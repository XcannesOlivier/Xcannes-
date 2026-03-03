/**
 * demoXrplMemo — demo-only payment-request schema & helpers.
 *
 * Uses a distinct schema ("xcannes-demo-payreq-v1") and QR prefix
 * ("xcannes-demo:") so demo QR codes are NOT accepted by the real wallet.
 */

export const DEMO_PAYREQ_SCHEMA = "xcannes-demo-payreq-v1";
const DEMO_QR_PREFIX = "xcannes-demo:";

/** Build a minimal demo payment-request object. */
export function buildDemoPayreq({ to, currency, amount, beneficiary }) {
  return {
    schema: DEMO_PAYREQ_SCHEMA,
    to: String(to || "").trim(),
    ccy: String(currency || "").trim().toUpperCase(),
    amt: amount != null ? Number(amount) : null,
    b: beneficiary ? String(beneficiary).trim() : null,
  };
}

/** Encode a payreq object into a demo QR string. */
export function encodeDemoPayreqQR(payreq) {
  if (!payreq) return "";
  const compact = { ...payreq };
  Object.keys(compact).forEach((k) => {
    if (compact[k] == null || compact[k] === "") delete compact[k];
  });
  const json = JSON.stringify(compact);
  const b64 = typeof Buffer !== "undefined"
    ? Buffer.from(json, "utf8").toString("base64")
    : btoa(json);
  return DEMO_QR_PREFIX + b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

/** Decode a demo QR string back to a payreq object (or null). */
export function decodeDemoPayreqQR(raw) {
  const str = String(raw || "").trim();
  if (!str.startsWith(DEMO_QR_PREFIX)) return null;
  const payload = str.slice(DEMO_QR_PREFIX.length);
  try {
    const padded = payload.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((payload.length + 3) % 4);
    const json = typeof Buffer !== "undefined"
      ? Buffer.from(padded, "base64").toString("utf8")
      : atob(padded);
    const obj = JSON.parse(json);
    if (obj && typeof obj === "object" && obj.to) return obj;
  } catch { /* invalid */ }
  return null;
}
