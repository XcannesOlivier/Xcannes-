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
import DemoWalletDashboardSendModal from "./modals/DemoWalletDashboardSendModal";
import DemoWalletDashboardReceiveModal from "./modals/DemoWalletDashboardReceiveModal";
import DemoWalletDashboardSwapModal from "./modals/DemoWalletDashboardSwapModal";
import DemoWalletDashboardCashModal from "./modals/DemoWalletDashboardCashModal";
import DemoWalletDashboardStatementModals from "./modals/DemoWalletDashboardStatementModals";
import DemoWalletInfoModal from "./modals/DemoWalletInfoModal";
import DemoQRScanner from "./components/DemoQRScanner";
import { QRCodeCanvas } from "qrcode.react";
import { useDemoSendForm } from "./hooks/useDemoSendForm";
import { useDemoPaymentRequestForm } from "./hooks/useDemoPaymentRequestForm";
import { useDemoPaymentRequestScanner } from "./hooks/useDemoPaymentRequestScanner";
import { lockBodyScroll } from "@/utils/bodyScrollLock";
import { useDemoConvertForm } from "./hooks/useDemoConvertForm";
import { useDemoCurrencyLinesForm } from "./hooks/useDemoCurrencyLinesForm";
import { useDemoWalletMeta } from "./hooks/useDemoWalletMeta";
import { useDemoSavedAddresses } from "./hooks/useDemoSavedAddresses";
	import { computeSpreadQuote } from "./utils/demoWalletSpread";
import xcannesApi from "@/lib/xcannesApi";
	import { CRYPTO_ICONS } from "./utils/demoMarketConstants";
	import { getCurrencyDescription } from "./utils/demoCurrencyDescriptions";
import {
  DEMO_CURRENCY_LINE_ORDER,
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
  getCurrencySymbol,
  USD_STABLECOINS
} from "./demoWalletDashboardConfig";

const DEMO_WALLET_ACCENTS = {
  A: {
    chip: "bg-xcannes-green/10 border-xcannes-green/25 text-xcannes-green",
    chipInactive: "text-white/60 hover:text-white",
    ring: "ring-xcannes-green/15",
    focusRing: "focus:ring-xcannes-green/40"
  }
};

const DEMO_FAUX_PAYREQ_EXAMPLE =
  '{"schema":"xcannes-payreq-v1","to":"rGt_Comptedepresentation_xxxxxxxxxxxxxxx","targetCurrency":"RLUSD","displayAmount":10,"displayCurrency":"USD","amountRlusd":10,"fxRate":1,"fxSource":"PYTH","issuer":"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De","memo":"DEMO","beneficiaryLabel":null,"createdAt":"2026-02-07T15:16:38.139Z"}';

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
  const display = getDisplayCurrencyCode(upper);
  const iconSrc = CRYPTO_ICONS?.[display];
  if (iconSrc) {
    return (
      <Image
        src={iconSrc}
        alt={display}
        width={20}
        height={20}
        className="w-5 h-5 object-contain"
      />
    );
  }
  return getCurrencyFlag(display);
}

		function getDemoCurrencyLabel(code) {
		  const upper = String(code || "").toUpperCase();
		  if (upper === "XRP") return "XRP · Native";
      if (upper === "USD") return "US Dollar";
		  if (upper === "RLUSD") return "US Dollar";
		  if (USD_STABLECOINS.includes(upper)) return "XRPL Stablecoin";
		  return getCurrencyDescription(upper) || upper;
		}

