/**
 * Resume <-> job-description matching. Deterministic and conservative:
 * a skill only counts as "matched" if it literally appears (after alias
 * normalisation) in BOTH lists. Nothing is inferred or assumed.
 */
const ALIASES = {
  js: "javascript", "node.js": "node", nodejs: "node", "react.js": "react", reactjs: "react", ts: "typescript",
  "next.js": "nextjs", "vue.js": "vue", postgres: "postgresql", mongo: "mongodb", k8s: "kubernetes", "c++": "cpp", "c#": "csharp", golang: "go",
  "amazon web services": "aws", "machine learning": "ml", "artificial intelligence": "ai",
};

const canon = (s) => {
  const k = String(s).toLowerCase().trim().replace(/\s+/g, " ");
  return ALIASES[k] || k.replace(/[^a-z0-9+#. ]/g, "").replace(/\.js$/, "").trim();
};

function matchSkills(resumeSkills = [], requiredSkills = []) {
  const have = new Map(resumeSkills.map((s) => [canon(s), s]));
  const matched = [];
  const missing = [];
  for (const req of requiredSkills) {
    const c = canon(req);
    if (!c) continue;
    if (have.has(c)) matched.push(req);
    else missing.push(req);
  }
  const required = new Set(requiredSkills.map(canon));
  const extra = resumeSkills.filter((s) => !required.has(canon(s))).slice(0, 15);
  const total = matched.length + missing.length;
  return { matched, missing, extra, matchPercent: total ? Math.round((matched.length / total) * 100) : null };
}

module.exports = { matchSkills, canon };
