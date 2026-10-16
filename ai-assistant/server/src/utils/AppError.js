/** An error that is safe to show to the client (message + code). */
class AppError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.expose = true;
    this.extra = extra;
  }
}
const badRequest = (msg = "Invalid request", code = "BAD_REQUEST", extra) => new AppError(400, code, msg, extra);
const unauthorized = (msg = "Authentication required", code = "UNAUTHENTICATED") => new AppError(401, code, msg);
const forbidden = (msg = "You do not have permission to do that", code = "FORBIDDEN") => new AppError(403, code, msg);
const notFound = (msg = "Not found", code = "NOT_FOUND") => new AppError(404, code, msg);
const conflict = (msg, code = "CONFLICT", extra) => new AppError(409, code, msg, extra);
const tooMany = (msg = "Too many requests. Please try again later.", code = "RATE_LIMITED") => new AppError(429, code, msg);
const unavailable = (msg, code = "SERVICE_UNAVAILABLE", extra) => new AppError(503, code, msg, extra);

module.exports = { AppError, badRequest, unauthorized, forbidden, notFound, conflict, tooMany, unavailable };
