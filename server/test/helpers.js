process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-test-secret-test-secret-123456";
process.env.CORS_ORIGINS = "http://localhost:3000";
process.env.MONGO_URI = process.env.TEST_MONGO_URI || "mongodb://127.0.0.1:27017";
process.env.GROQ_API_KEY = ""; // real AI is never reachable from tests

const mongoose = require("mongoose");
const request = require("supertest");
const { createApp } = require("../src/app");
const ai = require("../src/services/ai");
const models = require("../src/models");
const { ensureDefaults } = require("../src/services/defaults");
const { clearSettingsCache } = require("../src/services/settings");
const { hashPassword } = require("../src/services/passwords");
const { outbox } = require("../src/services/mailer");

const STRONG = "Str0ng!Passphrase#1";
let counter = 0;

async function setupDb(name) {
  await mongoose.connect(process.env.MONGO_URI, { dbName: `aiint_${name}_${process.pid}`, serverSelectionTimeoutMS: 5000 });
  await mongoose.connection.dropDatabase();
  await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  clearSettingsCache();
  await ensureDefaults();
}
async function teardownDb() {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
}

/**
 * Fake LLM. Behaviour is controlled by markers in the candidate's answer:
 *   EXCELLENT -> 9s,  POOR -> 2s,  anything else -> 6s.
 */
const fake = {
  confidence: 0.9,
  fail: { evaluate: 0, question: false, report: false }, // evaluate: number of upcoming failures
  calls: { evaluate: 0, question: 0, report: 0 },
  questionText: null, // override to force duplicates
  seq: 0,
  prompts: [],
  evalPrompts: [],
  reset() {
    this.prompts = [];
    this.evalPrompts = [];
    this.fail = { evaluate: 0, question: false, report: false };
    this.calls = { evaluate: 0, question: 0, report: 0 };
    this.questionText = null;
    this.confidence = 0.9;
    this.seq = 0;
  },
};
const fakeChat = async ({ kind, user }) => {
  if (kind === "question") {
    fake.calls.question++;
    if (fake.fail.question) throw new Error("provider down");
    fake.prompts.push(user);
    const n = ++fake.seq;
    const A = ["resilient", "scalable", "stateless", "cached", "encrypted", "observable", "modular", "asynchronous", "idempotent", "sharded", "versioned", "audited", "streaming", "batched", "replicated", "throttled"];
    const B = ["gateway", "scheduler", "pipeline", "registry", "dashboard", "compiler", "broker", "parser", "optimizer", "validator", "renderer", "indexer", "balancer", "collector", "migrator", "notifier"];
    const C = ["warehouse analytics", "mobile payments", "game servers", "hospital records", "ticket booking", "chat messaging", "logistics tracking", "video uploads", "fraud detection", "classroom grading", "weather alerts", "inventory sync", "podcast hosting", "energy billing", "library lending", "retail checkout"];
    const D = ["failure handling", "data modelling", "security controls", "testing strategy", "deployment steps", "cost limits", "monitoring signals", "rollback plans", "schema changes", "capacity planning", "access rules", "latency budgets", "backup routines", "audit trails", "user feedback", "error budgets"];
    let text = fake.questionText || `Describe a ${A[n % 16]} ${B[(n * 5) % 16]} you would build for ${C[(n * 7) % 16]}, including ${D[(n * 3) % 16]}.`;
    if (!fake.questionText && /<previous_exchange>/.test(user)) text = `Regarding your last point, which specific ${D[(n * 11) % 16]} detail would you reconsider for ${C[(n * 3) % 16]}?`;
    return JSON.stringify({ question: text, category: "Fundamentals" });
  }
  if (kind === "evaluate") {
    fake.calls.evaluate++;
    if (fake.fail.evaluate > 0) {
      fake.fail.evaluate--;
      throw new Error("provider down");
    }
    fake.evalPrompts.push(user);
    const v = /EXCELLENT/.test(user) ? 9 : /POOR/.test(user) ? 2 : 6;
    const s = { technicalKnowledge: v, accuracy: v, relevance: v, problemSolving: v, communication: v, clarity: v, completeness: v };
    const answer = (user.match(/<candidate_answer>\n([\s\S]*?)\n<\/candidate_answer>/) || [])[1] || "";
    const quote = answer.split(/\s+/).slice(0, 4).join(" ");
    return JSON.stringify({ scores: s, explanations: { technicalKnowledge: "Shows a basic grasp.", bogusKey: "dropped" }, feedback: `Assessment feedback (${v}/10 level).`, strengths: ["clear"], improvements: ["more depth"], suggestions: ["Practise more"], modelAnswer: "A strong answer would cover the key trade-offs.", evidence: [quote, "this exact sentence was never said by the candidate"], confidence: fake.confidence });
  }
  if (kind === "report") {
    fake.calls.report++;
    if (fake.fail.report) throw new Error("provider down");
    return JSON.stringify({ summary: "AI summary.", strengths: ["Good fundamentals"], weaknesses: ["Needs depth"], recommendations: ["Practise more"], practicePlan: [{ focus: "System design", why: "Lowest category", actions: ["Design one system per week", "Review trade-offs"] }] });
  }
  if (kind === "job") return JSON.stringify({ title: "Backend Engineer", seniority: "mid", requiredSkills: ["JavaScript", "Kubernetes", "PostgreSQL", "Docker"], niceToHave: ["Go"], responsibilities: ["Build APIs", "Operate services"] });
  if (kind === "resume")
    return JSON.stringify({ summary: "A developer.", experienceLevel: "Mid", yearsOfExperience: 5, technologies: ["JavaScript", "Node.js", "Docker"], projects: [{ name: "Shop API", description: "REST backend", technologies: ["Node.js"] }], skillsDetected: ["JavaScript", "Node"], strengths: ["a", "b", "c"], recommendedDomains: [{ label: "React", reason: "fits", confidence: 80 }, { label: "Not A Real Domain", reason: "x", confidence: 99 }] });
  throw new Error("unknown kind");
};
ai._setChat(fakeChat);

