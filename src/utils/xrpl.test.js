import { describe, it, expect } from "vitest";
import {
  encodeXrplCurrencyCode,
  decodeXrplCurrencyCode,
  XRPL_KNOWN_ISSUERS,
} from "./xrpl";

// ── encodeXrplCurrencyCode ──────────────────────────────────

describe("encodeXrplCurrencyCode", () => {
  it("returns XRP for XRP", () => {
    expect(encodeXrplCurrencyCode("XRP")).toBe("XRP");
    expect(encodeXrplCurrencyCode("xrp")).toBe("XRP");
  });

  it("returns 3-char codes uppercased", () => {
    expect(encodeXrplCurrencyCode("USD")).toBe("USD");
    expect(encodeXrplCurrencyCode("eur")).toBe("EUR");
  });

  it("encodes >3 char codes as 40-char hex padded", () => {
    const encoded = encodeXrplCurrencyCode("RLUSD");
    expect(encoded).toHaveLength(40);
    expect(/^[0-9A-F]+$/.test(encoded)).toBe(true);
  });

  it("returns empty for empty/null", () => {
    expect(encodeXrplCurrencyCode("")).toBe("");
    expect(encodeXrplCurrencyCode(null)).toBe("");
    expect(encodeXrplCurrencyCode()).toBe("");
  });
});

// ── decodeXrplCurrencyCode ──────────────────────────────────

describe("decodeXrplCurrencyCode", () => {
  it("returns short codes unchanged (uppercased)", () => {
    expect(decodeXrplCurrencyCode("USD")).toBe("USD");
    expect(decodeXrplCurrencyCode("eur")).toBe("EUR");
  });

  it("decodes a 40-char hex-encoded currency", () => {
    // Encode RLUSD then decode it back
    const hex = encodeXrplCurrencyCode("RLUSD");
    expect(decodeXrplCurrencyCode(hex)).toBe("RLUSD");
  });

  it("returns uppercase hex if decode yields non-printable", () => {
    // 40 zeros = null bytes → should return the hex itself
    const allZeros = "0000000000000000000000000000000000000000";
    const result = decodeXrplCurrencyCode(allZeros);
    expect(result).toBe(allZeros.toUpperCase());
  });

  it("returns empty for empty/null", () => {
    expect(decodeXrplCurrencyCode("")).toBe("");
    expect(decodeXrplCurrencyCode(null)).toBe("");
  });
});

// ── XRPL_KNOWN_ISSUERS ─────────────────────────────────────

describe("XRPL_KNOWN_ISSUERS", () => {
  it("has RLUSD issuer defined", () => {
    expect(XRPL_KNOWN_ISSUERS.RLUSD).toBeTruthy();
    expect(XRPL_KNOWN_ISSUERS.RLUSD).toMatch(/^r[a-zA-Z0-9]+$/);
  });
});
