"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { QRCodeCanvas } from "qrcode.react";
import { useModalTransition } from "@/hooks/useModalTransition";
import xcannesApi from "@/lib/xcannesApi";
import { buildSimpleSwapMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import {
  binanceYellowActionBtnBase,
  fireOrangeActionBtnBase,
  greenActionBtnBase,
  simpleSwapBlueActionBtnBase,
} from "./walletModalTokens";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import useIsDesktop from "../hooks/useIsDesktop";

const DEFAULT_RLUSD = { ticker: "rlusd", network: "xrp" };
const PRIORITY_TICKERS = ["usdc", "usdt", "dai", "usdp", "tusd", "fdusd", "pyusd"];
const SWAP_DIRECTIONS = {
  RLUSD_TO_STABLE: "rlusd_to_stable",
  STABLE_TO_RLUSD: "stable_to_rlusd",
};
const MAX_STABLE_SEARCH_RESULTS = 200;
const QUICK_STABLE_TARGETS = [
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
const POPULAR_STABLE_TARGETS = QUICK_STABLE_TARGETS.slice(0, 4);
const SIMPLESWAP_DEPOSITS_STORAGE_KEY = "xcannes_simpleswap_deposits_v1";
const SIMPLESWAP_DEPOSITS_MAX = 10;
const XRP_RAIL_CURRENCY = { ticker: "xrp", network: "xrp", name: "XRP" };

function pick(obj, keys, fallback = "") {
  for (const key of keys) {
    const value = obj?.[key];
    if (value === undefined || value === null) continue;
    const str = String(value).trim();
    if (str) return str;
  }
  return fallback;
}

function currencyKey(cur) {
  const ticker = String(cur?.ticker || "").trim().toLowerCase();
  const network = String(cur?.network || "").trim().toLowerCase();
  if (!ticker || !network) return "";
  return `${ticker}:${network}`;
}

function currencyLabel(cur) {
  const ticker = String(cur?.ticker || "").trim().toUpperCase();
  const network = String(cur?.network || "").trim().toUpperCase();
  const name = String(cur?.name || "").trim();
  if (name) return `${ticker} (${network}) — ${name}`;
  return `${ticker} (${network})`;
}

function truncateMiddle(value, head = 6, tail = 5) {
  const str = String(value ?? "");
  if (!str) return "";
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
}

function matchStableTarget(currency, { ticker, networkAliases }) {
  const curTicker = String(currency?.ticker || "").trim().toLowerCase();
  const curNetwork = String(currency?.network || "").trim().toLowerCase();
  if (!curTicker || !curNetwork) return false;
  if (curTicker !== String(ticker || "").trim().toLowerCase()) return false;
  return (networkAliases || []).includes(curNetwork);
}

function renderCurrencyIcon(currency) {
  const url = String(currency?.image || "").trim();
  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      className="w-6 h-6 rounded-full bg-white/10 ring-1 ring-white/10 object-cover flex-shrink-0"
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
    />
  );
}

function renderWalletOptionIcon(icon) {
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

function safeReadJsonArray(value) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseSimpleSwapRanges(ranges) {
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

function parseSimpleSwapEstimateAmount(quote) {
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

function buildXrpPaymentTxjson({ account, destination, amountXrp }) {
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

function parseDestinationTag(value) {
  const raw = String(value || "").trim();
  if (!/^\d+$/.test(raw)) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

function encodeTextToHex(value) {
  const input = String(value || "");
  if (!input) return "";
  return Array.from(new TextEncoder().encode(input))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase();
}

function buildPlainTextMemo(value) {
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

function normalizeAddressNetworkFamily(network) {
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

function validateAddressByNetworkFamily(address, family) {
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

export default function WalletDashboardUsdSwapModal({
  open,
  onClose,
  walletLabel = "",
  walletAddress = "",
  signTransaction = null,
  initialDirection = SWAP_DIRECTIONS.RLUSD_TO_STABLE,
  initialAmount = "",
  accentVariant = "",
  sourceSelectionMode = "",
  initialSourceCurrency = "",
  targetSelectionMode = "",
  initialTargetCurrency = "",
  titleOverride = "",
  subtitleOverride = "",
  availableTokens = [],
  rlusdPerUnitRates = {},
  selectLabelByCurrency = {},
  selectLabelRightByCurrency = {},
  selectIconByCurrency = {},
  noticeVariant = "preview",
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const isDesktop = useIsDesktop();
  const resolvedAccent = String(accentVariant || "").trim().toLowerCase();
  const isBinanceYellow =
    resolvedAccent === "binanceyellow" ||
    resolvedAccent === "binance_yellow" ||
    resolvedAccent === "binance";
  const isFireOrange = resolvedAccent === "fireorange" || resolvedAccent === "fire_orange";
  const isSimpleSwapBlue =
    resolvedAccent === "simpleswapblue" ||
    resolvedAccent === "simpleswap_blue" ||
    resolvedAccent === "simpleswap" ||
    resolvedAccent === "blue";
  const accentShadowPanel = isBinanceYellow
    ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(240,185,11,0.22),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]"
    : isFireOrange
    ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,106,0,0.22),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]"
    : isSimpleSwapBlue
      ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(8,112,248,0.22),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]"
    : "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]";
  const accentShadowCard = isBinanceYellow
    ? "shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
    : isFireOrange
    ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,106,0,0.22)]"
    : isSimpleSwapBlue
      ? "shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
    : "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]";
  const accentText80 = isBinanceYellow
    ? "text-[#F0B90B]/85"
    : isFireOrange
    ? "text-[#ff6a00]/80"
    : isSimpleSwapBlue
      ? "text-[#0870f8]/80"
      : "text-xcannes-green/80";
  const accentText90 = isBinanceYellow
    ? "text-[#F0B90B]/95"
    : isFireOrange
    ? "text-[#ff6a00]/90"
    : isSimpleSwapBlue
      ? "text-[#0870f8]/90"
      : "text-xcannes-green/90";
  const accentTextSolid = isBinanceYellow
    ? "text-[#F0B90B]"
    : isFireOrange
    ? "text-[#ff6a00]"
    : isSimpleSwapBlue
      ? "text-[#0870f8]"
      : "text-xcannes-green";
  const accentBadge = isBinanceYellow
    ? "bg-[#F0B90B]/15 text-[#F0B90B]"
    : isFireOrange
    ? "bg-[#ff6a00]/15 text-[#ff6a00]"
    : isSimpleSwapBlue
      ? "bg-[#0870f8]/15 text-[#0870f8]"
    : "bg-xcannes-green/15 text-xcannes-green";
  const accentRing60 = isBinanceYellow
    ? "focus:ring-[#F0B90B]/60"
    : isFireOrange
    ? "focus:ring-[#ff6a00]/60"
    : isSimpleSwapBlue
      ? "focus:ring-[#0870f8]/60"
    : "focus:ring-xcannes-green/60";
  const accentPulseDot = isBinanceYellow
    ? "ring-[#F0B90B]/25 bg-[#F0B90B]"
    : isFireOrange
    ? "ring-[#ff6a00]/25 bg-[#ff6a00]"
    : isSimpleSwapBlue
      ? "ring-[#0870f8]/25 bg-[#0870f8]"
    : "ring-xcannes-green/25 bg-xcannes-green";
  const accentSpinnerBorder = isBinanceYellow
    ? "border-[#F0B90B]"
    : isFireOrange
    ? "border-[#ff6a00]"
    : isSimpleSwapBlue
      ? "border-[#0870f8]"
      : "border-xcannes-green";
  const accentSwapIconShell = "bg-transparent ring-0";
  const accentSwapIcon = "text-white";
  const accentActiveCard = isBinanceYellow
    ? "bg-[#F0B90B]/10 ring-[#F0B90B]/35 text-white"
    : isFireOrange
    ? "bg-[#ff6a00]/10 ring-[#ff6a00]/35 text-white"
    : isSimpleSwapBlue
      ? "bg-[#0870f8]/10 ring-[#0870f8]/35 text-white"
    : "bg-xcannes-green/10 ring-xcannes-green/35 text-white";
  const accentActiveRow = isBinanceYellow
    ? "bg-[#F0B90B]/10 text-white"
    : isFireOrange
    ? "bg-[#ff6a00]/10 text-white"
    : isSimpleSwapBlue
      ? "bg-[#0870f8]/10 text-white"
      : "bg-xcannes-green/10 text-white";
  const actionBtnBase = isBinanceYellow
    ? binanceYellowActionBtnBase
    : isFireOrange
      ? fireOrangeActionBtnBase
    : isSimpleSwapBlue
      ? simpleSwapBlueActionBtnBase
      : greenActionBtnBase;
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });
  const swipeEnabled = false;

  const [step, setStep] = useState("form"); // form | address | pending | deposit
  const [direction, setDirection] = useState(SWAP_DIRECTIONS.RLUSD_TO_STABLE);
  const [walletAddressExpanded, setWalletAddressExpanded] = useState(false);
  const [walletAddressCopied, setWalletAddressCopied] = useState(false);
  const [rlusdCurrency, setRlusdCurrency] = useState(DEFAULT_RLUSD);
  const [currencies, setCurrencies] = useState([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [currenciesError, setCurrenciesError] = useState("");
  const [search, setSearch] = useState("");
  const [stableKey, setStableKey] = useState("");
  const [stableDropdownOpen, setStableDropdownOpen] = useState(false);
  const [stableDesktopPopupStyle, setStableDesktopPopupStyle] = useState(null);
  const stableDropdownRef = useRef(null);
  const stableDropdownOverlayRef = useRef(null);
  const stableDropdownListRef = useRef(null);
  const [stableOverlayDragging, setStableOverlayDragging] = useState(false);
  const [stableOverlayTranslateY, setStableOverlayTranslateY] = useState(0);
  const stableOverlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const [modalOverlayDragging, setModalOverlayDragging] = useState(false);
  const [modalOverlayTranslateY, setModalOverlayTranslateY] = useState(0);
  const [sourceSearch, setSourceSearch] = useState("");
  const [sourceDropdownOpen, setSourceDropdownOpen] = useState(false);
  const [sourceDesktopPopupStyle, setSourceDesktopPopupStyle] = useState(null);
  const sourceDropdownRef = useRef(null);
  const sourceDropdownOverlayRef = useRef(null);
  const sourceDropdownListRef = useRef(null);
  const [sourceOverlayDragging, setSourceOverlayDragging] = useState(false);
  const [sourceOverlayTranslateY, setSourceOverlayTranslateY] = useState(0);
  const sourceOverlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const modalOverlayRef = useRef(null);
  const modalOverlayListRef = useRef(null);
  const modalPanelRef = useRef(null);
  const modalOverlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const modalCloseRequestedRef = useRef(false);
  const [amount, setAmount] = useState("");
  const [receiveAddress, setReceiveAddress] = useState("");
  const [refundAddress, setRefundAddress] = useState("");
  const [refundExtraId, setRefundExtraId] = useState("");
  const [refundDetailsOpen, setRefundDetailsOpen] = useState(false);
  const [quote, setQuote] = useState(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [ranges, setRanges] = useState(null);
  const [apiError, setApiError] = useState("");
  const [pairUnavailable, setPairUnavailable] = useState(false);
  const [exchange, setExchange] = useState(null);
  const [exchangeRefreshing, setExchangeRefreshing] = useState(false);
  const [preparedSwap, setPreparedSwap] = useState(null);
  const [swapSubmitting, setSwapSubmitting] = useState(false);
  const estimateAbortRef = useRef(null);
  const estimateSeqRef = useRef(0);
  const openedRef = useRef(false);

  const maybeApplyResolvedRlusdCurrency = (resolved) => {
    if (!resolved || typeof resolved !== "object") return;
    const resTickerFrom = String(resolved?.tickerFrom || "").trim().toLowerCase();
    const resTickerTo = String(resolved?.tickerTo || "").trim().toLowerCase();
    const resNetworkFrom = String(resolved?.networkFrom || "").trim().toLowerCase();
    const resNetworkTo = String(resolved?.networkTo || "").trim().toLowerCase();
    const currentTicker = String(rlusdCurrency?.ticker || DEFAULT_RLUSD.ticker)
      .trim()
      .toLowerCase();
    const currentNetwork = String(rlusdCurrency?.network || DEFAULT_RLUSD.network)
      .trim()
      .toLowerCase();

    const isRlusd = (ticker) => {
      const normalized = String(ticker || "").trim().toLowerCase();
      return normalized === currentTicker || normalized === DEFAULT_RLUSD.ticker;
    };

    let nextTicker = "";
    let nextNetwork = "";
    if (isRlusd(resTickerFrom)) {
      nextTicker = resTickerFrom;
      nextNetwork = resNetworkFrom;
    } else if (isRlusd(resTickerTo)) {
      nextTicker = resTickerTo;
      nextNetwork = resNetworkTo;
    }

    if (!nextTicker || !nextNetwork) return;
    if (nextTicker === currentTicker && nextNetwork === currentNetwork) return;

    setRlusdCurrency((prev) => ({
      ticker: nextTicker || prev?.ticker || DEFAULT_RLUSD.ticker,
      network: nextNetwork || prev?.network || DEFAULT_RLUSD.network,
    }));
  };

  const parsedAmount = useMemo(
    () => Number(String(amount || "").trim().replace(",", ".")),
    [amount],
  );
  const hasValidAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const formatAmountNumber = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 8,
      });
    } catch {
      return null;
    }
  }, []);
  const formatUsdNumber = useMemo(() => {
    try {
      return new Intl.NumberFormat(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } catch {
      return null;
    }
  }, []);
  const rlusdKey = currencyKey(rlusdCurrency);
  const rlusdDisplayCurrency = useMemo(() => {
    const found = currencies.find((c) => currencyKey(c) === rlusdKey);
    if (found) return found;
    return {
      ...DEFAULT_RLUSD,
      ...rlusdCurrency,
      name: "RLUSD",
      image: CRYPTO_ICONS?.RLUSD || "",
    };
  }, [currencies, rlusdCurrency, rlusdKey]);
  const stableCurrency = useMemo(() => {
    if (!stableKey) return null;
    return currencies.find((c) => currencyKey(c) === stableKey) || null;
  }, [currencies, stableKey]);
  const walletSourceSelectionEnabled =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE &&
    String(sourceSelectionMode || "").trim().toLowerCase() === "wallet";
  const walletTargetSelectionEnabled =
    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD &&
    String(targetSelectionMode || "").trim().toLowerCase() === "wallet";
  const walletCurrencyShowBalance = walletSourceSelectionEnabled;
  const walletInlineSelectionEnabled =
    walletSourceSelectionEnabled || walletTargetSelectionEnabled;
  const totalStepsResolved = walletTargetSelectionEnabled ? 2 : 3;
  const currentStepIndexResolved =
    step === "form"
      ? 1
      : step === "address"
        ? 2
        : totalStepsResolved;
  const sourceCurrencyOptions = useMemo(() => {
    if (!walletInlineSelectionEnabled) return [];
    const seen = new Set();
    const orderedTokens = [
      ...availableTokens.filter((token) => String(token?.currency || "").toUpperCase() === "RLUSD"),
      ...availableTokens.filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code !== "RLUSD" && code !== "XRP";
      }),
    ];

    return orderedTokens
      .map((token) => {
        const currencyRaw = token?.currency;
        const currency = String(currencyRaw || "").trim().toUpperCase();
        if (!currency || seen.has(currency) || currency === "XRP") return null;
        if (currency !== "RLUSD" && currency !== "USD" && !token?.isTrustlineOnly) {
          return null;
        }
        seen.add(currency);

        const amountValue = Number(token?.value || 0);
        const fallbackAmountLabel =
          walletTargetSelectionEnabled || !Number.isFinite(amountValue)
            ? ""
            : `Solde : ${amountValue.toLocaleString(locale, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${currency}`;
        const baseLabel =
          selectLabelByCurrency?.[currencyRaw] ||
          selectLabelByCurrency?.[currency] ||
          currency;
        const resolvedLabel = walletTargetSelectionEnabled
          ? getCurrencyDescription(currency) || baseLabel
          : baseLabel;

        return {
          code: currency,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currency] ||
            null,
          label: resolvedLabel,
          labelRight:
            walletTargetSelectionEnabled
              ? ""
              : selectLabelRightByCurrency?.[currencyRaw] ||
                selectLabelRightByCurrency?.[currency] ||
                fallbackAmountLabel,
          isTrustlineOnly: Boolean(token?.isTrustlineOnly),
          value: Number(token?.value || 0),
          allocatedRlusd: Number(token?.allocatedRlusd),
        };
      })
      .filter(Boolean);
  }, [
    availableTokens,
    locale,
    selectIconByCurrency,
    selectLabelByCurrency,
    selectLabelRightByCurrency,
    walletTargetSelectionEnabled,
    walletInlineSelectionEnabled,
  ]);
  const filteredSourceCurrencyOptions = useMemo(() => {
    const needle = String(sourceSearch || "").trim().toLowerCase();
    if (!needle) return sourceCurrencyOptions;
    return sourceCurrencyOptions.filter((option) => {
      const code = String(option?.code || "").toLowerCase();
      const label = String(option?.label || "").toLowerCase();
      const right = String(option?.labelRight || "").toLowerCase();
      return `${code} ${label} ${right}`.includes(needle);
    });
  }, [sourceCurrencyOptions, sourceSearch]);
  const [sourceCurrencyCode, setSourceCurrencyCode] = useState("");
  const selectedSourceOption = useMemo(() => {
    const current = String(sourceCurrencyCode || "").trim().toUpperCase();
    if (!current) return sourceCurrencyOptions[0] || null;
    return (
      sourceCurrencyOptions.find(
        (option) => String(option?.code || "").trim().toUpperCase() === current,
      ) || sourceCurrencyOptions[0] || null
    );
  }, [sourceCurrencyCode, sourceCurrencyOptions]);
  const selectedSourceCurrencyCode = String(selectedSourceOption?.code || "RLUSD").toUpperCase();
  const selectedSourceAmount = parsedAmount;
  const selectedSourceIsCurrencyLine =
    walletInlineSelectionEnabled && selectedSourceCurrencyCode !== "RLUSD"
      ? Boolean(selectedSourceOption?.isTrustlineOnly)
      : false;
  const selectedSourceRlusdRate = !walletInlineSelectionEnabled
    ? 1
    : selectedSourceCurrencyCode === "RLUSD" || selectedSourceCurrencyCode === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[selectedSourceCurrencyCode]);
  const selectedSourceAvailableBalance = useMemo(() => {
    if (!walletSourceSelectionEnabled) return Number.NaN;
    const directBalance = Number(selectedSourceOption?.value);
    if (
      selectedSourceIsCurrencyLine &&
      Number.isFinite(Number(selectedSourceOption?.allocatedRlusd)) &&
      Number(selectedSourceOption?.allocatedRlusd) > 0 &&
      Number.isFinite(selectedSourceRlusdRate) &&
      selectedSourceRlusdRate > 0
    ) {
      return Number(selectedSourceOption.allocatedRlusd) / selectedSourceRlusdRate;
    }
    return Number.isFinite(directBalance) ? directBalance : Number.NaN;
  }, [
    selectedSourceIsCurrencyLine,
    selectedSourceOption,
    selectedSourceRlusdRate,
    walletSourceSelectionEnabled,
  ]);
  const outboundAmountRlusd = useMemo(() => {
    if (direction !== SWAP_DIRECTIONS.RLUSD_TO_STABLE) return Number.NaN;
    if (!Number.isFinite(selectedSourceAmount) || selectedSourceAmount <= 0) return Number.NaN;
    if (!walletSourceSelectionEnabled) return selectedSourceAmount;
    if (selectedSourceCurrencyCode === "RLUSD" || selectedSourceCurrencyCode === "USD") {
      return selectedSourceAmount;
    }
    if (selectedSourceIsCurrencyLine && Number.isFinite(selectedSourceRlusdRate) && selectedSourceRlusdRate > 0) {
      return selectedSourceAmount * selectedSourceRlusdRate;
    }
    return Number.NaN;
  }, [
    direction,
    selectedSourceAmount,
    selectedSourceCurrencyCode,
    selectedSourceIsCurrencyLine,
    selectedSourceRlusdRate,
    walletSourceSelectionEnabled,
  ]);
  const sourceConversionMissing =
    walletSourceSelectionEnabled &&
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE &&
    Number.isFinite(selectedSourceAmount) &&
    selectedSourceAmount > 0 &&
    selectedSourceCurrencyCode !== "RLUSD" &&
    selectedSourceCurrencyCode !== "USD" &&
    (!Number.isFinite(selectedSourceRlusdRate) || selectedSourceRlusdRate <= 0);
  const targetConversionMissing =
    walletTargetSelectionEnabled &&
    hasValidAmount &&
    selectedSourceCurrencyCode !== "RLUSD" &&
    selectedSourceCurrencyCode !== "USD" &&
    (!Number.isFinite(selectedSourceRlusdRate) || selectedSourceRlusdRate <= 0);
  const insufficientSourceBalance =
    walletSourceSelectionEnabled &&
    hasValidAmount &&
    Number.isFinite(selectedSourceAvailableBalance) &&
    parsedAmount > selectedSourceAvailableBalance;
  const sourceCurrencyDisplay = walletSourceSelectionEnabled
    ? {
        ticker: selectedSourceCurrencyCode.toLowerCase(),
        network: "wallet",
      }
    : rlusdCurrency;
  const fromCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? sourceCurrencyDisplay : stableCurrency;
  const toCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? stableCurrency : rlusdCurrency;
  const partnerPreviewFromCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? XRP_RAIL_CURRENCY : stableCurrency;
  const partnerPreviewToCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? stableCurrency : XRP_RAIL_CURRENCY;
  const fromCurrencyKey = currencyKey(fromCurrency);
  const toCurrencyKey = currencyKey(toCurrency);
  const toLabel = toCurrency ? currencyLabel(toCurrency) : "";
  const fromTicker = String(fromCurrency?.ticker || "").trim().toUpperCase();
  const fromNetwork = String(fromCurrency?.network || "").trim().toUpperCase();
  const toTicker = String(toCurrency?.ticker || "").trim().toUpperCase();
  const toNetwork = String(toCurrency?.network || "").trim().toUpperCase();
  const defaultReceiveAddress = direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? String(walletAddress || "").trim() : "";
  const effectiveReceiveAddress = String(receiveAddress || defaultReceiveAddress || "").trim();
  const expectedReceiveTicker =
    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
      ? String(rlusdCurrency?.ticker || "rlusd").trim().toUpperCase()
      : toTicker;
  const expectedReceiveNetwork =
    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
      ? String(rlusdCurrency?.network || "xrp").trim().toUpperCase()
      : toNetwork;
  const receiveAddressNetworkFamily = useMemo(
    () => normalizeAddressNetworkFamily(expectedReceiveNetwork),
    [expectedReceiveNetwork],
  );
  const receiveAddressIsLocallyValid = useMemo(() => {
    return validateAddressByNetworkFamily(effectiveReceiveAddress, receiveAddressNetworkFamily);
  }, [effectiveReceiveAddress, receiveAddressNetworkFamily]);
  const receiveAddressErrorMessage = useMemo(() => {
    if (!effectiveReceiveAddress || receiveAddressIsLocallyValid) return "";
    return t(
      "ui_usd_swap_invalid_receive_addr_network",
      `Adresse invalide pour ${expectedReceiveTicker || "cet actif"} sur ${expectedReceiveNetwork || "ce réseau"}.`,
    );
  }, [
    effectiveReceiveAddress,
    expectedReceiveNetwork,
    expectedReceiveTicker,
    receiveAddressIsLocallyValid,
    t,
  ]);
  const hasReceiveAddressValidationError = Boolean(receiveAddressErrorMessage);
  const flowTitle =
    String(titleOverride || "").trim() ||
    (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
      ? t("ui_swap_title_in_wallet", "Recevoir des stablecoins")
      : t("ui_swap_title_out", "RLUSD → stablecoin USD"));
  const flowTitleDisplay = String(flowTitle || "")
    .trim()
    .toUpperCase();
  const flowSubtitle =
    String(subtitleOverride || "").trim() ||
    (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
      ? t(
          "ui_swap_subtitle_in_wallet",
          "Choisissez le stablecoin, le montant puis la devise XCANNES créditée sur votre wallet.",
        )
      : t(
          "ui_swap_subtitle_out",
          "Choisissez une devise, le montant, le stablecoin souhaité puis l'adresse de votre wallet de réception.",
        ));
  const walletSelectorDialogTitle = t(
    "ui_choose_wallet_currency",
    "Choisir une devise",
  );
  const walletSelectorDialogSubtitle = walletTargetSelectionEnabled
    ? t(
        "ui_choose_wallet_currency_target_subtitle",
        "Sélectionnez la devise créditée sur votre wallet.",
      )
    : t(
        "ui_choose_wallet_currency_subtitle",
        "Sélectionnez l’actif source du wallet.",
      );

  const quotedReceiveAmount = useMemo(() => parseSimpleSwapEstimateAmount(quote), [quote]);
  const quotedPartnerReceiveAmount = useMemo(() => {
    const partnerAmount = Number(quote?.partnerEstimatedAmount);
    return Number.isFinite(partnerAmount) && partnerAmount > 0 ? partnerAmount : null;
  }, [quote]);

  const rangeLimits = useMemo(() => parseSimpleSwapRanges(ranges), [ranges]);
  const minFromAmount = useMemo(() => {
    const raw = rangeLimits?.min ?? null;
    if (
      direction !== SWAP_DIRECTIONS.RLUSD_TO_STABLE ||
      !walletSourceSelectionEnabled ||
      !Number.isFinite(raw) ||
      raw <= 0
    ) {
      return raw;
    }
    if (selectedSourceCurrencyCode === "RLUSD" || selectedSourceCurrencyCode === "USD") {
      return raw;
    }
    if (Number.isFinite(selectedSourceRlusdRate) && selectedSourceRlusdRate > 0) {
      return raw / selectedSourceRlusdRate;
    }
    return raw;
  }, [
    direction,
    rangeLimits?.min,
    selectedSourceCurrencyCode,
    selectedSourceRlusdRate,
    walletSourceSelectionEnabled,
  ]);
  const maxFromAmount = useMemo(() => {
    const raw = rangeLimits?.max ?? null;
    if (
      direction !== SWAP_DIRECTIONS.RLUSD_TO_STABLE ||
      !walletSourceSelectionEnabled ||
      !Number.isFinite(raw) ||
      raw <= 0
    ) {
      return raw;
    }
    if (selectedSourceCurrencyCode === "RLUSD" || selectedSourceCurrencyCode === "USD") {
      return raw;
    }
    if (Number.isFinite(selectedSourceRlusdRate) && selectedSourceRlusdRate > 0) {
      return raw / selectedSourceRlusdRate;
    }
    return raw;
  }, [
    direction,
    rangeLimits?.max,
    selectedSourceCurrencyCode,
    selectedSourceRlusdRate,
    walletSourceSelectionEnabled,
  ]);
  const amountBelowMin =
    hasValidAmount && Number.isFinite(minFromAmount) && parsedAmount < minFromAmount;
  const amountAboveMax =
    hasValidAmount && Number.isFinite(maxFromAmount) && parsedAmount > maxFromAmount;
  const amountOutOfRange = amountBelowMin || amountAboveMax;
  const sendApproxUsdAmount =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE &&
    walletSourceSelectionEnabled &&
    Number.isFinite(outboundAmountRlusd) &&
    outboundAmountRlusd > 0
      ? outboundAmountRlusd
      : hasValidAmount
        ? parsedAmount
        : Number.NaN;
  const quotedWalletReceiveAmount = useMemo(() => {
    if (!walletTargetSelectionEnabled) return quotedReceiveAmount;
    if (!Number.isFinite(Number(quotedReceiveAmount)) || Number(quotedReceiveAmount) <= 0) {
      return null;
    }
    if (selectedSourceCurrencyCode === "RLUSD" || selectedSourceCurrencyCode === "USD") {
      return Number(quotedReceiveAmount);
    }
    if (Number.isFinite(selectedSourceRlusdRate) && selectedSourceRlusdRate > 0) {
      return Number(quotedReceiveAmount) / selectedSourceRlusdRate;
    }
    return null;
  }, [
    quotedReceiveAmount,
    selectedSourceCurrencyCode,
    selectedSourceRlusdRate,
    walletTargetSelectionEnabled,
  ]);
  const receiveDisplayAmount = walletTargetSelectionEnabled
    ? quotedWalletReceiveAmount
    : quotedReceiveAmount;
  const receiveApproxUsdAmount =
    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD && walletTargetSelectionEnabled
      ? quotedReceiveAmount
      : quotedReceiveAmount;

  useEffect(() => {
    if (!open) return;
    setPairUnavailable(false);
  }, [open, direction, fromCurrencyKey, toCurrencyKey]);

  useEffect(() => {
    // Refresh min/max when the pair changes (not on amount typing).
    setRanges(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromCurrencyKey, toCurrencyKey, direction]);

  useEffect(() => {
    if (!stableDropdownOpen) return;
    // Prevent iOS keyboard from opening when the dropdown appears.
    try {
      document?.activeElement?.blur?.();
    } catch {
      // ignore
    }
  }, [stableDropdownOpen]);

  useEffect(() => {
    if (!sourceDropdownOpen) return;
    try {
      document?.activeElement?.blur?.();
    } catch {
      // ignore
    }
  }, [sourceDropdownOpen]);

  const filteredStableOptions = useMemo(() => {
    const needle = String(search || "").trim().toLowerCase();
    const list = currencies
      .filter((c) => {
        const key = currencyKey(c);
        if (!key) return false;
        if (key === rlusdKey) return false;
        if (!needle) return true;
        const hay = `${c.ticker || ""} ${c.network || ""} ${c.name || ""}`.toLowerCase();
        return hay.includes(needle);
      })
      .slice();

    list.sort((a, b) => {
      const aTicker = String(a?.ticker || "").toLowerCase();
      const bTicker = String(b?.ticker || "").toLowerCase();
      const aIdx = PRIORITY_TICKERS.indexOf(aTicker);
      const bIdx = PRIORITY_TICKERS.indexOf(bTicker);
      const ap = aIdx === -1 ? 999 : aIdx;
      const bp = bIdx === -1 ? 999 : bIdx;
      if (ap !== bp) return ap - bp;
      if (aTicker !== bTicker) return aTicker.localeCompare(bTicker);
      return String(a?.network || "").localeCompare(String(b?.network || ""));
    });

    return list;
  }, [currencies, rlusdKey, search]);

  const stableSearchResults = useMemo(
    () => filteredStableOptions.slice(0, MAX_STABLE_SEARCH_RESULTS),
    [filteredStableOptions],
  );

  useEffect(() => {
    if (!stableDropdownOpen || !isDesktop) {
      setStableDesktopPopupStyle(null);
      return;
    }

    const update = () => {
      try {
        const triggerEl = stableDropdownRef.current;
        const modalEl = modalOverlayRef.current;
        if (!triggerEl || !modalEl) return;

        const triggerRect = triggerEl.getBoundingClientRect();
        const modalRect = modalEl.getBoundingClientRect();
        const padding = 12;
        const gap = 8;

        const maxWidth = Math.max(280, modalRect.width - padding * 2);
        const width = Math.min(560, maxWidth);
        const centerX = triggerRect.left + triggerRect.width / 2;
        let left = centerX - width / 2;
        left = Math.max(modalRect.left + padding, left);
        left = Math.min(modalRect.right - padding - width, left);

        let top = triggerRect.bottom + gap;
        let maxHeight = modalRect.bottom - padding - top;

        if (maxHeight < 220) {
          const spaceAbove = triggerRect.top - gap - (modalRect.top + padding);
          if (spaceAbove > maxHeight) {
            maxHeight = spaceAbove;
            top = Math.max(modalRect.top + padding, triggerRect.top - gap - maxHeight);
          }
        }

        setStableDesktopPopupStyle({
          position: "fixed",
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${Math.round(width)}px`,
          maxHeight: `${Math.round(Math.max(180, maxHeight))}px`,
        });
      } catch {
        // ignore
      }
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isDesktop, stableDropdownOpen]);

  useEffect(() => {
    if (!sourceDropdownOpen || !isDesktop) {
      setSourceDesktopPopupStyle(null);
      return;
    }

    const update = () => {
      try {
        const triggerEl = sourceDropdownRef.current;
        const modalEl = modalOverlayRef.current;
        if (!triggerEl || !modalEl) return;

        const triggerRect = triggerEl.getBoundingClientRect();
        const modalRect = modalEl.getBoundingClientRect();
        const padding = 12;
        const gap = 8;

        const maxWidth = Math.max(280, modalRect.width - padding * 2);
        const width = Math.min(560, maxWidth);
        const centerX = triggerRect.left + triggerRect.width / 2;
        let left = centerX - width / 2;
        left = Math.max(modalRect.left + padding, left);
        left = Math.min(modalRect.right - padding - width, left);

        let top = triggerRect.bottom + gap;
        let maxHeight = modalRect.bottom - padding - top;

        if (maxHeight < 220) {
          const spaceAbove = triggerRect.top - gap - (modalRect.top + padding);
          if (spaceAbove > maxHeight) {
            maxHeight = spaceAbove;
            top = Math.max(modalRect.top + padding, triggerRect.top - gap - maxHeight);
          }
        }

        setSourceDesktopPopupStyle({
          position: "fixed",
          left: `${Math.round(left)}px`,
          top: `${Math.round(top)}px`,
          width: `${Math.round(width)}px`,
          maxHeight: `${Math.round(Math.max(180, maxHeight))}px`,
        });
      } catch {
        // ignore
      }
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isDesktop, sourceDropdownOpen]);

  const popularStableOptions = useMemo(() => {
    if (!currencies.length) return [];
    return POPULAR_STABLE_TARGETS.map((target) => {
      const match = currencies.find((cur) => matchStableTarget(cur, target));
      if (!match) return null;
      return {
        key: currencyKey(match),
        label: target.label,
        currency: match,
      };
    }).filter(Boolean);
  }, [currencies]);

  const exchangeId = useMemo(
    () => pick(exchange, ["id", "exchangeId", "publicId"], ""),
    [exchange],
  );
  const exchangeResolved = useMemo(() => {
    if (exchange?.xcannesResolved && typeof exchange.xcannesResolved === "object") {
      return exchange.xcannesResolved;
    }
    return exchange || {};
  }, [exchange]);
  const depositAddress = useMemo(
    () => pick(exchange, ["addressFrom", "address_from", "depositAddress"], ""),
    [exchange],
  );
  const depositExtraId = useMemo(
    () => pick(exchange, ["extraIdFrom", "extra_id_from", "depositExtraId"], ""),
    [exchange],
  );
  const sendAmountExact = useMemo(
    () => pick(exchange, ["amountFrom", "amount_from", "amount", "amountSend"], ""),
    [exchange],
  );
  const receiveAmountExact = useMemo(() => {
    return pick(exchange, ["amountTo", "amount_to", "amountReceive", "amount_received"], "");
  }, [exchange]);
  const status = useMemo(
    () => pick(exchange, ["status", "state"], ""),
    [exchange],
  );
  const partnerFromTicker = useMemo(
    () => pick(exchangeResolved, ["tickerFrom"], fromTicker).toUpperCase(),
    [exchangeResolved, fromTicker],
  );
  const partnerFromNetwork = useMemo(
    () => pick(exchangeResolved, ["networkFrom"], fromNetwork).toUpperCase(),
    [exchangeResolved, fromNetwork],
  );
  const partnerToTicker = useMemo(
    () => pick(exchangeResolved, ["tickerTo"], toTicker).toUpperCase(),
    [exchangeResolved, toTicker],
  );
  const partnerToNetwork = useMemo(
    () => pick(exchangeResolved, ["networkTo"], toNetwork).toUpperCase(),
    [exchangeResolved, toNetwork],
  );
  const exactInboundXrp = useMemo(() => {
    const value = Number(String(receiveAmountExact || "").trim().replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [receiveAmountExact]);

  const resetState = (prefill = "") => {
    setStep("form");
    setSearch("");
    setStableDropdownOpen(false);
    setSourceSearch("");
    setSourceDropdownOpen(false);
    setStableKey("");
    setSourceCurrencyCode("");
    setAmount(String(prefill || ""));
    setReceiveAddress("");
    setRefundAddress("");
    setRefundExtraId("");
    setRefundDetailsOpen(false);
    setQuote(null);
    setRanges(null);
    setApiError("");
    setExchange(null);
    setPreparedSwap(null);
    setSwapSubmitting(false);
    setCurrenciesError("");
    setWalletAddressExpanded(false);
    setWalletAddressCopied(false);
  };

  const handleCopyWalletAddress = async (event) => {
    event?.stopPropagation?.();
    try {
      const value = String(walletAddress || "").trim();
      if (!value) return;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setWalletAddressCopied(true);
      window.setTimeout(() => setWalletAddressCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (!open) {
      openedRef.current = false;
      return;
    }
    if (openedRef.current) return;
    openedRef.current = true;
    const allowed = Object.values(SWAP_DIRECTIONS);
    const nextDirection = allowed.includes(initialDirection)
      ? initialDirection
      : SWAP_DIRECTIONS.RLUSD_TO_STABLE;
    setDirection(nextDirection);
    resetState(initialAmount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDirection, initialAmount]);

  useEffect(() => {
    if (!open) return;
    if (!walletInlineSelectionEnabled) return;
    const initial = String(
      walletTargetSelectionEnabled ? initialTargetCurrency : initialSourceCurrency,
    )
      .trim()
      .toUpperCase();
    if (
      initial &&
      sourceCurrencyOptions.some(
        (option) => String(option?.code || "").trim().toUpperCase() === initial,
      )
    ) {
      setSourceCurrencyCode((prev) => (prev ? prev : initial));
      return;
    }
    if (sourceCurrencyOptions.length) {
      setSourceCurrencyCode((prev) =>
        prev && sourceCurrencyOptions.some((option) => option.code === prev)
          ? prev
          : sourceCurrencyOptions[0].code,
      );
    }
  }, [
    initialSourceCurrency,
    initialTargetCurrency,
    open,
    sourceCurrencyOptions,
    walletInlineSelectionEnabled,
    walletTargetSelectionEnabled,
  ]);

  useEffect(() => {
    if (!stableDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined" && !isDesktop)
        document.body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    const handlePointerDown = (event) => {
      const el = stableDropdownRef.current;
      const overlay = stableDropdownOverlayRef.current;
      if (!el) {
        setStableDropdownOpen(false);
        return;
      }
      if (el.contains(event.target)) return;
      if (overlay && overlay.contains(event.target)) return;
      setStableDropdownOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setStableDropdownOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    if (!isDesktop) document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      try {
        if (typeof document !== "undefined") document.body.style.overflow = prevOverflow || "";
      } catch {
        // ignore
      }
    };
  }, [isDesktop, stableDropdownOpen]);

  useEffect(() => {
    if (!sourceDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined" && !isDesktop)
        document.body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    const handlePointerDown = (event) => {
      const el = sourceDropdownRef.current;
      const overlay = sourceDropdownOverlayRef.current;
      if (!el) {
        setSourceDropdownOpen(false);
        return;
      }
      if (el.contains(event.target)) return;
      if (overlay && overlay.contains(event.target)) return;
      setSourceDropdownOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSourceDropdownOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    if (!isDesktop) document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
      try {
        if (typeof document !== "undefined") document.body.style.overflow = prevOverflow || "";
      } catch {
        // ignore
      }
    };
  }, [isDesktop, sourceDropdownOpen]);

  useEffect(() => {
    if (stableDropdownOpen) return;
    setStableOverlayDragging(false);
    setStableOverlayTranslateY(0);
    stableOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  }, [stableDropdownOpen]);

  useEffect(() => {
    if (sourceDropdownOpen) return;
    setSourceOverlayDragging(false);
    setSourceOverlayTranslateY(0);
    sourceOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  }, [sourceDropdownOpen]);

  const releaseStableOverlayScrollLock = () => {
    const meta = stableOverlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = stableDropdownListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartStableOverlayDrag = (event, source) => {
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = stableDropdownListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    stableOverlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleStableOverlayPointerMove = (event) => {
    const meta = stableOverlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      // Start drag.
      try {
        stableDropdownOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = stableDropdownListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setStableOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setStableOverlayTranslateY(delta);
  };

  const handleStableOverlayPointerEnd = (event) => {
    const meta = stableOverlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const shouldClose = delta > 160 || velocity > 1.0;

    stableOverlayDragMetaRef.current.pending = false;
    stableOverlayDragMetaRef.current.dragging = false;
    setStableOverlayDragging(false);
    releaseStableOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      setStableOverlayTranslateY(Math.max(delta, height));
      window.setTimeout(() => {
        setStableDropdownOpen(false);
      }, 180);
      stableOverlayDragMetaRef.current = {
        startY: 0,
        startAt: 0,
        pointerId: null,
        lastDelta: 0,
        pending: false,
        source: null,
        dragging: false,
        scrollLocked: false,
        lockedOverflowY: "",
      };
      return;
    }

    setStableOverlayTranslateY(0);
    stableOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  const releaseSourceOverlayScrollLock = () => {
    const meta = sourceOverlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = sourceDropdownListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartSourceOverlayDrag = (event, source) => {
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = sourceDropdownListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    sourceOverlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleSourceOverlayPointerMove = (event) => {
    const meta = sourceOverlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        sourceDropdownOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = sourceDropdownListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setSourceOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setSourceOverlayTranslateY(delta);
  };

  const handleSourceOverlayPointerEnd = (event) => {
    const meta = sourceOverlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration;
    const shouldClose = delta > 160 || velocity > 1.0;

    sourceOverlayDragMetaRef.current.pending = false;
    sourceOverlayDragMetaRef.current.dragging = false;
    setSourceOverlayDragging(false);
    releaseSourceOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      setSourceOverlayTranslateY(Math.max(delta, height));
      window.setTimeout(() => {
        setSourceDropdownOpen(false);
        setSourceSearch("");
      }, 180);
      sourceOverlayDragMetaRef.current = {
        startY: 0,
        startAt: 0,
        pointerId: null,
        lastDelta: 0,
        pending: false,
        source: null,
        dragging: false,
        scrollLocked: false,
        lockedOverflowY: "",
      };
      return;
    }

    setSourceOverlayTranslateY(0);
    sourceOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  const fetchCurrencies = async () => {
    setCurrenciesLoading(true);
    setCurrenciesError("");
    try {
      const response = await fetch("/api/simpleswap/currencies");
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      const list = Array.isArray(data?.currencies) ? data.currencies : [];
      setCurrencies(list);

      const rlusd = data?.rlusd || DEFAULT_RLUSD;
      const nextRlusd = {
        ticker: String(rlusd?.ticker || DEFAULT_RLUSD.ticker).toLowerCase(),
        network: String(rlusd?.network || DEFAULT_RLUSD.network).toLowerCase(),
      };
      setRlusdCurrency(nextRlusd);

      // Default stable selection: pick the most-used pairs first (USDT TRON, then USDT/USDC major networks).
      const byTicker = (ticker) =>
        list.filter(
          (c) =>
            String(c?.ticker || "").toLowerCase() === ticker &&
            currencyKey(c) !== currencyKey(nextRlusd),
        );
      const pickPreferred = (items) => {
        if (!items.length) return null;
        const eth = items.find((c) => String(c?.network || "").toLowerCase() === "eth");
        return eth || items[0];
      };

      const preferredQuick =
        QUICK_STABLE_TARGETS.map((target) => list.find((cur) => matchStableTarget(cur, target)))
          .find(Boolean) || null;
      const preferred =
        preferredQuick ||
        pickPreferred(byTicker("usdt")) ||
        pickPreferred(byTicker("usdc")) ||
        list.find((cur) => currencyKey(cur) !== currencyKey(nextRlusd)) ||
        null;
      const preferredKey = preferred ? currencyKey(preferred) : "";
      if (preferredKey) {
        setStableKey((prev) => {
          if (prev && list.some((cur) => currencyKey(cur) === prev)) return prev;
          return preferredKey;
        });
      }
    } catch (error) {
      setCurrenciesError(error?.message || "Impossible de charger les devises SimpleSwap.");
      setCurrencies([]);
    } finally {
      setCurrenciesLoading(false);
    }
  };

  const fetchRanges = async () => {
    if (!partnerPreviewFromCurrency || !partnerPreviewToCurrency) return;
    if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE && walletSourceSelectionEnabled && sourceConversionMissing) {
      setRanges(null);
      return;
    }
    setApiError("");
    setRanges(null);
    try {
      const response = await fetch(
        `/api/simpleswap/ranges?${new URLSearchParams({
          fixed: "false",
          reverse: "false",
          tickerFrom: String(partnerPreviewFromCurrency.ticker || ""),
          networkFrom: String(partnerPreviewFromCurrency.network || ""),
          tickerTo: String(partnerPreviewToCurrency.ticker || ""),
          networkTo: String(partnerPreviewToCurrency.network || ""),
        }).toString()}`,
      );
      const data = await response.json();
      if (response.ok) {
        if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE) {
          const partnerLimits = parseSimpleSwapRanges(data);
          const [minQuote, maxQuote] = await Promise.all([
            Number.isFinite(partnerLimits?.min) && partnerLimits.min > 0
              ? xcannesApi.getRlusdXrpQuote({
                  amountXrp: partnerLimits.min,
                  direction: "RLUSD_TO_XRP",
                })
              : Promise.resolve(null),
            Number.isFinite(partnerLimits?.max) && partnerLimits.max > 0
              ? xcannesApi.getRlusdXrpQuote({
                  amountXrp: partnerLimits.max,
                  direction: "RLUSD_TO_XRP",
                })
              : Promise.resolve(null),
          ]);
          setRanges({
            minAmount: Number(minQuote?.amountRlusdFilled) > 0 ? Number(minQuote.amountRlusdFilled) : null,
            maxAmount: Number(maxQuote?.amountRlusdFilled) > 0 ? Number(maxQuote.amountRlusdFilled) : null,
            partnerMinAmount: partnerLimits?.min ?? null,
            partnerMaxAmount: partnerLimits?.max ?? null,
            xcannesPreviewMode: "rlusd_via_xrp",
            xcannesPartnerPair: {
              tickerFrom: "xrp",
              networkFrom: "xrp",
              tickerTo: String(toCurrency?.ticker || ""),
              networkTo: String(toCurrency?.network || ""),
            },
          });
        } else {
          setRanges(data);
        }
        setPairUnavailable(false);
        return;
      }

      const message =
        String(data?.message || data?.error || "").trim() ||
        String(data?.details?.message || data?.details?.error || "").trim() ||
        `HTTP ${response.status}`;

      if (response.status === 404 && /pair is unavailable/i.test(message)) {
        setPairUnavailable(true);
        if (
          direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD &&
          String(partnerPreviewToCurrency?.ticker || "").trim().toLowerCase() === "rlusd" &&
          String(partnerPreviewToCurrency?.network || "").trim().toLowerCase() === "xrp"
        ) {
          setApiError(
            t(
              "ui_usd_swap_pair_unavailable_rlusd_xrp",
              "RLUSD (XRPL) n’est pas disponible en réception via l’API SimpleSwap pour cette paire (voir /pairs).",
            ),
          );
        }
      }
    } catch {
      // ignore (non-bloquant)
    }
  };

  const fetchEstimate = async ({ signal } = {}) => {
    if (!fromCurrency || !toCurrency || !partnerPreviewFromCurrency || !partnerPreviewToCurrency || !hasValidAmount) return;
    if (amountOutOfRange) return;
    if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE && sourceConversionMissing) {
      setQuote(null);
      return;
    }
    try {
      const tryEndpoints = ["/api/simpleswap/estimates", "/api/simpleswap/check"];

      const runEstimate = async (candidateFrom, candidateTo, amountValue) => {
        const params = new URLSearchParams({
          fixed: "false",
          reverse: "false",
          tickerFrom: String(candidateFrom?.ticker || ""),
          networkFrom: String(candidateFrom?.network || ""),
          tickerTo: String(candidateTo?.ticker || ""),
          networkTo: String(candidateTo?.network || ""),
          amount: String(amountValue),
        }).toString();

        let lastErrorMessage = "";
        let lastStatus = 0;
        for (const endpoint of tryEndpoints) {
          const response = await fetch(`${endpoint}?${params}`, { signal });
          const data = await response.json().catch(() => null);
          if (!response.ok) {
            lastStatus = response.status;
            lastErrorMessage =
              String(data?.message || data?.error || "").trim() ||
              String(data?.details?.message || data?.details?.error || "").trim() ||
              `HTTP ${response.status}`;
            continue;
          }
          if (data == null) continue;
          return { ok: true, data };
        }
        return { ok: false, status: lastStatus, message: lastErrorMessage };
      };

      setPairUnavailable(false);
      if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE) {
        const bridgeQuote = await xcannesApi.getRlusdXrpQuote({
          amountRlusd: outboundAmountRlusd,
          direction: "RLUSD_TO_XRP",
        });
        const bridgeXrpAmount = Number(bridgeQuote?.xrpAmount);
        if (!Number.isFinite(bridgeXrpAmount) || bridgeXrpAmount <= 0) {
          throw new Error(
            t(
              "ui_usd_swap_prepare_xrpl_failed",
              "Impossible de préparer le swap XRPL RLUSD → XRP.",
            ),
          );
        }

        const primary = await runEstimate(
          partnerPreviewFromCurrency,
          partnerPreviewToCurrency,
          bridgeXrpAmount,
        );
        if (primary.ok) {
          const partnerAmount = parseSimpleSwapEstimateAmount(primary.data);
          if (partnerAmount != null) {
            setQuote({
              estimatedAmount: partnerAmount,
              partnerEstimatedAmount: partnerAmount,
              partnerAmountInXrp: bridgeXrpAmount,
              bridgeQuote,
              partnerQuote: primary.data,
              xcannesPreviewMode: "rlusd_via_xrp",
            });
            setApiError("");
            setPairUnavailable(false);
            return;
          }
        }

        const lastStatus = Number(primary?.status) || 0;
        const lastErrorMessage = String(primary?.message || "").trim();
        const pairIsUnavailable =
          lastStatus === 404 &&
          /pair is unavailable/i.test(lastErrorMessage || "");

        if (lastErrorMessage) {
          if (lastStatus === 404) {
            setPairUnavailable(true);
            setApiError(
              t(
                "ui_usd_swap_pair_not_supported",
                pairIsUnavailable
                  ? `Paire indisponible dans ce sens (XRP/XRP → ${toTicker}/${toNetwork}). Essayez un autre réseau.`
                  : `Paire non supportée dans ce sens (XRP/XRP → ${toTicker}/${toNetwork}). Essayez un autre réseau.`,
              ),
            );
          } else {
            setApiError(lastErrorMessage);
          }
        }
        return;
      }

      const primary = await runEstimate(
        partnerPreviewFromCurrency,
        partnerPreviewToCurrency,
        parsedAmount,
      );
      if (primary.ok) {
        const partnerXrpAmount = parseSimpleSwapEstimateAmount(primary.data);
        if (partnerXrpAmount != null) {
          const bridgeQuote = await xcannesApi.getRlusdXrpQuote({
            amountXrp: partnerXrpAmount,
            direction: "XRP_TO_RLUSD",
          });
          const finalRlusdAmount = Number(bridgeQuote?.amountRlusdFilled);
          if (Number.isFinite(finalRlusdAmount) && finalRlusdAmount > 0) {
            setQuote({
              estimatedAmount: finalRlusdAmount,
              partnerEstimatedAmount: partnerXrpAmount,
              bridgeQuote,
              partnerQuote: primary.data,
              xcannesPreviewMode: "stable_via_xrp",
            });
            setApiError("");
            setPairUnavailable(false);
            return;
          }
        }
      }

      const lastStatus = Number(primary?.status) || 0;
      const lastErrorMessage = String(primary?.message || "").trim();
      const pairIsUnavailable =
        lastStatus === 404 &&
        /pair is unavailable/i.test(lastErrorMessage || "");

      if (lastErrorMessage) {
        if (lastStatus === 404) {
          setPairUnavailable(true);
          const rlusdPayoutBlocked =
            direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD &&
            String(partnerPreviewToCurrency?.ticker || "").trim().toLowerCase() === "rlusd" &&
            String(partnerPreviewToCurrency?.network || "").trim().toLowerCase() === "xrp" &&
            pairIsUnavailable;
          setApiError(
            t(
              "ui_usd_swap_pair_not_supported",
              rlusdPayoutBlocked
                ? `SimpleSwap renvoie “Pair is unavailable” pour RLUSD (XRPL) en réception. Vérifiez que votre API-key autorise bien cette paire et que le tag XRPL est correctement géré côté serveur (variable SIMPLESWAP_TAG_RLUSD).`
                : pairIsUnavailable
                  ? `Paire indisponible dans ce sens (${fromTicker}/${fromNetwork} → ${toTicker}/${toNetwork}). Essayez un autre réseau.`
                  : `Paire non supportée (${fromTicker}/${fromNetwork} → ${toTicker}/${toNetwork}). Essayez un autre réseau.`,
            ),
          );
        } else {
          setApiError(lastErrorMessage);
        }
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      setApiError(error?.message || "Impossible de récupérer une estimation.");
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchRanges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromCurrencyKey, toCurrencyKey]);

  useEffect(() => {
    if (!open) return;
    if (!fromCurrency || !toCurrency || !hasValidAmount) return;

    const seq = (estimateSeqRef.current += 1);
    const controller = new AbortController();
    try {
      estimateAbortRef.current?.abort?.();
    } catch {
      // ignore
    }
    estimateAbortRef.current = controller;
    setQuoteLoading(true);

    const timer = window.setTimeout(() => {
      fetchEstimate({ signal: controller.signal }).finally(() => {
        if (estimateSeqRef.current === seq) setQuoteLoading(false);
      });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, fromCurrencyKey, toCurrencyKey, parsedAmount, hasValidAmount]);

  useEffect(() => {
    if (!open) return;
    if (hasValidAmount) return;
    setQuoteLoading(false);
    setQuote(null);
    setPairUnavailable(false);
  }, [hasValidAmount, open]);

  const createExchange = async ({ returnStep = "address" } = {}) => {
    if (!fromCurrency || !toCurrency || !hasValidAmount) return;
    if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE && sourceConversionMissing) {
      setApiError(
        t(
          "ui_rate_unavailable_base_5c1a9b7d2e",
          "Rate unavailable for base currency.",
        ),
      );
      return;
    }
    if (insufficientSourceBalance) {
      setApiError(
        t(
          "ui_insufficient_balance",
          "Solde insuffisant.",
        ),
      );
      return;
    }
    if (amountOutOfRange) {
      const minText =
        Number.isFinite(minFromAmount) && minFromAmount
          ? `${minFromAmount} ${fromTicker || ""}`
          : "";
      const maxText =
        Number.isFinite(maxFromAmount) && maxFromAmount
          ? `${maxFromAmount} ${fromTicker || ""}`
          : "";
      setApiError(
        amountBelowMin
          ? t("ui_usd_swap_min_amount", `Montant minimum : ${minText}.`)
          : t("ui_usd_swap_max_amount", `Montant maximum : ${maxText}.`),
      );
      return;
    }
    const addr = effectiveReceiveAddress;
    if (!addr) {
      setApiError(t("ui_usd_swap_missing_receive_addr", "Adresse de réception requise."));
      return;
    }
    if (hasReceiveAddressValidationError) {
      setApiError(receiveAddressErrorMessage);
      return;
    }

    setApiError("");
    setPreparedSwap(null);
    setStep("pending");
    try {
      const refund =
        direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
          ? String(walletAddress || "").trim()
          : String(refundAddress || "").trim();
      const refundExtra =
        direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
          ? ""
          : String(refundExtraId || "").trim();
      let preparedOutboundSwap = null;
      let exchangeTickerFrom = String(fromCurrency.ticker || "");
      let exchangeNetworkFrom = String(fromCurrency.network || "");
      let exchangeTickerTo = String(toCurrency.ticker || "");
      let exchangeNetworkTo = String(toCurrency.network || "");
      let exchangeAmount = String(parsedAmount);

      if (direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE) {
        preparedOutboundSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: walletAddress,
          direction: "RLUSD_TO_XRP",
          amountRlusd: outboundAmountRlusd,
        });
        const preparedXrpAmount = Number(preparedOutboundSwap?.quote?.xrpAmount);
        if (!Number.isFinite(preparedXrpAmount) || preparedXrpAmount <= 0) {
          throw new Error(
            t(
              "ui_usd_swap_prepare_xrpl_failed",
              "Impossible de préparer le swap XRPL RLUSD → XRP.",
            ),
          );
        }
        exchangeTickerFrom = "xrp";
        exchangeNetworkFrom = "xrp";
        exchangeAmount = String(Number(preparedXrpAmount.toFixed(6)));
      } else {
        exchangeTickerTo = "xrp";
        exchangeNetworkTo = "xrp";
      }

      const response = await fetch("/api/simpleswap/create-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixed: false,
          reverse: false,
          tickerFrom: exchangeTickerFrom,
          networkFrom: exchangeNetworkFrom,
          tickerTo: exchangeTickerTo,
          networkTo: exchangeNetworkTo,
          amount: exchangeAmount,
          addressTo: addr,
          extraIdTo: "",
          userRefundAddress: refund,
          userRefundExtraId: refundExtra,
          rateId: null,
          customFee: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      setExchange(data);
      setPreparedSwap(preparedOutboundSwap);
      maybeApplyResolvedRlusdCurrency(data?.xcannesResolved);
      if (
        direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE &&
        typeof window !== "undefined"
      ) {
        const exchangeIdValue = pick(data, ["id", "exchangeId", "publicId"], "");
        const depositAddr = pick(data, ["addressFrom", "address_from", "depositAddress"], "");
        const depositMemo = pick(data, ["extraIdFrom", "extra_id_from", "depositExtraId"], "");
        const amountFromValue = pick(data, ["amountFrom", "amount_from", "amount", "amountSend"], "");
        if (depositAddr) {
          try {
            const prev = safeReadJsonArray(
              window.sessionStorage?.getItem(SIMPLESWAP_DEPOSITS_STORAGE_KEY),
            );
            const next = [
              {
                exchangeId: exchangeIdValue || null,
                depositAddress: depositAddr,
                depositExtraId: depositMemo || null,
                amountFrom: amountFromValue || null,
                tickerFrom: exchangeTickerFrom,
                networkFrom: exchangeNetworkFrom,
                tickerTo: exchangeTickerTo,
                networkTo: exchangeNetworkTo,
                targetCurrencyCode:
                  String(toCurrency?.ticker || "USD").trim().toUpperCase() || "USD",
                amountRlusd: outboundAmountRlusd,
                sourceCurrencyCode:
                  String(selectedSourceCurrencyCode || "RLUSD").trim().toUpperCase() || "RLUSD",
                sourceAmount: parsedAmount,
                createdAt: new Date().toISOString(),
              },
              ...prev,
            ]
              .filter(
                (item, idx, arr) =>
                  item &&
                  typeof item === "object" &&
                  String(item.depositAddress || "").trim() &&
                  arr.findIndex(
                    (other) =>
                      String(other?.depositAddress || "").trim() ===
                      String(item.depositAddress || "").trim(),
                  ) === idx,
              )
              .slice(0, SIMPLESWAP_DEPOSITS_MAX);
            window.sessionStorage?.setItem(
              SIMPLESWAP_DEPOSITS_STORAGE_KEY,
              JSON.stringify(next),
            );
          } catch {
            // ignore
          }
        }
      }
      setStep("deposit");
    } catch (error) {
      setApiError(error?.message || "Impossible de créer l’échange.");
      setStep(returnStep);
    }
  };

  const refreshExchange = async () => {
    if (!exchangeId) return;
    setExchangeRefreshing(true);
    setApiError("");
    try {
      const response = await fetch(
        `/api/simpleswap/exchange?id=${encodeURIComponent(exchangeId)}`,
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || `HTTP ${response.status}`);
      }
      setExchange(data);
    } catch (error) {
      setApiError(error?.message || "Impossible de rafraîchir le statut.");
    } finally {
      setExchangeRefreshing(false);
    }
  };

  const handleExecuteOutboundSwapAndDeposit = async () => {
    if (!signTransaction || !preparedSwap?.txjson) {
      setApiError(
        t(
          "ui_usd_swap_missing_signer",
          "Signature wallet indisponible pour exécuter le swap XRPL.",
        ),
      );
      return;
    }
    if (!depositAddress) {
      setApiError(
        t("ui_usd_swap_missing_deposit_address", "Adresse de dépôt indisponible."),
      );
      return;
    }

    const payoutXrp = Number(preparedSwap?.quote?.xrpAmount);
    if (!Number.isFinite(payoutXrp) || payoutXrp <= 0) {
      setApiError(
        t(
          "ui_usd_swap_invalid_xrp_amount",
          "Montant XRP invalide pour le dépôt partenaire.",
        ),
      );
      return;
    }

    setSwapSubmitting(true);
    setApiError("");
    try {
      const effectiveSourceCurrency =
        String(
          walletSourceSelectionEnabled
            ? selectedSourceCurrencyCode || "RLUSD"
            : "RLUSD",
        )
          .trim()
          .toUpperCase() || "RLUSD";
      const effectiveSourceAmount =
        walletSourceSelectionEnabled &&
        Number.isFinite(selectedSourceAmount) &&
        selectedSourceAmount > 0
          ? Number(selectedSourceAmount)
          : Number.isFinite(parsedAmount) && parsedAmount > 0
            ? Number(parsedAmount)
            : null;
      const effectiveSourceAmountRlusd =
        Number.isFinite(outboundAmountRlusd) && outboundAmountRlusd > 0
          ? Number(outboundAmountRlusd)
          : Number.isFinite(parsedAmount) && parsedAmount > 0
            ? Number(parsedAmount)
            : null;
      const swapAmountLabel =
        effectiveSourceCurrency !== "RLUSD" &&
        effectiveSourceAmount != null &&
        effectiveSourceAmountRlusd != null
          ? `${effectiveSourceAmount.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} ${effectiveSourceCurrency} (~${effectiveSourceAmountRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD) → XRP`
          : `${(effectiveSourceAmountRlusd ?? parsedAmount).toLocaleString("en-US", {
              maximumFractionDigits: 6,
            })} RLUSD → XRP`;
      const swapResult = await signTransaction(preparedSwap.txjson, {
        action: "wallet:swap",
        progressDetails: {
          amountLabel: swapAmountLabel,
          beneficiaryLabel: "SimpleSwap",
          beneficiaryAddress: depositAddress,
        },
      });
      if (!swapResult?.signed) {
        setApiError(
          t("ui_usd_swap_cancelled", "Swap XRPL annulé ou expiré."),
        );
        return;
      }

      const paymentTx = buildXrpPaymentTxjson({
        account: walletAddress,
        destination: depositAddress,
        amountXrp: payoutXrp,
      });
      if (!paymentTx) {
        throw new Error("Impossible de construire le paiement XRP SimpleSwap.");
      }

      const destinationTag = parseDestinationTag(depositExtraId);
      if (destinationTag != null) {
        paymentTx.DestinationTag = destinationTag;
      } else if (String(depositExtraId || "").trim()) {
        paymentTx.Memos = [
          ...(paymentTx.Memos || []),
          ...buildPlainTextMemo(depositExtraId),
        ];
      }

      const partnerMemo = buildSimpleSwapMemo({
        side: "out",
        provider: "simpleswap",
        exchangeId: exchangeId || null,
        targetCurrencyCode:
          String(toCurrency?.ticker || "USD").trim().toUpperCase() || "USD",
        amountRlusd: effectiveSourceAmountRlusd,
        sourceCurrencyCode: effectiveSourceCurrency,
        sourceAmount: effectiveSourceAmount,
      });
      const encodedPartnerMemo = partnerMemo ? buildXrplJsonMemo(partnerMemo) : null;
      if (encodedPartnerMemo?.length) {
        paymentTx.Memos = [...(paymentTx.Memos || []), ...encodedPartnerMemo];
      }

      const paymentResult = await signTransaction(paymentTx, {
        action: "wallet:send",
        progressDetails: {
          amountLabel: `${payoutXrp.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} XRP`,
          beneficiaryLabel: "SimpleSwap",
          beneficiaryAddress: depositAddress,
        },
      });
      if (!paymentResult?.signed) {
        setApiError(
          t(
            "ui_usd_swap_payment_cancelled",
            "Le dépôt XRP SimpleSwap a été annulé après le swap XRPL.",
          ),
        );
        return;
      }

      try {
        const prev = safeReadJsonArray(
          window.sessionStorage?.getItem(SIMPLESWAP_DEPOSITS_STORAGE_KEY),
        );
        const next = prev.filter(
          (item) => String(item?.depositAddress || "").trim() !== String(depositAddress || "").trim(),
        );
        window.sessionStorage?.setItem(
          SIMPLESWAP_DEPOSITS_STORAGE_KEY,
          JSON.stringify(next),
        );
      } catch {
        // ignore
      }
      closeModal();
    } catch (error) {
      setApiError(
        error?.message ||
          t("ui_usd_swap_execution_failed", "Impossible d’exécuter le flow XRPL."),
      );
    } finally {
      setSwapSubmitting(false);
    }
  };

  const handleConvertInboundToRlusd = async () => {
    if (!signTransaction) {
      setApiError(
        t(
          "ui_usd_swap_missing_signer",
          "Signature wallet indisponible pour exécuter le swap XRPL.",
        ),
      );
      return;
    }
    if (!Number.isFinite(exactInboundXrp) || exactInboundXrp <= 0) {
      setApiError(
        t(
          "ui_usd_swap_missing_inbound_xrp",
          "Montant XRP reçu indisponible pour la conversion RLUSD.",
        ),
      );
      return;
    }

    setSwapSubmitting(true);
    setApiError("");
    try {
      const preparedInboundSwap = await xcannesApi.prepareRlusdXrpSwap({
        address: walletAddress,
        direction: "XRP_TO_RLUSD",
        amountXrp: exactInboundXrp,
      });
      const result = await signTransaction(preparedInboundSwap.txjson, {
        action: "wallet:swap",
        progressDetails: {
          amountLabel: `${exactInboundXrp.toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} XRP → RLUSD`,
          beneficiaryLabel: walletLabel || "XCANNES",
          beneficiaryAddress: walletAddress,
        },
      });
      if (!result?.signed) {
        setApiError(
          t("ui_usd_swap_cancelled", "Swap XRPL annulé ou expiré."),
        );
        return;
      }
      closeModal();
    } catch (error) {
      setApiError(
        error?.message ||
          t("ui_usd_swap_execution_failed", "Impossible d’exécuter le flow XRPL."),
      );
    } finally {
      setSwapSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    fetchCurrencies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (direction !== SWAP_DIRECTIONS.STABLE_TO_RLUSD) return;
    if (String(receiveAddress || "").trim()) return;
    if (!String(walletAddress || "").trim()) return;
    setReceiveAddress(String(walletAddress).trim());
  }, [direction, open, receiveAddress, walletAddress]);

  useEffect(() => {
    if (open) return;
    modalCloseRequestedRef.current = false;
    try {
      const listEl = modalOverlayListRef.current;
      const meta = modalOverlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setModalOverlayDragging(false);
    setModalOverlayTranslateY(0);
    modalOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  }, [open]);

  if (!shouldRender) return null;

  const closeModal = () => {
    resetState();
    onClose?.();
  };

  const handleHeaderBack = () => {
    if (step === "form") {
      closeModal();
      return;
    }
    if (step === "address") {
      setApiError("");
      setStep("form");
      return;
    }
    closeModal();
  };

  const releaseModalOverlayScrollLock = () => {
    const meta = modalOverlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = modalOverlayListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartModalOverlayDrag = (event, source) => {
    if (!swipeEnabled) return false;
    if (inline) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = modalOverlayListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    modalOverlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleModalOverlayPointerMove = (event) => {
    if (!swipeEnabled) return;
    if (inline) return;
    const meta = modalOverlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        modalOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = modalOverlayListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setModalOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setModalOverlayTranslateY(delta);
  };

  const handleModalOverlayPointerEnd = (event) => {
    if (!swipeEnabled) return;
    if (inline) return;
    const meta = modalOverlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const shouldClose = delta > 160 || velocity > 1.0;

    modalOverlayDragMetaRef.current.pending = false;
    modalOverlayDragMetaRef.current.dragging = false;
    setModalOverlayDragging(false);
    releaseModalOverlayScrollLock();

    if (shouldClose) {
      if (!modalCloseRequestedRef.current) {
        modalCloseRequestedRef.current = true;
        const height = typeof window !== "undefined" ? window.innerHeight : 9999;
        setModalOverlayTranslateY(Math.max(delta, height));
        window.setTimeout(() => {
          closeModal();
        }, 180);
      }
      return;
    }

    setModalOverlayTranslateY(0);
    modalOverlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={closeModal}
          style={
            modalOverlayTranslateY > 0
              ? {
                  opacity: Math.max(
                    0,
                    Math.min(1, 1 - modalOverlayTranslateY / 420),
                  ),
                }
              : undefined
          }
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          ref={modalOverlayRef}
          className={inline ? "w-full h-full flex" : "pointer-events-auto w-full"}
          style={
            swipeEnabled
              ? {
                  transform: `translateY(${Math.max(0, modalOverlayTranslateY)}px)`,
                  transition: modalOverlayDragging
                    ? "none"
                    : "transform 220ms cubic-bezier(0.2,0,0,1)",
                  willChange: modalOverlayTranslateY ? "transform" : undefined,
                }
              : undefined
          }
          onPointerMove={swipeEnabled ? handleModalOverlayPointerMove : undefined}
          onPointerUp={swipeEnabled ? handleModalOverlayPointerEnd : undefined}
          onPointerCancel={swipeEnabled ? handleModalOverlayPointerEnd : undefined}
        >
          <div
            ref={modalPanelRef}
            className={panelClass}
            onClick={(e) => {
              if (!inline) e.stopPropagation();
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className={`absolute inset-0 ${isBinanceYellow ? 'bg-[radial-gradient(600px_circle_at_50%_0%,rgba(240,185,11,0.13),transparent_60%)]' : 'bg-[radial-gradient(600px_circle_at_50%_0%,rgba(8,112,248,0.15),transparent_60%)]'}`} />
            </div>
            <div
              className="border-b border-white/10"
              onPointerDown={
                swipeEnabled
                  ? (event) => {
                      maybeStartModalOverlayDrag(event, "fixed");
                    }
                  : undefined
              }
            >
              {!inline ? (
                swipeEnabled ? (
                  <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null
              ) : null}
              <div className="p-4">
              <div className="flex items-center justify-between gap-3">
	                    <button
	                      type="button"
                  onClick={handleHeaderBack}
                  className="wallet-modal-close text-white/70 hover:text-white transition-colors text-xl flex items-center justify-center"
                  aria-label={t("ui_back", "Retour")}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="w-5 h-5"
                    aria-hidden
                  >
                    <path
                      fillRule="evenodd"
                      d="M11.78 3.22a.75.75 0 0 1 0 1.06L7.06 9l4.72 4.72a.75.75 0 1 1-1.06 1.06l-5.25-5.25a.75.75 0 0 1 0-1.06l5.25-5.25a.75.75 0 0 1 1.06 0Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
              </div>

              {direction !== SWAP_DIRECTIONS.RLUSD_TO_STABLE && !walletTargetSelectionEnabled ? (
                <div className="mt-3 min-w-0">
                  <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                    {t("ui_swap_title_in", "Stablecoin USD → RLUSD")}
                  </h3>
                  <p className="mt-1 text-xs md:text-sm text-white/60">
                    {t(
                      "ui_swap_subtitle_in",
                      "Envoyez un stablecoin USD depuis un wallet externe et recevez du RLUSD sur XRPL via SimpleSwap.",
                    )}
                  </p>
                </div>
              ) : null}
            </div>
          </div>

          <div
            ref={modalOverlayListRef}
            className="flex-1 min-h-0 overflow-y-auto p-4 md:p-5"
            onPointerDown={
              swipeEnabled
                ? (event) => {
                    maybeStartModalOverlayDrag(event, "list");
                  }
                : undefined
            }
          >
            {step === "deposit" ? (
              <div className="space-y-5">
                <div className="flex items-center gap-3 px-1">
                  <div className="text-sm text-white/80 font-semibold">
                    {t("ui_transfer_deposit", "Transférer le dépôt")}
                  </div>
                </div>

                <div className="text-center pt-1">
                  <div className="text-white font-semibold text-2xl leading-tight">
                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                      ? t("ui_execute_swap_and_send", "Swap XRPL puis dépôt partenaire")
                      : t("ui_send_your_funds", "Envoyez vos fonds")}
                  </div>
                  <div className="mt-2 text-sm text-white/60 max-w-sm mx-auto">
                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                      ? t(
                          "ui_usd_swap_created_body_from_wallet_xrp",
                          "Le flow prépare un swap RLUSD → XRP sur XRPL, puis envoie automatiquement le XRP exact vers SimpleSwap.",
                        )
                      : t(
                          "ui_usd_swap_created_body_external_xrp",
                          "Envoyez le stablecoin demandé vers SimpleSwap. Une fois le XRP reçu sur votre wallet XCANNES, signez la conversion XRP → RLUSD.",
                        )}
                  </div>
                </div>

                {apiError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {apiError}
                  </div>
                ) : null}

                <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-white/60 text-xs">
                        {t("ui_usd_swap_send_amount", "Montant à envoyer")}
                      </div>
                      <div className="text-white font-semibold text-lg leading-tight">
                        {sendAmountExact || (hasValidAmount ? parsedAmount : "—")}{" "}
                        {partnerFromTicker || ""}
                      </div>
                    </div>
                    {partnerFromNetwork ? (
                      <span className="shrink-0 rounded-full bg-white/10 text-white/70 text-xs font-semibold px-2.5 py-1">
                        {partnerFromNetwork}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-3 border-t border-white/10 pt-3 space-y-3 text-sm text-white/80">
                    {exchangeId ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_exchange_id", "ID")}
                          </div>
                          <div className="font-mono break-all">{exchangeId}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(exchangeId).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

                    {depositAddress ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_deposit_address", "Adresse de dépôt")}
                          </div>
                          <div className="font-mono break-all">{depositAddress}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(depositAddress).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

                    {depositExtraId ? (
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-white/60 text-xs">
                            {t("ui_usd_swap_deposit_tag", "Tag / Memo")}
                          </div>
                          <div className="font-mono break-all">{depositExtraId}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            navigator?.clipboard?.writeText(depositExtraId).catch(() => {})
                          }
                          className="shrink-0 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs font-semibold px-3 py-2"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                      </div>
                    ) : null}

                    {status ? (
                      <div>
                        <div className="text-white/60 text-xs">
                          {t("ui_usd_swap_status", "Statut")}
                        </div>
                        <div className="text-white font-semibold">{status}</div>
                      </div>
                    ) : null}
                  </div>

                  {depositAddress ? (
                    <div className="mt-4 flex justify-center">
                      <div className="rounded-2xl bg-white p-3">
                        <QRCodeCanvas value={depositAddress} size={190} includeMargin />
                      </div>
                    </div>
                  ) : null}
                </div>

                {partnerToTicker ? (
                  <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white/60 text-xs">
                        {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                          ? t("ui_you_get_xrp_first", "Vous recevez d’abord")
                          : t("ui_you_get", "Vous obtenez")}
                      </div>
                      {partnerToNetwork ? (
                        <span className="shrink-0 rounded-full bg-white/10 text-white/70 text-xs font-semibold px-2.5 py-1">
                          {partnerToNetwork}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-white font-semibold text-lg leading-tight">
                      {String(receiveAmountExact || "").trim()
                        ? `${receiveAmountExact} ${direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? "XRP" : partnerToTicker}`
                        : (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                            ? quotedPartnerReceiveAmount
                            : quotedReceiveAmount)
                          ? `≈${
                              formatAmountNumber
                                ? formatAmountNumber.format(
                                    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                                      ? quotedPartnerReceiveAmount
                                      : quotedReceiveAmount,
                                  )
                                : String(
                                    direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                                      ? quotedPartnerReceiveAmount
                                      : quotedReceiveAmount,
                                  )
                            } ${direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? "XRP" : partnerToTicker}`
                          : `— ${direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? "XRP" : partnerToTicker}`}
                    </div>
                    {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                      <div className="mt-3 text-[11px] text-white/55">
                        {t(
                          "ui_usd_swap_convert_after_receive",
                          "Quand le dépôt partenaire est terminé et que le XRP est crédité sur XRPL, signez la conversion XRP → RLUSD ci-dessous.",
                        )}
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  {t(
                    "ui_usd_swap_warning",
                    `Attention : envoyez uniquement ${partnerFromTicker || "l'actif sélectionné"} (${partnerFromNetwork || "réseau sélectionné"}). Envoyer un autre actif ou oublier un Tag/Memo peut entraîner une perte.`,
                  )}
                </div>

                <div className="flex gap-2">
                  {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
                    <button
                      type="button"
                      onClick={handleExecuteOutboundSwapAndDeposit}
                      disabled={swapSubmitting || !preparedSwap?.txjson || !depositAddress}
                      className={`flex-1 py-3 ${actionBtnBase}`}
                    >
                      {swapSubmitting
                        ? t("ui_signing_swap", "Signature…")
                        : t("ui_execute_swap_and_send_btn", "Signer le swap puis envoyer")}
                    </button>
                  ) : null}
                  {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                    <button
                      type="button"
                      onClick={handleConvertInboundToRlusd}
                      disabled={swapSubmitting || !signTransaction || !Number.isFinite(exactInboundXrp)}
                      className={`flex-1 py-3 ${actionBtnBase}`}
                    >
                      {swapSubmitting
                        ? t("ui_signing_swap", "Signature…")
                        : t("ui_convert_xrp_to_rlusd", "Convertir le XRP en RLUSD")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={refreshExchange}
                    disabled={!exchangeId || exchangeRefreshing || swapSubmitting}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 text-white/80 font-semibold py-3 transition-colors hover:bg-black/30 hover:text-white disabled:opacity-50"
                  >
                    {exchangeRefreshing
                      ? t("ui_refreshing", "Rafraîchit…")
                      : t("ui_refresh", "Rafraîchir")}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className={`flex-1 py-3 ${actionBtnBase}`}
                  >
                    {t("ui_close_08378568ba", "Fermer")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE || walletTargetSelectionEnabled ? (
                  walletInlineSelectionEnabled ? (
                    <div className="px-4 pt-2 pb-4 text-center">
                      <h3 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight mb-2">
                        {flowTitle}
                      </h3>
                      <p className="mb-4 text-[14px] md:text-[15px] text-white/80 leading-relaxed">
                        {flowSubtitle}
                      </p>
                      <div className="flex justify-center">
                        <div className="inline-flex items-center gap-6 bg-elevated px-6 py-1.5 rounded-full shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                          <span className="text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide">
                            {t("moonpay_from_account", "Depuis le compte")}
                          </span>
                          <span
                            className={`h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse ${accentPulseDot}`}
                            aria-hidden
                          />
                          <span className="text-white/95 text-[14px] md:text-[15px] font-semibold">
                            {walletLabel || "XCANNES"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={[
                        "rounded-t-[14px] rounded-b-none px-4 py-4 ring-1 ring-white/10 ring-inset bg-[#101415]",
                        "shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]",
                      ].join(" ")}
                    >
                      <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {walletTargetSelectionEnabled
                          ? t("moonpay_destination_wallet", "Vers le compte")
                          : t("moonpay_from_account", "Depuis le compte")}
                      </p>
                      {String(walletLabel || "").trim() ? (
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className={`h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse ${accentPulseDot}`}
                            aria-hidden
                          />
                          <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
                            {walletLabel}
                          </p>
                        </div>
                      ) : null}
                      {String(walletAddress || "").trim() ? (
                        <p className="text-[13px] md:text-sm font-mono break-all md:tracking-[0.06em] text-white/70">
                          {walletAddress}
                        </p>
                      ) : null}
                    </div>
                  )
                ) : null}

                {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE || walletTargetSelectionEnabled ? (
                  <div className="px-1">
                    {!walletInlineSelectionEnabled ? (
                      <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                        {flowTitleDisplay}
                      </h3>
                    ) : null}
                    {!walletInlineSelectionEnabled ? (
                      <p className="mt-1 text-[15px] md:text-sm leading-snug text-white/85">
                        {flowSubtitle}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                {step === "pending" ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className={`animate-spin rounded-full h-12 w-12 border-b-2 mb-4 ${accentSpinnerBorder}`} />
                    <p className="text-white/80">
                      {t("ui_usd_swap_pending", "Création de l’échange…")}
                    </p>
                  </div>
                ) : null}

                {currenciesLoading ? (
                  <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
                    {t("ui_usd_swap_loading_currencies", "Chargement des devises SimpleSwap…")}
                  </div>
                ) : null}

                {currenciesError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {currenciesError}
                  </div>
                ) : null}

                {apiError ? (
                  <div className="rounded-lg ring-1 ring-red-500/20 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {apiError}
                  </div>
                ) : null}

                {step === "form" ? (
                  <>
		                    <div className={["rounded-[18px] ring-1 ring-white/10 ring-inset bg-[#101415] overflow-hidden", accentShadowCard].join(" ")}>
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                            {t("ui_swap_you_send", "Vous envoyez")}
                          </div>
                          <div className="flex items-center gap-2">
                            {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                              <div ref={stableDropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSourceDropdownOpen(false);
                                    setSourceSearch("");
                                    setStableDropdownOpen(true);
                                  }}
                                  aria-expanded={stableDropdownOpen}
                                  className="inline-flex items-center gap-2 rounded-full bg-elevated ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:ring-white/20 transition-colors"
                                >
                                  {stableCurrency ? (
                                    renderCurrencyIcon(stableCurrency)
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-white/10 ring-1 ring-white/10 flex-shrink-0" />
                                  )}
                                  <span className="text-sm font-semibold">
                                    {stableCurrency
                                      ? String(stableCurrency?.ticker || "").toUpperCase()
                                      : t("ui_choose", "Choisir")}
                                  </span>
                                  <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                    {stableCurrency
                                      ? String(stableCurrency?.network || "").toUpperCase()
                                      : "—"}
                                  </span>
                                  <svg
                                    className="w-4 h-4 flex-shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ) : walletSourceSelectionEnabled ? (
                              <div ref={sourceDropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setStableDropdownOpen(false);
                                    setSourceSearch("");
                                    setSourceDropdownOpen((prev) => !prev);
                                  }}
                                  aria-expanded={sourceDropdownOpen}
                                  className="inline-flex items-center gap-2 rounded-full bg-elevated ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:ring-white/20 transition-colors"
                                >
                                  <span className="shrink-0">
                                    {renderWalletOptionIcon(selectedSourceOption?.icon)}
                                  </span>
                                  <span className="text-sm font-semibold">
                                    {selectedSourceOption?.label || selectedSourceCurrencyCode}
                                  </span>
                                  <span className="text-white/70 font-mono tabular-nums text-sm">
                                    {selectedSourceOption?.labelRight || ""}
                                  </span>
                                  <svg
                                    className="w-4 h-4 flex-shrink-0"
                                    viewBox="0 0 20 20"
                                    fill="currentColor"
                                    aria-hidden
                                  >
                                    <path
                                      fillRule="evenodd"
                                      d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                      clipRule="evenodd"
                                    />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-2 text-white/90">
                                <img
                                  src={
                                    String(rlusdDisplayCurrency?.image || "").trim() ||
                                    CRYPTO_ICONS?.RLUSD ||
                                    "/symbols/rlusd.png"
                                  }
                                  alt=""
                                  className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                  loading="lazy"
                                  decoding="async"
                                  referrerPolicy="no-referrer"
                                />
                                <span className="text-base font-semibold tracking-tight">
                                  {String(rlusdDisplayCurrency?.ticker || "RLUSD").toUpperCase()}
                                </span>
                                <span className="text-[11px] tracking-[0.22em] uppercase text-white/55">
                                  {String(rlusdDisplayCurrency?.network || "xrp").toUpperCase()}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-2 flex items-end justify-between gap-3">
                          <input
                            type="text"
                            inputMode="decimal"
                            value={amount}
                            onChange={(e) => {
                              setAmount(e.target.value);
                              setApiError("");
                            }}
                            placeholder={direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? "25" : "100"}
                            className="w-full bg-transparent text-white text-4xl md:text-5xl font-semibold tracking-tight focus:outline-none xcannes-no-spinner"
                          />
                          <div className="text-sm text-white/50 whitespace-nowrap pb-1">
                            {hasValidAmount
                              ? `~${
                                  formatUsdNumber && Number.isFinite(sendApproxUsdAmount)
                                    ? formatUsdNumber.format(sendApproxUsdAmount)
                                    : Number.isFinite(sendApproxUsdAmount)
                                      ? sendApproxUsdAmount.toFixed(2)
                                      : parsedAmount.toFixed(2)
                                }$`
                              : ""}
                          </div>
                        </div>

                        {hasValidAmount && amountOutOfRange && (minFromAmount || maxFromAmount) ? (
                          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-white/45">
                            <div className="min-w-0 truncate">
                              {minFromAmount
                                ? `${t("ui_min", "Min")}: ${formatAmountNumber ? formatAmountNumber.format(minFromAmount) : String(minFromAmount)} ${fromTicker || ""}`
                                : ""}
                              {maxFromAmount
                                ? `${minFromAmount ? " • " : ""}${t("ui_max", "Max")}: ${formatAmountNumber ? formatAmountNumber.format(maxFromAmount) : String(maxFromAmount)} ${fromTicker || ""}`
                                : ""}
                            </div>
                            {amountOutOfRange ? (
                              <span className="shrink-0 text-red-200 font-semibold">
                                {amountBelowMin
                                  ? t("ui_too_low", "Trop bas")
                                  : t("ui_too_high", "Trop élevé")}
                              </span>
                            ) : null}
                          </div>
                        ) : null}
                        {walletSourceSelectionEnabled && insufficientSourceBalance ? (
                          <div className="mt-2 text-[11px] text-red-200">
                            {t("ui_insufficient_balance", "Solde insuffisant.")}
                          </div>
                        ) : null}
                        {walletSourceSelectionEnabled && sourceConversionMissing ? (
                          <div className="mt-2 text-[11px] text-red-200">
                            {t(
                              "ui_rate_unavailable_base_5c1a9b7d2e",
                              "Rate unavailable for base currency.",
                            )}
                          </div>
                        ) : null}
                        {walletTargetSelectionEnabled && targetConversionMissing ? (
                          <div className="mt-2 text-[11px] text-red-200">
                            {t(
                              "ui_rate_unavailable_quote_f31d9f6c4a",
                              "Rate unavailable for credited wallet currency.",
                            )}
                          </div>
                        ) : null}
                      </div>

	                      <div className="relative border-t border-white/10">
	                        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
	                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${accentSwapIconShell}`}>
	                            <svg
	                              viewBox="0 0 24 24"
	                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
	                              className={`w-5 h-5 ${accentSwapIcon}`}
	                              aria-hidden
	                            >
                              <polyline
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points="17 1 21 5 17 9"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M3 11V9a4 4 0 0 1 4-4h14"
                              />
                              <polyline
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                points="7 23 3 19 7 15"
                              />
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M21 13v2a4 4 0 0 1-4 4H3"
                              />
                            </svg>
                          </div>
                        </div>

                        <div className="p-4 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                              {t("ui_usd_swap_you_receive", "Vous recevez")}
                            </div>
                            <div className="flex items-center gap-2">
                              {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
                                <div ref={stableDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSourceDropdownOpen(false);
                                      setSourceSearch("");
                                      setStableDropdownOpen(true);
                                    }}
                                    aria-expanded={stableDropdownOpen}
                                    className="inline-flex items-center gap-2 rounded-full bg-elevated ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:ring-white/20 transition-colors"
                                  >
                                    {stableCurrency ? (
                                      renderCurrencyIcon(stableCurrency)
                                    ) : (
                                      <div className="w-5 h-5 rounded-full bg-white/10 ring-1 ring-white/10 flex-shrink-0" />
                                    )}
                                    <span className="text-sm font-semibold">
                                      {stableCurrency
                                        ? String(stableCurrency?.ticker || "").toUpperCase()
                                        : t("ui_choose", "Choisir")}
                                    </span>
                                    <span className="text-[10px] tracking-[0.18em] uppercase px-2 py-0.5 rounded-full bg-white/10 text-white/70">
                                      {stableCurrency
                                        ? String(stableCurrency?.network || "").toUpperCase()
                                        : "—"}
                                    </span>
                                    <svg
                                      className="w-4 h-4 flex-shrink-0"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      aria-hidden
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>

                                  {/* Portal content rendered once above (stableDropdownOpen) */}
                                </div>
                              ) : walletTargetSelectionEnabled ? (
                                <div ref={sourceDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setStableDropdownOpen(false);
                                      setSourceSearch("");
                                      setSourceDropdownOpen((prev) => !prev);
                                    }}
                                    aria-expanded={sourceDropdownOpen}
                                    className="inline-flex items-center gap-2 rounded-full bg-elevated ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:ring-white/20 transition-colors"
                                  >
                                    <span className="shrink-0">
                                      {renderWalletOptionIcon(selectedSourceOption?.icon)}
                                    </span>
                                    <span className="text-sm font-semibold">
                                      {selectedSourceOption?.label || selectedSourceCurrencyCode}
                                    </span>
                                    {walletCurrencyShowBalance ? (
                                      <span className="text-white/70 font-mono tabular-nums text-sm">
                                        {selectedSourceOption?.labelRight || ""}
                                      </span>
                                    ) : null}
                                    <svg
                                      className="w-4 h-4 flex-shrink-0"
                                      viewBox="0 0 20 20"
                                      fill="currentColor"
                                      aria-hidden
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.94l3.71-3.71a.75.75 0 1 1 1.06 1.06l-4.24 4.24a.75.75 0 0 1-1.06 0L5.21 8.29a.75.75 0 0 1 .02-1.08z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              ) : (
                                <div className="inline-flex items-center gap-2 text-white/90">
                                  <img
                                    src={
                                      String(rlusdDisplayCurrency?.image || "").trim() ||
                                      CRYPTO_ICONS?.RLUSD ||
                                      "/symbols/rlusd.png"
                                    }
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                                    loading="lazy"
                                    decoding="async"
                                    referrerPolicy="no-referrer"
                                  />
                                  <span className="text-base font-semibold tracking-tight">
                                    {String(rlusdDisplayCurrency?.ticker || "RLUSD").toUpperCase()}
                                  </span>
                                  <span className="text-[11px] tracking-[0.22em] uppercase text-white/55">
                                    {String(rlusdDisplayCurrency?.network || "xrp").toUpperCase()}
                                  </span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="mt-2 flex items-end justify-between gap-3">
                            <div className="text-white text-4xl md:text-5xl font-semibold tracking-tight truncate">
                              {hasValidAmount ? (
                                receiveDisplayAmount ? (
                                  `≈${
                                    formatAmountNumber
                                      ? formatAmountNumber.format(receiveDisplayAmount)
                                      : String(receiveDisplayAmount)
                                  }`
                                ) : quoteLoading ? (
                                  "…"
                                ) : (
                                  "—"
                                )
                              ) : (
                                "—"
                              )}
                            </div>
                            <div className="text-sm text-white/50 whitespace-nowrap pb-1">
                              {hasValidAmount && receiveApproxUsdAmount
                                ? `~${formatUsdNumber ? formatUsdNumber.format(receiveApproxUsdAmount) : Number(receiveApproxUsdAmount).toFixed(2)}$`
                                : ""}
                            </div>
                          </div>

                          <div className="mt-3 flex items-center justify-between text-xs text-white/55">
                            <div className="inline-flex items-center gap-2">
                              <svg
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                className="w-4 h-4 text-white/50"
                                aria-hidden
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M12 17v-1m0-4V7m0 14a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"
                                />
                              </svg>
                              {t("ui_variable_rate", "Taux variable")}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

		                    {stableDropdownOpen
		                      ? isDesktop
		                        ? stableDesktopPopupStyle
		                          ? createPortal(
		                            <div
		                              ref={stableDropdownOverlayRef}
		                              role="dialog"
		                              aria-modal="true"
		                              className="absolute inset-0 z-[10040]"
		                              onClick={(e) => e.stopPropagation()}
		                            >
		                              <div
		                                className="absolute inset-0 bg-black/70"
		                                onClick={() => setStableDropdownOpen(false)}
		                              />
		                              <div
		                                className={[
		                                  noticeVariant === "demo"
		                                    ? "bg-xcannes-surface-demo"
		                                    : "bg-elevated",
		                                  "absolute inset-0 flex flex-col min-h-0 overflow-hidden",
		                                ].join(" ")}
		                              >
		                                <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10">
		                                  <div className="min-w-0">
		                                    <div className="text-white font-semibold text-lg leading-tight truncate">
		                                      {t(
		                                        "ui_choose_stablecoin_title",
		                                        "Choisir un stablecoin USD",
		                                      )}
		                                    </div>
				                                    <div className="mt-0.5 text-[11px] truncate text-white/50">
				                                      {t(
				                                        "ui_choose_stablecoin_subtitle",
				                                        "Ticker / réseau (USDT, USDC…)",
				                                      )}
				                                    </div>
		                                  </div>
		                                  <button
		                                    type="button"
		                                    onClick={() => setStableDropdownOpen(false)}
		                                    className="text-white/70 hover:text-white transition-colors text-xl leading-none"
		                                    aria-label={t("ui_close", "Fermer")}
		                                  >
		                                    ✕
		                                  </button>
		                                </div>

		                                <div className="px-4 py-4 border-b border-white/10">
		                                  <div className="relative">
		                                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
		                                      <svg
		                                        viewBox="0 0 20 20"
		                                        fill="currentColor"
		                                        className="w-4 h-4"
		                                        aria-hidden
		                                      >
		                                        <path
		                                          fillRule="evenodd"
		                                          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
		                                          clipRule="evenodd"
		                                        />
		                                      </svg>
		                                    </div>
		                                    <input
		                                      value={search}
		                                      onChange={(e) => setSearch(e.target.value)}
		                                      placeholder={t("ui_search", "Rechercher…")}
			                                      className={`w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
			                                    />
		                                  </div>

	                                {!String(search || "").trim() && popularStableOptions.length ? (
	                                  <div className="mt-3">
	                                    <div className="text-[10px] tracking-[0.22em] uppercase text-white/45 px-1">
	                                      {t("ui_popular", "Populaires")}
	                                    </div>
	                                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
	                                      {popularStableOptions.slice(0, 4).map((opt) => {
	                                        const active = opt.key === stableKey;
	                                        return (
	                                          <button
	                                            key={opt.key}
	                                            type="button"
	                                            onClick={() => {
	                                              setStableKey(opt.key);
	                                              setStableDropdownOpen(false);
	                                              setSearch("");
	                                            }}
		                                            className={[
		                                              "rounded-xl px-3 py-3 ring-1 ring-inset transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] text-left",
		                                              active
		                                                ? accentActiveCard
		                                                : "bg-black/20 ring-white/10 text-white/70 hover:bg-black/30 hover:text-white/90 hover:ring-white/15",
		                                            ].join(" ")}
		                                          >
	                                            <div className="flex items-center gap-2">
	                                              {renderCurrencyIcon(opt.currency)}
	                                              <div className="min-w-0 flex-1">
	                                                <div className="text-sm font-semibold truncate">
	                                                  {opt.label}
	                                                </div>
	                                              </div>
		                                              {active ? (
		                                                <span className={`font-semibold text-xs ${accentTextSolid}`}>
		                                                  ✓
		                                                </span>
		                                              ) : null}
	                                            </div>
	                                          </button>
	                                        );
	                                      })}
	                                    </div>
	                                  </div>
	                                ) : null}
		                                </div>

		                                <div
		                                  ref={stableDropdownListRef}
		                                  className="flex-1 min-h-0 overflow-y-auto"
		                                >
		                                  {stableSearchResults.length ? (
		                                    stableSearchResults.map((cur) => {
		                                      const key = currencyKey(cur);
		                                      const active = key === stableKey;
		                                      return (
		                                        <button
		                                          key={key}
		                                          type="button"
		                                          onClick={() => {
		                                            setStableKey(key);
		                                            setStableDropdownOpen(false);
		                                            setSearch("");
		                                          }}
			                                          className={[
			                                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
			                                            active
			                                              ? accentActiveRow
			                                              : "hover:bg-white/[0.04] text-white/80",
			                                          ].join(" ")}
			                                        >
		                                          {renderCurrencyIcon(cur)}
		                                          <div className="min-w-0 flex-1">
		                                            <div className="text-[15px] font-semibold truncate">
		                                              {String(cur?.ticker || "").toUpperCase()}
		                                              <span className="text-white/50 font-normal">
		                                                ({String(cur?.network || "").toUpperCase()})
		                                              </span>
		                                              <span className="mx-1.5 text-white/30 font-normal">—</span>
		                                              <span className="text-white/55 font-normal text-[13px]">
		                                                {String(cur?.name || "").trim() ||
		                                                  currencyLabel(cur)}
		                                              </span>
		                                            </div>
		                                          </div>
			                                          {active ? (
			                                            <span className={`font-semibold text-xs ${accentTextSolid}`}>
			                                              ✓
			                                            </span>
			                                          ) : null}
		                                        </button>
		                                      );
		                                    })
		                                  ) : (
		                                    <div className="px-4 py-6 text-sm text-white/60">
		                                      {t("ui_no_results", "Aucun résultat.")}
		                                    </div>
		                                  )}
		                                </div>

		                                <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
		                                  {filteredStableOptions.length > MAX_STABLE_SEARCH_RESULTS
		                                    ? t(
		                                        "ui_search_limit",
		                                        `Résultats limités à ${MAX_STABLE_SEARCH_RESULTS}. Affinez votre recherche.`,
		                                      )
		                                    : t("ui_search_results", "Sélectionnez un actif.")}
		                                </div>
		                              </div>
		                            </div>,
		                            modalPanelRef.current || document.body,
		                          )
		                          : null
		                        : createPortal(
	                            <div className="fixed inset-0 z-[10020]">
	                              <div
	                                className="absolute inset-0 bg-black/80 md:backdrop-blur-sm"
	                                onClick={() => setStableDropdownOpen(false)}
	                                style={{
	                                  opacity: Math.max(
	                                    0,
	                                    Math.min(1, 1 - stableOverlayTranslateY / 420),
	                                  ),
	                                }}
	                              />
	                              <div
	                                ref={stableDropdownOverlayRef}
	                                role="dialog"
	                                aria-modal="true"
	                                className={[
	                                  "absolute inset-0 bg-elevated flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]",
	                                  "sm:inset-6 sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl",
	                                  "will-change-transform",
	                                ].join(" ")}
	                                style={{
	                                  transform: `translateY(${Math.max(0, stableOverlayTranslateY)}px)`,
	                                  transition: stableOverlayDragging
	                                    ? "none"
	                                    : "transform 220ms cubic-bezier(0.2,0,0,1)",
	                                }}
	                                onPointerMove={handleStableOverlayPointerMove}
	                                onPointerUp={handleStableOverlayPointerEnd}
	                                onPointerCancel={handleStableOverlayPointerEnd}
	                              >
	                                <div
	                                  className="border-b border-white/10"
	                                  onPointerDown={(event) => {
	                                    maybeStartStableOverlayDrag(event, "fixed");
	                                  }}
	                                >
	                                  <div className="sm:hidden flex justify-center pt-3 pb-1">
	                                    <div
	                                      className="w-16 h-5 flex items-center justify-center"
	                                      aria-hidden
	                                    >
	                                      <span className="block w-12 h-1.5 rounded-full bg-white/20" />
	                                    </div>
	                                  </div>

	                                  <div className="flex items-center justify-between gap-3 px-4 py-4">
	                                    <div className="min-w-0">
	                                      <div className="text-white font-semibold text-lg leading-tight truncate">
	                                        {t(
	                                          "ui_choose_stablecoin_title",
	                                          "Choisir un stablecoin USD",
	                                        )}
	                                      </div>
			                                      <div className="mt-0.5 text-[11px] truncate text-white/50">
			                                        {t(
			                                          "ui_choose_stablecoin_subtitle",
			                                          "Ticker / réseau (USDT, USDC…)",
			                                        )}
			                                      </div>
	                                    </div>
	                                    <button
	                                      type="button"
	                                      onClick={() => setStableDropdownOpen(false)}
	                                      className="hidden sm:inline-flex text-white/70 hover:text-white transition-colors text-xl"
	                                      aria-label={t("ui_close", "Fermer")}
	                                    >
	                                      ✕
	                                    </button>
	                                  </div>

	                                  <div className="px-4 pb-4">
	                                    <div className="relative">
	                                      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
	                                        <svg
	                                          viewBox="0 0 20 20"
	                                          fill="currentColor"
	                                          className="w-4 h-4"
	                                          aria-hidden
	                                        >
	                                          <path
	                                            fillRule="evenodd"
	                                            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
	                                            clipRule="evenodd"
	                                          />
	                                        </svg>
	                                      </div>
	                                      <input
	                                        value={search}
	                                        onChange={(e) => setSearch(e.target.value)}
	                                        placeholder={t("ui_search", "Rechercher…")}
		                                        className={`w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
		                                      />
	                                    </div>

	                                    {!String(search || "").trim() && popularStableOptions.length ? (
	                                      <div className="mt-3">
	                                        <div className="text-[10px] tracking-[0.22em] uppercase text-white/45 px-1">
	                                          {t("ui_popular", "Populaires")}
	                                        </div>
	                                        <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
	                                          {popularStableOptions.slice(0, 4).map((opt) => {
	                                            const active = opt.key === stableKey;
	                                            return (
	                                              <button
	                                                key={opt.key}
	                                                type="button"
	                                                onClick={() => {
	                                                  setStableKey(opt.key);
	                                                  setStableDropdownOpen(false);
	                                                  setSearch("");
	                                                }}
		                                                className={[
		                                                  "rounded-xl px-3 py-3 ring-1 ring-inset transition-all duration-[120ms] ease-[cubic-bezier(0.4,0,0.2,1)] text-left",
		                                                  active
		                                                    ? accentActiveCard
		                                                    : "bg-black/20 ring-white/10 text-white/70 hover:bg-black/30 hover:text-white/90 hover:ring-white/15",
		                                                ].join(" ")}
		                                              >
	                                                <div className="flex items-center gap-2">
	                                                  {renderCurrencyIcon(opt.currency)}
	                                                  <div className="min-w-0 flex-1">
	                                                    <div className="text-sm font-semibold truncate">
	                                                      {opt.label}
	                                                    </div>
	                                                  </div>
		                                                  {active ? (
		                                                    <span className={`font-semibold text-xs ${accentTextSolid}`}>
		                                                      ✓
		                                                    </span>
		                                                  ) : null}
	                                                </div>
	                                              </button>
	                                            );
	                                          })}
	                                        </div>
	                                      </div>
	                                    ) : null}
	                                  </div>
	                                </div>

	                                <div
	                                  ref={stableDropdownListRef}
	                                  className="flex-1 min-h-0 overflow-y-auto"
	                                  onPointerDown={(event) => {
	                                    maybeStartStableOverlayDrag(event, "list");
	                                  }}
	                                >
	                                  {stableSearchResults.length ? (
	                                    stableSearchResults.map((cur) => {
	                                      const key = currencyKey(cur);
	                                      const active = key === stableKey;
	                                      return (
	                                        <button
	                                          key={key}
	                                          type="button"
	                                          onClick={() => {
	                                            setStableKey(key);
	                                            setStableDropdownOpen(false);
	                                            setSearch("");
	                                          }}
		                                          className={[
		                                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
		                                            active
		                                              ? accentActiveRow
		                                              : "hover:bg-white/[0.04] text-white/80",
		                                          ].join(" ")}
		                                        >
	                                          {renderCurrencyIcon(cur)}
	                                          <div className="min-w-0 flex-1">
	                                            <div className="text-[15px] font-semibold truncate">
	                                              {String(cur?.ticker || "").toUpperCase()}
	                                              <span className="text-white/50 font-normal">
	                                                ({String(cur?.network || "").toUpperCase()})
	                                              </span>
	                                              <span className="mx-1.5 text-white/30 font-normal">—</span>
	                                              <span className="text-white/55 font-normal text-[13px]">
	                                                {String(cur?.name || "").trim() ||
	                                                  currencyLabel(cur)}
	                                              </span>
	                                            </div>
	                                          </div>
		                                          {active ? (
		                                            <span className={`font-semibold text-xs ${accentTextSolid}`}>
		                                              ✓
		                                            </span>
		                                          ) : null}
	                                        </button>
	                                      );
	                                    })
	                                  ) : (
	                                    <div className="px-4 py-6 text-sm text-white/60">
	                                      {t("ui_no_results", "Aucun résultat.")}
	                                    </div>
	                                  )}
	                                </div>

	                                <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
	                                  {filteredStableOptions.length > MAX_STABLE_SEARCH_RESULTS
	                                    ? t(
	                                        "ui_search_limit",
	                                        `Résultats limités à ${MAX_STABLE_SEARCH_RESULTS}. Affinez votre recherche.`,
	                                      )
	                                    : t("ui_search_results", "Sélectionnez un actif.")}
	                                </div>
	                              </div>
	                            </div>,
	                            document.body,
		                          )
		                      : null}

                    {sourceDropdownOpen
                      ? isDesktop
                        ? sourceDesktopPopupStyle
                          ? createPortal(
                            <div
                              ref={sourceDropdownOverlayRef}
                              role="dialog"
                              aria-modal="true"
                              className="absolute inset-0 z-[10040]"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <div
                                className="absolute inset-0 bg-black/70"
                                onClick={() => {
                                  setSourceDropdownOpen(false);
                                  setSourceSearch("");
                                }}
                              />
                              <div
                                className={[
                                  noticeVariant === "demo"
                                    ? "bg-xcannes-surface-demo"
                                    : "bg-elevated",
                                  "absolute inset-0 flex flex-col min-h-0 overflow-hidden",
                                ].join(" ")}
                              >
                                <div className="flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10">
                                  <div className="min-w-0">
                                    <div className="text-white font-semibold text-lg leading-tight truncate">
                                      {walletSelectorDialogTitle}
                                    </div>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSourceDropdownOpen(false);
                                      setSourceSearch("");
                                    }}
                                    className="text-white/70 hover:text-white transition-colors text-xl leading-none"
                                    aria-label={t("ui_close", "Fermer")}
                                  >
                                    ✕
                                  </button>
                                </div>

                                <div className="px-4 py-4 border-b border-white/10">
                                  <div className="relative">
                                    <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
                                      <svg
                                        viewBox="0 0 20 20"
                                        fill="currentColor"
                                        className="w-4 h-4"
                                        aria-hidden
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <input
                                      value={sourceSearch}
                                      onChange={(e) => setSourceSearch(e.target.value)}
                                      placeholder={t("ui_search", "Rechercher…")}
                                      className={`w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
                                    />
                                  </div>
                                </div>

                                <div
                                  ref={sourceDropdownListRef}
                                  className="flex-1 min-h-0 overflow-y-auto"
                                >
                                  {filteredSourceCurrencyOptions.length ? (
                                    filteredSourceCurrencyOptions.map((option) => {
                                      const active =
                                        String(option?.code || "").trim().toUpperCase() ===
                                        selectedSourceCurrencyCode;
                                      return (
                                        <button
                                          key={option.code}
                                          type="button"
                                          onClick={() => {
                                            setSourceCurrencyCode(option.code);
                                            setApiError("");
                                            setQuote(null);
                                            setSourceDropdownOpen(false);
                                            setSourceSearch("");
                                          }}
                                          className={[
                                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
                                            active
                                              ? accentActiveRow
                                              : "hover:bg-white/[0.04] text-white/80",
                                          ].join(" ")}
                                        >
                                          <span className="shrink-0">
                                            {renderWalletOptionIcon(option.icon)}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold truncate">
                                              {option.label || option.code}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {walletCurrencyShowBalance && option.labelRight ? (
                                              <span className="text-sm font-mono tabular-nums text-white/70">
                                                {option.labelRight}
                                              </span>
                                            ) : null}
                                            {active ? (
                                              <span className={`font-semibold text-xs ${accentTextSolid}`}>
                                                ✓
                                              </span>
                                            ) : null}
                                          </div>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="px-4 py-6 text-sm text-white/60">
                                      {t("ui_no_results", "Aucun résultat.")}
                                    </div>
                                  )}
                                </div>

                                <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
                                  {t("ui_search_results", "Sélectionnez un actif.")}
                                </div>
                              </div>
                            </div>,
                            modalPanelRef.current || document.body,
                          )
                          : null
                        : createPortal(
                            <div className="fixed inset-0 z-[10020]">
                              <div
                                className="absolute inset-0 bg-black/80 md:backdrop-blur-sm"
                                onClick={() => {
                                  setSourceDropdownOpen(false);
                                  setSourceSearch("");
                                }}
                                style={{
                                  opacity: Math.max(
                                    0,
                                    Math.min(1, 1 - sourceOverlayTranslateY / 420),
                                  ),
                                }}
                              />
                              <div
                                ref={sourceDropdownOverlayRef}
                                role="dialog"
                                aria-modal="true"
                                className={[
                                  "absolute inset-0 bg-elevated flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]",
                                  "sm:inset-6 sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl",
                                  "will-change-transform",
                                ].join(" ")}
                                style={{
                                  transform: `translateY(${Math.max(0, sourceOverlayTranslateY)}px)`,
                                  transition: sourceOverlayDragging
                                    ? "none"
                                    : "transform 220ms cubic-bezier(0.2,0,0,1)",
                                }}
                                onPointerMove={handleSourceOverlayPointerMove}
                                onPointerUp={handleSourceOverlayPointerEnd}
                                onPointerCancel={handleSourceOverlayPointerEnd}
                              >
                                <div
                                  className="border-b border-white/10"
                                  onPointerDown={(event) => {
                                    maybeStartSourceOverlayDrag(event, "fixed");
                                  }}
                                >
                                  <div className="sm:hidden flex justify-center pt-3 pb-1">
                                    <div className="w-16 h-5 flex items-center justify-center" aria-hidden>
                                      <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                                    </div>
                                  </div>

                                  <div className="flex items-center justify-between gap-3 px-4 py-4">
                                    <div className="min-w-0">
                                      <div className="text-white font-semibold text-lg leading-tight truncate">
                                        {walletSelectorDialogTitle}
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSourceDropdownOpen(false);
                                        setSourceSearch("");
                                      }}
                                      className="hidden sm:inline-flex text-white/70 hover:text-white transition-colors text-xl"
                                      aria-label={t("ui_close", "Fermer")}
                                    >
                                      ✕
                                    </button>
                                  </div>

                                  <div className="px-4 pb-4">
                                    <div className="relative">
                                      <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
                                        <svg
                                          viewBox="0 0 20 20"
                                          fill="currentColor"
                                          className="w-4 h-4"
                                          aria-hidden
                                        >
                                          <path
                                            fillRule="evenodd"
                                            d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
                                            clipRule="evenodd"
                                          />
                                        </svg>
                                      </div>
                                      <input
                                        value={sourceSearch}
                                        onChange={(e) => setSourceSearch(e.target.value)}
                                        placeholder={t("ui_search", "Rechercher…")}
                                        className={`w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
                                      />
                                    </div>
                                  </div>
                                </div>

                                <div
                                  ref={sourceDropdownListRef}
                                  className="flex-1 min-h-0 overflow-y-auto"
                                  onPointerDown={(event) => {
                                    maybeStartSourceOverlayDrag(event, "list");
                                  }}
                                >
                                  {filteredSourceCurrencyOptions.length ? (
                                    filteredSourceCurrencyOptions.map((option) => {
                                      const active =
                                        String(option?.code || "").trim().toUpperCase() ===
                                        selectedSourceCurrencyCode;
                                      return (
                                        <button
                                          key={option.code}
                                          type="button"
                                          onClick={() => {
                                            setSourceCurrencyCode(option.code);
                                            setApiError("");
                                            setQuote(null);
                                            setSourceDropdownOpen(false);
                                            setSourceSearch("");
                                          }}
                                          className={[
                                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
                                            active
                                              ? accentActiveRow
                                              : "hover:bg-white/[0.04] text-white/80",
                                          ].join(" ")}
                                        >
                                          <span className="shrink-0">
                                            {renderWalletOptionIcon(option.icon)}
                                          </span>
                                          <div className="min-w-0 flex-1">
                                            <div className="text-sm font-semibold truncate">
                                              {option.label || option.code}
                                            </div>
                                          </div>
                                          <div className="flex items-center gap-2 shrink-0">
                                            {walletCurrencyShowBalance && option.labelRight ? (
                                              <span className="text-sm font-mono tabular-nums text-white/70">
                                                {option.labelRight}
                                              </span>
                                            ) : null}
                                            {active ? (
                                              <span className={`font-semibold text-xs ${accentTextSolid}`}>
                                                ✓
                                              </span>
                                            ) : null}
                                          </div>
                                        </button>
                                      );
                                    })
                                  ) : (
                                    <div className="px-4 py-6 text-sm text-white/60">
                                      {t("ui_no_results", "Aucun résultat.")}
                                    </div>
                                  )}
                                </div>

                                <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
                                  {t("ui_search_results", "Sélectionnez un actif.")}
                                </div>
                              </div>
                            </div>,
                            document.body,
                          )
                      : null}

	                    {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD && !walletTargetSelectionEnabled ? (
			                      <div
	                          className={[
	                            "rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03]",
	                            "shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]",
	                          ].join(" ")}
	                        >
	                        <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
	                          {t("moonpay_destination_wallet", "Vers le compte")}
	                        </p>
	                        {String(walletLabel || "").trim() ? (
	                          <div className="flex items-center gap-2 mb-1">
	                            <span
	                              className={`h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse ${accentPulseDot}`}
	                              aria-hidden
	                            />
	                            <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
	                              {walletLabel}
	                            </p>
	                          </div>
	                        ) : null}
	                        {String(walletAddress || "").trim() ? (
	                          <p className="text-[13px] md:text-sm font-mono font-semibold break-all text-white/70">
	                            {walletAddress}
	                          </p>
	                        ) : null}
	                      </div>
	                    ) : null}

                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        amountOutOfRange ||
                        insufficientSourceBalance ||
                        sourceConversionMissing ||
                        targetConversionMissing ||
                        hasReceiveAddressValidationError ||
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) &&
                          !selectedSourceOption)
                      }
                      onClick={() => {
                        setApiError("");
                        setStableDropdownOpen(false);
                        setSearch("");
                        if (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD && walletTargetSelectionEnabled) {
                          createExchange({ returnStep: "form" });
                          return;
                        }
                        setStep("address");
                      }}
                      className={[
                        "md:hidden w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                        (!hasValidAmount || amountOutOfRange || insufficientSourceBalance || sourceConversionMissing || targetConversionMissing || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) && !selectedSourceOption))
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:scale-[1.01] active:scale-[0.98]",
                      ].join(" ")}
                      style={(!hasValidAmount || amountOutOfRange || insufficientSourceBalance || sourceConversionMissing || targetConversionMissing || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) && !selectedSourceOption))
                        ? { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,0.45) 0%, rgba(217,168,10,0.45) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,0.45) 0%, rgba(7,101,223,0.45) 100%)' }
                        : { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,1) 0%, rgba(217,168,10,1) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,1) 0%, rgba(7,101,223,1) 100%)',
                          boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      }
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        amountOutOfRange ||
                        insufficientSourceBalance ||
                        sourceConversionMissing ||
                        targetConversionMissing ||
                        hasReceiveAddressValidationError ||
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) &&
                          !selectedSourceOption)
                      }
                      onClick={() => {
                        setApiError("");
                        setStableDropdownOpen(false);
                        setSearch("");
                        if (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD && walletTargetSelectionEnabled) {
                          createExchange({ returnStep: "form" });
                          return;
                        }
                        setStep("address");
                      }}
                      className={[
                        "hidden md:flex items-center justify-center w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                        (!hasValidAmount || amountOutOfRange || insufficientSourceBalance || sourceConversionMissing || targetConversionMissing || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) && !selectedSourceOption))
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:scale-[1.01] active:scale-[0.98]",
                      ].join(" ")}
                      style={(!hasValidAmount || amountOutOfRange || insufficientSourceBalance || sourceConversionMissing || targetConversionMissing || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || ((walletSourceSelectionEnabled || walletTargetSelectionEnabled) && !selectedSourceOption))
                        ? { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,0.45) 0%, rgba(217,168,10,0.45) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,0.45) 0%, rgba(7,101,223,0.45) 100%)' }
                        : { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,1) 0%, rgba(217,168,10,1) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,1) 0%, rgba(7,101,223,1) 100%)',
                          boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      }
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
	                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE || walletTargetSelectionEnabled ? (
	                      <div className="mt-2 flex items-center justify-center gap-2 text-[11px] md:text-xs text-white/60">
	                        <span>
	                          {t(
	                            "ui_simpleswap_secure_partner_note_f1d7a9c2b3",
	                            "Conversion sécurisé via",
	                          )}
	                        </span>
                        <span
                          className="inline-flex items-center gap-1.5"
                          aria-label={t(
                            "moonpay_buy_payment_methods",
                            "Partenaires et moyens de paiement",
                          )}
                        >
                          <span className="inline-flex items-center justify-center h-[22px] md:h-6 rounded-md px-2 ring-1 ring-white/10 leading-none bg-white/90 w-[140px]">
                            <Image
                              src="/assets/payment-logos/simpleswap.jpeg"
                              alt="SimpleSwap"
                              width={140}
                              height={24}
                              className="h-full w-auto object-contain"
                            />
                          </span>
                        </span>
	                      </div>
	                    ) : null}
	                  </>
	                ) : null}

                {step === "address" ? (
                  <>
	                    <div className="flex items-center gap-3 px-1">
	                      <div className="text-sm text-white/80 font-semibold">
	                        {t("ui_enter_address", "Entrer l’adresse")}
	                      </div>
	                    </div>

                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                      <div className="text-white/80 text-sm">
                        <div>
                          {t("ui_swap_you_send", "Vous envoyez")}{" "}
                          <span className="text-white font-semibold">
                            {hasValidAmount ? parsedAmount : 0}{" "}
                            {walletSourceSelectionEnabled
                              ? selectedSourceCurrencyCode || fromTicker || ""
                              : fromTicker || ""}
                          </span>
                        </div>
                        <div className="mt-1">
                          {t("ui_usd_swap_you_receive", "Vous recevez")}{" "}
                          <span className="text-white font-semibold">
                            {toCurrency ? currencyLabel(toCurrency) : toLabel}
                          </span>
                        </div>
                        {walletSourceSelectionEnabled && Number.isFinite(outboundAmountRlusd) ? (
                          <div className="mt-1 text-white/55">
                            RLUSD utilisé pour le swap:{" "}
                            <span className="text-white/80 font-semibold">
                              {formatAmountNumber
                                ? formatAmountNumber.format(outboundAmountRlusd)
                                : String(outboundAmountRlusd)}{" "}
                              RLUSD
                            </span>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE && toNetwork ? (
                      <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                        {t(
                          "ui_usd_swap_network_note",
                          `Note : ${toTicker || "Le stablecoin"} sera envoyé sur le réseau ${toNetwork}.`,
                        )}
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                          ? t("ui_usd_swap_receive_address", "Adresse de réception")
                          : t(
                              "ui_usd_swap_receive_address_rlusd",
                              "Adresse de réception (RLUSD / XRPL)",
                            )}
                      </label>
                      <input
                        value={receiveAddress}
                        onChange={(e) => {
                          setReceiveAddress(e.target.value);
                          setApiError("");
                        }}
                        placeholder={t(
                          "ui_usd_swap_receive_address_placeholder",
                          direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                            ? "Adresse XRPL (ex: r…)"
                            : "Adresse sur le réseau choisi (ex: 0x… / T…)",
                        )}
                        className={`w-full px-4 py-4 bg-black/30 ring-1 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 transition-all duration-150 ${hasReceiveAddressValidationError ? "ring-red-500/40 focus:ring-red-500/60" : `ring-white/15 ${accentRing60}`}`}
                      />
                      {hasReceiveAddressValidationError ? (
                        <p className="mt-2 text-[11px] text-red-300">
                          {receiveAddressErrorMessage}
                        </p>
                      ) : null}
                    </div>

                    {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setRefundDetailsOpen((v) => !v)}
                          className="w-full flex items-center justify-between rounded-xl bg-white/[0.03] ring-1 ring-white/10 ring-inset px-4 py-3 text-sm text-white/75 hover:text-white transition-colors"
                        >
                          <span>
                            {t(
                              "ui_add_refund_details",
                              "Ajouter les détails de remboursement",
                            )}
                          </span>
                          <span className="text-white/50" aria-hidden>
                            {refundDetailsOpen ? "–" : "+"}
                          </span>
                        </button>
                        {refundDetailsOpen ? (
                          <div className="mt-3">
                            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                              {t("ui_swap_refund_address", "Adresse de remboursement (optionnel)")}
                            </label>
                            <input
                              value={refundAddress}
                              onChange={(e) => setRefundAddress(e.target.value)}
                              placeholder={t(
                                "ui_swap_refund_address_placeholder",
                                "Adresse sur le réseau d’envoi (si l’échange échoue)",
                              )}
	                              className={`w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
	                            />
                            {fromCurrency?.hasExtraId ? (
                              <div className="mt-2">
                                <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                                  {t(
                                    "ui_swap_refund_extraid",
                                    "Tag / Memo de remboursement (optionnel)",
                                  )}
                                </label>
                                <input
                                  value={refundExtraId}
                                  onChange={(e) => setRefundExtraId(e.target.value)}
                                  placeholder={fromCurrency?.extraIdName || "Memo / Tag"}
	                                  className={`w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 ${accentRing60} transition-all duration-150`}
	                                />
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </>
                    ) : null}

                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        amountOutOfRange ||
                        hasReceiveAddressValidationError ||
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        !effectiveReceiveAddress
                      }
                      onClick={async () => {
                        const addr = effectiveReceiveAddress;
                        if (!addr) {
                          setApiError(
                            t(
                              "ui_usd_swap_missing_receive_addr",
                              "Adresse de réception requise.",
                            ),
                          );
                          return;
                        }
                        if (hasReceiveAddressValidationError) {
                          setApiError(receiveAddressErrorMessage);
                          return;
                        }
                        await createExchange({ returnStep: "address" });
                      }}
                      className={[
                        "md:hidden w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                        (!hasValidAmount || amountOutOfRange || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || !effectiveReceiveAddress)
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:scale-[1.01] active:scale-[0.98]",
                      ].join(" ")}
                      style={(!hasValidAmount || amountOutOfRange || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || !effectiveReceiveAddress)
                        ? { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,0.45) 0%, rgba(217,168,10,0.45) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,0.45) 0%, rgba(7,101,223,0.45) 100%)' }
                        : { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,1) 0%, rgba(217,168,10,1) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,1) 0%, rgba(7,101,223,1) 100%)',
                          boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      }
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        amountOutOfRange ||
                        hasReceiveAddressValidationError ||
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        !effectiveReceiveAddress
                      }
                      onClick={async () => {
                        const addr = effectiveReceiveAddress;
                        if (!addr) {
                          setApiError(
                            t(
                              "ui_usd_swap_missing_receive_addr",
                              "Adresse de réception requise.",
                            ),
                          );
                          return;
                        }
                        if (hasReceiveAddressValidationError) {
                          setApiError(receiveAddressErrorMessage);
                          return;
                        }
                        await createExchange({ returnStep: "address" });
                      }}
                      className={[
                        "hidden md:flex items-center justify-center w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                        (!hasValidAmount || amountOutOfRange || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || !effectiveReceiveAddress)
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:scale-[1.01] active:scale-[0.98]",
                      ].join(" ")}
                      style={(!hasValidAmount || amountOutOfRange || hasReceiveAddressValidationError || pairUnavailable || !fromCurrency || !toCurrency || !stableCurrency || !effectiveReceiveAddress)
                        ? { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,0.45) 0%, rgba(217,168,10,0.45) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,0.45) 0%, rgba(7,101,223,0.45) 100%)' }
                        : { background: isBinanceYellow
                            ? 'linear-gradient(180deg, rgba(240,185,11,1) 0%, rgba(217,168,10,1) 100%)'
                            : 'linear-gradient(180deg, rgba(8,112,248,1) 0%, rgba(7,101,223,1) 100%)',
                          boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
                      }
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                  </>
                ) : null}

              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
	  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
