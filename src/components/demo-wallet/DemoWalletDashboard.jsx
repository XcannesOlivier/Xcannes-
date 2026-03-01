"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  applyDemoBuySell,
  applyDemoConvert,
  applyDemoEnableCurrency,
  applyDemoSend,
  buildDefaultDemoState,
  ensureAllocation,
  getWalletAddress,
  isDemoNativeCurrency,
  migrateDemoState,
  walletUsdTotal,
} from "./DemoWalletModel";
import DemoWalletHeader from "./components/DemoWalletHeader";
import DemoWalletActionBar from "./components/DemoWalletActionBar";
import DemoWalletTokenList from "./components/DemoWalletTokenList";
import DemoWalletFooter from "./components/DemoWalletFooter";
import DemoWalletModals from "./components/DemoWalletModals";
import { useDemoSendForm } from "./hooks/useDemoSendForm";
import { useDemoPaymentRequestForm } from "./hooks/useDemoPaymentRequestForm";
import { useDemoPaymentRequestScanner } from "./hooks/useDemoPaymentRequestScanner";
import { lockBodyScroll } from "@/utils/bodyScrollLock";
import { useDemoConvertForm } from "./hooks/useDemoConvertForm";
import { useDemoCurrencyLinesForm } from "./hooks/useDemoCurrencyLinesForm";
import { useDemoWalletMeta } from "./hooks/useDemoWalletMeta";
import { useDemoSavedAddresses } from "./hooks/useDemoSavedAddresses";
import { useDemoRates } from "./hooks/useDemoRates";
import { useDemoTokens, renderDemoTokenIcon, getDemoCurrencyLabel } from "./hooks/useDemoTokens";
import { useDemoStatementData } from "./hooks/useDemoStatementData";
import { computeSpreadQuote } from "./utils/demoWalletSpread";
import {
  clone,
  DEMO_SAVED_ADDRESSES_STORAGE_KEY,
  DEMO_STATE_STORAGE_KEY,
  DEMO_TOKEN_PRIORITY,
  formatUnits,
  getDemoLatencyMs,
  getMinUnitsForCurrency,
  isValidDemoState,
  needsDemoStateMigration,
  newDemoEventId,
  sleep,
} from "./utils/demoWalletHelpers";


