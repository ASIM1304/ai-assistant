const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const H = require("./helpers");

let app;
before(async () => {
  await H.setupDb("apisec");
  app = H.createApp();
});
after(H.teardownDb);

test("CORS: only allow-listed origins get CORS headers (never *)", async () => {
  const ok = await H.request(app).get("/healthz").set("Origin", "http://localhost:3000");
  assert.equal(ok.headers["access-control-allow-origin"], "http://localhost:3000");
  assert.equal(ok.headers["access-control-allow-credentials"], "true");
  const evil = await H.request(app).get("/healthz").set("Origin", "https://evil.example");
  assert.equal(evil.headers["access-control-allow-origin"], undefined);
  const pre = await H.request(app).options("/api/auth/login").set("Origin", "https://evil.example").set("Access-Control-Request-Method", "POST");
  assert.equal(pre.headers["access-control-allow-origin"], undefined);
});

test("secure headers are set and framework banner is hidden", async () => {
  const r = await H.request(app).get("/healthz");
  assert.equal(r.headers["x-powered-by"], undefined);
  assert.equal(r.headers["x-content-type-options"], "nosniff");
  assert.match(r.headers["content-security-policy"], /default-src 'none'/);
  assert.equal(r.headers["cache-control"], "no-store");
  assert.ok(r.headers["x-request-id"]);
});

test("oversized and malformed bodies are rejected cleanly", async () => {
  const big = await H.request(app).post("/api/auth/login").send({ email: "a@b.co", password: "x".repeat(200_000) });
  assert.equal(big.status, 413);
  const bad = await H.request(app).post("/api/auth/login").set("Content-Type", "application/json").send("{not json");
  assert.equal(bad.status, 400);
  assert.equal(bad.body.error.code, "INVALID_JSON");
  const form = await H.request(app).post("/api/auth/login").type("form").send("email=a@b.co&password=x");
  assert.equal(form.status, 415);
});

test("errors never leak internals; unknown routes return JSON 404", async () => {
  const c = await H.registerCandidate(app);
  const r = await c.get("/api/interviews/not-an-object-id");
  assert.equal(r.status, 400);
  assert.ok(!/CastError|stack|mongoose/i.test(JSON.stringify(r.body)));
  const nf = await H.request(app).get("/api/does-not-exist");
  assert.equal(nf.status, 404);
  assert.equal(nf.body.error.code, "NOT_FOUND");
});

test("unexpected server errors give a generic 500 with request id only", async () => {
  const c = await H.registerCandidate(app);
  const orig = H.models.Interview.find;
  H.models.Interview.find = () => {
    throw new Error("secret connection string mongodb://user:pass@host");
  };
  const origErr = console.error;
  console.error = () => {};
  try {
    const r = await c.get("/api/interviews");
    assert.equal(r.status, 500);
    assert.equal(r.body.error.code, "INTERNAL_ERROR");
    assert.ok(r.body.error.requestId);
    assert.ok(!JSON.stringify(r.body).includes("secret"));
  } finally {
    H.models.Interview.find = orig;
    console.error = origErr;
  }
});

test("query/path operator injection is rejected on other routes", async () => {
  const admin = await H.createAdmin(app);
  const r = await admin.get("/api/admin/candidates?search[$ne]=x");
  assert.equal(r.status, 400);
  const c = await H.registerCandidate(app);
  const r2 = await c.put("/api/profile").send({ name: { $set: { role: "admin" } } });
  assert.equal(r2.status, 400);
});
