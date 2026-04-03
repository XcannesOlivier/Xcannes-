"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { QRCodeCanvas } from "qrcode.react";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./walletModalTokens";
import { CRYPTO_ICONS } from "@/utils/marketConstants";

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

export default function WalletDashboardUsdSwapModal({
  open,
  onClose,
  walletLabel = "",
  walletAddress = "",
  initialDirection = SWAP_DIRECTIONS.RLUSD_TO_STABLE,
  noticeVariant = "preview",
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });
  const swipeEnabled = false;

  const [step, setStep] = useState("form"); // form | address | pending | deposit
  const [direction, setDirection] = useState(SWAP_DIRECTIONS.RLUSD_TO_STABLE);
  const [rlusdCurrency, setRlusdCurrency] = useState(DEFAULT_RLUSD);
  const [currencies, setCurrencies] = useState([]);
  const [currenciesLoading, setCurrenciesLoading] = useState(false);
  const [currenciesError, setCurrenciesError] = useState("");
  const [search, setSearch] = useState("");
  const [stableKey, setStableKey] = useState("");
  const [stableDropdownOpen, setStableDropdownOpen] = useState(false);
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
  const modalOverlayRef = useRef(null);
  const modalOverlayListRef = useRef(null);
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
  const estimateAbortRef = useRef(null);
  const estimateSeqRef = useRef(0);

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
  const fromCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? rlusdCurrency : stableCurrency;
  const toCurrency =
    direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? stableCurrency : rlusdCurrency;
  const fromCurrencyKey = currencyKey(fromCurrency);
  const toCurrencyKey = currencyKey(toCurrency);
  const toLabel = toCurrency ? currencyLabel(toCurrency) : "";
  const fromTicker = String(fromCurrency?.ticker || "").trim().toUpperCase();
  const fromNetwork = String(fromCurrency?.network || "").trim().toUpperCase();
  const toTicker = String(toCurrency?.ticker || "").trim().toUpperCase();
  const toNetwork = String(toCurrency?.network || "").trim().toUpperCase();
  const totalSteps = 3;
  const currentStepIndex =
    step === "form"
      ? 1
      : step === "address"
        ? 2
        : totalSteps;

  const quotedReceiveAmount = useMemo(() => {
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
    if (!Number.isFinite(num) || num <= 0) return null;
    return num;
  }, [quote]);

  const rangeLimits = useMemo(() => parseSimpleSwapRanges(ranges), [ranges]);
  const minFromAmount = rangeLimits?.min ?? null;
  const maxFromAmount = rangeLimits?.max ?? null;
  const amountBelowMin =
    hasValidAmount && Number.isFinite(minFromAmount) && parsedAmount < minFromAmount;
  const amountAboveMax =
    hasValidAmount && Number.isFinite(maxFromAmount) && parsedAmount > maxFromAmount;
  const amountOutOfRange = amountBelowMin || amountAboveMax;

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

  const resetState = () => {
    setStep("form");
    setSearch("");
    setStableDropdownOpen(false);
    setStableKey("");
    setAmount("");
    setReceiveAddress("");
    setRefundAddress("");
    setRefundExtraId("");
    setRefundDetailsOpen(false);
    setQuote(null);
    setRanges(null);
    setApiError("");
    setExchange(null);
    setCurrenciesError("");
  };

  useEffect(() => {
    if (!open) return;
    const allowed = Object.values(SWAP_DIRECTIONS);
    const nextDirection = allowed.includes(initialDirection)
      ? initialDirection
      : SWAP_DIRECTIONS.RLUSD_TO_STABLE;
    setDirection(nextDirection);
    resetState();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialDirection]);

  useEffect(() => {
    if (!stableDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined") document.body.style.overflow = "hidden";
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
    document.addEventListener("touchstart", handlePointerDown);
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
  }, [stableDropdownOpen]);

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
    if (!fromCurrency || !toCurrency) return;
    setApiError("");
    setRanges(null);
    try {
      const response = await fetch(
        `/api/simpleswap/ranges?${new URLSearchParams({
          fixed: "false",
          reverse: "false",
          tickerFrom: String(fromCurrency.ticker || ""),
          networkFrom: String(fromCurrency.network || ""),
          tickerTo: String(toCurrency.ticker || ""),
          networkTo: String(toCurrency.network || ""),
        }).toString()}`,
      );
      const data = await response.json();
      if (response.ok) {
        setRanges(data);
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
          String(toCurrency?.ticker || "").trim().toLowerCase() === "rlusd" &&
          String(toCurrency?.network || "").trim().toLowerCase() === "xrp"
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
    if (!fromCurrency || !toCurrency || !hasValidAmount) return;
    if (amountOutOfRange) return;
    try {
      const tryEndpoints = ["/api/simpleswap/estimates", "/api/simpleswap/check"];

      const runEstimate = async (candidateFrom, candidateTo) => {
        const params = new URLSearchParams({
          fixed: "false",
          reverse: "false",
          tickerFrom: String(candidateFrom?.ticker || ""),
          networkFrom: String(candidateFrom?.network || ""),
          tickerTo: String(candidateTo?.ticker || ""),
          networkTo: String(candidateTo?.network || ""),
          amount: String(parsedAmount),
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
      const primary = await runEstimate(fromCurrency, toCurrency);
      if (primary.ok) {
        const data = primary.data;
        if (typeof data === "string" || typeof data === "number") {
          setQuote({ estimatedAmount: data });
          setApiError("");
          setPairUnavailable(false);
          return;
        }
        if (typeof data === "object") {
          setQuote(data);
          maybeApplyResolvedRlusdCurrency(data?.xcannesResolved);
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
          const rlusdPayoutBlocked =
            direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD &&
            String(toCurrency?.ticker || "").trim().toLowerCase() === "rlusd" &&
            String(toCurrency?.network || "").trim().toLowerCase() === "xrp" &&
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
    const defaultReceive = direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? walletAddress : "";
    const addr = String(receiveAddress || defaultReceive || "").trim();
    if (!addr) {
      setApiError(t("ui_usd_swap_missing_receive_addr", "Adresse de réception requise."));
      return;
    }

    setApiError("");
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
      const response = await fetch("/api/simpleswap/create-exchange", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fixed: false,
          reverse: false,
          tickerFrom: String(fromCurrency.ticker || ""),
          networkFrom: String(fromCurrency.network || ""),
          tickerTo: String(toCurrency.ticker || ""),
          networkTo: String(toCurrency.network || ""),
          amount: String(parsedAmount),
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
                tickerFrom: String(fromCurrency?.ticker || "rlusd"),
                networkFrom: String(fromCurrency?.network || "xrp"),
                tickerTo: String(toCurrency?.ticker || ""),
                networkTo: String(toCurrency?.network || ""),
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
            className={panelClass}
            onClick={(e) => {
              if (!inline) e.stopPropagation();
            }}
          >
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

              {direction !== SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
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
                  <span className="inline-flex items-center justify-center rounded-full bg-xcannes-green/15 text-xcannes-green text-xs font-semibold px-2.5 py-1">
                    {currentStepIndex}/{totalSteps}
                  </span>
                  <div className="text-sm text-white/80 font-semibold">
                    {t("ui_transfer_deposit", "Transférer le dépôt")}
                  </div>
                </div>

                <div className="text-center pt-1">
                  <div className="text-white font-semibold text-2xl leading-tight">
                    {t("ui_send_your_funds", "Envoyez vos fonds")}
                  </div>
                  <div className="mt-2 text-sm text-white/60 max-w-sm mx-auto">
                    {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE
                      ? t(
                          "ui_usd_swap_created_body_from_wallet",
                          "Envoyez le montant indiqué depuis votre wallet XCANNES à l’adresse de dépôt pour lancer l’échange.",
                        )
                      : t(
                          "ui_usd_swap_created_body_external",
                          "Envoyez le montant indiqué depuis votre wallet externe à l’adresse de dépôt pour lancer l’échange.",
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
                        {fromTicker || ""}
                      </div>
                    </div>
                    {fromNetwork ? (
                      <span className="shrink-0 rounded-full bg-white/10 text-white/70 text-xs font-semibold px-2.5 py-1">
                        {fromNetwork}
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

                {toTicker ? (
                  <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-white/60 text-xs">
                        {t("ui_you_get", "Vous obtenez")}
                      </div>
                      {toNetwork ? (
                        <span className="shrink-0 rounded-full bg-white/10 text-white/70 text-xs font-semibold px-2.5 py-1">
                          {toNetwork}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 text-white font-semibold text-lg leading-tight">
                      {String(receiveAmountExact || "").trim()
                        ? `${receiveAmountExact} ${toTicker}`
                        : quotedReceiveAmount
                          ? `≈${
                              formatAmountNumber
                                ? formatAmountNumber.format(quotedReceiveAmount)
                                : String(quotedReceiveAmount)
                            } ${toTicker}`
                          : `— ${toTicker}`}
                    </div>
                  </div>
                ) : null}

                <div className="rounded-lg ring-1 ring-amber-500/20 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                  {t(
                    "ui_usd_swap_warning",
                    `Attention : envoyez uniquement ${fromTicker || "l'actif sélectionné"} (${fromNetwork || "réseau sélectionné"}). Envoyer un autre actif ou oublier un Tag/Memo peut entraîner une perte.`,
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={refreshExchange}
                    disabled={!exchangeId || exchangeRefreshing}
                    className="flex-1 rounded-lg border border-white/10 bg-black/20 text-white/80 font-semibold py-3 transition-colors hover:bg-black/30 hover:text-white disabled:opacity-50"
                  >
                    {exchangeRefreshing
                      ? t("ui_refreshing", "Rafraîchit…")
                      : t("ui_refresh", "Rafraîchir")}
                  </button>
                  <button
                    type="button"
                    onClick={closeModal}
                    className={`flex-1 py-3 ${greenActionBtnBase}`}
                  >
                    {t("ui_close_08378568ba", "Fermer")}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
		                {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
	                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
                      <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                        {t("moonpay_from_account", "Depuis le compte")}
                      </p>
                      {String(walletLabel || "").trim() ? (
                        <div className="flex items-center gap-2 mb-1">
	                          <span
	                            className="h-3 w-3 rounded-full ring-4 ring-xcannes-green/25 bg-xcannes-green shrink-0 animate-pulse"
	                            aria-hidden
	                          />
                          <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
                            {walletLabel}
                          </p>
                        </div>
                      ) : null}
	                      {String(walletAddress || "").trim() ? (
	                        <p className="text-[11px] md:text-[12px] text-xcannes-green/80 font-mono break-all">
	                          {walletAddress}
	                        </p>
	                      ) : null}
                    </div>
                  ) : null}

                {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
                  <div className="px-1">
                    <h3 className="text-white font-semibold text-base md:text-lg leading-tight">
                      {t("ui_swap_title_out", "RLUSD → stablecoin USD")}
                    </h3>
                    <p className="mt-1 text-xs md:text-sm text-white/60">
                      {t(
                        "ui_swap_subtitle_out",
                        "Recevez un stablecoin USD (multi-chain) sur une autre adresse via SimpleSwap.",
                      )}
                    </p>
                  </div>
                ) : null}

                {step === "pending" ? (
                  <div className="flex flex-col items-center justify-center py-10">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4" />
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
	                    <div className="rounded-[18px] ring-1 ring-white/10 ring-inset bg-black/20 overflow-hidden shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]">
                      <div className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-sm text-white/70">
                            {t("ui_swap_you_send", "Vous envoyez")}
                          </div>
                          <div className="flex items-center gap-2">
                            {direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD ? (
                              <div ref={stableDropdownRef}>
                                <button
                                  type="button"
                                  onClick={() => setStableDropdownOpen(true)}
                                  aria-expanded={stableDropdownOpen}
                                  className="inline-flex items-center gap-2 rounded-full bg-black/30 ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:bg-black/40 transition-colors"
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
                              ? `~${formatUsdNumber ? formatUsdNumber.format(parsedAmount) : parsedAmount.toFixed(2)}$`
                              : ""}
                          </div>
                        </div>

                        {minFromAmount || maxFromAmount ? (
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
                      </div>

                      <div className="relative border-t border-white/10">
                        <div className="absolute -top-5 left-1/2 -translate-x-1/2">
                          <div className="w-10 h-10 rounded-full bg-black/40 ring-1 ring-white/10 flex items-center justify-center">
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              className="w-5 h-5 text-white/60"
                              aria-hidden
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M7 7h10M7 7l3-3M7 7l3 3M17 17H7m10 0l-3-3m3 3l-3 3"
                              />
                            </svg>
                          </div>
                        </div>

                        <div className="p-4 pt-6">
                          <div className="flex items-center justify-between gap-3">
                            <div className="text-sm text-white/70">
                              {t("ui_usd_swap_you_receive", "Vous recevez")}
                            </div>
                            <div className="flex items-center gap-2">
                              {direction === SWAP_DIRECTIONS.RLUSD_TO_STABLE ? (
                                <div ref={stableDropdownRef}>
                                  <button
                                    type="button"
                                    onClick={() => setStableDropdownOpen(true)}
                                    aria-expanded={stableDropdownOpen}
                                    className="inline-flex items-center gap-2 rounded-full bg-black/30 ring-1 ring-white/10 px-3 py-1.5 text-white/85 hover:bg-black/40 transition-colors"
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
                                quotedReceiveAmount ? (
                                  `≈${
                                    formatAmountNumber
                                      ? formatAmountNumber.format(quotedReceiveAmount)
                                      : String(quotedReceiveAmount)
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
                              {hasValidAmount && quotedReceiveAmount
                                ? `~${formatUsdNumber ? formatUsdNumber.format(quotedReceiveAmount) : Number(quotedReceiveAmount).toFixed(2)}$`
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
                            <div className="text-white/40">
                              {toTicker ? `${toTicker} ${toNetwork ? `(${toNetwork})` : ""}` : ""}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {stableDropdownOpen
                      ? createPortal(
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
                                    <div className="text-white font-semibold text-base leading-tight truncate">
                                      {t(
                                        "ui_choose_stablecoin_title",
                                        "Choisir un stablecoin USD",
                                      )}
                                    </div>
                                    <div className="mt-0.5 text-[11px] text-white/55 truncate">
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
                                      className="w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
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
                                                  ? "bg-xcannes-green/10 ring-xcannes-green/35 text-white"
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
                                                  <span className="text-xcannes-green font-semibold text-xs">
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
                                            ? "bg-xcannes-green/10 text-white"
                                            : "hover:bg-white/[0.04] text-white/80",
                                        ].join(" ")}
                                      >
                                        {renderCurrencyIcon(cur)}
                                        <div className="min-w-0 flex-1">
                                          <div className="text-sm font-semibold truncate">
                                            {String(cur?.ticker || "").toUpperCase()}{" "}
                                            <span className="text-white/50 font-normal">
                                              ({String(cur?.network || "").toUpperCase()})
                                            </span>
                                          </div>
                                          <div className="text-[11px] text-white/55 truncate">
                                            {String(cur?.name || "").trim() ||
                                              currencyLabel(cur)}
                                          </div>
                                        </div>
                                        {active ? (
                                          <span className="text-xcannes-green font-semibold text-xs">
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

                    <button
                      type="button"
                      disabled={
                        !hasValidAmount ||
                        amountOutOfRange ||
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency
                      }
                      onClick={() => {
                        setApiError("");
                        setStableDropdownOpen(false);
                        setSearch("");
                        setStep("address");
                      }}
                      className={`w-full text-xl py-4 ${greenActionBtnBase}`}
                    >
                      {t("ui_action_continue", "Continuer")}
                    </button>
                  </>
                ) : null}

                {step === "address" ? (
                  <>
                    <div className="flex items-center gap-3 px-1">
                      <span className="inline-flex items-center justify-center rounded-full bg-xcannes-green/15 text-xcannes-green text-xs font-semibold px-2.5 py-1">
                        {currentStepIndex}/{totalSteps}
                      </span>
                      <div className="text-sm text-white/80 font-semibold">
                        {t("ui_enter_address", "Entrer l’adresse")}
                      </div>
                    </div>

                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-black/20">
                      <div className="text-white/80 text-sm">
                        <div>
                          {t("ui_swap_you_send", "Vous envoyez")}{" "}
                          <span className="text-white font-semibold">
                            {hasValidAmount ? parsedAmount : 0} {fromTicker || ""}
                          </span>
                        </div>
                        <div className="mt-1">
                          {t("ui_usd_swap_you_receive", "Vous recevez")}{" "}
                          <span className="text-white font-semibold">
                            {toCurrency ? currencyLabel(toCurrency) : toLabel}
                          </span>
                        </div>
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
                        onChange={(e) => setReceiveAddress(e.target.value)}
                        placeholder={t(
                          "ui_usd_swap_receive_address_placeholder",
                          direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                            ? "Adresse XRPL (ex: r…)"
                            : "Adresse sur le réseau choisi (ex: 0x… / T…)",
                        )}
                        className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
                      />
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
                              className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
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
                                  className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
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
                        pairUnavailable ||
                        !fromCurrency ||
                        !toCurrency ||
                        !stableCurrency ||
                        !String(
                          receiveAddress ||
                            (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                              ? walletAddress
                              : "") ||
                            "",
                        ).trim()
                      }
                      onClick={async () => {
                        const addr = String(
                          receiveAddress ||
                            (direction === SWAP_DIRECTIONS.STABLE_TO_RLUSD
                              ? walletAddress
                              : "") ||
                            "",
                        ).trim();
                        if (!addr) {
                          setApiError(
                            t(
                              "ui_usd_swap_missing_receive_addr",
                              "Adresse de réception requise.",
                            ),
                          );
                          return;
                        }
                        await createExchange({ returnStep: "address" });
                      }}
                      className={`w-full text-xl py-4 ${greenActionBtnBase}`}
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
