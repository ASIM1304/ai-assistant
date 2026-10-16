const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");
const H = require("./helpers");
const { config } = require("../src/config/env");

let app;
before(async () => {
  await H.setupDb("auth");
  app = H.createApp();
});
after(H.teardownDb);

test("rejects weak passwords and explains why", async () => {
  for (const password of ["short1A!", "alllowercase123456", "Password1234!", "abcdefghijklmnop", "Aaaaaa1111!!!!"]) {
    const res = await H.request(app).post("/api/auth/register").send({ name: "Weak One", email: `w${Math.random()}@example.com`, password });
    assert.equal(res.status, 400, password);
    assert.equal(res.body.error.code, "WEAK_PASSWORD");
  }
});

test("register stores only a bcrypt hash, sets httpOnly cookie, never returns hash", async () => {
  const c = await H.registerCandidate(app, { email: "hash@example.com" });
  const raw = await H.models.User.findOne({ email: "hash@example.com" }).select("+passwordHash").lean();
  assert.match(raw.passwordHash, /^\$2[aby]\$/);
  assert.ok(!raw.passwordHash.includes(H.STRONG));
  const login = await H.request(app).post("/api/auth/login").send({ email: "hash@example.com", password: H.STRONG });
  assert.equal(login.status, 200);
  assert.ok(!JSON.stringify(login.body).includes("passwordHash"));
  assert.match(login.headers["set-cookie"][0], /HttpOnly/i);
  assert.equal(c.user.role, "candidate");
});

test("mass assignment: cannot register as admin", async () => {
  const res = await H.request(app).post("/api/auth/register").send({ name: "Evil", email: "evil@example.com", password: H.STRONG, role: "admin" });
  assert.equal(res.status, 400);
  assert.equal(await H.models.User.countDocuments({ email: "evil@example.com" }), 0);
});

test("NoSQL injection payloads at login are rejected", async () => {
  await H.registerCandidate(app, { email: "victim@example.com" });
  for (const body of [
    { email: { $ne: null }, password: { $ne: null } },
    { email: "victim@example.com", password: { $gt: "" } },
    { email: { $regex: ".*" }, password: "x" },
  ]) {
    const res = await H.request(app).post("/api/auth/login").send(body);
    assert.equal(res.status, 400);
    assert.ok(!res.headers["set-cookie"]);
  }
});

test("generic error for wrong password / unknown user", async () => {
  const a = await H.request(app).post("/api/auth/login").send({ email: "victim@example.com", password: "Wrong!Pass123" });
  const b = await H.request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "Wrong!Pass123" });
  assert.equal(a.status, 401);
  assert.equal(b.status, 401);
  assert.equal(a.body.error.message, b.body.error.message);
});

test("brute force: account locks after repeated failures, even for the right password", async () => {
  await H.registerCandidate(app, { email: "lock@example.com" });
  for (let i = 0; i < config.lockout.maxFailures; i++) {
    const r = await H.request(app).post("/api/auth/login").send({ email: "lock@example.com", password: "Wrong!Pass123" });
    assert.equal(r.status, 401);
  }
  const locked = await H.request(app).post("/api/auth/login").send({ email: "lock@example.com", password: H.STRONG });
  assert.equal(locked.status, 429);
  assert.equal(locked.body.error.code, "ACCOUNT_LOCKED");
});

test("login rate limiter returns 429 per IP", async () => {
  const limited = H.createApp({ rateLimits: { login: 3 } });
  const codes = [];
  for (let i = 0; i < 5; i++) codes.push((await H.request(limited).post("/api/auth/login").send({ email: "x@example.com", password: "Whatever!123" })).status);
  assert.deepEqual(codes.slice(0, 3), [401, 401, 401]);
  assert.deepEqual(codes.slice(3), [429, 429]);
});

