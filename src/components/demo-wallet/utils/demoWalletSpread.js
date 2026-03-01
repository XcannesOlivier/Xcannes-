"use client";

const FIXED_FX_FEE_FRACTION = 0.01;

export const XCANNES_SPREAD_WALLET_ADDRESS =
  (process.env.NEXT_PUBLIC_XCANNES_SPREAD_WALLET_ADDRESS || "").trim() ||
  "rGt44i8APV6KMLCCkuaJpY19RVkj2JhnHC";

export function isFxConversion(base, quote) {
  const b = String(base || "").toUpperCase();
  const q = String(quote || "").toUpperCase();
  if (!b || !q || b === q) return false;
  return true;
}

export function computeSpreadQuote({ base, quote, amountRlusd }) {
  const b = String(base || "").toUpperCase();
  const q = String(quote || "").toUpperCase();
  const amount = Number(amountRlusd);
  if (!isFxConversion(b, q) || !Number.isFinite(amount) || amount <= 0) {
    return {
      isFx: false,
      spreadFraction: 0,
      halfSpreadFraction: 0,
      spreadFeeRlusd: 0,
      tier: null,
    };
  }

  const spreadFraction = FIXED_FX_FEE_FRACTION;
  const spreadFeeRlusd = amount * spreadFraction;

  return {
    isFx: true,
    spreadFraction,
    halfSpreadFraction: spreadFraction,
    spreadFeeRlusd: Number.isFinite(spreadFeeRlusd) ? spreadFeeRlusd : 0,
    tier: null,
  };
}
