"use client";

import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { spreadFractionForPair, currencyTier } from "@/components/dex/ExchangeSections/spread";

export const XCANNES_SPREAD_WALLET_ADDRESS =
  (process.env.NEXT_PUBLIC_XCANNES_SPREAD_WALLET_ADDRESS || "").trim() ||
  "rGt44i8APV6KMLCCkuaJpY19RVkj2JhnHC";

export const XCANNES_ACTIVATION_WALLET_ADDRESS =
  (process.env.NEXT_PUBLIC_XCANNES_ACTIVATION_WALLET_ADDRESS || "").trim() ||
  XCANNES_SPREAD_WALLET_ADDRESS;

export function isFxConversion(base, quote) {
  const b = String(base || "").toUpperCase();
  const q = String(quote || "").toUpperCase();
  if (!b || !q || b === q) return false;
  if (b === "XRP" || b === "XCS" || q === "XRP" || q === "XCS") return false;
  // FX conversions: RLUSD<->fiat or fiat<->fiat.
  return b !== "RLUSD" || q !== "RLUSD";
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

  const spreadFraction = spreadFractionForPair(b, q);
  const halfSpreadFraction = Number(spreadFraction) / 2;
  const spreadFeeRlusd = amount * halfSpreadFraction;

  const tierBase = currencyTier(b);
  const tierQuote = currencyTier(q);
  const tier =
    tierBase === "C" || tierQuote === "C"
      ? "C"
      : tierBase === "B" || tierQuote === "B"
        ? "B"
        : "A";

  return {
    isFx: true,
    spreadFraction,
    halfSpreadFraction,
    spreadFeeRlusd: Number.isFinite(spreadFeeRlusd) ? spreadFeeRlusd : 0,
    tier,
  };
}

export function normalizeXrplIouValue(value) {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return null;
  // Keep up to 8 decimals, trim trailing zeros.
  return num.toFixed(8).replace(/\.?0+$/, "");
}

export function buildRlusdPaymentTxjson({ account, destination, amountRlusd }) {
  const value = normalizeXrplIouValue(amountRlusd);
  if (!value) return null;

  const currency = encodeXrplCurrencyCode("RLUSD");
  const issuer = XRPL_KNOWN_ISSUERS.RLUSD;
  if (!currency || !issuer) return null;

  return {
    TransactionType: "Payment",
    Account: account,
    Destination: destination,
    Amount: {
      currency,
      issuer,
      value,
    },
  };
}

export function buildXcsPaymentTxjson({ account, destination, amountXcs }) {
  const value = normalizeXrplIouValue(amountXcs);
  if (!value) return null;

  const currency = encodeXrplCurrencyCode("XCS");
  const issuer = XRPL_KNOWN_ISSUERS.XCS;
  if (!currency || !issuer) return null;

  return {
    TransactionType: "Payment",
    Account: account,
    Destination: destination,
    Amount: {
      currency,
      issuer,
      value,
    },
  };
}