test("protected routes need a session; tampered/forged JWTs are rejected", async () => {
  assert.equal((await H.request(app).get("/api/auth/me")).status, 401);
  assert.equal((await H.request(app).get("/api/interviews")).status, 401);
  const forged = jwt.sign({ sub: "64b000000000000000000000", jti: "x" }, "wrong-secret-wrong-secret-wrong-secret!");
  assert.equal((await H.request(app).get("/api/auth/me").set("Cookie", `sid=${forged}`)).status, 401);
  const none = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: "1", jti: "1" })).toString("base64url") + ".";
  assert.equal((await H.request(app).get("/api/auth/me").set("Cookie", `sid=${none}`)).status, 401);
  const noSession = jwt.sign({ sub: "64b000000000000000000000", jti: "nonexistent" }, config.jwtSecret);
  assert.equal((await H.request(app).get("/api/auth/me").set("Cookie", `sid=${noSession}`)).status, 401);
});

test("CSRF: state-changing request without the token is refused", async () => {
  const c = await H.registerCandidate(app);
  const no = await c.agent.post("/api/interviews").send({ jobRole: "react" }); // cookie, no header
  assert.equal(no.status, 403);
  assert.equal(no.body.error.code, "CSRF_INVALID");
  const bad = await c.agent.post("/api/interviews").set("X-CSRF-Token", "nope").send({ jobRole: "react" });
  assert.equal(bad.status, 403);
  const ok = await c.post("/api/interviews").send({ jobRole: "react" });
  assert.equal(ok.status, 201);
});

test("logout revokes the session server-side (old cookie is dead)", async () => {
  const c = await H.registerCandidate(app);
  const cookie = (await c.get("/api/auth/me")).request.header.Cookie || c.agent.jar.getCookies({ domain: "127.0.0.1", path: "/", secure: false, script: false })[0].toValueString();
  assert.equal((await c.post("/api/auth/logout")).status, 200);
  assert.equal((await H.request(app).get("/api/auth/me").set("Cookie", cookie)).status, 401);
});

test("session expires after idle timeout and absolute lifetime", async () => {
  const c = await H.registerCandidate(app);
  await H.models.Session.updateMany({ userId: c.user.id }, { $set: { lastSeenAt: new Date(Date.now() - (config.session.idleMinutes + 1) * 60_000) } });
  const r = await c.get("/api/auth/me");
  assert.equal(r.status, 401);
  assert.equal(r.body.error.code, "SESSION_EXPIRED");

  const c2 = await H.registerCandidate(app);
  await H.models.Session.updateMany({ userId: c2.user.id }, { $set: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await c2.get("/api/auth/me")).status, 401);
});

test("RBAC: candidate cannot reach admin API; admin can", async () => {
  const cand = await H.registerCandidate(app);
  for (const url of ["/api/admin/stats", "/api/admin/candidates", "/api/admin/settings", "/api/admin/interviews"]) {
    assert.equal((await cand.get(url)).status, 401, url); // candidate cookie is not an admin session
  }
  assert.equal((await cand.put("/api/admin/settings").send({ interview: { totalQuestions: 1 } })).status, 401);
  const admin = await H.createAdmin(app);
  assert.equal((await admin.get("/api/admin/stats")).status, 200);
});

test("password reset: token is single-use, revokes all sessions, unlocks account", async () => {
  const c = await H.registerCandidate(app, { email: "reset@example.com" });
  H.outbox.length = 0;
  const f = await H.request(app).post("/api/auth/forgot-password").send({ email: "reset@example.com" });
  assert.equal(f.status, 202);
  const unknown = await H.request(app).post("/api/auth/forgot-password").send({ email: "ghost@example.com" });
  assert.deepEqual(unknown.body, f.body); // no enumeration
  const token = H.outbox.at(-1).text.match(/token=([a-f0-9]+)/)[1];
  const weak = await H.request(app).post("/api/auth/reset-password").send({ token, password: "weak" });
  assert.equal(weak.status, 400);
  const NEW = "Brand-New#Pass99";
  assert.equal((await H.request(app).post("/api/auth/reset-password").send({ token, password: NEW })).status, 200);
  assert.equal((await H.request(app).post("/api/auth/reset-password").send({ token, password: NEW })).status, 400); // reused
  assert.equal((await c.get("/api/auth/me")).status, 401); // old session revoked
  assert.equal((await H.request(app).post("/api/auth/login").send({ email: "reset@example.com", password: NEW })).status, 200);
});

