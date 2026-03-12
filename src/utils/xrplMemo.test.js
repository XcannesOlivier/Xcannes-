import { describe, it, expect } from "vitest";
import { buildXrplJsonMemo } from "./xrplMemo";
import {
  buildWalletLabelMemo,
  buildConversionMemo,
  buildPayreqMemo,
} from "./xcannesMemoSchemas";

// ── buildXrplJsonMemo ───────────────────────────────────────

describe("buildXrplJsonMemo", () => {
  it("wraps a valid payload into XRPL Memo array", () => {
    const payload = buildWalletLabelMemo({ label: "Alice" });
    const memos = buildXrplJsonMemo(payload);

    expect(memos).toBeInstanceOf(Array);
    expect(memos).toHaveLength(1);
    expect(memos[0].Memo).toBeDefined();
    expect(memos[0].Memo.MemoData).toBeTruthy();
    expect(memos[0].Memo.MemoType).toBeTruthy();
    expect(memos[0].Memo.MemoFormat).toBeTruthy();
  });

  it("hex-encodes MemoData as uppercase hex", () => {
    const payload = buildWalletLabelMemo({ label: "Test" });
    const memos = buildXrplJsonMemo(payload);
    expect(/^[0-9A-F]+$/.test(memos[0].Memo.MemoData)).toBe(true);
  });

  it("returns null for invalid schema payload", () => {
    // Missing required fields → schema validation fails
    const result = buildXrplJsonMemo({ invalid: true });
    expect(result).toBeNull();
  });

  it("allows skipping validation", () => {
    const result = buildXrplJsonMemo({ custom: "data" }, { validate: false });
    expect(result).toBeInstanceOf(Array);
    expect(result[0].Memo.MemoData).toBeTruthy();
  });
});

// ── buildWalletLabelMemo ────────────────────────────────────

describe("buildWalletLabelMemo", () => {
  it("builds a valid wallet_label v2 compact payload", () => {
    const payload = buildWalletLabelMemo({ label: "Alice" });
    expect(payload).toBeTruthy();
    expect(payload.xc).toBe("wl");
    expect(payload.l).toBe("Alice");
    expect(payload.v).toBe(2);
  });
});

// ── buildConversionMemo ─────────────────────────────────────

describe("buildConversionMemo", () => {
  it("builds a valid conversion v2 compact payload", () => {
    const payload = buildConversionMemo({
      base: "EUR",
      quote: "USD",
      amountBase: 100,
      amountQuote: 108,
      amountRlusd: 108,
      amountRlusdGross: 109.09,
      fxRate: 1.0909,
    });
    expect(payload).toBeTruthy();
    expect(payload.xc).toBe("cv");
    expect(payload.b).toBe("EUR");
    expect(payload.q).toBe("USD");
    expect(payload.r).toBe(108);
    expect(payload.v).toBe(2);
  });
});

// ── buildPayreqMemo ─────────────────────────────────────────

describe("buildPayreqMemo", () => {
  it("builds a valid payreq v2 compact payload", () => {
    const payload = buildPayreqMemo({
      origin: "payreq",
      targetCurrencyCode: "EUR",
      amountRlusd: 50,
    });
    expect(payload).toBeTruthy();
    expect(payload.xc).toBe("pr");
    expect(payload.tc).toBe("EUR");
    expect(payload.o).toBe("p"); // short origin: payreq → p
    expect(payload.r).toBe(50);
    expect(payload.v).toBe(2);
  });

  it("rejects invalid origin", () => {
    const payload = buildPayreqMemo({
      origin: "INVALID",
      targetCurrencyCode: "EUR",
      amountRlusd: 50,
    });
    expect(payload).toBeNull();
  });
});
