import { describe, it, expect } from "vitest";
import {
  isFxConversion,
  computeSpreadQuote,
  buildRlusdPaymentTxjson,
} from "./walletSpread";

// ── isFxConversion ──────────────────────────────────────────

describe("isFxConversion", () => {
  it("returns true for fiat→fiat", () => {
    expect(isFxConversion("EUR", "USD")).toBe(true);
    expect(isFxConversion("GBP", "CHF")).toBe(true);
  });

  it("returns false when XRP is involved", () => {
    expect(isFxConversion("XRP", "EUR")).toBe(false);
    expect(isFxConversion("USD", "XRP")).toBe(false);
  });

  it("returns false when RLUSD is involved", () => {
    expect(isFxConversion("RLUSD", "EUR")).toBe(false);
    expect(isFxConversion("USD", "RLUSD")).toBe(false);
  });

  it("returns false for same currency", () => {
    expect(isFxConversion("EUR", "EUR")).toBe(false);
  });

  it("returns false for empty/null", () => {
    expect(isFxConversion("", "USD")).toBe(false);
    expect(isFxConversion(null, "EUR")).toBe(false);
    expect(isFxConversion("EUR", null)).toBe(false);
  });
});

// ── computeSpreadQuote ──────────────────────────────────────

describe("computeSpreadQuote", () => {
  it("computes 1% spread on fiat→fiat conversion", () => {
    const result = computeSpreadQuote({
      base: "EUR",
      quote: "USD",
      amountRlusd: 1000,
    });
    expect(result.isFx).toBe(true);
    expect(result.spreadFraction).toBe(0.01);
    expect(result.spreadFeeRlusd).toBe(10); // 1% of 1000
  });

  it("returns zero spread for non-FX pairs", () => {
    const result = computeSpreadQuote({
      base: "XRP",
      quote: "USD",
      amountRlusd: 500,
    });
    expect(result.isFx).toBe(false);
    expect(result.spreadFeeRlusd).toBe(0);
  });

  it("returns zero spread for RLUSD pairs", () => {
    const result = computeSpreadQuote({
      base: "RLUSD",
      quote: "EUR",
      amountRlusd: 500,
    });
    expect(result.isFx).toBe(false);
    expect(result.spreadFeeRlusd).toBe(0);
  });

  it("handles invalid/zero amounts", () => {
    expect(
      computeSpreadQuote({ base: "EUR", quote: "GBP", amountRlusd: 0 })
        .spreadFeeRlusd,
    ).toBe(0);
    expect(
      computeSpreadQuote({ base: "EUR", quote: "GBP", amountRlusd: -10 })
        .spreadFeeRlusd,
    ).toBe(0);
    expect(
      computeSpreadQuote({ base: "EUR", quote: "GBP", amountRlusd: NaN })
        .spreadFeeRlusd,
    ).toBe(0);
  });
});

// ── buildRlusdPaymentTxjson ─────────────────────────────────

describe("buildRlusdPaymentTxjson", () => {
  it("builds a valid Payment txjson", () => {
    const tx = buildRlusdPaymentTxjson({
      account: "rSender111",
      destination: "rReceiver222",
      amountRlusd: 50.123,
    });
    expect(tx).not.toBeNull();
    expect(tx.TransactionType).toBe("Payment");
    expect(tx.Account).toBe("rSender111");
    expect(tx.Destination).toBe("rReceiver222");
    expect(tx.Amount.currency).toBeTruthy();
    expect(tx.Amount.issuer).toBeTruthy();
    expect(parseFloat(tx.Amount.value)).toBeCloseTo(50.123, 3);
  });

  it("trims trailing zeros from value", () => {
    const tx = buildRlusdPaymentTxjson({
      account: "rA",
      destination: "rB",
      amountRlusd: 10,
    });
    expect(tx.Amount.value).toBe("10");
    expect(tx.Amount.value).not.toContain(".00");
  });

  it("returns null for zero/negative/NaN amount", () => {
    expect(
      buildRlusdPaymentTxjson({ account: "rA", destination: "rB", amountRlusd: 0 }),
    ).toBeNull();
    expect(
      buildRlusdPaymentTxjson({ account: "rA", destination: "rB", amountRlusd: -5 }),
    ).toBeNull();
    expect(
      buildRlusdPaymentTxjson({ account: "rA", destination: "rB", amountRlusd: NaN }),
    ).toBeNull();
  });
});