test("email verification gate", async () => {
  const prev = config.requireEmailVerification;
  config.requireEmailVerification = true;
  try {
    H.outbox.length = 0;
    const reg = await H.request(app).post("/api/auth/register").send({ name: "Verify Me", email: "verify@example.com", password: H.STRONG });
    assert.equal(reg.status, 202);
    assert.ok(!reg.headers["set-cookie"]);
    const dup = await H.request(app).post("/api/auth/register").send({ name: "Verify Me", email: "verify@example.com", password: H.STRONG });
    assert.deepEqual(dup.body, reg.body); // same answer for existing e-mail
    const blocked = await H.request(app).post("/api/auth/login").send({ email: "verify@example.com", password: H.STRONG });
    assert.equal(blocked.status, 403);
    assert.equal(blocked.body.error.code, "EMAIL_NOT_VERIFIED");
    const token = H.outbox.find((m) => /verify-email/.test(m.text)).text.match(/token=([a-f0-9]+)/)[1];
    assert.equal((await H.request(app).post("/api/auth/verify-email").send({ token })).status, 200);
    assert.equal((await H.request(app).post("/api/auth/login").send({ email: "verify@example.com", password: H.STRONG })).status, 200);
  } finally {
    config.requireEmailVerification = prev;
  }
});

test("change password keeps current session, kills the others", async () => {
  const c = await H.registerCandidate(app, { email: "chg@example.com" });
  const other = H.client(app);
  const l = await other.post("/api/auth/login").send({ email: "chg@example.com", password: H.STRONG });
  other.csrf = l.body.csrfToken;
  const r = await c.post("/api/auth/change-password").send({ currentPassword: H.STRONG, newPassword: "Another#Strong77" });
  assert.equal(r.status, 200);
  assert.equal((await c.get("/api/auth/me")).status, 200);
  assert.equal((await other.get("/api/auth/me")).status, 401);
});

test("admins and candidates are fully separate: collections, logins and sessions", async () => {
  const admin = await H.createAdmin(app);
  const cand = await H.registerCandidate(app, { email: "sep@example.com" });
  // separate collections
  assert.equal(await H.models.User.countDocuments({ email: admin.email }), 0);
  assert.equal(await H.models.Admin.countDocuments({ email: "sep@example.com" }), 0);
  // credentials don't cross over
  assert.equal((await H.request(app).post("/api/auth/login").send({ email: admin.email, password: H.STRONG })).status, 401);
  assert.equal((await H.request(app).post("/api/admin/auth/login").send({ email: "sep@example.com", password: H.STRONG })).status, 401);
  // sessions don't cross over
  assert.equal((await admin.get("/api/interviews")).status, 401); // admin cookie on candidate API
  assert.equal((await admin.get("/api/profile")).status, 401);
  assert.equal((await cand.get("/api/admin/stats")).status, 401); // candidate cookie on admin API
  assert.equal((await admin.get("/api/admin/stats")).status, 200);
  // cookie names differ and a candidate JWT can't be replayed as the admin cookie
  const candCookie = cand.agent.jar.getCookies({ domain: "127.0.0.1", path: "/", secure: false, script: false })[0].value;
  assert.equal((await H.request(app).get("/api/admin/stats").set("Cookie", `asid=${candCookie}`)).status, 401);
  // no way to register an admin; admin lockout works
  assert.equal((await H.request(app).post("/api/auth/register").send({ name: "Mal Lory", email: "mal@example.com", password: H.STRONG, role: "admin" })).status, 400);
  for (let i = 0; i < config.lockout.maxFailures; i++) await H.request(app).post("/api/admin/auth/login").send({ email: admin.email, password: "Wrong!Pass123" });
  assert.equal((await H.request(app).post("/api/admin/auth/login").send({ email: admin.email, password: H.STRONG })).status, 429);
  // admin logout revokes the admin session
  const admin2 = await H.createAdmin(app);
  assert.equal((await admin2.post("/api/admin/auth/logout")).status, 200);
  assert.equal((await admin2.get("/api/admin/stats")).status, 401);
});
