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
  const [activeAction, setActiveAction] = useState(null); // send | receive | swap | cash | null
  const [cashModalTab, setCashModalTab] = useState("buy"); // buy | sell
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
  const [isDesktop, setIsDesktop] = useState(false);

  const activeWallet = state.wallets[activeWalletId];
  const isWalletLabelLocked = Boolean(activeWallet?.labelLocked);
  const walletContextLabel =
    String(activeWallet?.label || "").trim() ||
    `${t("demo_wallet_label", "Wallet")} ${activeWalletId}`;
  const wallet = getWalletAddress(state, activeWalletId);
  const refreshTimerRef = useRef(null);
  const prevActiveActionRef = useRef(activeAction);

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

  const handleDemoQrScan = useCallback(
    (data) => {
      // Support both plain XRPL addresses and XCANNES payreq payloads.
      handlePaymentRequestScan?.(data);
      setQrScannerOpen(false);
    },
    [handlePaymentRequestScan, setQrScannerOpen],
  );

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  return (
    <div
      className={[
        "h-full flex flex-col min-h-0 ring-1 rounded-md overflow-hidden bg-xcannes-surface-demo border border-white/10",
        "demo-wallet-tooltip-scope",
        "ring-white/10",
      ].join(" ")}
    >
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

      <DemoWalletActionBar
        setSendTab={setSendTab}
        setActiveAction={setActiveAction}
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

      <DemoWalletFooter />

      <DemoWalletModals
        walletInfoOpen={walletInfoOpen}
        setWalletInfoOpen={setWalletInfoOpen}
        activeAction={activeAction}
        setActiveAction={setActiveAction}
        hasPayreq={hasPayreq}
        setSendPaymentRequest={setSendPaymentRequest}
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
