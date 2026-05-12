/**
 * simpleSwapUtils.js
 * Constantes et fonctions utilitaires pures pour le module UsdSwap (SimpleSwap).
 * Aucune dépendance React — importable dans les hooks et composants.
 */

import Image from "next/image";
import { normalizeCurrencyCode } from "../utils/normalizeCurrencyCode";

// ─── Constantes ───────────────────────────────────────────────────────────────

export const DEFAULT_RLUSD = { ticker: "rlusd", network: "xrp" };
export const PRIORITY_TICKERS = ["usdc", "usdt", "dai", "usdp", "tusd", "fdusd", "pyusd"];
export const SWAP_DIRECTIONS = {
  RLUSD_TO_STABLE: "rlusd_to_stable",
  STABLE_TO_RLUSD: "stable_to_rlusd",
};
export const MAX_STABLE_SEARCH_RESULTS = 200;
export const QUICK_STABLE_TARGETS = [
  { ticker: "usdt", networkAliases: ["eth", "ethereum", "erc20"], label: "USDT (ETH)" },
  { ticker: "usdc", networkAliases: ["eth", "ethereum", "erc20"], label: "USDC (ETH)" },
  { ticker: "usdt", networkAliases: ["tron", "trx", "trc20"], label: "USDT (TRON)" },
  { ticker: "usdt", networkAliases: ["bsc", "bnb", "bep20"], label: "USDT (BSC)" },
  { ticker: "usdc", networkAliases: ["sol", "solana"], label: "USDC (SOL)" },
  { ticker: "usdc", networkAliases: ["arbitrum", "arb"], label: "USDC (ARBITRUM)" },
  { ticker: "usdc", networkAliases: ["base"], label: "USDC (BASE)" },
  { ticker: "usdc", networkAliases: ["polygon", "matic"], label: "USDC (POLYGON)" },
  { ticker: "usdc", networkAliases: ["optimism", "op"], label: "USDC (OPTIMISM)" },
  { ticker: "dai", networkAliases: ["eth", "ethereum", "erc20"], label: "DAI (ETH)" },
  { ticker: "fdusd", networkAliases: ["bsc", "bnb", "bep20"], label: "FDUSD (BSC)" },
  { ticker: "usdp", networkAliases: ["eth", "ethereum", "erc20"], label: "USDP (ETH)" },
  { ticker: "pyusd", networkAliases: ["eth", "ethereum", "erc20"], label: "PYUSD (ETH)" },
];
export const POPULAR_STABLE_TARGETS = QUICK_STABLE_TARGETS.slice(0, 4);
export const SIMPLESWAP_DEPOSITS_STORAGE_KEY = "xcannes_simpleswap_deposits_v1";
export const SIMPLESWAP_DEPOSITS_MAX = 10;
export const XRP_RAIL_CURRENCY = { ticker: "xrp", network: "xrp", name: "XRP" };

// ─── Fonctions utilitaires ────────────────────────────────────────────────────

export function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return fallback;
}

export function currencyKey(cur) {
  const ticker = String(cur?.ticker || "").trim().toLowerCase();
  const network = String(cur?.network || "").trim().toLowerCase();
  if (!ticker || !network) return "";
  return `${ticker}:${network}`;
}

export function currencyLabel(cur) {
  const ticker = normalizeCurrencyCode(cur?.ticker);
  const network = normalizeCurrencyCode(cur?.network);
  const name = String(cur?.name || "").trim();
  if (name) return `${ticker} (${network}) — ${name}`;
  return `${ticker} (${network})`;
}

export function matchStableTarget(currency, { ticker, networkAliases }) {
  const curTicker = String(currency?.ticker || "").trim().toLowerCase();
  const curNetwork = String(currency?.network || "").trim().toLowerCase();
  if (!curTicker || !curNetwork) return false;
  if (curTicker !== String(ticker || "").trim().toLowerCase()) return false;
  return (networkAliases || []).includes(curNetwork);
}

export function renderCurrencyIcon(currency) {
  const url = String(currency?.image || "").trim();
  if (!url) return null;
  return (
    <Image
      src={url}
      loader={({ src }) => src}
      unoptimized
      alt=""
      width={24}
      height={24}
      className="w-6 h-6 rounded-full bg-white/10 ring-1 ring-white/10 object-cover flex-shrink-0"
    />
  );
}

export function renderWalletOptionIcon(icon) {
  if (!icon) return null;
  if (typeof icon === "string" || typeof icon === "number") {
    return (
      <span className="text-base leading-none" aria-hidden="true">
        {icon}
      </span>
    );
  }
  if (icon?.src) {
    return (
      <Image
        src={icon.src}
        alt={icon.alt || ""}
        width={22}
        height={22}
        className="w-5 h-5 object-contain"
      />
    );
  }
  return null;
}

export function safeReadJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function parseSimpleSwapRanges(ranges) {
  if (!ranges) return { min: null, max: null };
  const source = Array.isArray(ranges)
    ? ranges[0]
    : typeof ranges === "object"
      ? ranges?.data || ranges?.result || ranges
      : null;
  if (!source || typeof source !== "object") return { min: null, max: null };

  const rawMin = pick(source, ["min", "minAmount", "min_amount", "minAmountFrom", "min_amount_from"], "");
  const rawMax = pick(source, ["max", "maxAmount", "max_amount", "maxAmountFrom", "max_amount_from"], "");

  const min = rawMin ? Number(String(rawMin).trim().replace(",", ".")) : null;
  const max = rawMax ? Number(String(rawMax).trim().replace(",", ".")) : null;

  return {
    min: Number.isFinite(min) && min > 0 ? min : null,
    max: Number.isFinite(max) && max > 0 ? max : null,
  };
}

