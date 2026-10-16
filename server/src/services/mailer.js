const nodemailer = require("nodemailer");
const { config } = require("../config/env");

let transport = null;
/** In tests (and dev without SMTP) messages are captured here instead of sent. */
const outbox = [];

function getTransport() {
  if (!config.smtp.host) return null;
  transport ??= nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
  return transport;
}

async function sendMail({ to, subject, text }) {
  const t = getTransport();
  if (!t) {
    outbox.push({ to, subject, text });
    if (outbox.length > 50) outbox.shift();
    if (!config.isProd && !config.isTest) console.log(`\n[mail:dev] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return;
  }
  try {
    await t.sendMail({ from: config.smtp.from, to, subject, text });
  } catch (err) {
    // Never surface mail errors (or addresses) to the requester.
    console.error("[mail] send failed:", err.code || err.message);
  }
}

module.exports = { sendMail, outbox };
