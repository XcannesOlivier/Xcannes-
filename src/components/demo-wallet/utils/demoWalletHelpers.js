/**
 * Utility functions & constants for DemoWalletDashboard.
 *
 * Extracted from DemoWalletDashboard.jsx to keep the component lean.
 * Every export here is a pure function or a plain constant — no React.
 */

import xcannesApi from "@/lib/xcannesApi";
import {
  formatAmountWithSymbol,
  getCurrencySymbol,
} from "../demoWalletDashboardConfig";

// ─── Constants ──────────────────────────────────────────────────────────────

export const DEMO_FAUX_PAYREQ_EXAMPLE =
  '{"schema":"xcannes-demo-payreq-v1","to":"GtxxxxXcannes123xxxxxxxxxxx","ccy":"USD","amt":10}';

export const DEMO_STATE_STORAGE_KEY = "xcannes_demo_wallet_state_v1";
export const DEMO_SAVED_ADDRESSES_STORAGE_KEY =
  "xcannes_demo_saved_addresses_v1";
const DEMO_LATENCY_MS_MIN = 450;
const DEMO_LATENCY_MS_MAX = 1100;
export const DEMO_TOKEN_PRIORITY = { RLUSD: 1, USD: 2 };

// ─── Generic helpers ────────────────────────────────────────────────────────

export function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function getDemoLatencyMs() {
  return Math.max(
    0,
    Math.floor(
      DEMO_LATENCY_MS_MIN +
        Math.random() * (DEMO_LATENCY_MS_MAX - DEMO_LATENCY_MS_MIN),
    ),
  );
}

// ─── Currency helpers ───────────────────────────────────────────────────────

export function getMinUnitsForCurrency(currencyCode) {
  return 0.01;
}

export function formatMoney(locale, amount, currency) {
  return formatAmountWithSymbol(locale, amount, currency, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatUnits(locale, amount) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return String(amount);
  }
}

export function formatUnitsWithSymbol(locale, amount, currencyCode) {
  const value = formatUnits(locale, amount);
  const symbol = getCurrencySymbol(currencyCode, locale);
  return symbol ? `${value} ${symbol}` : value;
}

export function formatDemoAddressShort(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

// ─── Ticker / rate resolution ───────────────────────────────────────────────

export async function resolveUsdPerUnit(code) {
  const upper = String(code || "").toUpperCase();
  if (!upper) return { rate: Number.NaN, source: null };
  if (upper === "USD" || upper === "RLUSD") return { rate: 1, source: "FAWAZ" };

  try {
    const fxData = await xcannesApi.getFxRate("USD", upper);
    const rate = Number(fxData?.rate);

    // API returns USD->QUOTE (QUOTE per USD), so USD per 1 QUOTE is 1/rate.
    if (Number.isFinite(rate) && rate > 0)
      return { rate: 1 / rate, source: "FAWAZ" };
  } catch (_err) {
    // ignore
  }
  return { rate: Number.NaN, source: null };
}

// ─── Demo state validation ──────────────────────────────────────────────────

export function isValidDemoState(value) {
  if (!value || typeof value !== "object") return false;
  const wallets = value.wallets;
  if (!wallets || typeof wallets !== "object") return false;
  if (!wallets.A || !wallets.A.allocations) return false;
  return true;
}

export function needsDemoStateMigration(value) {
  if (!isValidDemoState(value)) return false;
  const walletA = value?.wallets?.A || {};
  const label = String(walletA?.label || "").trim();
  const address = String(walletA?.address || "").trim();
  if (
    !label ||
    label === "Wallet A" ||
    label === "Compte démo" ||
    label === "Compte demo"
  ) {
    return true;
  }
  if (
    !address ||
    address === "rDEMO_WALLET_A_xxxxxxxxxxxxxxxxxxxxxxxx" ||
    address === "rGt_Comptedepresentation_xxxxxxxxxxx" ||
    address === "rGt_Comptedepresentation_xxxxxxxxxxxxx" ||
    address === "rGt_Comptedepresentation_RVkj2JhnHC"
  ) {
    return true;
  }
  if (
    address.startsWith("rGt_Comptedepresentation_") &&
    address !== "GtxxxxXcannes123xxxxxxxxxxx"
  ) {
    return true;
  }
  return false;
}
