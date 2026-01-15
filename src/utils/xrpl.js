import { Buffer } from "buffer";

export const pairToBackendFormat = (pair) => pair.replace("/", "_");

const RLUSD_ISSUER = (process.env.NEXT_PUBLIC_RLUSD_ISSUER || "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De").trim();
const XCS_ISSUER = (process.env.NEXT_PUBLIC_XCS_ISSUER || "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx").trim();

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

export const XRPL_KNOWN_ISSUERS = {
  RLUSD: RLUSD_ISSUER,
  XCS: XCS_ISSUER,
};
