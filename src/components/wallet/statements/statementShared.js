/**
 * statementShared.js
 * ------------------
 * Constants, tiny components and pure utilities shared by
 * CurrencyStatement and GlobalStatement.
 */

/* ─── Constants ───────────────────────────────────────────── */

export const HIGHLIGHT_DURATION_MS = 5000;
export const STATEMENT_HISTORY_MONTHS = 13;

/* ─── ShareIcon (SVG) ─────────────────────────────────────── */

export const ShareIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/* ─── Tiny helpers ────────────────────────────────────────── */

export const isSvgIcon = (src) => {
  if (!src) return false;
  return String(src).toLowerCase().endsWith(".svg");
};

export const stripCountSuffix = (label) =>
  String(label || "")
    .replace(/\s*[\(\uFF08]\s*$/, "")
    .trim();

/* ─── Month utilities ─────────────────────────────────────── */

const buildMonthKeyUtc = (date) => {
  if (!(date instanceof Date)) return null;
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  return `${year}-${String(month).padStart(2, "0")}`;
};

export const buildDefaultMonthKeys = (months) => {
  const now = new Date();
  const list = [];
  for (let i = 0; i < months; i += 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
    );
    const key = buildMonthKeyUtc(date);
    if (key) list.push(key);
  }
  return list;
};

export const getMonthKeyFromTransaction = (tx) => {
  const createdAt = tx?.createdAt ? new Date(tx.createdAt) : null;
  if (createdAt && Number.isFinite(createdAt.getTime())) {
    return buildMonthKeyUtc(createdAt);
  }
  const dateRaw = String(tx?.date || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) {
    const [year, month] = dateRaw
      .split("-")
      .map((value) => Number.parseInt(value, 10));
    if (Number.isFinite(year) && Number.isFinite(month)) {
      return `${year}-${String(month).padStart(2, "0")}`;
    }
  }
  return null;
};

export const formatMonthLabel = (
  monthKey,
  locale,
  { monthOnly = false } = {},
) => {
  if (!monthKey) return "";
  const [year, month] = String(monthKey)
    .split("-")
    .map((value) => Number.parseInt(value, 10));
  if (!Number.isFinite(year) || !Number.isFinite(month)) return monthKey;
  const date = new Date(year, month - 1, 1);
  const result = date.toLocaleDateString(
    locale || "en",
    monthOnly ? { month: "long" } : { month: "long", year: "numeric" },
  );
  return result.charAt(0).toUpperCase() + result.slice(1);
};

/* ─── STATEMENT_LAYOUTS ───────────────────────────────────── */

export const STATEMENT_LAYOUTS = {
  full: {
    backdropClass: "bg-black/80 md:backdrop-blur-sm",
    wrapperClass: "items-stretch justify-center px-0 md:items-center md:px-4",
    panelClass:
      "w-full xcannes-fullscreen-safe md:h-auto rounded-none border-0 md:max-w-4xl md:rounded-2xl md:max-h-[92vh] lg:max-w-5xl",
  },
  "inline-desktop": {
    backdropClass: "",
    wrapperClass: "items-stretch justify-stretch p-0",
    panelClass: "w-full h-full rounded-xl",
  },
};

/* ─── getCurrencyFlag ─────────────────────────────────────── */

