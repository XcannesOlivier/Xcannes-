import { describe, it, expect } from "vitest";
import {
  isAcceptedOnChainToken,
  normalizeMovementKind,
  resolveIncomingXrpAmount,
} from "./movementUtils";

// ── isAcceptedOnChainToken ────────────────────────────────────

describe("isAcceptedOnChainToken", () => {
  it("returns true for RLUSD (uppercase)", () => {
    expect(isAcceptedOnChainToken("RLUSD")).toBe(true);
  });

  it("returns true for rlusd (lowercase)", () => {
    expect(isAcceptedOnChainToken("rlusd")).toBe(true);
  });

  it("returns false for unknown tokens", () => {
    expect(isAcceptedOnChainToken("DOGE")).toBe(false);
    expect(isAcceptedOnChainToken("BTC")).toBe(false);
    expect(isAcceptedOnChainToken("XRP")).toBe(false);
  });

  it("returns false for null / undefined / empty", () => {
    expect(isAcceptedOnChainToken(null)).toBe(false);
    expect(isAcceptedOnChainToken(undefined)).toBe(false);
    expect(isAcceptedOnChainToken("")).toBe(false);
  });
});

// ── normalizeMovementKind ─────────────────────────────────────

describe("normalizeMovementKind", () => {
  it("uppercases and trims the value", () => {
    expect(normalizeMovementKind("payment_out")).toBe("PAYMENT_OUT");
    expect(normalizeMovementKind("  conversion  ")).toBe("CONVERSION");
  });

  it("returns empty string for null / undefined / empty", () => {
    expect(normalizeMovementKind(null)).toBe("");
    expect(normalizeMovementKind(undefined)).toBe("");
    expect(normalizeMovementKind("")).toBe("");
  });

  it("preserves already-normalised values unchanged", () => {
    expect(normalizeMovementKind("PAYMENT_IN")).toBe("PAYMENT_IN");
    expect(normalizeMovementKind("XRPL_PAYMENT_OUT")).toBe("XRPL_PAYMENT_OUT");
  });
});

// ── resolveIncomingXrpAmount ──────────────────────────────────

describe("resolveIncomingXrpAmount", () => {
  it("returns displayAmount when positive", () => {
    expect(resolveIncomingXrpAmount({ displayAmount: 10.5 })).toBe(10.5);
  });

  it("falls back to amountXrp when displayAmount is missing", () => {
    expect(resolveIncomingXrpAmount({ amountXrp: 7.2 })).toBe(7.2);
  });

  it("falls back to amount when amountXrp is missing", () => {
    expect(resolveIncomingXrpAmount({ amount: 3.1 })).toBe(3.1);
  });

  it("computes from amountRlusd / fxRate when all direct fields are missing", () => {
    const result = resolveIncomingXrpAmount({ amountRlusd: 100, fxRate: 2 });
    expect(result).toBeCloseTo(50, 5);
  });

  it("returns NaN when nothing is resolvable", () => {
    expect(resolveIncomingXrpAmount({})).toBeNaN();
    expect(resolveIncomingXrpAmount(null)).toBeNaN();
    expect(resolveIncomingXrpAmount(undefined)).toBeNaN();
  });

  it("ignores non-positive displayAmount and falls back", () => {
    expect(resolveIncomingXrpAmount({ displayAmount: 0, amountXrp: 5 })).toBe(5);
    expect(resolveIncomingXrpAmount({ displayAmount: -1, amountXrp: 5 })).toBe(5);
  });

  it("ignores non-finite fxRate", () => {
    expect(resolveIncomingXrpAmount({ amountRlusd: 100, fxRate: 0 })).toBeNaN();
    expect(resolveIncomingXrpAmount({ amountRlusd: 100, fxRate: -1 })).toBeNaN();
  });
});
