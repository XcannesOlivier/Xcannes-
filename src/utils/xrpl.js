import { Buffer } from "buffer";

const RLUSD_ISSUER = (process.env.NEXT_PUBLIC_RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De").trim();

export function encodeXrplCurrencyCode(currency = "") {
  const code = String(currency || "").toUpperCase();
  if (!code) return "";
  if (code === "XRP") return "XRP";
  if (code.length > 3) {
    return Buffer.from(code, "utf8")
      .toString("hex")
      .toUpperCase()
      .padEnd(40, "0");
  }
  return code;
}

export function decodeXrplCurrencyCode(currency = "") {
  const raw = String(currency || "").trim();
  if (!raw) return "";
  if (!/^[0-9A-Fa-f]{40}$/.test(raw)) return raw.toUpperCase();
  try {
    const decoded = Buffer.from(raw, "hex").toString("utf8").replace(/\0+$/g, "");
    if (!decoded) return raw.toUpperCase();
    if (!/^[\x20-\x7E]+$/.test(decoded)) return raw.toUpperCase();
    return decoded.trim().toUpperCase();
  } catch {
    return raw.toUpperCase();
  }
}

export const XRPL_KNOWN_ISSUERS = {
  RLUSD: RLUSD_ISSUER,
};