function formatMoney(locale, amount, currency) {
  return formatAmountWithSymbol(locale, amount, currency, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
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

function formatUnitsWithSymbol(locale, amount, currencyCode) {
  const value = formatUnits(locale, amount);
  const symbol = getCurrencySymbol(currencyCode, locale);
  return symbol ? `${value} ${symbol}` : value;
}

function formatDemoAddressShort(address) {
  const value = String(address || "").trim();
  if (!value) return "";
  if (value.length <= 18) return value;
  return `${value.slice(0, 8)}…${value.slice(-8)}`;
}

	const DEMO_STATE_STORAGE_KEY = "xcannes_demo_wallet_state_v1";
	const DEMO_SAVED_ADDRESSES_STORAGE_KEY = "xcannes_demo_saved_addresses_v1";
	const DEMO_LATENCY_MS_MIN = 450;
	const DEMO_LATENCY_MS_MAX = 1100;
	const DEMO_RATES_REFRESH_MS = 60_000;
	const DEMO_RATES_STALE_AFTER_MS = 30_000;
const DEMO_TOKEN_PRIORITY = { XRP: 0, RLUSD: 1, USD: 2 };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function newDemoEventId(prefix = "demo") {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function getDemoLatencyMs() {
  const min = DEMO_LATENCY_MS_MIN;
  const max = DEMO_LATENCY_MS_MAX;
  return Math.max(0, Math.floor(min + Math.random() * (max - min)));
}

const DEMO_NATIVE_CURRENCIES = new Set(["XRP", "RLUSD"]);

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
  if (!wallets.A || !wallets.A.allocations) return false;
  return true;
}

function needsDemoStateMigration(value) {
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
    address !== "rGt_Comptedepresentation_xxxxxxxxxxxxxxx"
  ) {
    return true;
  }
  return false;
}

export default function DemoWalletDashboard({
  defaultWalletId = "A",
  theme: _theme = "default",
  showWalletSwitcher = true,
  demoState,
  setDemoState,
  allowBackgroundScrollOnMobile = false
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const resolvedDefaultWalletId = "A";
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
  const ratesCancelledRef = useRef(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localState, setLocalState] = useState(() => buildDefaultDemoState());
  const [isHydrated, setIsHydrated] = useState(false);
  const isExternalState = demoState && typeof setDemoState === "function";
  const state = isExternalState ? demoState : localState;
  const setState = isExternalState ? setDemoState : setLocalState;
  const [activeWalletId, setActiveWalletId] = useState(resolvedDefaultWalletId);
  const [walletSwitchAnimating, setWalletSwitchAnimating] = useState(false);
	  const [activeAction, setActiveAction] = useState(null); // send | receive | swap | cash | null
	  const [swapDefaultView, setSwapDefaultView] = useState("convert");
	  const [swapLockedView, setSwapLockedView] = useState(null);
	  const [cashModalTab, setCashModalTab] = useState("buy"); // buy | sell
	  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
	  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
	  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
	  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
	  const [previewCurrencyTransactions, setPreviewCurrencyTransactions] = useState([]);
	  const [statementHighlightByWallet, setStatementHighlightByWallet] = useState({});
	  const [isDesktop, setIsDesktop] = useState(false);

  const activeWallet = state.wallets[activeWalletId];
  const demoAccents = DEMO_WALLET_ACCENTS;
  const activeAccent = demoAccents[activeWalletId] || demoAccents.A;
  const panelRingClass = "ring-white/10";
  const demoBottomBorderClass = "";
  const isWalletLabelLocked = Boolean(activeWallet?.labelLocked);
  const walletContextLabel =
    String(activeWallet?.label || "").trim() ||
    `${t("demo_wallet_label", "Wallet")} ${activeWalletId}`;
  const effectiveWallet = getWalletAddress(state, activeWalletId);
  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
  const [walletLabelDraft, setWalletLabelDraft] = useState(walletContextLabel);
  const [walletHeaderToast, setWalletHeaderToast] = useState("");
  const toastTimerRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const prevActiveActionRef = useRef(activeAction);

  useEffect(() => {
    setWalletLabelDraft(walletContextLabel);
  }, [walletContextLabel]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const flashWalletHeaderToast = useCallback((message) => {
    const text = String(message || "").trim();
    if (!text) return;
    setWalletHeaderToast(text);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setWalletHeaderToast("");
      toastTimerRef.current = null;
    }, 1300);
  }, []);

  useEffect(() => {
    if (isWalletLabelLocked && isEditingWalletLabel) setIsEditingWalletLabel(false);
  }, [isEditingWalletLabel, isWalletLabelLocked]);

  const handleOpenWalletLabelEditor = useCallback(() => {
    if (isWalletLabelLocked) return;
    setWalletLabelDraft(walletContextLabel);
    setIsEditingWalletLabel(true);
  }, [isWalletLabelLocked, walletContextLabel]);

  const handleCancelWalletLabel = useCallback(() => {
    setIsEditingWalletLabel(false);
    setWalletLabelDraft(walletContextLabel);
  }, [walletContextLabel]);

  const handleSaveWalletLabel = useCallback(() => {
    if (isWalletLabelLocked) return;
    const nextLabel = String(walletLabelDraft || "").trim();
    if (!nextLabel) {
      handleCancelWalletLabel();
      return;
    }
    if (nextLabel === "Mr et Mme Dupont") {
      handleCancelWalletLabel();
      return;
    }
    const nextState = clone(state);
    const wallet = nextState?.wallets?.[activeWalletId];
    if (wallet) {
      wallet.label = nextLabel.slice(0, 40);
      wallet.labelLocked = true;
    }
    setState(nextState);
    setIsEditingWalletLabel(false);
  }, [
    activeWalletId,
    handleCancelWalletLabel,
    isWalletLabelLocked,
    setState,
    state,
    walletLabelDraft,
  ]);

  const handleCopyWalletAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(effectiveWallet);
      flashWalletHeaderToast(t("demo_copied", "Copié"));
    } catch {
      // noop
    }
  }, [effectiveWallet, flashWalletHeaderToast, t]);

  const { renderWalletMeta } = useDemoWalletMeta({
    walletAddress: effectiveWallet,
    walletLabel: walletContextLabel,
    hideAddress: isWalletLabelLocked,
    addressTitle: t("demo_tt_wallet_address", "Adresse XRPL du wallet.")
  });
  const demoNoticeContextLabel = "";
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

  const { savedAddresses: demoSavedAddresses, saveAddress: saveDemoAddress } =
    useDemoSavedAddresses(DEMO_SAVED_ADDRESSES_STORAGE_KEY);

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
    if (!needsDemoStateMigration(state)) return;
    setState((prev) => migrateDemoState(prev));
  }, [isExternalState, isHydrated, setState, state]);

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
  } = useDemoSendForm({
    defaultSendTab: "manual",
    defaultSendAssetKey: "RLUSD"
  });

  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo
  } = useDemoPaymentRequestForm({
    defaultCurrency: "RLUSD"
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
  } = useDemoConvertForm({
    defaultBaseCurrency: "RLUSD",
    defaultQuoteCurrency: "EUR"
  });

  const {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd
  } = useDemoCurrencyLinesForm();

  useEffect(() => {
    const prevAction = prevActiveActionRef.current;
    if (prevAction === "send" && activeAction !== "send") {
      setSendTab("manual");
      setSendAssetKey("RLUSD");
      setSendAmount("");
      setSendDestination("");
      setSendPaymentRequest(null);
    }
    if (prevAction === "receive" && activeAction !== "receive") {
      setRequestAmount("");
      setRequestCurrency("RLUSD");
      setRequestMemo("");
    }
    if (prevAction === "swap" && activeAction !== "swap") {
      setConvertBaseCurrency("RLUSD");
      setConvertQuoteCurrency("EUR");
      setConvertAmount("");
      setConvertPreview("");
      setSwapDefaultView("convert");
      setSwapLockedView(null);
    }
    if (prevAction === "cash" && activeAction !== "cash") {
      setCashModalTab("buy");
    }
    prevActiveActionRef.current = activeAction;
  }, [
    activeAction,
    setCashModalTab,
    setConvertAmount,
    setConvertBaseCurrency,
    setConvertPreview,
    setConvertQuoteCurrency,
    setRequestAmount,
    setRequestCurrency,
    setRequestMemo,
    setSendAmount,
    setSendAssetKey,
    setSendDestination,
    setSendPaymentRequest,
    setSendTab,
    setSwapDefaultView,
    setSwapLockedView,
  ]);

  useEffect(() => {
    const id = setInterval(() => setRatesNowTs(Date.now()), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    ratesCancelledRef.current = false;
    return () => {
      ratesCancelledRef.current = true;
    };
  }, []);

  const requiredRateCodes = useMemo(() => {
    const codes = new Set(["USD", "RLUSD", "RLUSD"]);
    const wallets = state?.wallets || {};
    Object.values(wallets).forEach((wallet) => {
      Object.keys(wallet?.allocations || {}).forEach((code) => {
        const upper = String(code || "").toUpperCase();
        if (!upper || upper === "XRP") return;
        codes.add(upper);
      });
    });
    if (convertBaseCurrency) {
      const upper = String(convertBaseCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    if (convertQuoteCurrency) {
      const upper = String(convertQuoteCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    if (requestCurrency) {
      const upper = String(requestCurrency).toUpperCase();
      if (upper && upper !== "XRP") codes.add(upper);
    }
    return Array.from(codes).filter(Boolean).sort((a, b) => a.localeCompare(b));
  }, [convertBaseCurrency, convertQuoteCurrency, requestCurrency, state?.wallets]);

  const refreshRates = useCallback(async () => {
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

      if (ratesCancelledRef.current) return;
      setUsdPerUnitRates((prev) => ({ ...prev, ...nextRates }));
      setUsdPerUnitSources((prev) => ({ ...prev, ...nextSources }));
      setRatesLastOkTs(Date.now());
    } catch (err) {
      if (!ratesCancelledRef.current) {
        console.warn("[demo-wallet] rates refresh failed:", err?.message || err);
      }
    }
  }, [requiredRateCodes]);

  useEffect(() => {
    refreshRates();
    const id = setInterval(refreshRates, DEMO_RATES_REFRESH_MS);
    return () => {
      clearInterval(id);
    };
  }, [refreshRates]);

  const handleReset = useCallback(() => {
    setState(buildDefaultDemoState());
    setActiveWalletId(resolvedDefaultWalletId);
    setActiveAction(null);
    setCashModalTab("buy");
    setShowGlobalStatement(false);
    setShowCurrencyStatement(false);
    setSelectedStatementToken(null);
    setStatementHighlightByWallet({});
    setSendPaymentRequest(null);
    setIsEditingWalletLabel(false);
    setWalletHeaderToast("");
  }, [
    resolvedDefaultWalletId,
    setActiveAction,
    setActiveWalletId,
    setCashModalTab,
    setSelectedStatementToken,
    setSendPaymentRequest,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setState,
    setStatementHighlightByWallet,
    setIsEditingWalletLabel,
    setWalletHeaderToast,
  ]);

  const handleRefreshWallet = useCallback(() => {
    // Bound to demo reset (same intent as the "Réinitialiser" button).
    if (isRefreshing) return;
    setIsRefreshing(true);
    handleReset();
    if (refreshTimerRef.current) {
      window.clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    refreshTimerRef.current = window.setTimeout(() => {
      setIsRefreshing(false);
      refreshTimerRef.current = null;
    }, 500);
  }, [handleReset, isRefreshing]);

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

  const currencyOrderIndex = useMemo(() => {
    const entries = Array.isArray(DEMO_CURRENCY_LINE_ORDER)
      ? DEMO_CURRENCY_LINE_ORDER
      : [];
    const index = new Map();
    entries.forEach((code, idx) => {
      const upper = String(code || "").toUpperCase();
      if (!upper) return;
      if (!index.has(upper)) index.set(upper, idx);
    });
    return index;
  }, []);

  const allocationSummary = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const rlusdOnChain = Number(allocations?.RLUSD || 0);
    const totalAllocatedUsd = Object.entries(allocations).reduce((sum, [code, value]) => {
      const upper = String(code || "").toUpperCase();
      if (upper === "RLUSD" || upper === "XRP" || upper === "USD") return sum;
      return sum + (Number(value) || 0);
    }, 0);
    const unallocatedRlusd = Math.max(0, rlusdOnChain - totalAllocatedUsd);
    return { rlusdOnChain, totalAllocatedUsd, unallocatedRlusd };
  }, [activeWallet?.allocations]);

  const tokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const unallocatedUsd = allocationSummary.unallocatedRlusd;

    const entries = Object.entries(allocations)
      .map(([code, storedValue]) => {
        const upper = String(code || "").toUpperCase();
        const storedNum = Number(storedValue) || 0;
        const rate = Number(effectiveUsdPerUnitRates?.[upper] ?? 0);
        const isNative = isDemoNativeCurrency(upper);
        const allocationUsd = isNative
          ? upper === "XRP"
            ? storedNum * rate
            : storedNum
          : storedNum;
        const units = isNative ? storedNum : rate > 0 ? storedNum / rate : 0;
        const usdValue = Number.isFinite(allocationUsd) ? allocationUsd : null;
        return { code: upper, units, usdValue, allocationUsd };
      })
      .filter((entry) => entry.code !== "RLUSD" && entry.code !== "USD");

    entries.push({
      code: "USD",
      units: unallocatedUsd,
      usdValue: unallocatedUsd,
      allocationUsd: unallocatedUsd,
      isDerived: true
    });

    return entries
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
        const aOrder = currencyOrderIndex.get(a.code) ?? Number.POSITIVE_INFINITY;
        const bOrder = currencyOrderIndex.get(b.code) ?? Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.code.localeCompare(b.code);
      });
  }, [
    activeWallet?.allocations,
    allocationSummary.unallocatedRlusd,
    currencyOrderIndex,
    effectiveUsdPerUnitRates
  ]);

  const rlusdPerUnitRates = useMemo(
    () => effectiveUsdPerUnitRates,
    [effectiveUsdPerUnitRates]
  );
  const rlusdPerUnitSources = useMemo(() => ({ ...usdPerUnitSources }), [usdPerUnitSources]);
  const rlusdPerUnitRatesRef = useRef(rlusdPerUnitRates);

  useEffect(() => {
    rlusdPerUnitRatesRef.current = rlusdPerUnitRates;
  }, [rlusdPerUnitRates]);

  const augmentedTokens = useMemo(() => {
    const allocations = activeWallet?.allocations || {};
    const entries = Object.entries(allocations).map(([code, units]) => {
      const currency = String(code || "").toUpperCase();
      const storedValue = Number(units) || 0;
      const isTrustlineOnly = !isDemoNativeCurrency(currency);
      const rlusdPerUnit = Number(rlusdPerUnitRates?.[currency] || 0);
      const allocationUsd = isTrustlineOnly
        ? storedValue
        : currency === "XRP"
          ? storedValue * rlusdPerUnit
          : storedValue;
      const displayUnits = isTrustlineOnly
        ? rlusdPerUnit > 0
          ? storedValue / rlusdPerUnit
          : 0
        : storedValue;
      const demoRlusdValue = allocationUsd;

      return {
        key: currency,
        currency,
        value: displayUnits,
        allocationUsd,
        issuer: undefined,
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
        const aOrder = currencyOrderIndex.get(a.currency) ?? Number.POSITIVE_INFINITY;
        const bOrder = currencyOrderIndex.get(b.currency) ?? Number.POSITIVE_INFINITY;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return String(a.currency || "").localeCompare(String(b.currency || ""));
      }
    );
  }, [activeWallet?.allocations, currencyOrderIndex, rlusdPerUnitRates]);

  const globalStatementTokens = useMemo(() => {
    const base = (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code && code !== "XRP" && code !== "USD" && code !== "RLUSD";
    });
    base.push({
      currency: "USD",
      value: allocationSummary.unallocatedRlusd,
      issuer: undefined,
      isTrustlineOnly: true,
      isDerivedUsd: true
    });
    return base;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens]);

  const selectableTokens = useMemo(() => {
    return (augmentedTokens || []).filter((token) => {
      const code = String(token?.currency || "").toUpperCase();
      return code !== "XRP" && code !== "USD";
    });
  }, [augmentedTokens]);

  useEffect(() => {
    const upper = String(requestCurrency || "").toUpperCase();
    if (upper === "XRP" || upper === "USD") setRequestCurrency("RLUSD");
  }, [requestCurrency, setRequestCurrency]);

  useEffect(() => {
    const upper = String(convertBaseCurrency || "").toUpperCase();
    if (upper === "XRP" || upper === "USD") setConvertBaseCurrency("RLUSD");
  }, [convertBaseCurrency, setConvertBaseCurrency]);

  useEffect(() => {
    const upper = String(convertQuoteCurrency || "").toUpperCase();
    if (upper === "XRP" || upper === "USD") setConvertQuoteCurrency("RLUSD");
  }, [convertQuoteCurrency, setConvertQuoteCurrency]);

  const selectLabelByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      if (token.key) labels[token.key] = display;
      labels[code] = display;
    });
    return labels;
  }, [augmentedTokens]);

  const selectLabelRightByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountValue =
        code === "RLUSD" ? allocationSummary.unallocatedRlusd : token.value || 0;
      const display = getDisplayCurrencyCode(code);
      const amountLabel = formatUnitsWithSymbol(locale, amountValue, display);
      const label = amountLabel;
      if (token.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens, locale, t]);

  const selectLabelMobileByAssetKey = useMemo(() => {
    const labels = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const amountValue =
        code === "RLUSD" ? allocationSummary.unallocatedRlusd : token.value || 0;
      const display = getDisplayCurrencyCode(code);
      const amountLabel = formatUnitsWithSymbol(locale, amountValue, display);
      const label = `${display} (${amountLabel})`;
      if (token.key) labels[token.key] = label;
      labels[code] = label;
    });
    return labels;
  }, [allocationSummary.unallocatedRlusd, augmentedTokens, locale]);

  const selectIconByAssetKey = useMemo(() => {
    const icons = {};
    (augmentedTokens || []).forEach((token) => {
      const code = String(token?.currency || "").toUpperCase();
      if (!code) return;
      const display = getDisplayCurrencyCode(code);
      const icon = CRYPTO_ICONS?.[display]
        ? { src: CRYPTO_ICONS[display], alt: display }
        : getCurrencyFlag(display);
      if (token.key) icons[token.key] = icon;
      icons[code] = icon;
    });
    return icons;
  }, [augmentedTokens]);

  const selectedSendToken = useMemo(() => {
    if (!selectableTokens.length) return null;
    return (
      selectableTokens.find((token) => token.key === sendAssetKey) || selectableTokens[0]
    );
  }, [selectableTokens, sendAssetKey]);

  useEffect(() => {
    if (!selectedSendToken) return;
    if (!sendAssetKey) setSendAssetKey(selectedSendToken.key);
  }, [selectedSendToken, sendAssetKey, setSendAssetKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

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
    handlePaymentRequestScan
  } = useDemoPaymentRequestScanner({
    augmentedTokens,
    setSendDestination,
    setSendAmount,
    setSendAssetKey,
    setSendTab,
    setSendPaymentRequest
  });
  const allowBackgroundScroll =
    allowBackgroundScrollOnMobile && !isDesktop;
	  const shouldLockBodyScroll = Boolean(
	    !allowBackgroundScroll &&
	      (activeAction ||
	        showGlobalStatement ||
	        showCurrencyStatement ||
	        walletInfoOpen ||
	        qrScannerOpen)
	  );
  const showDemoMobileScannerQr = !isDesktop;
  const demoScannerQrSize = 220;

  const handleDemoQrScan = useCallback((data) => {
    // Support both plain XRPL addresses and XCANNES payreq payloads.
    handlePaymentRequestScan?.(data);
    setQrScannerOpen(false);
  }, [handlePaymentRequestScan, setQrScannerOpen]);

  const handleDemoRequestGenerated = useCallback((_request) => {
    // With a single demo wallet, we don't simulate cross-wallet payment requests anymore.
  }, []);

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  const submitSend = ({ amount, currency, memo, toAddress, isFxSend, paymentRequest }) => {
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
	                "Demande de paiement incohérente (démo).\n\nDemandé : ≈ {{requested}} USD\nCalculé : ≈ {{computed}} USD\n\nResscanez la demande ou réessayez.",
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

    if (isFxSend && spreadFeeRlusd > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      const availableUsd = Number(fromWallet?.allocations?.[currency] || 0);
      const amountUsd = Number(amount) * Number(fxRate || 0);
      const totalDebitUsd = amountUsd + Number(spreadFeeRlusd || 0);
      if (!Number.isFinite(availableUsd) || availableUsd + 1e-9 < totalDebitUsd) {
        return { error: t("demo_error_insufficient", "Solde insuffisant (démo).") };
      }
    }

    const result = applyDemoSend({
      state: nextState,
      fromWalletId: activeWalletId,
      toWalletId: null,
      toAddress,
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
    }

    if (isFxSend && spreadFeeRlusd > 0) {
      const fromWallet = nextState.wallets?.[activeWalletId];
      if (fromWallet) {
        ensureAllocation(fromWallet, currency);
        fromWallet.allocations[currency] = Number(
          (Number(fromWallet.allocations[currency] || 0) - Number(spreadFeeRlusd)).toFixed(6)
        );
        ensureAllocation(fromWallet, "RLUSD");
        fromWallet.allocations.RLUSD = Number(
          (Number(fromWallet.allocations.RLUSD || 0) - Number(spreadFeeRlusd)).toFixed(6)
        );
      }
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

	  const handleSendSubmit = async ({ saveDestination = "", saveLabel = "" } = {}) => {
	    if (!selectedSendToken) return { ok: false };
	    const amountNum = Number.parseFloat(sendAmount || "0");
	    if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false };

	    const dest = String(sendDestination || "").trim();
    if (!dest) {
      alert(t("demo_error_destination_required", "Veuillez saisir une adresse de destination (démo)."));
      return { ok: false };
    }
    if (sendPaymentRequest?.to && dest !== String(sendPaymentRequest.to).trim()) {
      alert(
        t(
          "demo_error_request_destination_mismatch",
          "La destination de la demande de paiement ne correspond pas (démo)."
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
        toAddress: dest,
        isFxSend,
        paymentRequest: sendPaymentRequest
      });
	      if (res?.error) {
	        alert(res.error);
	        return { ok: false };
	      }
	      const normalizedSaveDestination = String(saveDestination || "").trim();
	      if (normalizedSaveDestination && normalizedSaveDestination === dest) {
	        const isAlreadySaved = (demoSavedAddresses || []).some(
	          (entry) => entry.address === normalizedSaveDestination
	        );
	        if (!isAlreadySaved) {
	          saveDemoAddress(
	            normalizedSaveDestination,
	            String(saveLabel || "").trim()
	          );
	        }
	      }
	      setActiveAction(null);
	      setSendPaymentRequest(null);
	      return { ok: true };
	    } finally {
	      setSendProcessing(false);
    }
  };

  const currencyLinesBase = useMemo(() => {
    return (augmentedTokens || [])
      .filter((token) => token.isTrustlineOnly && token.currency !== "USD")
      .map((token) => {
        const code = String(token.currency || "").toUpperCase();
        const rate = Number(rlusdPerUnitRates?.[code] || 0);
        const allocatedRlusd = rate > 0 ? Number(token.value || 0) * rate : 0;
        return { currencyCode: code, allocatedRlusd };
      });
  }, [augmentedTokens, rlusdPerUnitRates]);

  const currencyLinesSummary = useMemo(() => {
    const rlusdOnChain = allocationSummary.rlusdOnChain;
    const totalAllocatedRlusd = allocationSummary.totalAllocatedUsd;
    const unallocatedRlusd = allocationSummary.unallocatedRlusd;
    return { rlusdOnChain, totalAllocatedRlusd, unallocatedRlusd };
  }, [allocationSummary]);

  const currencyLines = useMemo(() => {
    const lines = [
      ...(currencyLinesBase || []),
      {
        currencyCode: "USD",
        allocatedRlusd: allocationSummary.unallocatedRlusd,
        isDerived: true,
      },
    ];
    return lines.sort((a, b) => {
      const aCode = String(a?.currencyCode || "").toUpperCase();
      const bCode = String(b?.currencyCode || "").toUpperCase();
      const aOrder = currencyOrderIndex.get(aCode) ?? Number.POSITIVE_INFINITY;
      const bOrder = currencyOrderIndex.get(bCode) ?? Number.POSITIVE_INFINITY;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return aCode.localeCompare(bCode);
    });
  }, [allocationSummary.unallocatedRlusd, currencyLinesBase, currencyOrderIndex]);

  const swapCurrencyOptions = useMemo(() => {
    const codes = new Set(
      (augmentedTokens || [])
        .map((tok) => String(tok.currency || "").toUpperCase())
        .filter((code) => code && code !== "XRP")
    );
    codes.add("RLUSD");
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
    const feeUsd = usdGross * 100 / 10_000;
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
    if (!res.ok) return false;
    setState(nextState);
    return true;
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
      return false;
    }
    setState(nextState);
    setActiveAction(null);
    return true;
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
    const currentRlusd = Number(wallet.allocations?.RLUSD || 0);
    const allocations = wallet.allocations || {};
    const nextTotalAllocated = Object.entries(allocations).reduce((sum, [entryCode, entryValue]) => {
      const upper = String(entryCode || "").toUpperCase();
      if (upper === "RLUSD" || upper === "XRP") return sum;
      const value = upper === code ? allocated : Number(entryValue || 0);
      return sum + value;
    }, 0);

    if (nextTotalAllocated > currentRlusd + 1e-9) {
      alert(t("demo_error_insufficient", "Solde insuffisant (démo)."));
      return;
    }

    wallet.allocations[code] = Number(allocated.toFixed(6));
    setState(nextState);
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
    const resolveEventUsdValue = (evt) => {
      const usdValue = Number(evt?.usdValue);
      if (Number.isFinite(usdValue)) return usdValue;
      const code = String(evt?.currency || "").toUpperCase();
      const rate = Number(rlusdPerUnitRates?.[code] || 0);
      const amount = Number(evt?.amount || 0);
      if (code === "RLUSD") return amount;
      return rate > 0 ? amount * rate : amount;
    };

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
        const evtCurrency = String(evt.currency || "RLUSD").toUpperCase();
        const amountRlusd = resolveEventUsdValue(evt);
        return {
          movementId: evt.id,
          createdAt: new Date(evt.ts).toISOString(),
          fromCurrencyCode: evt.kind === "buy" ? "USD" : evtCurrency,
          toCurrencyCode: evt.kind === "buy" ? evtCurrency : "USD",
          amountRlusd
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
    const ratesSnapshot = rlusdPerUnitRatesRef.current || {};
    let running = Number(activeWallet?.allocations?.[currency]) || 0;
    const runningRate = Number(ratesSnapshot?.[currency] || 0);
    if (!isDemoNativeCurrency(currency) && runningRate > 0) {
      running = running / runningRate;
    }
    const txs = [];

    events.forEach((evt) => {
      const createdAt = new Date(evt.ts).toISOString();
      const runningSnapshot = running;
      let amount = 0;
      let delta = 0;
      let type = "credit";
      let category = "other";
      let description = t("demo_statement_movement", "Mouvement");
      let counterparty = "";
      let postEventTx = null;

      if (evt.kind === "send" && String(evt.currency).toUpperCase() === currency) {
        amount = Number(evt.amount || 0);
        if (evt.from === activeWalletId) {
          delta = -amount;
          type = "debit";
          const destAddress = String(
            evt.toAddress || (evt.to ? getWalletAddress(state, evt.to) : "")
          ).trim();
          const destLabel =
            String(evt.toLabel || "").trim() ||
            formatDemoAddressShort(destAddress) ||
            (evt.to ? String(evt.to) : "");
          counterparty = destAddress || destLabel;
          description = evt.to
            ? t("demo_statement_send_to_wallet", {
                defaultValue: "Envoyé à {{walletId}}",
                walletId: evt.to,
              })
            : t("demo_statement_send_to", {
                defaultValue: "Envoyé à {{to}}",
                to: destLabel || t("demo_counterparty_unknown", "Destination"),
              });
        } else if (evt.to === activeWalletId) {
          delta = amount;
          type = "credit";
          const srcAddress = String(
            evt.fromAddress || (evt.from ? getWalletAddress(state, evt.from) : "")
          ).trim();
          const srcLabel =
            String(evt.fromLabel || "").trim() ||
            formatDemoAddressShort(srcAddress) ||
            (evt.from ? String(evt.from) : "");
          counterparty = srcAddress || srcLabel;
          description = evt.from
            ? t("demo_statement_receive_from_wallet", {
                defaultValue: "Recevoir depuis le wallet {{walletId}}",
                walletId: evt.from,
              })
            : t("demo_statement_receive_from", {
                defaultValue: "Reçu de {{from}}",
                from: srcLabel || t("demo_counterparty_unknown", "Source"),
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
          const feeUsd = Number(evt.feeUsd || 0);
          const quoteRate = Number(ratesSnapshot?.[currency] || 0);
          const fromLabel = getDisplayCurrencyCode(evt.fromCurrency);
          const toLabel = getDisplayCurrencyCode(evt.toCurrency);
          const feeQuote =
            Number.isFinite(feeUsd) && feeUsd > 0 && quoteRate > 0
              ? feeUsd / quoteRate
              : 0;
          if (Number.isFinite(feeQuote) && feeQuote > 0) {
            const feeUsdLabel = feeUsd.toLocaleString(locale, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2
            });
            postEventTx = {
              id: `${evt.id}_fee`,
              date: createdAt,
              createdAt,
              category: "fee",
              type: "debit",
              description: t("demo_statement_fee_spread_pair", {
                defaultValue:
                  "Frais conversion {{fromCurrency}} → {{toCurrency}} ({{fee}} USD)",
                fromCurrency: fromLabel,
                toCurrency: toLabel,
                fee: feeUsdLabel
              }),
              counterparty: "",
              amount: feeQuote,
              runningBalance: runningSnapshot,
              displayRunningBalance: runningSnapshot,
              suppressDescriptionFlags: true
            };
          }
        } else {
          return;
        }
      } else if (
        evt.kind === "buy" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
        category = "buy";
        type = "credit";
        amount = Number(evt.amount || 0);
        delta = amount;
        description = t("demo_statement_buy_moonpay", "Achat via MoonPay (démo)");
      } else if (
        evt.kind === "sell" &&
        String(evt.currency || "").toUpperCase() === currency
      ) {
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
        description = t("demo_statement_fee_spread", "Frais de conversion (1 %)");
      } else if (
        evt.kind === "trustline_add" &&
        String(evt.currency).toUpperCase() === currency &&
        evt.wallet === activeWalletId
      ) {
        category = "operation";
        type = "credit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_add", {
          defaultValue: "Activation de ligne {{currency}}",
          currency
        });
      } else if (
        evt.kind === "trustline_remove" &&
        String(evt.currency).toUpperCase() === currency &&
        evt.wallet === activeWalletId
      ) {
        category = "operation";
        type = "debit";
        amount = 0;
        delta = 0;
        description = t("demo_statement_trustline_remove", {
          defaultValue: "Désactivation de ligne {{currency}}",
          currency
        });
      } else {
        return;
      }

      if (!Number.isFinite(amount) || (amount <= 0 && category !== "operation")) return;

      txs.push({
        id: evt.id,
        date: createdAt,
        createdAt,
        category,
        type,
        description,
        counterparty,
        amount,
        runningBalance: running
      });
      running -= delta;

      if (postEventTx) {
        txs.push(postEventTx);
      }
    });

    setPreviewCurrencyTransactions(txs);
  }, [
    activeWallet?.allocations,
    activeWalletId,
    locale,
    selectedStatementToken,
    state,
    t,
    walletEvents
  ]);

  const statementBalance = useMemo(() => {
    if (!selectedStatementToken) return null;
    const currency = String(selectedStatementToken.currency || "").toUpperCase();
    const isDerivedUsd = Boolean(selectedStatementToken?.isDerivedUsd);
    let currentBalance = 0;
    if (currency === "USD" || (currency === "RLUSD" && isDerivedUsd)) {
      const allocations = activeWallet?.allocations || {};
      const rlusdOnChain = Number(allocations?.RLUSD || 0);
      const totalAllocatedUsd = Object.entries(allocations).reduce((sum, [code, value]) => {
        const upper = String(code || "").toUpperCase();
        if (upper === "RLUSD" || upper === "XRP" || upper === "USD") return sum;
        return sum + (Number(value) || 0);
      }, 0);
      currentBalance = Math.max(0, rlusdOnChain - totalAllocatedUsd);
    } else {
      const stored = Number(activeWallet?.allocations?.[currency] || 0);
      if (isDemoNativeCurrency(currency)) {
        currentBalance = stored;
      } else {
        const rate = Number(rlusdPerUnitRates?.[currency] || 0);
        if (!Number.isFinite(rate) || rate <= 0) return null;
        currentBalance = stored / rate;
      }
    }
    return Number.isFinite(currentBalance) ? currentBalance : null;
  }, [activeWallet?.allocations, rlusdPerUnitRates, selectedStatementToken]);

  useEffect(() => {
    if (statementBalance == null) return;
    setPreviewCurrencyTransactions((prev) => {
      if (!Array.isArray(prev) || prev.length === 0) return prev;
      const first = prev[0];
      if (!first) return prev;
      if (Number(first.displayRunningBalance) === Number(statementBalance)) return prev;
      const next = [...prev];
      next[0] = { ...first, displayRunningBalance: statementBalance };
      return next;
    });
  }, [statementBalance]);

  const highlightTransactionId = useMemo(() => {
    if (!selectedStatementToken) return null;
    const walletKey = String(activeWalletId || "").trim().toUpperCase();
    const currencyKey = String(selectedStatementToken.currency || "").trim().toUpperCase();
    const walletMap = statementHighlightByWallet[walletKey] || {};
    return walletMap?.[currencyKey]?.eventId || null;
  }, [activeWalletId, selectedStatementToken, statementHighlightByWallet]);

  const walletSwitchTimeoutRef = useRef(null);
  const walletSwitchRafRef = useRef(null);
  const prevWalletIdRef = useRef(activeWalletId);

  useEffect(() => {
    if (prevWalletIdRef.current === activeWalletId) return;
    prevWalletIdRef.current = activeWalletId;

    setWalletSwitchAnimating(false);

    if (walletSwitchTimeoutRef.current) {
      window.clearTimeout(walletSwitchTimeoutRef.current);
      walletSwitchTimeoutRef.current = null;
    }
    if (walletSwitchRafRef.current) {
      window.cancelAnimationFrame(walletSwitchRafRef.current);
      walletSwitchRafRef.current = null;
    }

    walletSwitchRafRef.current = window.requestAnimationFrame(() => {
      setWalletSwitchAnimating(true);
      walletSwitchTimeoutRef.current = window.setTimeout(() => {
        setWalletSwitchAnimating(false);
        walletSwitchTimeoutRef.current = null;
      }, 500);
    });

    return () => {
      if (walletSwitchTimeoutRef.current) {
        window.clearTimeout(walletSwitchTimeoutRef.current);
        walletSwitchTimeoutRef.current = null;
      }
      if (walletSwitchRafRef.current) {
        window.cancelAnimationFrame(walletSwitchRafRef.current);
        walletSwitchRafRef.current = null;
      }
    };
  }, [activeWalletId]);

  return (
	    <div
	      className={[
		      "h-full flex flex-col min-h-0 ring-1 rounded-md overflow-hidden bg-[#0b0f10] border border-white/10",
	      "demo-wallet-tooltip-scope",
	      walletSwitchAnimating ? "demo-wallet-switch-in" : "",
	      panelRingClass,
	      demoBottomBorderClass].
	      join(" ")}>

			      <div className="panel-header">
			        <div className="flex items-center justify-between gap-3">
			          <div className="flex items-center gap-1 min-w-0">
			            <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">{t("ui_xcannes_30015bef4b", "XCANNES")}

			            </span>
			          </div>
				        </div>

	        {showWalletSwitcher &&
	        <div className="mt-3 flex items-center justify-between gap-3">
	            <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1">
	              {["A"].map((id) =>
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
	          <div className="text-[11px] md:text-xs text-white/55 tracking-[0.18em] uppercase">
	            {t("ui_total_balance_label_a91b6b8c1e", "Solde total")}
	          </div>
	          <p
	            className="text-3xl md:text-4xl lg:text-5xl font-sans font-bold text-white tabular-nums tracking-tight"
	            title={t("demo_tt_balance", "Total converti en USD (démo).")}
	          >
	            {formatMoney(locale, displayAmount, displayCurrency)}
	          </p>
			          <a
			            href="https://ripple.com/solutions/stablecoin/transparency/"
			            target="_blank"
		            rel="noopener noreferrer"
		            className="text-xs md:text-[10px] text-white/40 hover:text-white/70 transition-colors"
		          >
		            {t(
		              "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
		              "Stablecoin USD régulé (détails)"
		            )}
		          </a>

				          <div className="w-full mt-1.5 flex justify-center">
				            <div className="flex items-center gap-2 w-full max-w-[460px]">
				              <div className="flex-1 min-w-0 rounded-md bg-black/20 px-2.5 py-1.5 shadow-none">
					                <div className="flex items-start justify-between gap-3">
					                  <div className="min-w-0">
				                    <div className="flex items-center gap-2 min-w-0">
				                      <span className="text-[13px] md:text-[14px] font-semibold text-white/90 truncate">
				                        {walletContextLabel || t("nav_wallet", "Wallet")}
				                      </span>
		                      {isWalletLabelLocked && walletHeaderToast ? (
		                        <span className="text-[10px] text-xcannes-green/90 truncate">
		                          {walletHeaderToast}
		                        </span>
		                      ) : null}
		                    </div>

			                    {!isWalletLabelLocked ? (
			                      <div className="mt-0.5 flex items-center gap-2 min-w-0">
			                        <span
			                          className="font-mono text-[10px] text-white/55 truncate"
			                          title={t("demo_tt_wallet_address", "Adresse XRPL du wallet.")}
			                        >
			                          {formatDemoAddressShort(effectiveWallet)}
			                        </span>
		                        {walletHeaderToast ? (
		                          <span className="text-[10px] text-xcannes-green/90">
		                            {walletHeaderToast}
		                          </span>
		                        ) : null}
		                      </div>
		                    ) : null}
		                  </div>

			                  <div className="flex items-center gap-2 shrink-0">
			                    {!isWalletLabelLocked ? (
			                      <button
		                        type="button"
			                        onClick={handleOpenWalletLabelEditor}
			                        disabled={isEditingWalletLabel}
			                        title={t("ui_rename_86c8307e14", "Renommer")}
				                        className="p-1 rounded-md bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
				                        aria-label={t(
				                          "ui_rename_wallet_8fecb8eee2",
				                          "Renommer le wallet"
		                        )}
		                      >
		                        <svg
		                          className="w-4 h-4"
		                          fill="none"
		                          stroke="currentColor"
		                          viewBox="0 0 24 24"
		                        >
		                          <path
		                            strokeLinecap="round"
		                            strokeLinejoin="round"
		                            strokeWidth={2}
		                            d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.9 17.39a4 4 0 01-1.69 1l-3.42 1.14 1.14-3.42a4 4 0 011-1.69L16.862 3.487z"
		                          />
		                        </svg>
		                      </button>
		                    ) : null}

				                    <button
				                      type="button"
				                      onClick={handleCopyWalletAddress}
				                      title={t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
				                      className="p-1 rounded-md bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
				                      aria-label={t(
				                        "ui_copy_xrpl_address_4f63ed10fc",
				                        "Copier l'adresse XRPL"
			                      )}
		                    >
		                      <svg
		                        className="w-4 h-4"
		                        fill="none"
		                        stroke="currentColor"
		                        viewBox="0 0 24 24"
		                      >
		                        <path
		                          strokeLinecap="round"
		                          strokeLinejoin="round"
		                          strokeWidth={2}
		                          d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
		                        />
		                      </svg>
		                    </button>
			                  </div>
			                </div>

			                {isEditingWalletLabel && !isWalletLabelLocked ? (
			                  <div className="mt-1.5 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-1.5 rounded-md bg-white/5 border border-white/10 px-2 py-1">
			                    <input
			                      type="text"
			                      value={walletLabelDraft}
	                      onChange={(e) => setWalletLabelDraft(e.target.value)}
	                      placeholder={t("ui_wallet_name_b4c2f054b9", "Nom du wallet")}
	                      className="min-w-0 w-full bg-transparent text-[16px] md:text-[12px] text-white/85 outline-none placeholder:text-white/35"
	                      onKeyDown={(e) => {
	                        if (e.key === "Enter") {
	                          handleSaveWalletLabel();
	                        }
	                        if (e.key === "Escape") {
	                          handleCancelWalletLabel();
	                        }
	                      }}
	                      autoFocus
	                    />

			                    <button
			                      type="button"
			                      onClick={handleSaveWalletLabel}
			                      className="p-1 rounded-md bg-xcannes-green/15 hover:bg-xcannes-green/25 border border-xcannes-green/25 text-xcannes-green transition-colors active:scale-95"
			                      aria-label={t("ui_save_404be3f4a5", "Enregistrer")}
			                      title={t("ui_save_2d42b7df0f", "Enregistrer")}
			                    >
	                      <svg
	                        className="w-4 h-4"
	                        fill="none"
	                        stroke="currentColor"
	                        viewBox="0 0 24 24"
	                      >
	                        <path
	                          strokeLinecap="round"
	                          strokeLinejoin="round"
	                          strokeWidth={2}
	                          d="M5 13l4 4L19 7"
	                        />
	                      </svg>
	                    </button>

		                    <button
		                      type="button"
		                      onClick={handleCancelWalletLabel}
		                      className="p-1.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition-colors active:scale-95"
		                      aria-label={t("ui_cancel_d2d2058892", "Annuler")}
		                      title={t("ui_cancel_fbca985028", "Annuler")}
		                    >
	                      <svg
	                        className="w-4 h-4"
	                        fill="none"
	                        stroke="currentColor"
	                        viewBox="0 0 24 24"
	                      >
	                        <path
	                          strokeLinecap="round"
	                          strokeLinejoin="round"
	                          strokeWidth={2}
	                          d="M6 18L18 6M6 6l12 12"
	                        />
	                      </svg>
	                    </button>
	                  </div>
			                ) : null}
		              </div>

			              <button
			                type="button"
			                onClick={handleRefreshWallet}
				                disabled={isRefreshing}
				                title={t("demo_tt_reset", "Réinitialiser la démo.")}
				                aria-label={t("demo_reset", "Réinitialiser")}
				                className={`shrink-0 z-10 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed ${
				                  isRefreshing
				                    ? "text-xcannes-green hover:text-xcannes-green/90"
				                    : "text-white/60 hover:text-white"
				                }`}
				              >
			                <svg
			                  className={`w-5 h-5 ${isRefreshing ? "animate-spin" : ""}`}
			                  fill="currentColor"
			                  viewBox="0 0 24 24"
			                >
		                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
		                </svg>
		              </button>
		            </div>
		          </div>
		        </div>
		      </div>

      <div className="px-3 py-2 md:py-3 border-b border-white/5">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <button
            type="button"
	            onClick={() => {
	              setSendTab("manual");
	              setActiveAction("send");
	            }}
            title={t("demo_tt_send", "Envoyer un paiement dans la devise choisie.")}
            className="wallet-action-btn wallet-action-send group">

	            <div className="wallet-action-icon">
	              <svg
	                className="w-4 h-4"
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
            <span className="wallet-action-label !text-sm !font-normal">{t("demo_tab_send", "Envoyer")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
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
            <span className="wallet-action-label !text-sm !font-normal">{t("demo_receive", "Recevoir")}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSwapDefaultView("convert");
              setSwapLockedView(null);
              setActiveAction("swap");
            }}
            title={t("demo_tt_convert", "Convertir entre devises internes (démo).")}
            className="wallet-action-btn wallet-action-swap group">

	            <div className="wallet-action-icon">
	              <svg
	                className="w-4 h-4"
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
            <span className="wallet-action-label !text-sm !font-normal">{t("demo_tab_convert", "Convertir")}</span>
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
            <span className="wallet-action-label !text-lg !font-bold">+/−</span>
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex-1 min-h-0 p-3 flex flex-col">
	          <div className="flex items-center justify-end gap-2 mb-2">
	            <button
	              type="button"
	              onClick={() => setShowGlobalStatement(true)}
	              className="text-sm md:text-xs text-white/70 hover:text-white transition-colors"
	              title={t("demo_tt_statement", "Voir le relevé global.")}
	            >
	              {t(
	                "ui_consult_global_statement_3b89f4a7a2",
	                "Consulter votre Relevé global"
	              )}
	            </button>
	          </div>
	          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-1.5">
            {tokens.map((row) => {
              const upperCode = String(row.code || "").toUpperCase();
              if (upperCode === "XRP" || upperCode === "RLUSD") return null;
              const displayCode = getDisplayCurrencyCode(upperCode);
              const isNativeAsset = upperCode === "XRP";
              const hasCryptoIcon = Boolean(CRYPTO_ICONS?.[displayCode]);
              const isFlagIcon = !isNativeAsset && !hasCryptoIcon;
	              const iconSizeClass = isNativeAsset
		                ? "w-7 h-7 text-[13px]"
	                : isFlagIcon
	                  ? "w-10 h-10 text-[18px] sm:w-11 sm:h-11 sm:text-[20px]"
	                  : "w-9 h-9 text-[16px] sm:w-9 sm:h-9 sm:text-[16px]";
	              const iconRadiusClass = isNativeAsset ? "rounded-lg" : "";
	              return (
	            <div key={row.code} className="w-full">
                <button
                type="button"
                onClick={() => {
                  const statementCode = upperCode === "USD" ? "RLUSD" : upperCode;
                  const token =
                  augmentedTokens.find(
                    (tok) =>
                    String(tok?.currency || "").toUpperCase() === statementCode
                  ) || {
                    currency: statementCode,
                    value: row.units,
                    isDerivedUsd: upperCode === "USD"
                  };
                  if (upperCode === "USD" && token) {
                    token.isDerivedUsd = true;
                  }
                  setSelectedStatementToken(token);
                  setShowGlobalStatement(false);
                  setShowCurrencyStatement(true);
                }}
                className="w-full text-left"
                title={t("demo_open_statement", "Ouvrir le relevé")}>

		                  <div
		                    className={[
		                      "flex items-center justify-between rounded-md px-3 py-2 transition-colors",
		                      "bg-black/20 hover:bg-black/15",
		                    ].join(" ")}
		                  >
	                    <div className="flex items-center gap-3 min-w-0">
	                      <div className={`${iconSizeClass} ${iconRadiusClass} flex items-center justify-center font-semibold text-primary overflow-hidden`}>
	                        {renderDemoTokenIcon(row.code)}
	                      </div>
		                      <div className="min-w-0">
		                        <div className="flex items-baseline gap-2 min-w-0">
				                          <span className="text-[15px] md:text-[16px] text-white/90 font-semibold truncate">
				                            {getDemoCurrencyLabel(row.code)}
				                          </span>
		                        </div>
		                      </div>
		                    </div>
				                    <div className="text-right text-[14px] md:text-[15px] text-primary">
				                      <div className="font-mono">
				                        {formatUnitsWithSymbol(locale, row.units, displayCode)}
				                      </div>
			                    </div>
	                  </div>
	                </button>
	              </div>
              );
            })}

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
			          "bg-[#0b0f10]",
			        ].join(" ")}
			      >
	        <div className="flex items-center justify-between gap-3">
	          <div className="text-[11px] text-white/60 font-medium">
	            {t("ui_xrpl_not_connected_0d0d4a67a1", "XRPL non connecté")}
	          </div>
	          <div className="flex items-center gap-2 flex-shrink-0">
		            <button
			              type="button"
			              onClick={() => setWalletInfoOpen(true)}
			              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-white/70 font-medium transition-all duration-300"
			              title={t("wallet_footer_info_title", "Wallet info & fees")}
			            >
	              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[12px] leading-none">
	                i
	              </span>
	              <span>{t("wallet_footer_info_fees", "Info & Fees")}</span>
	            </button>
	          </div>
	        </div>
	      </div>

	      <DemoWalletInfoModal
	        isOpen={walletInfoOpen}
	        onClose={() => setWalletInfoOpen(false)}
	        isPreviewMode={true}
	        isWalletActivated={true}
	        hasRlusdTrustline={true}
	        noticeVariant="demo"
	        noticeContextLabel={demoNoticeContextLabel}
	      />

		      <DemoWalletDashboardSendModal
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
		        augmentedTokens={selectableTokens}
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
	        handlePaymentRequestScan={handlePaymentRequestScan}
	        handleSendSubmit={handleSendSubmit}
	        sendProcessing={sendProcessing}
	        enableSaveAddress={true}
	        showFauxPayreqDecor={true} />


	      <DemoWalletDashboardReceiveModal
        open={activeAction === "receive"}
        onClose={() => setActiveAction(null)}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
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
        unallocatedUsd={allocationSummary?.unallocatedRlusd ?? 0}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
	        augmentedTokens={selectableTokens}
	        requestMemo={requestMemo}
	        setRequestMemo={setRequestMemo}
	        rlusdPerUnitRates={rlusdPerUnitRates}
	        rlusdPerUnitSources={rlusdPerUnitSources}
	        onRequestGenerated={handleDemoRequestGenerated} />


      <DemoWalletDashboardSwapModal
        open={activeAction === "swap"}
        onClose={() => setActiveAction(null)}
        defaultView={swapDefaultView}
        lockedView={swapLockedView}
        renderWalletMeta={renderWalletMeta}
        isPreviewMode={true}
        noticeVariant="demo"
        noticeContextLabel={demoNoticeContextLabel}
        walletId={activeWalletId}
        effectiveIsConnected={false}
        hasOnChainRlusd={true}
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


	      <DemoWalletDashboardCashModal
	        open={activeAction === "cash"}
	        onClose={() => setActiveAction(null)}
	        isPreviewMode={true}
	        noticeVariant="demo"
	        noticeContextLabel={demoNoticeContextLabel}
	        walletId={activeWalletId}
	        walletLabel={walletContextLabel}
	        hideWalletAddress={isWalletLabelLocked}
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
          return { ok: true };
        }}
        cashModalTab={cashModalTab}
        setCashModalTab={setCashModalTab}
        renderWalletMeta={renderWalletMeta}
	        availableTokens={selectableTokens}
        rlusdPerUnitRates={rlusdPerUnitRates}
        selectLabelByCurrency={selectLabelByAssetKey}
        selectLabelRightByCurrency={selectLabelRightByAssetKey}
        selectIconByCurrency={selectIconByAssetKey}
        selectLabelMobileByCurrency={selectLabelMobileByAssetKey}
        walletAddress={effectiveWallet || ""} />


		      <DemoWalletDashboardStatementModals
		        augmentedTokens={selectableTokens}
		        backendWalletAddress={""}
		        effectiveWallet={effectiveWallet}
		        walletDisplayLabel={walletContextLabel}
		        isPreviewMode={true}
		        noticeVariant="demo"
		        noticeContextLabel={demoNoticeContextLabel}
		        walletId={activeWalletId}
	        previewGlobalMovements={previewGlobalMovements}
        previewCurrencyTransactions={previewCurrencyTransactions}
        isFullPageView={false}
        statementVariant={"default"}
        usdRates={effectiveUsdPerUnitRates}
        highlightTransactionId={highlightTransactionId}
        showGlobalStatement={showGlobalStatement}
        setShowGlobalStatement={setShowGlobalStatement}
        showCurrencyStatement={showCurrencyStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
        selectedStatementToken={selectedStatementToken}
        setSelectedStatementToken={setSelectedStatementToken}
        statementBalance={statementBalance}
        statementTotalBalanceUsd={usdTotal}
        globalStatementTokens={globalStatementTokens} />


      <DemoQRScanner
        isOpen={qrScannerOpen}
        onScan={handleDemoQrScan}
        onClose={() => setQrScannerOpen(false)}
        enableCamera={!showDemoMobileScannerQr}
        showStaticImage={showDemoMobileScannerQr}
        staticContent={showDemoMobileScannerQr ? (
          <QRCodeCanvas
            value={DEMO_FAUX_PAYREQ_EXAMPLE}
            size={demoScannerQrSize}
            bgColor="#000000"
            fgColor="#ffffff"
          />
        ) : null}
        staticContentClassName="bg-black/60" />


    </div>);

}
