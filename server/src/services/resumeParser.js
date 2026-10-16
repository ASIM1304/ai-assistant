const { badRequest } = require("../utils/AppError");

let pdfjsPromise;
const PDF_MAX_PAGES = 15;
const TEXT_CAP = 20000;
const PARSE_TIMEOUT_MS = 15000;

function sniff(buf) {
  if (buf.length >= 5 && buf.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";
  if (buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4b && buf[2] === 0x03 && buf[3] === 0x04) return "zip"; // docx/odt/zip
  if (buf.length >= 8 && buf[0] === 0xd0 && buf[1] === 0xcf && buf[2] === 0x11 && buf[3] === 0xe0) return "ole"; // legacy .doc
  if (buf.includes(0x00)) return "binary";
  return "text";
}

async function pdfToText(buffer) {
  pdfjsPromise ??= import("pdfjs-dist/legacy/build/pdf.mjs"); // ESM-only package; CommonJS loads it dynamically
  const pdfjs = await pdfjsPromise;
  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  });
  const work = (async () => {
    const pdf = await task.promise;
    let out = "";
    const pages = Math.min(pdf.numPages, PDF_MAX_PAGES);
    for (let i = 1; i <= pages && out.length < TEXT_CAP; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      out += content.items.map((it) => it.str).join(" ") + "\n";
    }
    return out;
  })();
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => rej(new Error("pdf-timeout")), PARSE_TIMEOUT_MS);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
    task.destroy().catch(() => {});
  }
}

/**
 * The declared MIME type comes from the client and is NOT trusted: we look at
 * the actual bytes. Supported: PDF and plain text. (The previous version
 * accepted .docx but decoded it as UTF-8, producing garbage.)
 */
async function extractResumeText(file) {
  const kind = sniff(file.buffer);
  if (kind === "zip" || kind === "ole")
    throw badRequest("Word documents aren't supported. Please export your resume as a PDF or plain-text file.", "UNSUPPORTED_FILE");
  if (kind === "binary") throw badRequest("Unsupported file. Upload a PDF or plain-text resume.", "UNSUPPORTED_FILE");

  let text;
  if (kind === "pdf") {
    try {
      text = await pdfToText(file.buffer);
    } catch {
      throw badRequest("Could not read that PDF. It may be corrupted, encrypted or image-only.", "UNREADABLE_FILE");
    }
  } else {
    text = file.buffer.toString("utf8");
  }
  text = text.replace(/\s+/g, " ").trim().slice(0, TEXT_CAP);
  if (text.length < 50) throw badRequest("Couldn't extract enough text from the resume (image-only PDFs are not supported).", "UNREADABLE_FILE");
  return text;
}

module.exports = { extractResumeText, sniff };
