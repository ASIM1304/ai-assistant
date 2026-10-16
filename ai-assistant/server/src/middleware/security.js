const { badRequest, AppError } = require("../utils/AppError");

/**
 * NoSQL-injection guard. Rejects any request whose body/query/params contain
 * keys that Mongo would interpret as operators ("$ne", "$gt", ...) or dotted
 * paths. (Zod type checks on every route are the primary defence; this is a
 * second layer that also protects routes that forget to validate.)
 */
function hasDangerousKey(value, depth = 0) {
  if (depth > 8 || value === null || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some((v) => hasDangerousKey(v, depth + 1));
  return Object.keys(value).some((k) => k.startsWith("$") || k.includes(".") || hasDangerousKey(value[k], depth + 1));
}

const noSqlGuard = (req, _res, next) => {
  if (hasDangerousKey(req.body) || hasDangerousKey(req.query) || hasDangerousKey(req.params))
    return next(badRequest("Invalid characters in request", "INVALID_INPUT"));
  next();
};

/** State-changing requests must be JSON (or multipart on the explicit upload route). */
const requireJsonBody = (req, _res, next) => {
  if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
    const len = Number(req.headers["content-length"] || 0);
    const type = req.headers["content-type"] || "";
    if (len > 0 && !/^application\/json\b/i.test(type) && !/^multipart\/form-data\b/i.test(type))
      return next(new AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Content-Type must be application/json"));
  }
  next();
};

module.exports = { noSqlGuard, requireJsonBody, hasDangerousKey };
