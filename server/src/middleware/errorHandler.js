const { ZodError } = require("zod");
const { config } = require("../config/env");
const { AppError } = require("../utils/AppError");

/**
 * One place that turns errors into responses. Known (AppError) errors expose
 * their message; everything else becomes a generic 500 with a request id -
 * never a stack trace, driver message or internal detail.
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  let status = 500;
  let code = "INTERNAL_ERROR";
  let message = "Something went wrong on our side. Please try again.";
  let extra = {};

  if (err instanceof AppError) {
    ({ status, code, message } = err);
    extra = err.extra || {};
  } else if (err instanceof ZodError) {
    status = 400;
    code = "VALIDATION_ERROR";
    message = "Validation failed";
    extra = { fields: err.issues.map((i) => ({ field: i.path.join("."), message: i.message })) };
  } else if (err?.type === "entity.too.large") {
    status = 413;
    code = "PAYLOAD_TOO_LARGE";
    message = "Request body is too large";
  } else if (err?.type === "entity.parse.failed" || err instanceof SyntaxError) {
    status = 400;
    code = "INVALID_JSON";
    message = "Malformed JSON body";
  } else if (err?.code === "LIMIT_FILE_SIZE") {
    status = 413;
    code = "FILE_TOO_LARGE";
    message = "File is too large (max 5 MB)";
  } else if (err?.name === "MulterError") {
    status = 400;
    code = "UPLOAD_ERROR";
    message = "Invalid upload";
  } else if (err?.code === 11000) {
    status = 409;
    code = "DUPLICATE";
    message = "That record already exists";
  } else if (err?.name === "CastError" || err?.name === "ValidationError") {
    status = 400;
    code = "INVALID_INPUT";
    message = "Invalid input";
  } else if (err?.message === "CORS_NOT_ALLOWED") {
    status = 403;
    code = "CORS_NOT_ALLOWED";
    message = "Origin not allowed";
  }

  if (status >= 500) {
    // Server-side only: full detail goes to logs, correlated by request id.
    console.error(JSON.stringify({ level: "error", requestId: req.id, method: req.method, path: req.path, name: err?.name, message: err?.message, stack: config.isProd ? undefined : err?.stack }));
  }
  if (res.headersSent) return;
  res.status(status).json({ error: { code, message, requestId: status >= 500 ? req.id : undefined, ...extra } });
}

const notFoundHandler = (req, res) => res.status(404).json({ error: { code: "NOT_FOUND", message: "Route not found" } });

module.exports = { errorHandler, notFoundHandler };
