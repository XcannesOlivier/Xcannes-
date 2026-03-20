const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
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

export const DEMO_CURRENCY_LINE_ORDER = [
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

export function getDisplayCurrencyCode(code) {
  const upper = String(code || "").toUpperCase();
  return upper === "RLUSD" ? "USD" : upper;
}

export function getCurrencySymbol(code, locale = "en") {
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
  _options = {},
) {
  const num = Number(amount);
  if (!Number.isFinite(num)) return "-";
  const minimumFractionDigits = 2;
  const maximumFractionDigits = 2;
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

