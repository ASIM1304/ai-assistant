/** Shared toJSON transform: expose `id`, hide internals. */
function cleanJson(doc, ret) {
  ret.id = ret._id?.toString();
  delete ret._id;
  delete ret.__v;
  delete ret.passwordHash;
  return ret;
}
module.exports = { cleanJson, jsonOpts: { transform: cleanJson } };
