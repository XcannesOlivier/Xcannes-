import { describe, it, expect } from "vitest";
import {
  getDisplayCurrencyCode,
  formatAmountWithSymbol,
  getCurrencyFlag,
  getTokenIcon,
  validateWalletLabel,
  USD_STABLECOINS,
  WALLET_ACCEPTED_TOKENS,
} from "./walletDashboardConfig";

// ── getDisplayCurrencyCode ──────────────────────────────────

describe("getDisplayCurrencyCode", () => {
  it("maps RLUSD → USD", () => {
    expect(getDisplayCurrencyCode("RLUSD")).toBe("USD");
    expect(getDisplayCurrencyCode("rlusd")).toBe("USD");
  });

  it("returns uppercase for other codes", () => {
    expect(getDisplayCurrencyCode("eur")).toBe("EUR");
    expect(getDisplayCurrencyCode("XRP")).toBe("XRP");
  });

  it("handles null/empty", () => {
    expect(getDisplayCurrencyCode("")).toBe("");
    expect(getDisplayCurrencyCode(null)).toBe("");
    expect(getDisplayCurrencyCode(undefined)).toBe("");
  });
});

// ── formatAmountWithSymbol ──────────────────────────────────

describe("formatAmountWithSymbol", () => {
  it("formats a standard amount with currency symbol", () => {
    const result = formatAmountWithSymbol("en", 1234.56, "USD");
    expect(result).toContain("1,234.56");
    expect(result).toContain("$");
  });

  it("returns dash for non-finite amounts", () => {
    expect(formatAmountWithSymbol("en", NaN, "USD")).toBe("-");
    expect(formatAmountWithSymbol("en", Infinity, "EUR")).toBe("-");
    expect(formatAmountWithSymbol("en", "not-a-number", "GBP")).toBe("-");
  });

  it("formats zero", () => {
    const result = formatAmountWithSymbol("en", 0, "EUR");
    expect(result).toContain("0.00");
  });

  it("respects fraction digits options", () => {
    const result = formatAmountWithSymbol("en", 100, "CHF", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
    expect(result).not.toContain(".");
  });
});

// ── getCurrencyFlag ─────────────────────────────────────────

describe("getCurrencyFlag", () => {
  it("returns override for EUR", () => {
    expect(getCurrencyFlag("EUR")).toBe("🇪🇺");
  });

  it("returns override for XAF/XOF", () => {
    expect(getCurrencyFlag("XAF")).toBe("🌍");
    expect(getCurrencyFlag("XOF")).toBe("🌍");
  });

  it("returns flag emoji for standard currency", () => {
    const flag = getCurrencyFlag("USD");
    expect(flag).toBeTruthy();
    expect(flag).not.toBe("🏳️");
  });

  it("returns fallback for empty/null", () => {
    expect(getCurrencyFlag("")).toBe("🏳️");
    expect(getCurrencyFlag(null)).toBe("🏳️");
  });
});

// ── getTokenIcon ────────────────────────────────────────────

describe("getTokenIcon", () => {
  it("returns flag for RLUSD/USD", () => {
    const icon = getTokenIcon("RLUSD");
    expect(icon).toBeTruthy();
  });

  it("returns ✕ for XRP", () => {
    expect(getTokenIcon("XRP")).toBe("✕");
  });

  it("returns first letter for unknown tokens", () => {
    expect(getTokenIcon("BTC")).toBe("B");
  });

  it("returns ? for empty", () => {
    expect(getTokenIcon("")).toBe("?");
  });
});

// ── validateWalletLabel ─────────────────────────────────────

describe("validateWalletLabel", () => {
  it("accepts 1 word, ≤7 letters", () => {
    expect(validateWalletLabel("Alice")).toBe(true);
    expect(validateWalletLabel("ABCDEFG")).toBe(true);
  });

  it("accepts 2 words, each ≤7 letters", () => {
    expect(validateWalletLabel("Mon Wallet")).toBe(true);
  });

  it("rejects 3+ words", () => {
    expect(validateWalletLabel("Un Deux Trois")).toBe(false);
  });

  it("rejects word >7 chars", () => {
    expect(validateWalletLabel("ABCDEFGH")).toBe(false);
  });

  it("rejects numbers/special chars", () => {
    expect(validateWalletLabel("Test123")).toBe(false);
    expect(validateWalletLabel("Hello!")).toBe(false);
  });

  it("rejects empty/null", () => {
    expect(validateWalletLabel("")).toBe(false);
    expect(validateWalletLabel(null)).toBe(false);
    expect(validateWalletLabel("   ")).toBe(false);
  });
});

// ── Constants ───────────────────────────────────────────────

describe("constants", () => {
  it("USD_STABLECOINS includes RLUSD and USD", () => {
    expect(USD_STABLECOINS).toContain("RLUSD");
    expect(USD_STABLECOINS).toContain("USD");
  });

  it("WALLET_ACCEPTED_TOKENS contains RLUSD", () => {
    expect(WALLET_ACCEPTED_TOKENS.has("RLUSD")).toBe(true);
  });

  it("WALLET_ACCEPTED_TOKENS does not contain arbitrary tokens", () => {
    expect(WALLET_ACCEPTED_TOKENS.has("DOGE")).toBe(false);
  });
});