/** An agent that remembers the session cookie and automatically sends the CSRF header. */
function client(app) {
  const agent = request.agent(app);
  const c = { agent, csrf: null, user: null };
  for (const m of ["get", "post", "put", "patch", "delete"]) {
    c[m] = (url) => {
      const t = agent[m](url);
      if (c.csrf && m !== "get") t.set("X-CSRF-Token", c.csrf);
      return t;
    };
  }
  return c;
}

async function registerCandidate(app, overrides = {}) {
  const c = client(app);
  const email = overrides.email || `cand${++counter}_${Date.now()}@example.com`;
  const res = await c.post("/api/auth/register").send({ name: overrides.name || "Test Candidate", email, password: overrides.password || STRONG });
  if (res.status !== 201) throw new Error("register failed: " + JSON.stringify(res.body));
  c.csrf = res.body.csrfToken;
  c.user = res.body.user;
  c.email = email;
  return c;
}

async function createAdmin(app) {
  const email = `admin${++counter}_${Date.now()}@example.com`;
  await models.Admin.create({ name: "Admin", email, passwordHash: await hashPassword(STRONG) });
  const c = client(app);
  const res = await c.post("/api/admin/auth/login").send({ email, password: STRONG });
  if (res.status !== 200) throw new Error("admin login failed " + JSON.stringify(res.body));
  c.csrf = res.body.csrfToken;
  c.user = res.body.admin;
  c.email = email;
  return c;
}

const CONSENT = { privacyVersion: require("../src/services/privacy").PRIVACY_VERSION, privacyAccepted: true, identityConfirmed: true, cameraConsent: true, microphoneConsent: true };

/** create -> consent -> start. Returns { id, state }. */
async function startInterview(c, jobRole = "react") {
  const created = await c.post("/api/interviews").send({ jobRole });
  if (created.status !== 201) throw new Error("create failed " + JSON.stringify(created.body));
  const id = created.body.interview.id;
  const consent = await c.post(`/api/interviews/${id}/consent`).send(CONSENT);
  if (consent.status !== 200) throw new Error("consent failed " + JSON.stringify(consent.body));
  const started = await c.post(`/api/interviews/${id}/start`).send({ verification: { faceDetected: true, voiceChecked: true } });
  if (started.status !== 200) throw new Error("start failed " + JSON.stringify(started.body));
  return { id, state: started.body };
}

const answer = (c, id, qid, text = "A reasonably detailed answer that is long enough to pass.") => c.post(`/api/interviews/${id}/answer`).send({ questionId: qid, answer: text });

module.exports = { fakeChat, request, mongoose, models, createApp, setupDb, teardownDb, fake, ai, client, registerCandidate, createAdmin, startInterview, answer, CONSENT, STRONG, outbox, clearSettingsCache };
