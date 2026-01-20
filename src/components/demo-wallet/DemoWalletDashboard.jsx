"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  applyDemoBuySell,
  applyDemoConvert,
  applyDemoDisableCurrency,
  applyDemoEnableCurrency,
  applyDemoSend,
  buildDefaultDemoState,
  ensureAllocation,
  getDemoRatesUsdPerUnit,
  getWalletAddress,
  migrateDemoState,
  walletUsdTotal
} from "./DemoWalletModel";
import WalletDashboardSendModal from "@/components/wallet/modals/WalletDashboardSendModal";
import WalletDashboardReceiveModal from "@/components/wallet/modals/WalletDashboardReceiveModal";
import WalletDashboardSwapModal from "@/components/wallet/modals/WalletDashboardSwapModal";
import WalletDashboardCashModal from "@/components/wallet/modals/WalletDashboardCashModal";
import WalletDashboardStatementModals from "@/components/wallet/modals/WalletDashboardStatementModals";
import QRScanner from "@/components/wallet/components/QRScanner";
import { useSendForm } from "@/components/wallet/hooks/useSendForm";
import { useReceiveForm } from "@/components/wallet/hooks/useReceiveForm";
import { usePaymentRequestForm } from "@/components/wallet/hooks/usePaymentRequestForm";
import { usePaymentRequestScanner } from "@/components/wallet/hooks/usePaymentRequestScanner";
import { useConvertForm } from "@/components/wallet/hooks/useConvertForm";
import { useCurrencyLinesForm } from "@/components/wallet/hooks/useCurrencyLinesForm";
import { useWalletMeta } from "@/components/wallet/hooks/useWalletMeta";
import { computeSpreadQuote } from "@/utils/walletSpread";
import xcannesApi from "@/lib/xcannesApi";
import { CRYPTO_ICONS } from "@/utils/marketConstants";

const DEMO_WALLET_ACCENTS = {
  A: {
    chip: "bg-xcannes-green/10 border-xcannes-green/25 text-xcannes-green",
    chipInactive: "text-white/60 hover:text-white",
    ring: "ring-xcannes-green/15",
    focusRing: "focus:ring-xcannes-green/40"
  },
  B: {
    chip: "bg-xcannes-blue-light/10 border-xcannes-blue-light/25 text-xcannes-blue-light",
    chipInactive: "text-white/60 hover:text-white",
    ring: "ring-xcannes-blue-light/15",
    focusRing: "focus:ring-xcannes-blue-light/40"
  }
};

function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function countryCodeToFlag(countryCode) {
  if (!countryCode || String(countryCode).length !== 2) return "🏳️";
  const codePoints = [...String(countryCode).toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍"
};

function getCurrencyFlag(code) {
  const upper = String(code || "").toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) return CURRENCY_FLAG_OVERRIDES[upper];
  return countryCodeToFlag(upper.slice(0, 2));
}

function renderDemoTokenIcon(code) {
  const upper = String(code || "").toUpperCase();
  const iconSrc = CRYPTO_ICONS?.[upper];
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt={upper}
        width={20}
        height={20}
        className="w-5 h-5 object-contain"
      />
    );
  }
  return getCurrencyFlag(upper);
}

function formatMoney(locale, amount, currency) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `${Number(amount || 0).toFixed(2)} ${currency}`;
  }
}

