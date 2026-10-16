const { z } = require("zod");
const mongoose = require("mongoose");
const { badRequest } = require("./AppError");

/**
 * Validation middleware. Schemas should be .strict() so unknown fields
 * (e.g. `role`, `score`, `status`, `questionsAnswered`) are rejected instead of
 * silently ignored - this is our mass-assignment / tampering defence.
 * Parsed values are exposed on req.valid.{body,query,params} (Express 5 makes
 * req.query read-only, so we never write back to req).
 */
function validate(schemas) {
  return (req, _res, next) => {
    req.valid = req.valid || {};
    for (const key of ["params", "query", "body"]) {
      if (!schemas[key]) continue;
      const source = key === "body" ? (req.body ?? {}) : req[key];
      const result = schemas[key].safeParse(source);
      if (!result.success) {
        const fields = result.error.issues.map((i) => ({
          field: i.path.join(".") || "(root)",
          message: i.message,
        }));
        return next(badRequest("Validation failed", "VALIDATION_ERROR", { fields }));
      }
      req.valid[key] = result.data;
    }
    next();
  };
}

const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i, "Invalid id")
  .refine((v) => mongoose.isValidObjectId(v), "Invalid id");
const idParams = z.object({ id: objectId }).strict();

module.exports = { validate, objectId, idParams, z };
