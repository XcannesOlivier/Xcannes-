"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import {
  buildDefaultDemoState,
  getWalletAddress,
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
import { useDemoWalletLabel } from "./hooks/useDemoWalletLabel";
import { useDemoWalletMeta } from "./hooks/useDemoWalletMeta";
import { useDemoSavedAddresses } from "./hooks/useDemoSavedAddresses";
import { useDemoRates } from "./hooks/useDemoRates";
import { useDemoActions } from "./hooks/useDemoActions";
import { useDemoTokens, renderDemoTokenIcon, getDemoCurrencyLabel } from "./hooks/useDemoTokens";
import { useDemoStatementData } from "./hooks/useDemoStatementData";
import { computeSpreadQuote } from "./utils/demoWalletSpread";
import { usePreferredCurrency } from "@/components/wallet/hooks/usePreferredCurrency";
import {
  DEMO_SAVED_ADDRESSES_STORAGE_KEY,
  DEMO_STATE_STORAGE_KEY,
  isValidDemoState,
  needsDemoStateMigration,
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
  const [activeAction, setActiveAction] = useState(null); // sendChoice | send | receive | swap | cash | null
  const [cashModalTab, setCashModalTab] = useState("choice"); // choice | buy | sell
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);

  const {
    preferredCurrency,
    setPreferredCurrency,
    topCurrencies,
    fawazCurrencies,
    fawazLoading,
    loadFawazCurrencies,
  } = usePreferredCurrency();
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [activitySkeletonExpired, setActivitySkeletonExpired] = useState(false);
  const [activityTooltipOpen, setActivityTooltipOpen] = useState(false);
  const isDesktop = false;

  const activeWallet = state.wallets[activeWalletId];
  const isWalletLabelLocked = Boolean(activeWallet?.labelLocked);
  const walletContextLabel =
    String(activeWallet?.label || "").trim() ||
    `${t("demo_wallet_label", "Wallet")} ${activeWalletId}`;
  const wallet = getWalletAddress(state, activeWalletId);
  const refreshTimerRef = useRef(null);
  const prevActiveActionRef = useRef(activeAction);
  const activityTooltipTriggerRef = useRef(null);

  const { walletHeaderToast, handleCopyWalletAddress } = useDemoWalletLabel({
    activeWalletId,
    walletContextLabel,
    walletAddress: wallet,
    isWalletLabelLocked,
    state,
    setState,
  });

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  const { renderWalletMeta } = useDemoWalletMeta({
    walletAddress: wallet,
    walletLabel: walletContextLabel,
    hideAddress: false,
    addressTitle: t("demo_tt_wallet_address", "Adresse XRPL du wallet."),
  });
  const { renderWalletMeta: renderWalletMetaNoAddress } = useDemoWalletMeta({
    walletAddress: wallet,
    walletLabel: walletContextLabel,
    hideAddress: true,
    addressTitle: t("demo_tt_wallet_address", "Adresse XRPL du wallet."),
  });
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
    }
    if (prevAction === "cash" && activeAction !== "cash") {
      setCashModalTab("choice");
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
  ]);

  // ── Business-logic hooks ──────────────────────────────────────
  const { effectiveUsdPerUnitRates, rlusdPerUnitRates, rlusdPerUnitSources } =
    useDemoRates({
      wallets: state.wallets,
      convertBaseCurrency,
      convertQuoteCurrency,
      preferredCurrency,
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
    currencyLinesSummary,
    currencyLines,
    swapCurrencyOptions,
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
    recentActivity,
  } = useDemoStatementData({
    state,
    activeWalletId,
    activeWallet,
    rlusdPerUnitRates,
    selectedStatementToken,
  });

  useEffect(() => {
    if (recentActivity) {
      setActivitySkeletonExpired(false);
      return;
    }
    setActivitySkeletonExpired(false);
    const timer = setTimeout(() => setActivitySkeletonExpired(true), 5000);
    return () => clearTimeout(timer);
  }, [recentActivity]);

  const recentActivityIcon = recentActivity?.icon || null;
  const recentActivityLabel = recentActivity?.bannerLabel || null;
  const recentActivityMessage = recentActivity?.message || recentActivity?.amount || null;

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
    () => walletUsdTotal(activeWallet),
    [activeWallet],
  );

  const preferredUsdPerUnit = useMemo(() => {
    const code = String(preferredCurrency || "USD").toUpperCase();
    const rate = Number(effectiveUsdPerUnitRates?.[code]);
    return Number.isFinite(rate) && rate > 0 ? rate : 1;
  }, [effectiveUsdPerUnitRates, preferredCurrency]);

  const displayCurrency = String(preferredCurrency || "USD").toUpperCase();
  const displayTotal = usdTotal / preferredUsdPerUnit;

  const walletAddresses = useMemo(() => {
    return Object.values(state?.wallets || {}).map((w) => ({
      id: w?.id,
      label: w?.label,
      address: w?.address,
    }));
  }, [state?.wallets]);

  useEffect(() => {
    const upper = String(requestCurrency || "").toUpperCase();
    if (upper === "USD") setRequestCurrency("RLUSD");
  }, [requestCurrency, setRequestCurrency]);

  useEffect(() => {
    const upper = String(convertBaseCurrency || "").toUpperCase();
    if (upper === "USD") setConvertBaseCurrency("RLUSD");
  }, [convertBaseCurrency, setConvertBaseCurrency]);

  useEffect(() => {
    const upper = String(convertQuoteCurrency || "").toUpperCase();
    if (upper === "USD") setConvertQuoteCurrency("RLUSD");
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

  const sendFxInfo = useMemo(() => {
    if (!selectedSendToken) return null;
    const amountFx = Number.parseFloat(sendAmount || "0");
    if (!Number.isFinite(amountFx) || amountFx <= 0) return null;

    const code = String(selectedSendToken.currency || "").toUpperCase();
    const isFxSend =
      selectedSendToken?.isTrustlineOnly && code !== "RLUSD";
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

  const {
    handleSendSubmit,
    handleDemoConvert,
    handleDemoBuy,
    handleDemoSell,
  } = useDemoActions({
    state,
    setState,
    activeWalletId,
    walletAddress: wallet,
    effectiveUsdPerUnitRates,
    rlusdPerUnitRates,
    recordStatementHighlight,
    selectedSendToken,
    sendAmount,
    sendDestination,
    setSendDestination,
    sendPaymentRequest,
    setSendProcessing,
    setSendPaymentRequest,
    setActiveAction,
    demoSavedAddresses,
    saveDemoAddress,
    convertBaseCurrency,
    convertQuoteCurrency,
    convertAmount,
    setConvertPreview,
    setConvertProcessing,
  });

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
  const openSendAfterScanRef = useRef(false);

  const handleDemoQrScan = useCallback(
    (data) => {
      // Support both plain XRPL addresses and XCANNES payreq payloads.
      handlePaymentRequestScan?.(data);
      setQrScannerOpen(false);
      if (openSendAfterScanRef.current) {
        openSendAfterScanRef.current = false;
        setActiveAction("send");
      }
    },
    [handlePaymentRequestScan, setActiveAction, setQrScannerOpen],
  );

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  return (
    <div className="w-full h-full min-h-0 flex justify-center demo-wallet-tooltip-scope demo-wallet-demo-scope">
      <div className="w-full max-w-[410px] h-full min-h-0">
        <div className="bg-xcannes-surface-demo h-full min-h-0 overflow-hidden flex flex-col rounded-[28px] ring-1 ring-white/[0.06] shadow-[0_20px_60px_rgba(0,0,0,0.55)] relative">
          <div className="flex flex-col min-h-0 relative">
            {/* Header */}
            <DemoWalletHeader
              locale={locale}
              displayAmount={displayTotal}
              displayCurrency={displayCurrency}
              totalInRlusd={usdTotal}
              walletContextLabel={walletContextLabel}
              wallet={wallet}
              onOpenInfo={() => setWalletInfoOpen(true)}
              preferredCurrency={preferredCurrency}
              topCurrencies={topCurrencies}
              fawazCurrencies={fawazCurrencies}
              fawazLoading={fawazLoading}
              onLoadFawazCurrencies={loadFawazCurrencies}
              onPreferredCurrencyChange={setPreferredCurrency}
              walletHeaderToast={walletHeaderToast}
              handleCopyWalletAddress={handleCopyWalletAddress}
              walletAddresses={walletAddresses}
              activeWalletId={activeWalletId}
              onSwitchWallet={setActiveWalletId}
              handleRefreshWallet={handleRefreshWallet}
              isRefreshing={isRefreshing}
            />

            {/* Action bar — mobile */}
            <div className="lg:hidden">
              <DemoWalletActionBar
                setSendTab={setSendTab}
                setActiveAction={setActiveAction}
                setCashModalTab={setCashModalTab}
              />
            </div>

            {/* Token list */}
            <div className="relative flex-1 flex flex-col min-h-0">
              <div className="flex-1 min-w-0 flex flex-col min-h-0">
                <DemoWalletTokenList
                  locale={locale}
                  tokens={tokens}
                  augmentedTokens={augmentedTokens}
                  renderDemoTokenIcon={renderDemoTokenIcon}
                  getDemoCurrencyLabel={getDemoCurrencyLabel}
                  recentActivity={recentActivity}
                  setSelectedStatementToken={setSelectedStatementToken}
                  setShowGlobalStatement={setShowGlobalStatement}
                  setShowCurrencyStatement={setShowCurrencyStatement}
                  headerTitle={
                    <div className="w-full flex flex-col gap-y-0">
                      <div
                        className="w-full min-w-0 overflow-visible relative"
                        aria-live="polite"
                      >
                        {!recentActivity ? (
                          activitySkeletonExpired ? (
                            /* ── Message vide après 5s ── */
                            <div className="relative mx-0 mb-0 px-4 py-[9px] animate-fade-in recent-activity-fade-border rounded-[16px] overflow-hidden shadow-[inset_0_-16px_20px_rgba(0,0,0,0.88)]">
                              <div className="relative z-10">
                                <div className="flex items-center gap-2 min-h-[52px]">
                                  <svg className="w-4 h-4 shrink-0 text-white/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                    <circle cx="12" cy="12" r="9" />
                                    <polyline points="12 7 12 12 15.5 14.5" />
                                  </svg>
                                  <span className="text-[13px] text-white/30">
                                    {t('ui_no_recent_activity', 'Aucune transaction détectée pour le moment')}
                                  </span>
                                </div>
                              </div>
                            </div>
                          ) : (
                            /* ── Skeleton pendant le chargement ── */
                            <div className="relative mx-0 mb-0 px-4 py-[9px] recent-activity-fade-border rounded-[16px] overflow-hidden shadow-[inset_0_-16px_20px_rgba(0,0,0,0.88)]">
                              <div className="relative z-10">
                                <div className="flex flex-col justify-center gap-[5px] min-h-[52px]">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5">
                                      <div className="h-4 w-4 rounded-full bg-white/[0.07] animate-pulse shrink-0" />
                                      <div className="h-2.5 w-20 rounded bg-white/[0.07] animate-pulse" />
                                    </div>
                                    <div className="h-2.5 w-12 rounded bg-white/[0.07] animate-pulse" />
                                  </div>
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="h-3 w-36 rounded bg-white/[0.07] animate-pulse" />
                                    <div className="flex items-center gap-1">
                                      <div className="h-2.5 w-10 rounded bg-white/[0.07] animate-pulse" />
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        ) : (
                          <button
                            type="button"
                            ref={activityTooltipTriggerRef}
                            title={
                              recentActivity.date || recentActivity.time
                                ? `${recentActivity.date || ''} ${recentActivity.time || ''} — ${recentActivityLabel || ''}`
                                : recentActivityLabel || ''
                            }
                            onClick={() => {
                              setActivityTooltipOpen(false);
                              setShowGlobalStatement(true);
                            }}
                            onMouseEnter={() => setActivityTooltipOpen(true)}
                            onMouseLeave={() => setActivityTooltipOpen(false)}
                            onBlur={() => setActivityTooltipOpen(false)}
                            className="w-full text-left focus:outline-none animate-fade-in"
                          >
                            <div className="relative mx-0 mb-0 px-4 py-[9px] transition-colors recent-activity-fade-border rounded-[16px] overflow-hidden shadow-[inset_0_-16px_20px_rgba(0,0,0,0.88)]">
                              <div className="relative z-10">
                                <div className="flex flex-col justify-center gap-[2px] min-h-[52px]">
                                  {/* Ligne 1 : icône + type + date */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <div
                                        className={[
                                          "shrink-0 flex items-center justify-center opacity-70",
                                          recentActivityIcon === "receive" ? "text-xcannes-green"
                                            : recentActivityIcon === "send" ? "text-red-400"
                                            : "text-xcannes-green",
                                        ].join(" ")}
                                        aria-hidden
                                      >
                                        {recentActivityIcon === "send" ? (
                                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 17L17 7" /><path d="M7 7h10v10" />
                                          </svg>
                                        ) : recentActivityIcon === "receive" ? (
                                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M7 7l10 10" /><path d="M17 7v10H7" />
                                          </svg>
                                        ) : (
                                          <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" />
                                            <polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
                                          </svg>
                                        )}
                                      </div>
                                      <span className="text-[13px] text-white/55 truncate">{recentActivityLabel}</span>
                                    </div>
                                    {recentActivity.date ? (
                                      <span className="shrink-0 text-[12px] text-white/35 whitespace-nowrap">{recentActivity.date}</span>
                                    ) : null}
                                  </div>
                                  {/* Ligne 2 : montant + heure + chevron */}
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="min-w-0 truncate text-[14px] text-white/75 font-medium">
                                      {recentActivityIcon === "convert" ? (
                                        <>{recentActivityMessage}</>
                                      ) : recentActivityIcon === "receive" ? (
                                        <span className="text-xcannes-green">+ {recentActivity.amount}</span>
                                      ) : recentActivityIcon === "send" ? (
                                        <span className="text-red-400">− {recentActivity.amount}</span>
                                      ) : recentActivityMessage}
                                    </span>
                                    <div className="shrink-0 flex items-center gap-1">
                                      {recentActivity.time ? (
                                        <span className="text-[12px] text-white/35 whitespace-nowrap">{recentActivity.time}</span>
                                      ) : null}
                                      <svg className="w-[14px] h-[14px] text-white/30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                                        <polyline points="9 18 15 12 9 6" />
                                      </svg>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </button>
                        )}
                        {activityTooltipOpen && recentActivity ? (
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-max max-w-[260px] bg-[#1e2628] text-white/85 text-[11px] leading-snug rounded-lg px-3 py-2 shadow-xl ring-1 ring-white/10 pointer-events-none">
                            {recentActivity.date ? (
                              <div className="text-white/60 text-[11px] mb-1">
                                <span>{recentActivity.date}{recentActivity.time ? ` — ${recentActivity.time}` : ''}</span>
                              </div>
                            ) : null}
                            <div>
                              <span className="text-[14px] text-white/85 font-semibold">
                                {recentActivityIcon === "convert" ? (
                                  recentActivityMessage
                                ) : recentActivityIcon === "receive" ? (
                                  <span className="text-[#16A34A]">+ {recentActivity.amount}</span>
                                ) : recentActivityIcon === "send" ? (
                                  <span className="text-red-300">− {recentActivity.amount}</span>
                                ) : recentActivityMessage}
                              </span>
                            </div>
                            <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[#1e2628]" />
                          </div>
                        ) : null}
                      </div>
                      {/* "Mes devises" — md→lg */}
                      <div className="hidden md:flex lg:hidden items-center justify-between gap-x-2">
                        <span className="pl-0.5 text-[13px] font-medium text-white/30 tracking-wide uppercase">
                          {t('ui_my_currencies', 'Mes devises')}
                        </span>
                      </div>
                      {/* "Mes devises" — lg+ */}
                      <div className="hidden lg:flex items-center justify-between gap-2 px-0.5 pb-1 border-b border-white/[0.06]">
                        <span className="text-[12px] font-semibold text-white/40 tracking-widest">{t('ui_my_currencies', 'Mes devises')}</span>
                      </div>
                    </div>
                  }
                />
              </div>
            </div>

            <div className="lg:mr-[229px]">
              <DemoWalletFooter
                onAddCurrency={() => setWalletInfoOpen(true)}
                onScan={() => setQrScannerOpen(true)}
                onHistory={() => setShowGlobalStatement(true)}
              />
            </div>
          </div>

          <div className="absolute inset-0 z-[10000] pointer-events-none">
            <DemoWalletModals
              inline
              walletInfoOpen={walletInfoOpen}
              setWalletInfoOpen={setWalletInfoOpen}
              activeAction={activeAction}
              setActiveAction={setActiveAction}
              hasPayreq={hasPayreq}
              setSendPaymentRequest={setSendPaymentRequest}
              renderWalletMeta={renderWalletMeta}
              renderWalletMetaNoAddress={renderWalletMetaNoAddress}
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
              handleDemoConvert={handleDemoConvert}
              convertProcessing={convertProcessing}
              walletContextLabel={walletContextLabel}
              isWalletLabelLocked={isWalletLabelLocked}
              preferredCurrency={preferredCurrency}
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
              onOpenSendAfterScan={() => {
                openSendAfterScanRef.current = true;
              }}
              showDemoMobileScannerQr={showDemoMobileScannerQr}
              isDesktop={isDesktop}
              demoScannerQrSize={demoScannerQrSize}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