function formatUnits(locale, amount) {
  const safeLocale = locale || "en";
  try {
    return new Intl.NumberFormat(safeLocale, {
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return String(amount);
  }
}

const DEMO_STATE_STORAGE_KEY = "xcannes_demo_wallet_state_v1";
const DEMO_PENDING_REQUEST_KEY = "xcannes_demo_wallet_pending_request_v1";
const DEMO_CARD_EVENT = "xcannes:demo-wallet:card";
const DEMO_CARD_CTA_EVENT = "xcannes:demo-wallet:cta";
const DEMO_CARD_FLASH_DURATION_MS = 5000;
const DEMO_LATENCY_MS_MIN = 450;
const DEMO_LATENCY_MS_MAX = 1100;
const DEMO_RATES_REFRESH_MS = 15_000;
const DEMO_RATES_STALE_AFTER_MS = 30_000;
const DEMO_PENDING_REQUEST_TTL_MS = 10 * 60 * 1000;
const DEMO_TOKEN_PRIORITY = { XRP: 0, XCS: 1, RLUSD: 2 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readPendingDemoRequest() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DEMO_PENDING_REQUEST_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.request || !parsed.toWalletId) return null;
    const ts = Number(parsed.ts || 0);
    if (ts && Date.now() - ts > DEMO_PENDING_REQUEST_TTL_MS) {
      window.localStorage.removeItem(DEMO_PENDING_REQUEST_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writePendingDemoRequest(detail) {
  if (typeof window === "undefined") return;
  try {
    const payload = { ...detail, ts: Date.now() };
    window.localStorage.setItem(DEMO_PENDING_REQUEST_KEY, JSON.stringify(payload));
  } catch {
    // ignore
  }
}

function clearPendingDemoRequest() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DEMO_PENDING_REQUEST_KEY);
  } catch {
    // ignore
  }
}

function newDemoEventId(prefix = "demo") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getDemoLatencyMs() {
  const min = DEMO_LATENCY_MS_MIN;
  const max = DEMO_LATENCY_MS_MAX;
  return Math.max(0, Math.floor(min + Math.random() * (max - min)));
}

const DEMO_NATIVE_CURRENCIES = new Set(["XRP", "RLUSD", "XCS"]);

function isDemoNativeCurrency(code) {
  return DEMO_NATIVE_CURRENCIES.has(String(code || "").toUpperCase());
}

function getMinUnitsForCurrency(currencyCode) {
  const code = String(currencyCode || "").toUpperCase();
  if (code === "XRP") return 0.000001;
  return 0.01;
}

function extractTickerPrice(ticker) {
  const priceSource =
    ticker?.lastPrice ??
    ticker?.price ??
    ticker?.midPrice ??
    ticker?.bidPrice ??
    ticker?.askPrice;
  const price = Number(priceSource);
  return Number.isFinite(price) && price > 0 ? price : Number.NaN;
}

async function resolveUsdPerUnit(code, pythPairsMap) {
  const upper = String(code || "").toUpperCase();
  if (!upper) return { rate: Number.NaN, source: null };
  if (upper === "USD" || upper === "RLUSD") return { rate: 1, source: "PYTH" };

  try {
    const directKey = `${upper}_USD`;
    const inverseKey = `USD_${upper}`;

    if (pythPairsMap?.has?.(directKey)) {
      const meta = pythPairsMap.get(directKey);
      const ticker = await xcannesApi.getTicker(meta?.symbol || directKey);
      const price = extractTickerPrice(ticker);
      if (Number.isFinite(price)) return { rate: price, source: "PYTH" };
    }

    if (pythPairsMap?.has?.(inverseKey)) {
      const meta = pythPairsMap.get(inverseKey);
      const ticker = await xcannesApi.getTicker(meta?.symbol || inverseKey);
      const price = extractTickerPrice(ticker);
      if (Number.isFinite(price) && price > 0) return { rate: 1 / price, source: "PYTH" };
    }
  } catch (_err) {
    // fallback below
  }
  try {
    const fxResult = await xcannesApi.getFxEod("USD", upper, 30);
    const candles = Array.isArray(fxResult?.candles) ? fxResult.candles : [];
    const last = candles[candles.length - 1];
    let close = Number.NaN;
    if (last && last.close != null) close = Number(last.close);
    else if (last && last.price != null) close = Number(last.price);

    // API returns USD->QUOTE (QUOTE per USD), so USD per 1 QUOTE is 1/close.
    if (Number.isFinite(close) && close > 0) return { rate: 1 / close, source: "FAWAZ" };
  } catch (_err) {
    // ignore
  }
  return { rate: Number.NaN, source: null };
}

function isValidDemoState(value) {
  if (!value || typeof value !== "object") return false;
  const wallets = value.wallets;
  if (!wallets || typeof wallets !== "object") return false;
  if (!wallets.A || !wallets.B) return false;
  if (!wallets.A.allocations || !wallets.B.allocations) return false;
  return true;
}

export default function DemoWalletDashboard({
  defaultWalletId = "A",
  theme = "default",
  showWalletSwitcher = true,
  showCompareLink = false,
  demoState,
  setDemoState
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const isHomeTheme = theme === "home";
  const isDexTheme = theme === "dex";
  const resolvedDefaultWalletId = defaultWalletId === "B" ? "B" : "A";
  const fallbackUsdPerUnit = useMemo(() => getDemoRatesUsdPerUnit(), []);
  const fallbackRates = useMemo(
    () => ({
      USD: 1,
      RLUSD: 1,
      ...fallbackUsdPerUnit
    }),
    [fallbackUsdPerUnit]
  );
  const [usdPerUnitRates, setUsdPerUnitRates] = useState(() => ({
    USD: 1,
    RLUSD: 1,
    ...fallbackUsdPerUnit
  }));
  const [usdPerUnitSources, setUsdPerUnitSources] = useState(() => ({
    USD: "PYTH",
    RLUSD: "PYTH"
  }));
  const [ratesLastOkTs, setRatesLastOkTs] = useState(() => Date.now());
  const [ratesNowTs, setRatesNowTs] = useState(() => Date.now());
  const [localState, setLocalState] = useState(() => buildDefaultDemoState());
  const [isHydrated, setIsHydrated] = useState(false);
  const isExternalState = demoState && typeof setDemoState === "function";
  const state = isExternalState ? demoState : localState;
  const setState = isExternalState ? setDemoState : setLocalState;
  const [activeWalletId, setActiveWalletId] = useState(resolvedDefaultWalletId);
  const [activeAction, setActiveAction] = useState(null); // send | receive | swap | cash | null
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [cashModalTab, setCashModalTab] = useState("buy"); // buy | sell
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [previewCurrencyTransactions, setPreviewCurrencyTransactions] = useState([]);
  const [statementHighlightByWallet, setStatementHighlightByWallet] = useState({});
  const pendingCtaRef = useRef(null);
  const pendingCardQueueRef = useRef({});
  const flushTimersRef = useRef([]);
  const prevActiveActionRef = useRef(activeAction);
  const wasStatementOpenRef = useRef(false);

  const activeWallet = state.wallets[activeWalletId];
  const otherWalletId = activeWalletId === "A" ? "B" : "A";
  const otherWallet = state.wallets[otherWalletId];
  const demoAccents = DEMO_WALLET_ACCENTS;
  const activeAccent = demoAccents[activeWalletId] || demoAccents.A;
  const panelRingClass = isHomeTheme ? "ring-white/10" : activeAccent.ring;

  const walletContextLabel = `${t("demo_wallet_label", "Wallet")} ${activeWalletId}`;
  const effectiveWallet = getWalletAddress(state, activeWalletId);
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: effectiveWallet,
    walletLabel: walletContextLabel,
    addressTitle: t("demo_tt_wallet_address", "Adresse XRPL du wallet.")
  });
  const demoNoticeContextLabel = "";
  const announceDemoCard = useCallback((detail) => {
    if (typeof window === "undefined") return;
    window.dispatchEvent(new CustomEvent(DEMO_CARD_EVENT, { detail }));
  }, []);
  const recordStatementHighlight = useCallback((walletId, currency, eventId) => {
    if (!walletId || !currency || !eventId) return;
    const walletKey = String(walletId).trim().toUpperCase();
    const currencyKey = String(currency).trim().toUpperCase();
    setStatementHighlightByWallet((prev) => {
      const next = { ...prev };
      const walletMap = { ...(next[walletKey] || {}) };
      walletMap[currencyKey] = { eventId, ts: Date.now() };
      next[walletKey] = walletMap;
      return next;
    });
  }, []);
  const enqueueDemoCard = useCallback((modalKey, detail) => {
    if (!modalKey || !detail) return;
    const current = pendingCardQueueRef.current;
    if (!current[modalKey]) current[modalKey] = [];
    current[modalKey].push(detail);
  }, []);
  const flushDemoCards = useCallback((modalKey) => {
    if (!modalKey) return;
    const current = pendingCardQueueRef.current;
    const queue = current[modalKey];
    if (!queue || !queue.length) return;
    current[modalKey] = [];
    queue.forEach((detail, index) => {
      const timer = setTimeout(
        () => announceDemoCard(detail),
        index * DEMO_CARD_FLASH_DURATION_MS
      );
      flushTimersRef.current.push(timer);
    });
  }, [announceDemoCard]);

  const demoSavedAddresses = useMemo(() => {
    const address = getWalletAddress(state, otherWalletId);
    if (!address) return [];
    return [
      {
        label: otherWallet?.label || `${t("demo_wallet_label", "Wallet")} ${otherWalletId}`,
        address
      }
    ];
  }, [otherWallet?.label, otherWalletId, state, t]);

  useEffect(() => {
    if (isExternalState) return;
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidDemoState(parsed)) setState(migrateDemoState(parsed));
      }
    } catch (err) {
      console.warn("[demo-wallet] failed to load persisted state:", err);
    } finally {
      setIsHydrated(true);
    }
  }, [isExternalState, setState]);

  useEffect(() => {
    if (isExternalState) return;
    if (!isHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(state));
    } catch (err) {
      console.warn("[demo-wallet] failed to persist state:", err);
    }
  }, [isExternalState, isHydrated, state]);

  const {
    sendTab,
    setSendTab,
    sendAssetKey,
    setSendAssetKey,
    sendDestination,
    setSendDestination,
    sendAmount,
    setSendAmount,
    sendProcessing,
    setSendProcessing,
    sendPaymentRequest,
    setSendPaymentRequest
  } = useSendForm({ defaultSendTab: "scan-request" });

  const { receiveTab, setReceiveTab } = useReceiveForm();

  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMethod,
    setRequestMethod,
    requestToAddress,
    setRequestToAddress,
    requestMemo,
    setRequestMemo
  } = usePaymentRequestForm({
    defaultCurrency: "RLUSD",
    defaultMethod: "qr"
  });

  const {
    convertBaseCurrency,
    setConvertBaseCurrency,
    convertQuoteCurrency,
    setConvertQuoteCurrency,
    convertAmount,
    setConvertAmount,
    convertPreview,
    setConvertPreview,
    convertProcessing,
    setConvertProcessing
  } = useConvertForm({
    defaultBaseCurrency: "EUR",
    defaultQuoteCurrency: "RLUSD"
  });

  const {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd
  } = useCurrencyLinesForm();

  useEffect(() => {
    const id = setInterval(() => setRatesNowTs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  const requiredRateCodes = useMemo(() => {
    const codes = new Set(["USD", "RLUSD", "XRP", "XCS"]);
    const wallets = state?.wallets || {};
    Object.values(wallets).forEach((wallet) => {
      Object.keys(wallet?.allocations || {}).forEach((code) => {
        codes.add(String(code || "").toUpperCase());
      });
    });
    if (convertBaseCurrency) codes.add(String(convertBaseCurrency).toUpperCase());
    if (convertQuoteCurrency) codes.add(String(convertQuoteCurrency).toUpperCase());
    if (requestCurrency) codes.add(String(requestCurrency).toUpperCase());
    return Array.from(codes).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [convertBaseCurrency, convertQuoteCurrency, requestCurrency, state?.wallets]);

  useEffect(() => {
    let cancelled = false;

    const loadRates = async () => {
      try {
        const markets = await xcannesApi.getAllMarkets();
        const pythPairs = Array.isArray(markets?.pyth) ? markets.pyth : [];
        const pythPairsMap = new Map();
        pythPairs.forEach((pair) => {
          const base = String(pair?.base || "").toUpperCase();
          const quote = String(pair?.quote || "").toUpperCase();
          if (!base || !quote) return;
          pythPairsMap.set(`${base}_${quote}`, pair);
        });

        const nextRates = { USD: 1, RLUSD: 1 };
        const nextSources = { USD: "PYTH", RLUSD: "PYTH" };

        await Promise.all(
          (requiredRateCodes || []).map(async (code) => {
            const resolved = await resolveUsdPerUnit(code, pythPairsMap);
            const num = Number(resolved?.rate);
            if (!Number.isFinite(num) || num <= 0) return;
            const upper = String(code || "").toUpperCase();
            if (!upper) return;
            nextRates[upper] = num;
            nextSources[upper] = resolved?.source || null;
          })
        );

        if (cancelled) return;
        setUsdPerUnitRates((prev) => ({ ...prev, ...nextRates }));
        setUsdPerUnitSources((prev) => ({ ...prev, ...nextSources }));
        setRatesLastOkTs(Date.now());
      } catch (err) {
        if (!cancelled) {
          console.warn("[demo-wallet] rates refresh failed:", err?.message || err);
        }
      }
    };

    loadRates();
    const id = setInterval(loadRates, DEMO_RATES_REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [requiredRateCodes]);

  const ratesAreStale = ratesNowTs - ratesLastOkTs > DEMO_RATES_STALE_AFTER_MS;
  const effectiveUsdPerUnitRates = useMemo(
    () => ratesAreStale ? { ...fallbackRates, ...usdPerUnitRates } : usdPerUnitRates,
    [fallbackRates, ratesAreStale, usdPerUnitRates]
  );

  const usdTotal = useMemo(
    () => walletUsdTotal(activeWallet, effectiveUsdPerUnitRates),
    [activeWallet, effectiveUsdPerUnitRates]
  );
  const displayCurrency = "USD";
  const displayAmount = usdTotal;

  const tokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    return Object.entries(allocations)
      .map(([code, units]) => {
        const upper = String(code || "").toUpperCase();
        const unitsNum = Number(units) || 0;
        const rate = effectiveUsdPerUnitRates?.[upper] ?? null;
        const usdValue = Number.isFinite(Number(rate)) ? unitsNum * Number(rate) : null;
        return { code: upper, units: unitsNum, usdValue };
      })
      .sort((a, b) => {
        const aPriority =
          Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, a.code)
            ? DEMO_TOKEN_PRIORITY[a.code]
            : Number.POSITIVE_INFINITY;
        const bPriority =
          Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, b.code)
            ? DEMO_TOKEN_PRIORITY[b.code]
            : Number.POSITIVE_INFINITY;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const diff = (b.usdValue || 0) - (a.usdValue || 0);
        if (diff !== 0) return diff;
        return a.code.localeCompare(b.code);
      });
  }, [activeWallet?.allocations, effectiveUsdPerUnitRates]);

  const rlusdPerUnitRates = useMemo(
    () => effectiveUsdPerUnitRates,
    [effectiveUsdPerUnitRates]
  );
  const rlusdPerUnitSources = useMemo(() => ({ ...usdPerUnitSources }), [usdPerUnitSources]);

  const augmentedTokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const entries = Object.entries(allocations).map(([code, units]) => {
      const currency = String(code || "").toUpperCase();
      const value = Number(units) || 0;
      const isTrustlineOnly = !isDemoNativeCurrency(currency);
      const rlusdPerUnit = Number(rlusdPerUnitRates?.[currency] || 0);
      const nativeRate = Number(rlusdPerUnitRates?.[currency] || 0);
      const demoRlusdValue = isTrustlineOnly
        ? value * (rlusdPerUnit || 0)
        : currency === "RLUSD"
          ? value
          : nativeRate > 0
            ? value * nativeRate
            : value;

      return {
        key: currency,
        currency,
        value,
        issuer: isTrustlineOnly ? "XCANNES" : undefined,
        isTrustlineOnly,
        isMissingTrustline: false,
        demoRlusdValue
      };
    });
    return entries.sort(
      (a, b) => {
        const aPriority =
          Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, a.currency)
            ? DEMO_TOKEN_PRIORITY[a.currency]
            : Number.POSITIVE_INFINITY;
        const bPriority =
          Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, b.currency)
            ? DEMO_TOKEN_PRIORITY[b.currency]
            : Number.POSITIVE_INFINITY;
        if (aPriority !== bPriority) return aPriority - bPriority;
        const diff =
          Number(b.demoRlusdValue || 0) - Number(a.demoRlusdValue || 0);
        if (diff !== 0) return diff;
        return String(a.currency || "").localeCompare(String(b.currency || ""));
      }
    );
  }, [activeWallet?.allocations, rlusdPerUnitRates]);

  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      if (token.key) labels[token.key] = code;
      labels[code] = code;
    });
    return labels;
  }, [augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    const balanceLabel = t("ui_balance_label_4db9aa0c31", "Balance").replace(/:\s*$/, "");
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountLabel = formatUnits(locale, token.value || 0);
      const label = `${balanceLabel} = ${amountLabel}`;
      if (token.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [augmentedTokens, locale, t]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountLabel = formatUnits(locale, token.value || 0);
      const label = `${code} (${amountLabel})`;
      if (token.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [augmentedTokens, locale]);

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const icon = CRYPTO_ICONS?.[code]
        ? { src: CRYPTO_ICONS[code], alt: code }
        : getCurrencyFlag(code);
      if (token.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  const selectedSendToken = useMemo(() => {
    if (!augmentedTokens.length) return null;
    return augmentedTokens.find((token) => token.key === sendAssetKey) || augmentedTokens[0];
  }, [augmentedTokens, sendAssetKey]);

  useEffect(() => {
    if (!selectedSendToken) return;
    if (!sendAssetKey) setSendAssetKey(selectedSendToken.key);
  }, [selectedSendToken, sendAssetKey, setSendAssetKey]);

  const sendFxInfo = useMemo(() => {
    if (!selectedSendToken) return null;
    const amountFx = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountFx) || amountFx <= 0) return null;

    const code = String(selectedSendToken.currency || "").toUpperCase();
    const isFxSend = selectedSendToken?.isTrustlineOnly && !isDemoNativeCurrency(code);
    if (!isFxSend) return null;

    const rlusdPerUnit = Number(rlusdPerUnitRates?.[code] || 0);
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) return null;

    const paymentRlusd = amountFx * rlusdPerUnit;
    const spread = computeSpreadQuote({
      base: code,
      quote: "RLUSD",
      amountRlusd: paymentRlusd
    });
    const spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);

    return {
      currency: code,
      fxSource: "DEMO",
      rlusdPerUnit,
      amountFx,
      paymentRlusd,
      spreadFeeRlusd,
      spreadTier: spread?.tier || null,
      spreadPercentTotal:
        spread?.isFx && Number.isFinite(Number(spread?.spreadFraction))
          ? Number(spread.spreadFraction) * 100
          : 0
    };
  }, [rlusdPerUnitRates, selectedSendToken, sendAmount]);

  const {
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan
  } = usePaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendAmount,
    setSendAssetKey,
    setSendTab,
    setSendPaymentRequest
  });

  const handlePendingDemoRequest = useCallback((detail) => {
    if (!detail?.request) return false;
    if (detail.toWalletId !== activeWalletId) return false;
    setSendTab("manual");
    setActiveAction("send");
    handlePaymentRequestScan?.(JSON.stringify(detail.request));
    clearPendingDemoRequest();
    return true;
  }, [activeWalletId, handlePaymentRequestScan, setActiveAction, setSendTab]);

  const runDemoCta = useCallback((detail) => {
    const action = detail?.action;
    if (!action) return;
    const currency = String(detail.currency || "").trim().toUpperCase();
    const closeStatements = () => {
      setShowGlobalStatement(false);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
    };
    const openCurrencyStatement = (code) => {
      const upper = String(code || "").trim().toUpperCase();
      if (!upper) return;
      const token =
        (augmentedTokens || []).find(
          (tok) => String(tok.currency || "").toUpperCase() === upper
        ) || {
          currency: upper,
          value: Number(activeWallet?.allocations?.[upper] || 0)
        };
      setSelectedStatementToken(token);
      setShowCurrencyStatement(true);
    };

    if (action === "open_statement_currency") {
      setActiveAction(null);
      closeStatements();
      openCurrencyStatement(currency);
      return;
    }

    if (action === "open_statement_global") {
      setActiveAction(null);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
      setShowGlobalStatement(true);
      return;
    }

    if (action === "open_send") {
      closeStatements();
      if (detail.usePendingRequest) {
        const pending = readPendingDemoRequest();
        if (pending && pending.toWalletId === activeWalletId) {
          handlePendingDemoRequest(pending);
          return;
        }
      }
      setSendTab(detail.sendTab || "manual");
      setActiveAction("send");
      return;
    }

    if (action === "open_receive") {
      closeStatements();
      setReceiveTab(detail.receiveTab || "receive");
      setActiveAction("receive");
      return;
    }

    if (action === "open_swap") {
      closeStatements();
      setSwapDefaultView(detail.swapView || "convert");
      setActiveAction("swap");
      return;
    }

    if (action === "open_cash") {
      closeStatements();
      setCashModalTab(detail.cashTab === "sell" ? "sell" : "buy");
      setActiveAction("cash");
    }
  }, [
    activeWallet?.allocations,
    activeWalletId,
    augmentedTokens,
    handlePendingDemoRequest,
    setActiveAction,
    setCashModalTab,
    setReceiveTab,
    setSendTab,
    setSelectedStatementToken,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setSwapDefaultView
  ]);

  const handleDemoRequestGenerated = useCallback((request) => {
    if (!request || typeof window === "undefined") return;
    const detail = {
      request,
      fromWalletId: activeWalletId,
      toWalletId: otherWalletId
    };
    window.dispatchEvent(new CustomEvent("xcannes:demo-wallet:request", { detail }));
    writePendingDemoRequest(detail);
    const requestAmount = request?.displayAmount ?? request?.amount ?? request?.amountRlusd;
    const requestCurrency =
      request?.displayCurrency ||
      request?.targetCurrency ||
      request?.targetCurrencyCode ||
      request?.currency;
    enqueueDemoCard("receive", {
      action: "request",
      walletId: activeWalletId,
      fromWalletId: activeWalletId,
      toWalletId: otherWalletId,
      amount: requestAmount,
      currency: requestCurrency
    });
  }, [activeWalletId, enqueueDemoCard, otherWalletId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event) => {
      const detail = event?.detail || {};
      handlePendingDemoRequest(detail);
    };
    window.addEventListener("xcannes:demo-wallet:request", handler);
    return () => window.removeEventListener("xcannes:demo-wallet:request", handler);
  }, [handlePendingDemoRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const pending = readPendingDemoRequest();
    if (!pending) return;
    handlePendingDemoRequest(pending);
  }, [activeWalletId, handlePendingDemoRequest]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (event) => {
      const detail = event?.detail || {};
      const action = detail?.action;
      if (!action) return;
      const targetWalletId = detail.walletId
        ? String(detail.walletId).trim().toUpperCase()
        : null;

      if (targetWalletId) {
        if (isExternalState) {
          if (resolvedDefaultWalletId !== targetWalletId) return;
        } else if (activeWalletId !== targetWalletId) {
          pendingCtaRef.current = { ...detail, walletId: targetWalletId };
          setActiveWalletId(targetWalletId);
          return;
        }
      }

      runDemoCta(detail);
    };

    window.addEventListener(DEMO_CARD_CTA_EVENT, handler);
    return () => window.removeEventListener(DEMO_CARD_CTA_EVENT, handler);
  }, [activeWalletId, isExternalState, resolvedDefaultWalletId, runDemoCta]);

  useEffect(() => {
    const pending = pendingCtaRef.current;
    if (!pending) return;
    const targetWalletId = pending.walletId
      ? String(pending.walletId).trim().toUpperCase()
      : null;
    if (targetWalletId && targetWalletId !== activeWalletId) return;
    pendingCtaRef.current = null;
    runDemoCta(pending);
  }, [activeWalletId, runDemoCta]);

  useEffect(() => {
    const prev = prevActiveActionRef.current;
    if (prev && prev !== activeAction) {
      flushDemoCards(prev);
    }
    prevActiveActionRef.current = activeAction;
  }, [activeAction, flushDemoCards]);

  useEffect(() => {
    if (showGlobalStatement) {
      enqueueDemoCard("statement", {
        action: "statement_global",
        walletId: activeWalletId
      });
    }
  }, [activeWalletId, enqueueDemoCard, showGlobalStatement]);

  useEffect(() => {
    if (!showCurrencyStatement || !selectedStatementToken) return;
    enqueueDemoCard("statement", {
      action: "statement_currency",
      walletId: activeWalletId,
      currency: selectedStatementToken.currency
    });
  }, [activeWalletId, enqueueDemoCard, selectedStatementToken, showCurrencyStatement]);

  useEffect(() => {
    const isStatementOpen = showGlobalStatement || showCurrencyStatement;
    if (wasStatementOpenRef.current && !isStatementOpen) {
      flushDemoCards("statement");
    }
    wasStatementOpenRef.current = isStatementOpen;
  }, [flushDemoCards, showCurrencyStatement, showGlobalStatement]);

  useEffect(() => {
    return () => {
      flushTimersRef.current.forEach((timer) => clearTimeout(timer));
      flushTimersRef.current = [];
    };
  }, []);

  const handleReset = () => {
    setState(buildDefaultDemoState());
    setActiveWalletId(resolvedDefaultWalletId);
    setActiveAction(null);
    setCashModalTab("buy");
    setShowGlobalStatement(false);
    setShowCurrencyStatement(false);
    setSelectedStatementToken(null);
    setStatementHighlightByWallet({});
    setSendPaymentRequest(null);
  };

  const submitSend = ({ amount, currency, memo, toWalletId, isFxSend, paymentRequest }) => {
    const minUnits = getMinUnitsForCurrency(currency);
    if (!Number.isFinite(Number(amount)) || Number(amount) < minUnits) {
      return {
        error: t(
          "demo_error_amount_too_small",
          "Amount too small (demo)."
        )
      };
    }

    let spreadFeeUnits = 0;
    let spreadFeeRlusd = 0;
    let fxRate = null;

    if (isFxSend) {
      const requestedFxRate =
      paymentRequest?.fxRate != null ? Number(paymentRequest.fxRate) : Number.NaN;
      const rawRate = Number(effectiveUsdPerUnitRates?.[currency]);
      const effectiveRate =
      Number.isFinite(requestedFxRate) && requestedFxRate > 0 ? requestedFxRate : rawRate;
      if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) {
        return {
          error: t("demo_error_rates_stale", "Rates temporarily unavailable (demo). Please retry.")
        };
      }

      fxRate = effectiveRate;
      const paymentRlusd = Number(amount) * effectiveRate;
      const requestedRlusd =
      paymentRequest?.amountRlusd != null ? Number(paymentRequest.amountRlusd) : Number.NaN;
      if (Number.isFinite(requestedRlusd) && requestedRlusd > 0) {
        const diff = Math.abs(paymentRlusd - requestedRlusd);
        if (diff > Math.max(0.01, requestedRlusd * 0.005)) {
          const requestedLabel = requestedRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6
          });
          const computedLabel = paymentRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6
          });
          return {
            error: t("demo_error_payment_request_mismatch", {
              defaultValue:
                "Demande de paiement incohérente (démo).\n\nDemandé : ≈ {{requested}} RLUSD\nCalculé : ≈ {{computed}} RLUSD\n\nResscanez la demande ou réessayez.",
              requested: requestedLabel,
              computed: computedLabel
            })
          };
        }
      }

      const spread = computeSpreadQuote({
        base: currency,
        quote: "RLUSD",
        amountRlusd: paymentRlusd
      });
      spreadFeeRlusd = Number(spread?.spreadFeeRlusd || 0);
      if (Number.isFinite(spreadFeeRlusd) && spreadFeeRlusd > 0) {
        spreadFeeUnits = spreadFeeRlusd / effectiveRate;
      }
    }

    const nextState = clone(state);

    if (isFxSend && spreadFeeUnits > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      const available = Number(fromWallet?.allocations?.[currency] || 0);
      const totalDebit = Number(amount) + Number(spreadFeeUnits || 0);
      if (!Number.isFinite(available) || available + 1e-9 < totalDebit) {
        return { error: t("demo_error_insufficient", "Solde insuffisant (démo).") };
      }
    }

    const result = applyDemoSend({
      state: nextState,
      fromWalletId: activeWalletId,
      toWalletId: toWalletId || otherWalletId,
      currencyCode: currency,
      amountUnits: amount,
      memo,
      ratesUsdPerUnit: effectiveUsdPerUnitRates
    });
    if (!result.ok) {
      const message =
      result.error === "insufficient_funds" ?
      t("demo_error_insufficient", "Solde insuffisant (démo).") :
      result.error === "unsupported_currency" ?
      t("demo_error_unsupported", "Devise non supportée (démo).") :
      t("demo_error_generic", "Action impossible (démo).");
      return { error: message };
    }
    const sendEvent = result?.event || null;
    if (sendEvent?.id) {
      recordStatementHighlight(activeWalletId, currency, sendEvent.id);
      if (toWalletId) {
        recordStatementHighlight(toWalletId, currency, sendEvent.id);
      }
    }

    if (isFxSend && spreadFeeUnits > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      const feeWallet = nextState.wallets?.FEE;
      if (fromWallet) {
        ensureAllocation(fromWallet, currency);
        fromWallet.allocations[currency] = Number(
          (Number(fromWallet.allocations[currency] || 0) - Number(spreadFeeUnits)).toFixed(6)
        );
      }
      if (feeWallet) {
        ensureAllocation(feeWallet, currency);
        feeWallet.allocations[currency] = Number(
          (Number(feeWallet.allocations[currency] || 0) + Number(spreadFeeUnits)).toFixed(6)
        );
      }
      if (!nextState.events) nextState.events = [];
      nextState.events.unshift({
        id: newDemoEventId("demo_spread"),
        ts: Date.now(),
        kind: "spread_fee",
        wallet: activeWalletId,
        currency,
        amount: Number(spreadFeeUnits),
        usdValue: Number(spreadFeeRlusd) || 0,
        fxRate
      });
    }

    setState(nextState);
    return { ok: true };
  };

  const submitConvert = ({ amount, from, to }) => {
    const minUnits = getMinUnitsForCurrency(from);
    if (!Number.isFinite(Number(amount)) || Number(amount) < minUnits) {
      return {
        error: t(
          "demo_error_amount_too_small",
          "Amount too small (demo)."
        )
      };
    }
    const nextState = clone(state);
    const result = applyDemoConvert({
      state: nextState,
      walletId: activeWalletId,
      fromCurrencyCode: from,
      toCurrencyCode: to,
      amountUnits: amount,
      ratesUsdPerUnit: effectiveUsdPerUnitRates
    });
    if (!result.ok) {
      const message =
      result.error === "insufficient_funds" ?
      t("demo_error_insufficient", "Solde insuffisant (démo).") :
      result.error === "invalid_pair" ?
      t("demo_error_pair", "Paire invalide (démo).") :
      t("demo_error_generic", "Action impossible (démo).");
      return { error: message };
    }
    setState(nextState);
    return { ok: true, event: result?.event || nextState?.events?.[0] || null };
  };

  const handleSendSubmit = async () => {
    if (!selectedSendToken) return { ok: false };
    const amountNum = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false };

    const dest = String(sendDestination || "").trim();
    if (sendPaymentRequest?.to && dest !== String(sendPaymentRequest.to).trim()) {
      alert(
        t(
          "demo_error_request_destination_mismatch",
          "La destination de la demande de paiement ne correspond pas (démo)."
        )
      );
      return { ok: false };
    }
    const toWalletId =
      dest === getWalletAddress(state, otherWalletId) ? otherWalletId : null;
    if (!toWalletId) {
      alert(
        t(
          "demo_error_destination_wallet_required",
          "Démo : la destination doit être une adresse Wallet A/B."
        )
      );
      return { ok: false };
    }

    const currency = String(selectedSendToken.currency || "").toUpperCase();
    const requestTargetCurrency = String(sendPaymentRequest?.targetCurrencyCode || "")
      .trim()
      .toUpperCase();
    if (requestTargetCurrency && requestTargetCurrency !== currency) {
      alert(
        t("demo_error_request_currency_mismatch", {
          defaultValue:
            "Cette demande est en {{currency}}.\nVeuillez sélectionner {{currency}} pour payer.",
          currency: requestTargetCurrency
        })
      );
      return { ok: false };
    }

    const isFxSend = selectedSendToken?.isTrustlineOnly && !isDemoNativeCurrency(currency);

    setSendProcessing(true);
    try {
      await sleep(getDemoLatencyMs());
      const res = submitSend({
        amount: amountNum,
        currency,
        memo: sendPaymentRequest?.memo || "",
        toWalletId,
        isFxSend,
        paymentRequest: sendPaymentRequest
      });
      if (res?.error) {
        alert(res.error);
        return { ok: false };
      }
      enqueueDemoCard("send", {
        action: "send",
        walletId: activeWalletId,
        fromWalletId: activeWalletId,
        toWalletId,
        amount: amountNum,
        currency
      });
      setActiveAction(null);
      setSendPaymentRequest(null);
      return { ok: true };
    } finally {
      setSendProcessing(false);
    }
  };

  const currencyLines = useMemo(() => {
    return (augmentedTokens || [])
      .filter((token) => token.isTrustlineOnly)
      .map((token) => {
        const code = String(token.currency || "").toUpperCase();
        const rate = Number(rlusdPerUnitRates?.[code] || 0);
        const allocatedRlusd = rate > 0 ? Number(token.value || 0) * rate : 0;
        return { currencyCode: code, allocatedRlusd };
      });
  }, [augmentedTokens, rlusdPerUnitRates]);

  const currencyLinesSummary = useMemo(() => {
    const rlusdOnChain = Number(activeWallet?.allocations?.RLUSD) || 0;
    const totalAllocatedRlusd = currencyLines.reduce(
      (sum, line) => sum + Number(line?.allocatedRlusd || 0),
      0
    );
    const unallocatedRlusd = Math.max(0, rlusdOnChain - totalAllocatedRlusd);
    return { rlusdOnChain, totalAllocatedRlusd, unallocatedRlusd };
  }, [activeWallet?.allocations?.RLUSD, currencyLines]);

  const swapCurrencyOptions = useMemo(() => {
    const codes = new Set(
      (augmentedTokens || []).map((tok) => String(tok.currency || "").toUpperCase())
    );
    codes.add("RLUSD");
    codes.add("XRP");
    codes.add("XCS");
    return Array.from(codes).filter(Boolean).sort((a, b) => {
      const aPriority =
        Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, a)
          ? DEMO_TOKEN_PRIORITY[a]
          : Number.POSITIVE_INFINITY;
      const bPriority =
        Object.prototype.hasOwnProperty.call(DEMO_TOKEN_PRIORITY, b)
          ? DEMO_TOKEN_PRIORITY[b]
          : Number.POSITIVE_INFINITY;
      if (aPriority !== bPriority) return aPriority - bPriority;
      return a.localeCompare(b);
    });
  }, [augmentedTokens]);

  useEffect(() => {
    const amt = Number.parseFloat(convertAmount || "0");
    if (!Number.isFinite(amt) || amt <= 0) {
      setConvertPreview("");
      return;
    }
    const base = String(convertBaseCurrency || "").toUpperCase();
    const quote = String(convertQuoteCurrency || "").toUpperCase();
    if (!base || !quote || base === quote) {
      setConvertPreview("");
      return;
    }
    const baseUsd = Number(rlusdPerUnitRates?.[base] || 0);
    const quoteUsd = Number(rlusdPerUnitRates?.[quote] || 0);
    if (!baseUsd || !quoteUsd) {
      setConvertPreview("");
      return;
    }
    const usdGross = amt * baseUsd;
    const feeUsd = usdGross * 60 / 10_000;
    const usdNet = Math.max(0, usdGross - feeUsd);
    const toAmount = usdNet / quoteUsd;
    const amountLabel = toAmount.toLocaleString(locale, { maximumFractionDigits: 6 });
    const usdLabel = usdNet.toLocaleString(locale, { maximumFractionDigits: 2 });
    const feeLabel = feeUsd.toLocaleString(locale, { maximumFractionDigits: 2 });
    const baseLabel = t("demo_quote_backed", "USD base");
    const feeLabelText = t("demo_quote_fee", "fee");
    setConvertPreview(
      `≈ ${amountLabel} ${quote} · ${baseLabel} ${usdLabel} · ${feeLabelText} ${feeLabel}`
    );
  }, [
  convertAmount,
  convertBaseCurrency,
  convertQuoteCurrency,
  locale,
  rlusdPerUnitRates,
  setConvertPreview,
  t]
  );

  const handleDemoConvert = () => {
    void (async () => {
      const amt = Number.parseFloat(convertAmount || "0");
      if (!Number.isFinite(amt) || amt <= 0) return;
      const from = String(convertBaseCurrency || "").toUpperCase();
      const to = String(convertQuoteCurrency || "").toUpperCase();
      if (!from || !to || from === to) return;
      setConvertProcessing(true);
      try {
        await sleep(getDemoLatencyMs());
        const res = submitConvert({ amount: amt, from, to });
        if (res?.error) alert(res.error);
        if (res?.ok) {
          const event = res.event || {};
          if (event?.id) {
            const fromCode = event.fromCurrency || from;
            const toCode = event.toCurrency || to;
            if (fromCode) recordStatementHighlight(activeWalletId, fromCode, event.id);
            if (toCode) recordStatementHighlight(activeWalletId, toCode, event.id);
          }
          enqueueDemoCard("swap", {
            action: "convert",
            walletId: activeWalletId,
            fromAmount: event.fromAmount ?? amt,
            toAmount: event.toAmount ?? null,
            fromCurrency: event.fromCurrency ?? from,
            toCurrency: event.toCurrency ?? to
          });
        }
        setActiveAction(null);
      } finally {
        setConvertProcessing(false);
      }
    })();
  };

  const handleActivateCurrencyLine = (code) => {
    const nextState = clone(state);
    const res = applyDemoEnableCurrency({
      state: nextState,
      walletId: activeWalletId,
      currencyCode: code
    });
    if (res.ok) {
      setState(nextState);
      enqueueDemoCard("swap", {
        action: "trustline_add",
        walletId: activeWalletId,
        currency: code
      });
    }
  };

  const handleRemoveCurrencyLine = (code) => {
    const nextState = clone(state);
    const res = applyDemoDisableCurrency({
      state: nextState,
      walletId: activeWalletId,
      currencyCode: code
    });
    if (!res.ok) {
      alert(
        res.error === "non_zero_balance" ?
        t("demo_trustlines_delete_disabled", "Convertissez vers 0 avant suppression.") :
        t("demo_error_generic", "Action impossible (démo).")
      );
      return;
    }
    setState(nextState);
    enqueueDemoCard("swap", {
      action: "trustline_remove",
      walletId: activeWalletId,
      currency: code
    });
  };

  const handleUpsertCurrencyLine = () => {
    const code = String(currencyLineCode || "").toUpperCase();
    const allocated = Number.parseFloat(currencyLineAllocatedRlusd || "0");
    if (!code || !Number.isFinite(allocated) || allocated < 0) return;
    const rate = Number(rlusdPerUnitRates?.[code] || 0);
    if (!rate || code === "RLUSD") return;
    const nextState = clone(state);
    const wallet = nextState.wallets?.[activeWalletId];
    if (!wallet) return;
    const prevUnits = Number(wallet.allocations?.[code] || 0);
    const prevAllocated = Number.isFinite(prevUnits) ? prevUnits * rate : 0;
    const deltaAllocated = allocated - prevAllocated;
    const currentRlusd = Number(wallet.allocations?.RLUSD || 0);
    const nextRlusd = currentRlusd - deltaAllocated;

    if (nextRlusd + 1e-9 < 0) {
      alert(t("demo_error_insufficient", "Solde insuffisant (démo)."));
      return;
    }

    const units = allocated / rate;
    wallet.allocations.RLUSD = Number(Math.max(0, nextRlusd).toFixed(6));
    wallet.allocations[code] = Number(units.toFixed(6));
    setState(nextState);
    enqueueDemoCard("swap", {
      action: "trustline_update",
      walletId: activeWalletId,
      currency: code,
      amount: allocated
    });
  };

  const walletEvents = useMemo(() => {
    return (state.events || []).filter((evt) => {
      if (!evt) return false;
      if (evt.kind === "send") {
        return evt.from === activeWalletId || evt.to === activeWalletId;
      }
      if (evt.wallet) return evt.wallet === activeWalletId;
      return false;
    });
  }, [activeWalletId, state.events]);

  const previewGlobalMovements = useMemo(() => {
    return (walletEvents || []).map((evt) => {
      if (evt.kind === "convert") {
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.fromCurrency,
          toCurrencyCode: evt.toCurrency,
          amountRlusd: evt.usdNet ?? evt.usdGross ?? 0
        };
      }
      if (evt.kind === "send") {
        const rate = Number(rlusdPerUnitRates?.[evt.currency] || 0);
        const amountRlusd =
        String(evt.currency).toUpperCase() === "RLUSD" ?
        evt.amount :
        rate > 0 ?
        Number(evt.amount || 0) * rate :
        0;
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.currency,
          toCurrencyCode: evt.currency,
          amountRlusd
        };
      }
      if (evt.kind === "buy" || evt.kind === "sell") {
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.kind === "buy" ? "USD" : "RLUSD",
          toCurrencyCode: "RLUSD",
          amountRlusd: evt.amount || 0
        };
      }
      return {
        movementId: evt.id,
        createdAt: new Date(evt.ts).toISOString(),
        fromCurrencyCode: evt.currency || "RLUSD",
        toCurrencyCode: evt.currency || "RLUSD",
        amountRlusd: evt.amount || 0
      };
    });
  }, [rlusdPerUnitRates, walletEvents]);

  useEffect(() => {
    if (!selectedStatementToken) {
      setPreviewCurrencyTransactions([]);
      return;
    }
    const currency = String(selectedStatementToken.currency || "").toUpperCase();
    const events = walletEvents || []; // newest -> oldest
    let running = Number(activeWallet?.allocations?.[currency]) || 0;
    const txs = [];

    events.forEach((evt) => {
      let amount = 0;
      let delta = 0;
      let type = "credit";
      let category = "other";
      let description = t("demo_statement_movement", "Mouvement");
      let counterparty = "";

      if (evt.kind === "send" && String(evt.currency).toUpperCase() === currency) {
        amount = Number(evt.amount || 0);
        if (evt.from === activeWalletId) {
          delta = -amount;
          type = "debit";
          counterparty = getWalletAddress(state, evt.to);
          description = t("demo_statement_send_to_wallet", {
            defaultValue: "Envoyer vers le wallet {{walletId}}",
            walletId: evt.to
          });
        } else if (evt.to === activeWalletId) {
          delta = amount;
          type = "credit";
          counterparty = getWalletAddress(state, evt.from);
          description = t("demo_statement_receive_from_wallet", {
            defaultValue: "Recevoir depuis le wallet {{walletId}}",
            walletId: evt.from
          });
        } else {
          return;
        }
      } else if (evt.kind === "convert") {
        category = "exchange";
        if (String(evt.fromCurrency).toUpperCase() === currency) {
          type = "debit";
          amount = Number(evt.fromAmount || 0);
          delta = -amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: evt.fromCurrency,
            toCurrency: evt.toCurrency
          });
        } else if (String(evt.toCurrency).toUpperCase() === currency) {
          type = "credit";
          amount = Number(evt.toAmount || 0);
          delta = amount;
          description = t("demo_statement_exchange", {
            defaultValue: "Conversion {{fromCurrency}} → {{toCurrency}}",
            fromCurrency: evt.fromCurrency,
            toCurrency: evt.toCurrency
          });
        } else {
          return;
        }
      } else if (evt.kind === "buy" && currency === "RLUSD") {
        category = "buy";
        type = "credit";
        amount = Number(evt.amount || 0);
        delta = amount;
        description = t("demo_statement_buy_moonpay", "Achat via MoonPay (démo)");
      } else if (evt.kind === "sell" && currency === "RLUSD") {
        category = "sell";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t("demo_statement_sell_moonpay", "Vente via MoonPay (démo)");
      } else if (
      evt.kind === "spread_fee" &&
      String(evt.currency).toUpperCase() === currency &&
      evt.wallet === activeWalletId)
      {
        category = "fee";
        type = "debit";
        amount = Number(evt.amount || 0);
        delta = -amount;
        description = t("demo_statement_fee_spread", "Frais XCANNES (spread)");
      } else {
        return;
      }

      if (!Number.isFinite(amount) || amount <= 0) return;

      txs.push({
        id: evt.id,
        date: new Date(evt.ts).toISOString(),
        category,
        type,
        description,
        counterparty,
        amount,
        runningBalance: running
      });
      running -= delta;
    });

    setPreviewCurrencyTransactions(txs);
  }, [
    activeWallet?.allocations,
    activeWalletId,
    selectedStatementToken,
    state,
    t,
    walletEvents
  ]);

  const highlightTransactionId = useMemo(() => {
    if (!selectedStatementToken) return null;
    const walletKey = String(activeWalletId || "").trim().toUpperCase();
    const currencyKey = String(selectedStatementToken.currency || "").trim().toUpperCase();
    const walletMap = statementHighlightByWallet[walletKey] || {};
    return walletMap?.[currencyKey]?.eventId || null;
  }, [activeWalletId, selectedStatementToken, statementHighlightByWallet]);

  return (
    <div
      className={[
      "h-full flex flex-col min-h-0 ring-1 rounded-xl bg-elevated",
      isHomeTheme ? "demo-wallet-theme-home" : "",
      isDexTheme ? "demo-wallet-theme-dex" : "",
      panelRingClass].
      join(" ")}>

      <div className="panel-header">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">{t("ui_xcannes_30015bef4b", "XCANNES")}

            </span>
            <span className="text-[10px] font-light text-white/30">|</span>
            <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/70 uppercase truncate">
              {t("demo_wallet_label", "Wallet")} {activeWalletId}
            </span>
          </div>
          <span className="text-[10px] font-semibold text-xcannes-green uppercase tracking-[0.18em]">
            {t("demo_notice_title", "Demo mode")}
          </span>
        </div>

        {showWalletSwitcher &&
        <div className="mt-3 flex items-center justify-between gap-3">
            <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1">
              {["A", "B"].map((id) =>
            <button
              key={id}
              type="button"
              onClick={() => setActiveWalletId(id)}
              className={[
              "px-3 py-1.5 text-xs rounded-md transition-colors border",
              activeWalletId === id ?
              id === "A" ?
              "bg-white/5 border-white/15 text-white hover:bg-white/10" :
              "bg-xcannes-blue-light/10 border-xcannes-blue-light/30 text-xcannes-blue-light" :
              "border-transparent text-white/60 hover:text-white"].
              join(" ")}>

                  {t("demo_wallet_label", "Wallet")} {id}
                </button>
            )}
            </div>
          </div>
        }

        <div className="mt-4 flex flex-col items-center gap-2">
          <p
            className="text-2xl md:text-3xl font-orbitron font-semibold text-white"
            title={t("demo_tt_balance", "Total converti en USD (démo).")}
          >
            {formatMoney(locale, displayAmount, displayCurrency)}
          </p>
          <button
            type="button"
            onClick={() => setShowGlobalStatement(true)}
            title={t("demo_tt_statement", "Voir le relevé global.")}
            className="mt-1 px-4 py-1.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded-lg text-xs font-medium transition-all duration-200 border border-xcannes-green/30 hover:scale-105">

            {t("demo_view_statement", "Voir le relevé")}
          </button>
          <div className="mt-2 text-[11px] text-white/50">
            {t("demo_to_wallet", "Contrepartie")}:{" "}
            <span className="text-white/75">{otherWallet?.label}</span>
          </div>
        </div>
      </div>

      <div className="px-3 py-2 md:py-3 border-b border-white/5">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => {
              setSendTab("manual");
              setSendDestination(getWalletAddress(state, otherWalletId));
              setActiveAction("send");
            }}
            title={t("demo_tt_send", "Envoyer un paiement dans la devise choisie.")}
            className="wallet-action-btn wallet-action-send group">

            <div className="wallet-action-icon">
              <svg
                className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </div>
            <span className="wallet-action-label">{t("demo_tab_send", "Envoyer")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setReceiveTab("receive");
              setActiveAction("receive");
            }}
            title={t("demo_tt_receive", "Recevoir des fonds ou créer une demande.")}
            className="wallet-action-btn wallet-action-receive group">

            <div className="wallet-action-icon">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <line x1="12" y1="5" x2="12" y2="19"></line>
                <polyline points="19 12 12 19 5 12"></polyline>
              </svg>
            </div>
            <span className="wallet-action-label">{t("demo_receive", "Recevoir")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSwapDefaultView("convert");
              setActiveAction("swap");
            }}
            title={t("demo_tt_convert", "Convertir entre devises internes (démo).")}
            className="wallet-action-btn wallet-action-swap group">

            <div className="wallet-action-icon">
              <svg
                className="w-4 h-4 transition-transform duration-150 group-hover:rotate-90"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <polyline points="17 1 21 5 17 9"></polyline>
                <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
                <polyline points="7 23 3 19 7 15"></polyline>
                <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
              </svg>
            </div>
            <span className="wallet-action-label">{t("demo_tab_convert", "Convertir")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setCashModalTab("buy");
              setActiveAction("cash");
            }}
            title={t("demo_tt_cash", "Acheter ou vendre des cryptos (démo).")}
            className="wallet-action-btn wallet-action-buysell group">

            <div className="wallet-action-icon">
              <svg
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round">

                <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
                <line x1="1" y1="10" x2="23" y2="10"></line>
              </svg>
            </div>
            <span className="wallet-action-label">{t("ui_buy_sell_fce5963198", "Buy/Sell")}</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 p-3 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-2">
            <div className="text-[11px] text-white/45">
              {t("demo_lines_title", "Lignes (monnaies locales)")}
            </div>
            <button
              type="button"
              onClick={() => {
                setSwapDefaultView("lines");
                setActiveAction("swap");
              }}
              title={t("demo_tt_manage_lines", "Gérer les lignes de devises.")}
              className="text-[11px] text-xcannes-green/80 hover:text-xcannes-green transition-colors">

              {t("demo_manage_lines", "Gérer les lignes")} →
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-1.5">
            {tokens.map((row) =>
            <div key={row.code} className="w-full">
                <button
                type="button"
                onClick={() => {
                  const token =
                  augmentedTokens.find(
                    (tok) =>
                    String(tok?.currency || "").toUpperCase() === row.code
                  ) || {
                    currency: row.code,
                    value: row.units
                  };
                  setSelectedStatementToken(token);
                  setShowGlobalStatement(false);
                  setShowCurrencyStatement(true);
                }}
                className="w-full text-left"
                title={t("demo_open_statement", "Ouvrir le relevé")}>

                  <div
                    className={[
                      "flex items-center justify-between rounded-md border border-white/10 px-3 py-2 hover:border-white/20 transition-colors",
                      isHomeTheme ? "bg-black/20" : "bg-base",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 flex items-center justify-center text-[13px] font-semibold text-primary overflow-hidden rounded-md">
                        {renderDemoTokenIcon(row.code)}
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs text-primary truncate">{row.code}</span>
                        <span className="text-[11px] text-muted truncate">
                          {t("demo_currency_line_label", "Monnaie locale")}
                        </span>
                      </div>
                    </div>
                    <div className="text-right text-[12px] text-primary">
                      <div className="font-mono">
                        {formatUnits(locale, row.units)}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted font-normal">
                        {row.usdValue == null ?
                      "—" :
                      `≈ ${formatMoney(locale, row.usdValue, "USD")}`}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            )}

            {tokens.length === 0 ?
            <div className="text-sm text-white/50">
                {t("demo_no_lines", "Aucune ligne pour le moment.")}
              </div> :
            null}
          </div>
        </div>

      </div>

      <div
        className={[
          "shrink-0 border-t border-white/10 px-3 py-2",
          isHomeTheme ? "bg-elevated" : "bg-elevated/80 backdrop-blur",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleReset}
            title={t("demo_tt_reset", "Réinitialiser la démo.")}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 font-medium transition-colors">

            {t("demo_reset", "Réinitialiser")}
          </button>
          <div className="flex items-center gap-2 flex-shrink-0">
            {showCompareLink &&
            <a
              href="/demo-wallets"
              target="_blank"
              rel="noopener noreferrer"
              title={t("demo_tt_compare", "Comparer les deux wallets.")}
              className="hidden md:inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 font-medium transition-colors">

                {t("demo_footer_compare_cta", "Comparer Wallet A/B")}
                <span className="text-[11px] text-white/40">↗</span>
              </a>
            }
            <div className="text-xs text-white/45">
              {t("demo_footer_note", "Données fictives")}
            </div>
          </div>
        </div>
      </div>

      <WalletDashboardSendModal
        open={activeAction === "send"}
        onClose={() => {
          setActiveAction(null);
          setSendPaymentRequest(null);
        }}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        sendTab={sendTab}
        setSendTab={setSendTab}
        renderWalletMeta={renderWalletMeta}
        augmentedTokens={augmentedTokens}
        selectedSendToken={selectedSendToken}
        sendFxInfo={sendFxInfo}
        setSendAssetKey={setSendAssetKey}
        sendAmount={sendAmount}
        setSendAmount={setSendAmount}
        selectLabelByAssetKey={selectLabelByAssetKey}
        selectLabelRightByAssetKey={selectLabelRightByAssetKey}
        selectIconByAssetKey={selectIconByAssetKey}
        selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
        savedAddresses={demoSavedAddresses}
        sendDestination={sendDestination}
        setSendDestination={setSendDestination}
        setQrScannerOpen={setQrScannerOpen}
        handlePaymentRequestScan={handlePaymentRequestScan}
        handleSendSubmit={handleSendSubmit}
        sendProcessing={sendProcessing}
        enableSaveAddress={false} />


      <WalletDashboardReceiveModal
        open={activeAction === "receive"}
        onClose={() => setActiveAction(null)}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        receiveTab={receiveTab}
        setReceiveTab={setReceiveTab}
        renderWalletMeta={renderWalletMeta}
        effectiveWallet={effectiveWallet}
        handleCopyAddress={async () => {
          try {
            await navigator.clipboard.writeText(effectiveWallet);
          } catch {

            // noop
          }}}
        requestAmount={requestAmount}
        setRequestAmount={setRequestAmount}
        requestCurrency={requestCurrency}
        setRequestCurrency={setRequestCurrency}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        augmentedTokens={augmentedTokens}
        requestMemo={requestMemo}
        setRequestMemo={setRequestMemo}
        requestMethod={requestMethod}
        setRequestMethod={setRequestMethod}
        requestToAddress={requestToAddress}
        setRequestToAddress={setRequestToAddress}
        rlusdPerUnitRates={rlusdPerUnitRates}
        rlusdPerUnitSources={rlusdPerUnitSources}
        onRequestGenerated={handleDemoRequestGenerated} />


      <WalletDashboardSwapModal
        open={activeAction === "swap"}
        onClose={() => setActiveAction(null)}
        defaultView={swapDefaultView}
        renderWalletMeta={renderWalletMeta}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        simulateDexInDemo={true}
        effectiveIsConnected={false}
        hasOnChainRlusd={true}
        hasOnChainXcs={true}
        onInstallTrustline={() => {}}
        onActivateCurrencyLine={handleActivateCurrencyLine}
        refreshCurrencyLines={() => {}}
        currencyLinesLoading={false}
        currencyLinesError={null}
        currencyLinesSummary={currencyLinesSummary}
        currencyLines={currencyLines}
        handleRemoveCurrencyLine={handleRemoveCurrencyLine}
        swapCurrencyOptions={swapCurrencyOptions}
        convertBaseCurrency={convertBaseCurrency}
        setConvertBaseCurrency={setConvertBaseCurrency}
        convertQuoteCurrency={convertQuoteCurrency}
        setConvertQuoteCurrency={setConvertQuoteCurrency}
        convertAmount={convertAmount}
        setConvertAmount={setConvertAmount}
        convertPreview={convertPreview}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        currencyLineCode={currencyLineCode}
        setCurrencyLineCode={setCurrencyLineCode}
        currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
        setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
        handleUpsertCurrencyLine={handleUpsertCurrencyLine}
        handleDemoConvert={handleDemoConvert}
        convertProcessing={convertProcessing}
        rlusdPerUnitRates={rlusdPerUnitRates} />


      <WalletDashboardCashModal
        open={activeAction === "cash"}
        onClose={() => setActiveAction(null)}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        demoMode={true}
        onDemoBuy={async ({ amount }) => {
          await sleep(getDemoLatencyMs());
          const nextState = clone(state);
          const res = applyDemoBuySell({
            state: nextState,
            walletId: activeWalletId,
            side: "buy",
            amountUsd: Number(amount),
            memo: "MoonPay (demo)"
          });
          if (!res.ok) return { error: t("demo_error_generic", "Action impossible (démo).") };
          const event = res?.event || null;
          if (event?.id) {
            recordStatementHighlight(activeWalletId, "RLUSD", event.id);
          }
          setState(nextState);
          enqueueDemoCard("cash", {
            action: "buy",
            walletId: activeWalletId,
            amount: Number(amount),
            currency: "RLUSD"
          });
          return { ok: true };
        }}
        onDemoSell={async ({ amount }) => {
          await sleep(getDemoLatencyMs());
          const nextState = clone(state);
          const res = applyDemoBuySell({
            state: nextState,
            walletId: activeWalletId,
            side: "sell",
            amountUsd: Number(amount),
            memo: "MoonPay (demo)"
          });
          if (!res.ok) {
            return {
              error:
              res.error === "insufficient_funds" ?
              t("demo_error_insufficient", "Solde insuffisant (démo).") :
              t("demo_error_generic", "Action impossible (démo).")
            };
          }
          const event = res?.event || null;
          if (event?.id) {
            recordStatementHighlight(activeWalletId, "RLUSD", event.id);
          }
          setState(nextState);
          enqueueDemoCard("cash", {
            action: "sell",
            walletId: activeWalletId,
            amount: Number(amount),
            currency: "RLUSD"
          });
          return { ok: true };
        }}
        cashModalTab={cashModalTab}
        setCashModalTab={setCashModalTab}
        renderWalletMeta={renderWalletMeta}
        availableTokens={augmentedTokens}
        rlusdPerUnitRates={rlusdPerUnitRates}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        walletAddress={effectiveWallet || ""} />


      <WalletDashboardStatementModals
        augmentedTokens={augmentedTokens}
        backendWalletAddress={""}
        effectiveWallet={effectiveWallet}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        previewGlobalMovements={previewGlobalMovements}
        previewCurrencyTransactions={previewCurrencyTransactions}
        isFullPageView={false}
        statementVariant={"default"}
        currencyLines={currencyLines}
        usdRates={effectiveUsdPerUnitRates}
        highlightTransactionId={highlightTransactionId}
        showGlobalStatement={showGlobalStatement}
        setShowGlobalStatement={setShowGlobalStatement}
        showCurrencyStatement={showCurrencyStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
        selectedStatementToken={selectedStatementToken}
        setSelectedStatementToken={setSelectedStatementToken} />


      <QRScanner
        isOpen={qrScannerOpen}
        onScan={handleAddressScan}
        onClose={() => setQrScannerOpen(false)} />


    </div>);

}