export function parseSimpleSwapEstimateAmount(quote) {
  if (quote == null) return null;
  if (typeof quote === "number") {
    return Number.isFinite(quote) && quote > 0 ? quote : null;
  }
  if (typeof quote === "string") {
    const num = Number(String(quote || "").trim().replace(",", "."));
    return Number.isFinite(num) && num > 0 ? num : null;
  }
  const keys = [
    "amount",
    "estimatedAmount",
    "estimate",
    "amountTo",
    "amount_to",
    "amountToEstimated",
    "estimatedAmountTo",
  ];
  const raw =
    pick(quote, keys, "") ||
    pick(quote?.data, keys, "") ||
    pick(quote?.result, keys, "") ||
    pick(quote?.estimate, keys, "") ||
    "";
  const num = Number(String(raw || "").trim().replace(",", "."));
  return Number.isFinite(num) && num > 0 ? num : null;
}

export function buildXrpPaymentTxjson({ account, destination, amountXrp }) {
  const amount = Number(amountXrp);
  if (!account || !destination) return null;
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return {
    TransactionType: "Payment",
    Account: account,
    Destination: destination,
    Amount: String(Math.round(amount * 1_000_000)),
  };
}

export function parseDestinationTag(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function encodeTextToHex(value) {
  const input = String(value || "");
  if (!input) return "";
  return Array.from(new TextEncoder().encode(input))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

export function buildPlainTextMemo(value) {
  const encoded = encodeTextToHex(value);
  if (!encoded) return null;
  return [
    {
      Memo: {
        MemoData: encoded,
      },
    },
  ];
}

export function normalizeAddressNetworkFamily(network) {
  const normalized = String(network || "").trim().toLowerCase();
  if (!normalized) return "";
  if (["xrp", "xrpl"].includes(normalized)) return "xrpl";
  if (["tron", "trx", "trc20"].includes(normalized)) return "tron";
  if (["sol", "solana"].includes(normalized)) return "solana";
  if (
    [
      "eth",
      "ethereum",
      "erc20",
      "bsc",
      "bnb",
      "bep20",
      "base",
      "arb",
      "arbitrum",
      "matic",
      "polygon",
      "op",
      "optimism",
      "avax",
      "avaxc",
      "avaxcchain",
      "cchain",
      "linea",
      "zksync",
    ].includes(normalized) ||
    normalized.includes("erc20") ||
    normalized.includes("bep20")
  ) {
    return "evm";
  }
  if (["btc", "bitcoin"].includes(normalized)) return "bitcoin";
  if (["ltc", "litecoin"].includes(normalized)) return "litecoin";
  if (["doge", "dogecoin"].includes(normalized)) return "dogecoin";
  if (["ton"].includes(normalized)) return "ton";
  if (["xlm", "stellar"].includes(normalized)) return "stellar";
  if (["algo", "algorand"].includes(normalized)) return "algorand";
  if (["ada", "cardano"].includes(normalized)) return "cardano";
  if (["near"].includes(normalized)) return "near";
  if (["apt", "aptos"].includes(normalized)) return "aptos";
  if (["sui"].includes(normalized)) return "sui";
  return "";
}

export function validateAddressByNetworkFamily(address, family) {
  const value = String(address || "").trim();
  if (!value || !family) return true;

  switch (family) {
    case "evm":
      return /^0x[a-fA-F0-9]{40}$/.test(value);
    case "tron":
      return /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(value);
    case "solana":
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value);
    case "xrpl":
      return (
        /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value) ||
        /^[XT][1-9A-HJ-NP-Za-km-z]{46,55}$/.test(value)
      );
    case "bitcoin":
      return (
        /^(bc1|tb1)[ac-hj-np-z02-9]{11,71}$/i.test(value) ||
        /^[13mn2][1-9A-HJ-NP-Za-km-z]{25,62}$/.test(value)
      );
    case "litecoin":
      return (
        /^ltc1[ac-hj-np-z02-9]{8,87}$/i.test(value) ||
        /^[LM3][1-9A-HJ-NP-Za-km-z]{26,33}$/.test(value)
      );
    case "dogecoin":
      return /^D[1-9A-HJ-NP-Za-km-z]{25,34}$/.test(value);
    case "ton":
      return /^(EQ|UQ)[A-Za-z0-9_-]{46}$/.test(value);
    case "stellar":
      return /^G[A-Z2-7]{55}$/.test(value);
    case "algorand":
      return /^[A-Z2-7]{58}$/.test(value);
    case "cardano":
      return /^(addr1[0-9a-z]{20,}|DdzFF[1-9A-HJ-NP-Za-km-z]{20,})$/i.test(value);
    case "near":
      return /^(?:[a-z0-9._-]{2,64}|[0-9a-f]{64})$/.test(value);
    case "aptos":
    case "sui":
      return /^0x[0-9a-fA-F]{1,64}$/.test(value);
    default:
      return true;
  }
}
