const { AuditLog } = require("../models");

/** Fire-and-forget: audit failures must never break the request. */
async function audit(actor, action, target = {}, meta) {
  try {
    await AuditLog.create({
      actorId: actor?._id || actor?.id,
      actorRole: actor?.role,
      action,
      targetType: target.type,
      targetId: target.id ? String(target.id) : undefined,
      meta,
    });
  } catch (err) {
    console.error("[audit] failed:", err.message);
  }
}

module.exports = { audit };
