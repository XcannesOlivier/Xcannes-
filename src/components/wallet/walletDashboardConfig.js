const TOKEN_ICONS = {
  XRP: "✕",
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "＄",
};

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
};

const CURRENCY_SYMBOL_OVERRIDES = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
  CNY: "¥",
  CHF: "CHF",
  CAD: "$",
  AUD: "$",
  NZD: "$",
  HKD: "$",
  SGD: "$",
  MXN: "$",
  BRL: "R$",
  INR: "₹",
  NGN: "₦",
  PHP: "₱",
  KRW: "₩",
  ZAR: "R",
  TRY: "₺",
  RUB: "₽",
  PLN: "zł",
  SEK: "kr",
  NOK: "kr",
  DKK: "kr",
  XOF: "FCFA",
  XAF: "FCFA",
  AED: "د.إ",
  SAR: "﷼",
};

export const USD_STABLECOINS = [
  "RLUSD",
  "USD",
  "USDC",
  "USDT",
  "BUSD",
  "DAI",
  "TUSD",
  "USDP",
  "GUSD",
];

/**
 * Actifs XRPL acceptés dans le wallet XCANNES (hors XRP natif qui est
 * toujours affiché). Tout autre token/trustline du ledger est ignoré.
 * Les lignes de devises internes (EUR, GBP…) sont gérées séparément
 * via le système d'allocations RLUSD — elles ne passent pas par ce filtre.
 */
export const WALLET_ACCEPTED_TOKENS = new Set(["RLUSD"]);

export const WALLET_CURRENCY_LINE_ORDER = [
  "USD",
  "EUR",
  "CHF",
  "GBP",
  "CAD",
  "JPY",
  "AED",
  "SAR",
  "XOF",
  "XAF",
  "MXN",
  "BRL",
  "INR",
  "NGN",
  "PHP",
  "ARS",
];

export function getDisplayCurrencyCode(code) {
  const upper = String(code || "").toUpperCase();
  return upper === "RLUSD" ? "USD" : upper;
}

function getCurrencySymbol(code, locale = "en") {
  const upper = String(code || "").toUpperCase();
  if (!upper) return "";
  try {
    const parts = new Intl.NumberFormat(locale, {
      style: "currency",
      currency: upper,
      currencyDisplay: "narrowSymbol",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).formatToParts(0);
    const symbol = parts.find((part) => part.type === "currency")?.value;
    if (symbol) return symbol;
  } catch {
    // ignore
  }
  return CURRENCY_SYMBOL_OVERRIDES[upper] || upper;
}

export function formatAmountWithSymbol(
  locale,
  amount,
  currencyCode,
  { minimumFractionDigits = 2, maximumFractionDigits = 2 } = {},
) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "-";
  const value = new Intl.NumberFormat(locale || "en", {
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(num);
  const symbol = getCurrencySymbol(currencyCode, locale);
  return symbol ? `${value} ${symbol}` : value;
}

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65),
  );
  return String.fromCodePoint(...codePoints);
}

export function getCurrencyFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

export function getTokenIcon(currency) {
  const code = String(currency || "").toUpperCase();
  if (code === "RLUSD" || code === "USD") return getCurrencyFlag("USD");
  if (TOKEN_ICONS[code]) return TOKEN_ICONS[code];
  const first = code.match(/[A-Z]/);
  return first ? first[0] : "?";
}

export const WALLET_LAYOUT = Object.freeze({
  statementVariant: "full",
  containerClass: "overflow-hidden",
});

// ── Wallet setup shared constants ────────────────────────────

export const AVAILABLE_DEFAULT_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "JPY",
  "AUD",
];

/**
 * Validate a wallet label: 1 or 2 words, max 7 ASCII letters each, A-Z only.
 */
export function validateWalletLabel(value) {
  const trimmed = String(value || "").trim();
  const words = trimmed.split(/\s+/).filter(Boolean);
  const wordPattern = /^[A-Za-z]+$/;
  if (words.length < 1 || words.length > 2) return false;
  return words.every((w) => w.length <= 7 && wordPattern.test(w));
}