const CURRENCY_FLAGS = {
  // Fiat – Major
  USD: "🇺🇸",
  EUR: "🇪🇺",
  GBP: "🇬🇧",
  JPY: "🇯🇵",
  CHF: "🇨🇭",
  CAD: "🇨🇦",
  AUD: "🇦🇺",
  CNY: "🇨🇳",
  INR: "🇮🇳",
  BRL: "🇧🇷",
  MXN: "🇲🇽",
  KRW: "🇰🇷",
  RUB: "🇷🇺",
  ZAR: "🇿🇦",
  SGD: "🇸🇬",
  HKD: "🇭🇰",
  NOK: "🇳🇴",
  SEK: "🇸🇪",
  DKK: "🇩🇰",
  PLN: "🇵🇱",
  TRY: "🇹🇷",
  AED: "🇦🇪",
  SAR: "🇸🇦",
  THB: "🇹🇭",
  IDR: "🇮🇩",
  MYR: "🇲🇾",
  PHP: "🇵🇭",
  NZD: "🇳🇿",
  ARS: "🇦🇷",
  CLP: "🇨🇱",
  COP: "🇨🇴",
  PEN: "🇵🇪",
  EGP: "🇪🇬",
  NGN: "🇳🇬",
  KES: "🇰🇪",
  GHS: "🇬🇭",
  MAD: "🇲🇦",
  TND: "🇹🇳",

  // Africa
  XOF: "🇸🇳",
  XAF: "🇨🇲",
  UGX: "🇺🇬",
  TZS: "🇹🇿",
  ETB: "🇪🇹",
  MUR: "🇲🇺",
  BWP: "🇧🇼",
  ZMW: "🇿🇲",
  AOA: "🇦🇴",
  MZN: "🇲🇿",
  RWF: "🇷🇼",
  NAD: "🇳🇦",

  // Latin America
  VES: "🇻🇪",
  UYU: "🇺🇾",
  PYG: "🇵🇾",
  BOB: "🇧🇴",
  CRC: "🇨🇷",
  GTQ: "🇬🇹",
  HNL: "🇭🇳",
  NIO: "🇳🇮",
  PAB: "🇵🇦",
  SOL: "🇵🇪",
  DOP: "🇩🇴",
  HTG: "🇭🇹",
  JMD: "🇯🇲",
  TTD: "🇹🇹",

  // Asia-Pacific
  VND: "🇻🇳",
  LAK: "🇱🇦",
  KHR: "🇰🇭",
  MMK: "🇲🇲",
  BDT: "🇧🇩",
  PKR: "🇵🇰",
  LKR: "🇱🇰",
  NPR: "🇳🇵",
  AFN: "🇦🇫",
  MNT: "🇲🇳",
  KZT: "🇰🇿",
  UZS: "🇺🇿",
  TJS: "🇹🇯",
  KGS: "🇰🇬",
  TWD: "🇹🇼",

  // Middle-East
  ILS: "🇮🇱",
  JOD: "🇯🇴",
  KWD: "🇰🇼",
  BHD: "🇧🇭",
  OMR: "🇴🇲",
  QAR: "🇶🇦",
  IQD: "🇮🇶",
  SYP: "🇸🇾",
  LBP: "🇱🇧",
  YER: "🇾🇪",

  // Eastern Europe & others
  CZK: "🇨🇿",
  HUF: "🇭🇺",
  RON: "🇷🇴",
  BGN: "🇧🇬",
  RSD: "🇷🇸",
  UAH: "🇺🇦",
  BYN: "🇧🇾",
  GEL: "🇬🇪",
  AMD: "🇦🇲",
  AZN: "🇦🇿",
  MDL: "🇲🇩",
  ALL: "🇦🇱",
  MKD: "🇲🇰",
  BAM: "🇧🇦",
  ISK: "🇮🇸",

  // Oceania & misc
  FJD: "🇫🇯",
  PGK: "🇵🇬",
  WST: "🇼🇸",
  TOP: "🇹🇴",
  VUV: "🇻🇺",

  // More fiat
  BSD: "🇧🇸",
  BBD: "🇧🇧",
  BZD: "🇧🇿",
  BMD: "🇧🇲",
  BTN: "🇧🇹",
  BND: "🇧🇳",
  BIF: "🇧🇮",
  CVE: "🇨🇻",
  KMF: "🇰🇲",
  CDF: "🇨🇩",
  CUP: "🇨🇺",
  CYP: "🇨🇾",
  DJF: "🇩🇯",
  XCD: "🇦🇬",
  ERN: "🇪🇷",
  GMD: "🇬🇲",
  GNF: "🇬🇳",
  GYD: "🇬🇾",
  LSL: "🇱🇸",
  LRD: "🇱🇷",
  LYD: "🇱🇾",
  MOP: "🇲🇴",
  MGA: "🇲🇬",
  MWK: "🇲🇼",
  MVR: "🇲🇻",
  MRU: "🇲🇷",
  SCR: "🇸🇨",
  SOS: "🇸🇴",
  SDG: "🇸🇩",
  SRD: "🇸🇷",
  SZL: "🇸🇿",
  STN: "🇸🇹",
  ZWL: "🇿🇼",
  TMT: "🇹🇲",

  // Stablecoins
  RLUSD: "🔵",
  BUSD: "🟡",
  DAI: "🟠",
  TUSD: "🔷",
  USDP: "⚪",
  GUSD: "💚",
  USDD: "⚫",
  FRAX: "🔲",
  LUSD: "🟦",
  sUSD: "🔶",

  // Crypto
  XRP: "⚡",
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "🔵",
  BNB: "🔶",
  ADA: "₳",
  DOGE: "Ð",
  MATIC: "🟣",
  DOT: "⬤",
  LINK: "🔗",
  AVAX: "🔺",
  UNI: "🦄",
  ATOM: "⚛️",
  XLM: "🚀",
  ALGO: "◬",
  VET: "💎",
  ICP: "∞",
  FIL: "📁",
  NEAR: "Ⓝ",
  APT: "🅰️",
  ARB: "🔷",
  OP: "🔴",
  SAND: "🏖️",
  MANA: "🎮",
  SHIB: "🐕",
  TRX: "🔺",
  LTC: "Ł",
  BCH: "₿",
  XMR: "ɱ",
  ETC: "Ξ",
  XTZ: "ꜩ",
  EOS: "🔷",
  AAVE: "👻",
  MKR: "Ⓜ️",
  COMP: "🏦",
  SNX: "🔷",
  CRV: "🌊",
  SUSHI: "🍣",
  YFI: "💼",
  BAT: "🦇",
  ZRX: "Ⓩ",
  ENJ: "🎮",
  CHZ: "⚽",
  THETA: "📺",
  FTM: "👻",
  HBAR: "ℏ",
  EGLD: "🏔️",
  FLR: "🔥",
  XDC: "🌐",
  KAVA: "🌾",
  ZIL: "💎",
  QTUM: "⬡",
  WAVES: "🌊",
  ICX: "🔷",
  ONT: "⭕",
  ZEC: "🛡️",
  DASH: "💸",
  DCR: "🔷",
};

/**
 * Convert a 2-letter country code to a regional indicator flag emoji.
 * Same approach used by the swap modal's WalletCurrencySelector.
 */
function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return null;
  const upper = countryCode.toUpperCase();
  // Only A-Z letters produce valid regional indicator symbols.
  if (!/^[A-Z]{2}$/.test(upper)) return null;
  const codePoints = [...upper].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65));
  return String.fromCodePoint(...codePoints);
}

/**
 * Return an emoji flag / symbol for a given currency code.
 * 1. Check explicit CURRENCY_FLAGS map (crypto symbols, stablecoins, special cases).
 * 2. Dynamically generate a flag from the first 2 letters (same logic as swap modal).
 * 3. Fall back to 💱 if nothing works.
 */
export function getCurrencyFlag(code) {
  const upper = String(code || "")
    .trim()
    .toUpperCase();
  if (CURRENCY_FLAGS[upper]) return CURRENCY_FLAGS[upper];
  // Dynamic generation from first 2 chars — works for any fiat currency code.
  const dynamicFlag = countryCodeToFlag(upper.slice(0, 2));
  if (dynamicFlag) return dynamicFlag;
  return "💱";
}
