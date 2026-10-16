/** Text hygiene helpers used on every piece of user- or AI-supplied text. */

// Strip control characters (except \n and \t) and zero-width/bidi tricks.
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

function cleanText(input, max = 1000) {
  if (typeof input !== "string") return "";
  return input.replace(CONTROL, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

// Remove HTML tags - defence in depth for short profile fields. React escapes
// on output, but reports may be exported/e-mailed later.
function stripTags(input, max = 200) {
  return cleanText(input, max * 2).replace(/<[^>]*>/g, "").trim().slice(0, max);
}

/**
 * Prepare untrusted text for embedding between delimiter tags in an LLM prompt.
 * Neutralises any attempt to close/open our delimiter tags from inside the text.
 */
function forPrompt(input, max = 8000) {
  return cleanText(input, max).replace(/<\s*\/?\s*(candidate_answer|resume|candidate_context|question|job_description|previous_exchange|previous_questions|data)[^>]*>/gi, "[tag removed]");
}

const INJECTION_PATTERNS = [
  /ignore (all |any |the )?(previous|prior|above) (instructions|prompts?|rules)/i,
  /disregard (all |any |the )?(previous|prior|above)/i,
  /(give|assign|award) (me |this |the candidate )?(a )?(full|perfect|maximum|10\/10|100)/i,
  /you are now (a|an|the)\b/i,
  /system prompt/i,
  /reveal (your|the) (instructions|prompt)/i,
];
const looksLikePromptInjection = (text) => INJECTION_PATTERNS.some((re) => re.test(text || ""));

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);

const maskEmail = (email = "") => {
  const [local = "", domain = ""] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}${"*".repeat(Math.max(2, Math.min(local.length - 1, 6)))}@${domain}`;
};

const STOP = new Set("a an the of to in on for and or is are was were be been being with by at as that this it its from how what why when which do does did you your can could would should about into over between explain describe tell me us".split(" "));
// Minimal plural folding: closures->closure, queries->query, classes->class (not "process"->"proces").
function stem(t) {
  if (t.length <= 4) return t;
  if (/ies$/.test(t)) return t.replace(/ies$/, "y");
  if (/(ss|us|is)$/.test(t)) return t;
  if (/(sh|ch|x|z|s)es$/.test(t)) return t.replace(/es$/, "");
  return t.replace(/s$/, "");
}
const tokens = (s) =>
  new Set(
    String(s)
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((t) => t && !STOP.has(t) && t.length > 1)
      .map(stem),
  );
/** Jaccard similarity over content words, 0..1. */
function similarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  return inter / (A.size + B.size - inter);
}

const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
function bigrams(s) {
  const out = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) || 0) + 1);
  }
  return out;
}
/** Sorensen-Dice coefficient over character bigrams (catches re-worded / re-ordered text). */
function dice(a, b) {
  const A = bigrams(norm(a));
  const B = bigrams(norm(b));
  let inter = 0;
  let total = 0;
  for (const [g, c] of A) {
    inter += Math.min(c, B.get(g) || 0);
    total += c;
  }
  for (const c of B.values()) total += c;
  return total ? (2 * inter) / total : 0;
}
/**
 * "Is this question essentially one we already asked?" Two signals on content
 * words: Jaccard overlap and containment (one question's key terms inside the
 * other). No embeddings API is available, so this is LEXICAL: it catches
 * re-phrasings and re-orderings, not true paraphrases that use different words.
 * (A character-bigram signal was tried and rejected: it flagged different
 * topics written from the same sentence template.)
 */
function isSimilarQuestion(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return false;
  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;
  const jaccard = inter / (A.size + B.size - inter);
  const small = Math.min(A.size, B.size);
  if (jaccard >= 0.6) return true;
  if (small >= 3 && inter / small >= 0.85) return true;
  return false;
}

module.exports = { isSimilarQuestion, dice, cleanText, stripTags, forPrompt, looksLikePromptInjection, slugify, maskEmail, similarity };
