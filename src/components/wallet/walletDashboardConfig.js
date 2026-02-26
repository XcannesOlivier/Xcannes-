export const TOKEN_ICONS = {
  XRP: "✕",
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "＄",
};

export const CURRENCY_FLAG_OVERRIDES = {
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

export function countryCodeToFlag(countryCode) {
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

export const WALLET_LAYOUTS = {
  full: {
    isFullPage: true,
    tokenListClass: "max-h-none",
    statementVariant: "full",
    showBrandTitle: true,
    showOpenFullWallet: false,
    containerClass: "",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
  "dex-desktop": {
    isFullPage: false,
    tokenListClass: "max-h-none",
    statementVariant: "dex-desktop",
    showBrandTitle: false,
    showOpenFullWallet: false,
    containerClass: "overflow-hidden",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "rounded-lg",
  },
  "dex-mobile": {
    isFullPage: false,
    tokenListClass: "max-h-[calc(100svh-300px)] md:max-h-[420px]",
    statementVariant: "dex-mobile",
    showBrandTitle: true,
    showOpenFullWallet: true,
    containerClass:
      "h-[100svh] rounded-none shadow-xl shadow-black/30 overflow-hidden border-t border-white/10",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "rounded-xl bg-white/5 border-white/10 hover:bg-white/10",
  },
  default: {
    isFullPage: false,
    tokenListClass: "max-h-72 md:max-h-[420px]",
    statementVariant: "default",
    showBrandTitle: true,
    showOpenFullWallet: false,
    containerClass: "",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
};

export function resolveWalletLayout(variant, isFullPage) {
  if (variant && WALLET_LAYOUTS[variant]) {
    return WALLET_LAYOUTS[variant];
  }
  if (isFullPage) {
    return WALLET_LAYOUTS.full;
  }
  return WALLET_LAYOUTS.default;
}
