export const TOKEN_ICONS = {
  XRP: "✕",
  XCS: "Ⓧ",
  BTC: "₿",
  ETH: "Ξ",
  USDT: "₮",
  USDC: "＄",
};

export const WALLET_LABEL_STORAGE_KEY = "xcannes_wallet_labels";

export const CURRENCY_FLAG_OVERRIDES = {
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

export function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
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
  if (TOKEN_ICONS[code]) return TOKEN_ICONS[code];
  const first = code.match(/[A-Z]/);
  return first ? first[0] : "?";
}

export const WALLET_LAYOUTS = {
  full: {
    isFullPage: true,
    tokenListClass: "flex-1",
    statementVariant: "full",
    showBrandTitle: true,
    showOpenFullWallet: false,
    containerClass: "h-full min-h-0 overflow-hidden",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
  "dex-desktop": {
    isFullPage: false,
    tokenListClass: "flex-1",
    statementVariant: "dex-desktop",
    showBrandTitle: false,
    showOpenFullWallet: false,
    containerClass: "h-full min-h-0 overflow-hidden",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "rounded-lg",
  },
  "dex-mobile": {
    isFullPage: false,
    tokenListClass: "flex-1",
    statementVariant: "dex-mobile",
    showBrandTitle: true,
    showOpenFullWallet: true,
    containerClass:
      "h-[720px] max-h-[82svh] rounded-2xl rounded-t-none border-t border-white/10 shadow-xl shadow-black/30 overflow-hidden",
    headerClass: "bg-black/20",
    actionRowClass: "bg-black/10",
    tokenRowClass: "rounded-xl bg-white/5 border-white/10 hover:bg-white/10",
  },
  default: {
    isFullPage: false,
    tokenListClass: "max-h-72 md:max-h-[420px]",
    statementVariant: "default",
    showBrandTitle: false,
    showOpenFullWallet: false,
    containerClass: "",
    headerClass: "",
    actionRowClass: "",
    tokenRowClass: "",
  },
};