export default function DemoWalletDashboard({
  defaultWalletId = "A",
  demoState,
  setDemoState,
  allowBackgroundScrollOnMobile = false,
}) {
  const { t } = useTranslation("common");
  const router = useRouter();
  const locale = router?.locale || "en";

  const resolvedDefaultWalletId = defaultWalletId;
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [localState, setLocalState] = useState(() => buildDefaultDemoState());
  const [isHydrated, setIsHydrated] = useState(false);
  const isExternalState = demoState && typeof setDemoState === "function";
  const state = isExternalState ? demoState : localState;
  const setState = isExternalState ? setDemoState : setLocalState;
  const [activeWalletId, setActiveWalletId] = useState(resolvedDefaultWalletId);
  const [activeAction, setActiveAction] = useState(null); // send | receive | swap | cash | null
  const [swapDefaultView, setSwapDefaultView] = useState("convert");
  const [swapLockedView, setSwapLockedView] = useState(null);
  const [cashModalTab, setCashModalTab] = useState("buy"); // buy | sell
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);

  const activeWallet = state.wallets[activeWalletId];
  const panelRingClass = "ring-white/10";
  const isWalletLabelLocked = Boolean(activeWallet?.labelLocked);
  const walletContextLabel =
    String(activeWallet?.label || "").trim() ||
    `${t("demo_wallet_label", "Wallet")} ${activeWalletId}`;
  const wallet = getWalletAddress(state, activeWalletId);
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
    if (isWalletLabelLocked && isEditingWalletLabel)
      setIsEditingWalletLabel(false);
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
      await navigator.clipboard.writeText(wallet);
      flashWalletHeaderToast(t("demo_copied", "Copié"));
    } catch {
      // noop
    }
  }, [wallet, flashWalletHeaderToast, t]);

  const { renderWalletMeta } = useDemoWalletMeta({
    walletAddress: wallet,
    walletLabel: walletContextLabel,
    hideAddress: isWalletLabelLocked,
    addressTitle: t("demo_tt_wallet_address", "Adresse XRPL du wallet."),
  });
  const demoNoticeContextLabel = "";
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
      window.localStorage.setItem(
        DEMO_STATE_STORAGE_KEY,
        JSON.stringify(state),
      );
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
    setSendPaymentRequest,
  } = useDemoSendForm({
    defaultSendTab: "manual",
    defaultSendAssetKey: "RLUSD",
  });
  const hasPayreq = Boolean(sendPaymentRequest);

  const {
    requestAmount,
    setRequestAmount,
    requestCurrency,
    setRequestCurrency,
    requestMemo,
    setRequestMemo,
  } = useDemoPaymentRequestForm({
    defaultCurrency: "RLUSD",
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
    setConvertProcessing,
  } = useDemoConvertForm({
    defaultBaseCurrency: "RLUSD",
    defaultQuoteCurrency: "EUR",
  });

  const {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
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

  // ── Business-logic hooks ──────────────────────────────────────
  const { effectiveUsdPerUnitRates, rlusdPerUnitRates, rlusdPerUnitSources } =
    useDemoRates({
      wallets: state.wallets,
      convertBaseCurrency,
      convertQuoteCurrency,
      requestCurrency,
    });

  const {
    currencyOrderIndex,
    allocationSummary,
    tokens,
    augmentedTokens,
    globalStatementTokens,
    selectableTokens,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectLabelMobileByAssetKey,
    selectIconByAssetKey,
  } = useDemoTokens({
    activeWallet,
    effectiveUsdPerUnitRates,
    rlusdPerUnitRates,
    locale,
  });

  const {
    recordStatementHighlight,
    resetStatementHighlights,
    previewGlobalMovements,
    previewCurrencyTransactions,
    statementBalance,
    highlightTransactionId,
  } = useDemoStatementData({
    state,
    activeWalletId,
    activeWallet,
    rlusdPerUnitRates,
    selectedStatementToken,
  });

  const handleReset = useCallback(() => {
    setState(buildDefaultDemoState());
    setActiveWalletId(resolvedDefaultWalletId);
    setActiveAction(null);
    setCashModalTab("buy");
    setShowGlobalStatement(false);
    setShowCurrencyStatement(false);
    setSelectedStatementToken(null);
    resetStatementHighlights();
    setSendPaymentRequest(null);
    setIsEditingWalletLabel(false);
    setWalletHeaderToast("");
  }, [
    resetStatementHighlights,
    resolvedDefaultWalletId,
    setActiveAction,
    setActiveWalletId,
    setCashModalTab,
    setSelectedStatementToken,
    setSendPaymentRequest,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setState,
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

  const usdTotal = useMemo(
    () => walletUsdTotal(activeWallet, effectiveUsdPerUnitRates),
    [activeWallet, effectiveUsdPerUnitRates],
  );
  const displayCurrency = "USD";
  const displayAmount = usdTotal;

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

  const selectedSendToken = useMemo(() => {
    if (!selectableTokens.length) return null;
    return (
      selectableTokens.find((token) => token.key === sendAssetKey) ||
      selectableTokens[0]
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
    const isFxSend =
      selectedSendToken?.isTrustlineOnly && !isDemoNativeCurrency(code);
    if (!isFxSend) return null;

    const rlusdPerUnit = Number(rlusdPerUnitRates?.[code] || 0);
    if (!Number.isFinite(rlusdPerUnit) || rlusdPerUnit <= 0) return null;

    const paymentRlusd = amountFx * rlusdPerUnit;
    const spread = computeSpreadQuote({
      base: code,
      quote: "RLUSD",
      amountRlusd: paymentRlusd,
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
          : 0,
    };
  }, [rlusdPerUnitRates, selectedSendToken, sendAmount]);

  const { qrScannerOpen, setQrScannerOpen, handlePaymentRequestScan } =
    useDemoPaymentRequestScanner({
      augmentedTokens,
      setSendDestination,
      setSendAmount,
      setSendAssetKey,
      setSendTab,
      setSendPaymentRequest,
    });
  const allowBackgroundScroll = allowBackgroundScrollOnMobile && !isDesktop;
  const shouldLockBodyScroll = Boolean(
    !allowBackgroundScroll &&
    (activeAction ||
      showGlobalStatement ||
      showCurrencyStatement ||
      walletInfoOpen ||
      qrScannerOpen),
  );
  const showDemoMobileScannerQr = !isDesktop;
  const demoScannerQrSize = 220;

  const handleDemoQrScan = useCallback(
    (data) => {
      // Support both plain XRPL addresses and XCANNES payreq payloads.
      handlePaymentRequestScan?.(data);
      setQrScannerOpen(false);
    },
    [handlePaymentRequestScan, setQrScannerOpen],
  );

  const handleDemoRequestGenerated = useCallback((_request) => {
    // With a single demo wallet, we don't simulate cross-wallet payment requests anymore.
  }, []);

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  const submitSend = ({
    amount,
    currency,
    memo,
    toAddress,
    isFxSend,
    paymentRequest,
  }) => {
    const minUnits = getMinUnitsForCurrency(currency);
    if (!Number.isFinite(Number(amount)) || Number(amount) < minUnits) {
      return {
        error: t("demo_error_amount_too_small", "Amount too small (demo)."),
      };
    }

    let spreadFeeUnits = 0;
    let spreadFeeRlusd = 0;
    let fxRate = null;

    if (isFxSend) {
      const requestedFxRate =
        paymentRequest?.fxRate != null
          ? Number(paymentRequest.fxRate)
          : Number.NaN;
      const rawRate = Number(effectiveUsdPerUnitRates?.[currency]);
      const effectiveRate =
        Number.isFinite(requestedFxRate) && requestedFxRate > 0
          ? requestedFxRate
          : rawRate;
      if (!Number.isFinite(effectiveRate) || effectiveRate <= 0) {
        return {
          error: t(
            "demo_error_rates_stale",
            "Rates temporarily unavailable (demo). Please retry.",
          ),
        };
      }

      fxRate = effectiveRate;
      const paymentRlusd = Number(amount) * effectiveRate;
      const requestedRlusd =
        paymentRequest?.amountRlusd != null
          ? Number(paymentRequest.amountRlusd)
          : Number.NaN;
      if (Number.isFinite(requestedRlusd) && requestedRlusd > 0) {
        const diff = Math.abs(paymentRlusd - requestedRlusd);
        if (diff > Math.max(0.01, requestedRlusd * 0.005)) {
          const requestedLabel = requestedRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6,
          });
          const computedLabel = paymentRlusd.toLocaleString(locale, {
            maximumFractionDigits: 6,
          });
          return {
            error: t("demo_error_payment_request_mismatch", {
              defaultValue:
                "Demande de paiement incohérente (démo).\n\nDemandé : ≈ {{requested}} USD\nCalculé : ≈ {{computed}} USD\n\nResscanez la demande ou réessayez.",
              requested: requestedLabel,
              computed: computedLabel,
            }),
          };
        }
      }

      const spread = computeSpreadQuote({
        base: currency,
        quote: "RLUSD",
        amountRlusd: paymentRlusd,
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
      if (
        !Number.isFinite(availableUsd) ||
        availableUsd + 1e-9 < totalDebitUsd
      ) {
        return {
          error: t("demo_error_insufficient", "Solde insuffisant (démo)."),
        };
      }
    }

    const toWalletId =
      toAddress && wallet && String(toAddress).trim() === String(wallet).trim()
        ? activeWalletId
        : null;

    const result = applyDemoSend({
      state: nextState,
      fromWalletId: activeWalletId,
      toWalletId,
      toAddress,
      currencyCode: currency,
      amountUnits: amount,
      memo,
      ratesUsdPerUnit: effectiveUsdPerUnitRates,
    });
    if (!result.ok) {
      const message =
        result.error === "insufficient_funds"
          ? t("demo_error_insufficient", "Solde insuffisant (démo).")
          : result.error === "unsupported_currency"
            ? t("demo_error_unsupported", "Devise non supportée (démo).")
            : t("demo_error_generic", "Action impossible (démo).");
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
          (
            Number(fromWallet.allocations[currency] || 0) -
            Number(spreadFeeRlusd)
          ).toFixed(6),
        );
        ensureAllocation(fromWallet, "RLUSD");
        fromWallet.allocations.RLUSD = Number(
          (
            Number(fromWallet.allocations.RLUSD || 0) - Number(spreadFeeRlusd)
          ).toFixed(6),
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
        error: t("demo_error_amount_too_small", "Amount too small (demo)."),
      };
    }
    const nextState = clone(state);
    const result = applyDemoConvert({
      state: nextState,
      walletId: activeWalletId,
      fromCurrencyCode: from,
      toCurrencyCode: to,
      amountUnits: amount,
      ratesUsdPerUnit: effectiveUsdPerUnitRates,
    });
    if (!result.ok) {
      const message =
        result.error === "insufficient_funds"
          ? t("demo_error_insufficient", "Solde insuffisant (démo).")
          : result.error === "invalid_pair"
            ? t("demo_error_pair", "Paire invalide (démo).")
            : t("demo_error_generic", "Action impossible (démo).");
      return { error: message };
    }
    setState(nextState);
    return { ok: true, event: result?.event || nextState?.events?.[0] || null };
  };

  const handleSendSubmit = async ({
    saveDestination = "",
    saveLabel = "",
  } = {}) => {
    if (!selectedSendToken) return { ok: false };
    const amountNum = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountNum) || amountNum <= 0) return { ok: false };

    const normalizeDestination = (value) => {
      const raw = String(value || "").trim();
      if (!raw) return "";
      if (/^xrpl:/i.test(raw)) {
        const cleaned = raw
          .replace(/^xrpl:\/\//i, "xrpl://")
          .replace(/^xrpl:/i, "xrpl://");
        try {
          const url = new URL(cleaned);
          const candidate =
            url.searchParams.get("to") ||
            url.searchParams.get("destination") ||
            (url.hostname && url.hostname !== "xrpl" ? url.hostname : "") ||
            (url.pathname || "").replace(/^\/+/, "");
          if (candidate) return candidate;
        } catch {
          // fall back to stripping prefix
        }
        return raw.replace(/^xrpl:\/*/i, "");
      }
      if (/^https?:/i.test(raw)) {
        try {
          const url = new URL(raw);
          const candidate =
            url.searchParams.get("to") ||
            url.searchParams.get("destination") ||
            "";
          if (candidate) return candidate;
          const host = url.hostname || "";
          const path = (url.pathname || "").replace(/^\/+/, "");
          if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(host)) return host;
          if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(path)) return path;
        } catch {
          // ignore
        }
      }
      return raw;
    };
    const dest = normalizeDestination(sendDestination);
    if (dest && dest !== String(sendDestination || "").trim()) {
      setSendDestination(dest);
    }
    if (!dest) {
      alert(
        t(
          "demo_error_destination_required",
          "Veuillez saisir une adresse de destination (démo).",
        ),
      );
      return { ok: false };
    }
    if (
      sendPaymentRequest?.to &&
      dest !== String(sendPaymentRequest.to).trim()
    ) {
      alert(
        t(
          "demo_error_request_destination_mismatch",
          "La destination de la demande de paiement ne correspond pas (démo).",
        ),
      );
      return { ok: false };
    }

    const currency = String(selectedSendToken.currency || "").toUpperCase();
    const requestTargetCurrency = String(
      sendPaymentRequest?.targetCurrencyCode || "",
    )
      .trim()
      .toUpperCase();
    if (requestTargetCurrency && requestTargetCurrency !== currency) {
      alert(
        t("demo_error_request_currency_mismatch", {
          defaultValue:
            "Cette demande est en {{currency}}.\nVeuillez sélectionner {{currency}} pour payer.",
          currency: requestTargetCurrency,
        }),
      );
      return { ok: false };
    }

    const isFxSend =
      selectedSendToken?.isTrustlineOnly && !isDemoNativeCurrency(currency);

    setSendProcessing(true);
    try {
      await sleep(getDemoLatencyMs());
      const res = submitSend({
        amount: amountNum,
        currency,
        memo: sendPaymentRequest?.memo || "",
        toAddress: dest,
        isFxSend,
        paymentRequest: sendPaymentRequest,
      });
      if (res?.error) {
        alert(res.error);
        return { ok: false };
      }
      const normalizedSaveDestination = String(saveDestination || "").trim();
      if (normalizedSaveDestination && normalizedSaveDestination === dest) {
        const isAlreadySaved = (demoSavedAddresses || []).some(
          (entry) => entry.address === normalizedSaveDestination,
        );
        if (!isAlreadySaved) {
          saveDemoAddress(
            normalizedSaveDestination,
            String(saveLabel || "").trim(),
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
  }, [
    allocationSummary.unallocatedRlusd,
    currencyLinesBase,
    currencyOrderIndex,
  ]);

  const swapCurrencyOptions = useMemo(() => {
    const codes = new Set(
      (augmentedTokens || [])
        .map((tok) => String(tok.currency || "").toUpperCase())
        .filter((code) => code && code !== "XRP"),
    );
    codes.add("RLUSD");
    return Array.from(codes)
      .filter(Boolean)
      .sort((a, b) => {
        const aPriority = Object.prototype.hasOwnProperty.call(
          DEMO_TOKEN_PRIORITY,
          a,
        )
          ? DEMO_TOKEN_PRIORITY[a]
          : Number.POSITIVE_INFINITY;
        const bPriority = Object.prototype.hasOwnProperty.call(
          DEMO_TOKEN_PRIORITY,
          b,
        )
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
    const feeUsd = (usdGross * 100) / 10_000;
    const usdNet = Math.max(0, usdGross - feeUsd);
    const toAmount = usdNet / quoteUsd;
    const amountLabel = toAmount.toLocaleString(locale, {
      maximumFractionDigits: 6,
    });
    const usdLabel = usdNet.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    const feeLabel = feeUsd.toLocaleString(locale, {
      maximumFractionDigits: 2,
    });
    const baseLabel = t("demo_quote_backed", "USD base");
    const feeLabelText = t("demo_quote_fee", "fee");
    setConvertPreview(
      `≈ ${amountLabel} ${quote} · ${baseLabel} ${usdLabel} · ${feeLabelText} ${feeLabel}`,
    );
  }, [
    convertAmount,
    convertBaseCurrency,
    convertQuoteCurrency,
    locale,
    rlusdPerUnitRates,
    setConvertPreview,
    t,
  ]);

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
            if (fromCode)
              recordStatementHighlight(activeWalletId, fromCode, event.id);
            if (toCode)
              recordStatementHighlight(activeWalletId, toCode, event.id);
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
      currencyCode: code,
    });
    if (!res.ok) return false;
    setState(nextState);
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
    const nextTotalAllocated = Object.entries(allocations).reduce(
      (sum, [entryCode, entryValue]) => {
        const upper = String(entryCode || "").toUpperCase();
        if (upper === "RLUSD" || upper === "XRP") return sum;
        const value = upper === code ? allocated : Number(entryValue || 0);
        return sum + value;
      },
      0,
    );

    if (nextTotalAllocated > currentRlusd + 1e-9) {
      alert(t("demo_error_insufficient", "Solde insuffisant (démo)."));
      return;
    }

    wallet.allocations[code] = Number(allocated.toFixed(6));
    setState(nextState);
  };

  // ── Cash modal handlers (buy / sell) ────────────────────────────
  const handleDemoBuy = async ({ amount }) => {
    await sleep(getDemoLatencyMs());
    const nextState = clone(state);
    const res = applyDemoBuySell({
      state: nextState,
      walletId: activeWalletId,
      side: "buy",
      amountUsd: Number(amount),
      memo: "MoonPay (demo)",
    });
    if (!res.ok)
      return {
        error: t("demo_error_generic", "Action impossible (démo)."),
      };
    const event = res?.event || null;
    if (event?.id) {
      recordStatementHighlight(activeWalletId, "RLUSD", event.id);
    }
    setState(nextState);
    return { ok: true };
  };

  const handleDemoSell = async ({ amount }) => {
    await sleep(getDemoLatencyMs());
    const nextState = clone(state);
    const res = applyDemoBuySell({
      state: nextState,
      walletId: activeWalletId,
      side: "sell",
      amountUsd: Number(amount),
      memo: "MoonPay (demo)",
    });
    if (!res.ok) {
      return {
        error:
          res.error === "insufficient_funds"
            ? t("demo_error_insufficient", "Solde insuffisant (démo).")
            : t("demo_error_generic", "Action impossible (démo)."),
      };
    }
    const event = res?.event || null;
    if (event?.id) {
      recordStatementHighlight(activeWalletId, "RLUSD", event.id);
    }
    setState(nextState);
    return { ok: true };
  };

  return (
    <div
      className={[
        "h-full flex flex-col min-h-0 ring-1 rounded-md overflow-hidden bg-[#0b0f10] border border-white/10",
        "demo-wallet-tooltip-scope",
        panelRingClass,
      ].join(" ")}
    >
      <DemoWalletHeader
        locale={locale}
        displayAmount={displayAmount}
        displayCurrency={displayCurrency}
        walletContextLabel={walletContextLabel}
        wallet={wallet}
        walletHeaderToast={walletHeaderToast}
        isWalletLabelLocked={isWalletLabelLocked}
        isEditingWalletLabel={isEditingWalletLabel}
        walletLabelDraft={walletLabelDraft}
        setWalletLabelDraft={setWalletLabelDraft}
        handleOpenWalletLabelEditor={handleOpenWalletLabelEditor}
        handleSaveWalletLabel={handleSaveWalletLabel}
        handleCancelWalletLabel={handleCancelWalletLabel}
        handleCopyWalletAddress={handleCopyWalletAddress}
        handleRefreshWallet={handleRefreshWallet}
        isRefreshing={isRefreshing}
      />

      <DemoWalletActionBar
        setSendTab={setSendTab}
        setActiveAction={setActiveAction}
        setSwapDefaultView={setSwapDefaultView}
        setSwapLockedView={setSwapLockedView}
        setCashModalTab={setCashModalTab}
      />

      <DemoWalletTokenList
        locale={locale}
        tokens={tokens}
        augmentedTokens={augmentedTokens}
        renderDemoTokenIcon={renderDemoTokenIcon}
        getDemoCurrencyLabel={getDemoCurrencyLabel}
        setSelectedStatementToken={setSelectedStatementToken}
        setShowGlobalStatement={setShowGlobalStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
      />

      <DemoWalletFooter setWalletInfoOpen={setWalletInfoOpen} />

      <DemoWalletModals
        walletInfoOpen={walletInfoOpen}
        setWalletInfoOpen={setWalletInfoOpen}
        demoNoticeContextLabel={demoNoticeContextLabel}
        activeAction={activeAction}
        setActiveAction={setActiveAction}
        hasPayreq={hasPayreq}
        setSendPaymentRequest={setSendPaymentRequest}
        activeWalletId={activeWalletId}
        renderWalletMeta={renderWalletMeta}
        selectableTokens={selectableTokens}
        selectedSendToken={selectedSendToken}
        sendFxInfo={sendFxInfo}
        setSendAssetKey={setSendAssetKey}
        sendAmount={sendAmount}
        setSendAmount={setSendAmount}
        selectLabelByAssetKey={selectLabelByAssetKey}
        selectLabelRightByAssetKey={selectLabelRightByAssetKey}
        selectIconByAssetKey={selectIconByAssetKey}
        selectLabelMobileByAssetKey={selectLabelMobileByAssetKey}
        demoSavedAddresses={demoSavedAddresses}
        sendDestination={sendDestination}
        setSendDestination={setSendDestination}
        handlePaymentRequestScan={handlePaymentRequestScan}
        handleSendSubmit={handleSendSubmit}
        sendProcessing={sendProcessing}
        sendPaymentRequest={sendPaymentRequest}
        wallet={wallet}
        requestAmount={requestAmount}
        setRequestAmount={setRequestAmount}
        requestCurrency={requestCurrency}
        setRequestCurrency={setRequestCurrency}
        allocationSummary={allocationSummary}
        requestMemo={requestMemo}
        setRequestMemo={setRequestMemo}
        rlusdPerUnitRates={rlusdPerUnitRates}
        rlusdPerUnitSources={rlusdPerUnitSources}
        handleDemoRequestGenerated={handleDemoRequestGenerated}
        swapDefaultView={swapDefaultView}
        swapLockedView={swapLockedView}
        handleActivateCurrencyLine={handleActivateCurrencyLine}
        currencyLinesSummary={currencyLinesSummary}
        currencyLines={currencyLines}
        swapCurrencyOptions={swapCurrencyOptions}
        convertBaseCurrency={convertBaseCurrency}
        setConvertBaseCurrency={setConvertBaseCurrency}
        convertQuoteCurrency={convertQuoteCurrency}
        setConvertQuoteCurrency={setConvertQuoteCurrency}
        convertAmount={convertAmount}
        setConvertAmount={setConvertAmount}
        convertPreview={convertPreview}
        currencyLineCode={currencyLineCode}
        setCurrencyLineCode={setCurrencyLineCode}
        currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
        setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
        handleUpsertCurrencyLine={handleUpsertCurrencyLine}
        handleDemoConvert={handleDemoConvert}
        convertProcessing={convertProcessing}
        walletContextLabel={walletContextLabel}
        isWalletLabelLocked={isWalletLabelLocked}
        handleDemoBuy={handleDemoBuy}
        handleDemoSell={handleDemoSell}
        cashModalTab={cashModalTab}
        setCashModalTab={setCashModalTab}
        previewGlobalMovements={previewGlobalMovements}
        previewCurrencyTransactions={previewCurrencyTransactions}
        effectiveUsdPerUnitRates={effectiveUsdPerUnitRates}
        highlightTransactionId={highlightTransactionId}
        showGlobalStatement={showGlobalStatement}
        setShowGlobalStatement={setShowGlobalStatement}
        showCurrencyStatement={showCurrencyStatement}
        setShowCurrencyStatement={setShowCurrencyStatement}
        selectedStatementToken={selectedStatementToken}
        setSelectedStatementToken={setSelectedStatementToken}
        statementBalance={statementBalance}
        usdTotal={usdTotal}
        globalStatementTokens={globalStatementTokens}
        qrScannerOpen={qrScannerOpen}
        handleDemoQrScan={handleDemoQrScan}
        setQrScannerOpen={setQrScannerOpen}
        showDemoMobileScannerQr={showDemoMobileScannerQr}
        isDesktop={isDesktop}
        demoScannerQrSize={demoScannerQrSize}
      />
    </div>
  );
}
