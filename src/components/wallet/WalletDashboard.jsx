"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import xcannesApi from "@/lib/xcannesApi";
import { CRYPTO_ICONS } from "@/utils/marketConstants";

import { useWalletCurrencyLines } from "./hooks/useWalletCurrencyLines";
import { useCurrencyLinesForm } from "./hooks/useCurrencyLinesForm";
import { useCurrencyLinesActions } from "./hooks/useCurrencyLinesActions";
import { useWalletTokens } from "./hooks/useWalletTokens";
import { useRlusdPerUnitRates } from "./hooks/useRlusdPerUnitRates";
import { useUsdTotalLabel } from "./hooks/useUsdTotalLabel";
import { useWalletMeta } from "./hooks/useWalletMeta";
import { lockBodyScroll } from "@/utils/bodyScrollLock";
import { useXrplConnectionIndicator } from "./hooks/useXrplConnectionIndicator";
import { useWalletLabel } from "./hooks/useWalletLabel";
import WalletDashboardFooter from "./components/WalletDashboardFooter";
import WalletDashboardHeader from "./components/WalletDashboardHeader";
import WalletDashboardActionRow from "./components/WalletDashboardActionRow";
import WalletDashboardTokenList from "./components/WalletDashboardTokenList";
import WalletDashboardTokenRow from "./components/WalletDashboardTokenRow";
import { useWalletModalProps } from "./hooks/useWalletModalProps";
import { useWalletActivation } from "./hooks/useWalletActivation";
import { useWalletToast } from "./hooks/useWalletToast";
import WalletDesktopModals from "./desktop/WalletDesktopModals";
import WalletMobileModals from "./mobile/WalletMobileModals";
import WalletToastOverlay from "./components/WalletToastOverlay";
import { useWalletNavigation } from "./hooks/useWalletNavigation";
import { useTokenDisplayLabels } from "./hooks/useTokenDisplayLabels";
import WalletPendingPayreqs from "./components/WalletPendingPayreqs";
import { useTranslation } from "next-i18next";
import {
  resolveWalletLayout,
  USD_STABLECOINS,
  WALLET_ACCEPTED_TOKENS,
} from "./walletDashboardConfig";

// Sub-orchestrator hooks
import { useWalletSendOrchestrator } from "./hooks/useWalletSendOrchestrator";
import { useWalletSwapOrchestrator } from "./hooks/useWalletSwapOrchestrator";
import { useWalletIncomingToast } from "./hooks/useWalletIncomingToast";
import { useDesktopInlineFlags } from "./hooks/useDesktopInlineFlags";
import { useAugmentedCurrencyLines } from "./hooks/useAugmentedCurrencyLines";

const DEFAULT_ADJUSTMENT_FEE_RLUSD = 1;
const ADJUSTMENT_FEE_RLUSD = (() => {
  const raw = Number.parseFloat(
    process.env.NEXT_PUBLIC_WALLET_ADJUSTMENT_FEE_RLUSD || "",
  );
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_ADJUSTMENT_FEE_RLUSD;
})();

const DEFAULT_ACTIVATION_XRP_AMOUNT = 1;
const ACTIVATION_BUNDLE_XRP_AMOUNT = 1.4;

function isAcceptedOnChainToken(currency) {
  const code = String(currency || "").toUpperCase();
  return WALLET_ACCEPTED_TOKENS.has(code);
}

export default function WalletDashboard({
  isFullPage = false,
  variant,
  showDesktopStatement = false,
  showPayreqDecor = false,
  qrSizingVariant = "default",
  showMobileHomeLink = false,
  allowBackgroundScrollOnMobile = false,
  allowPageScrollOnMobile = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const layout = useMemo(
    () => resolveWalletLayout(variant, isFullPage),
    [variant, isFullPage],
  );
  const isFullPageView = layout.isFullPage;
  const statementVariant = layout.statementVariant;
  const showDesktopStatementPanel = Boolean(showDesktopStatement);
  const payreqDecorProps = showPayreqDecor ? { showFauxPayreqDecor: true } : {};

  // ── Core wallet context ────────────────────────────────────
  const {
    wallet,
    isConnected,
    isConnecting,
    balance,
    isWalletActivated,
    qrModalData,
    refreshBalance,
    connect,
    disconnect,
    signTransaction,
    closeQrModal,
  } = useWallet();

  const { toasts, confirmState, toast, confirm, dismissToast, resolveConfirm } =
    useWalletToast();

  // ── Token computation ──────────────────────────────────────
  const baseTokens = useMemo(
    () =>
      (balance?.tokens || []).filter((tok) =>
        isAcceptedOnChainToken(tok?.currency),
      ),
    [balance?.tokens],
  );
  const hasOnChainRlusd = (baseTokens || []).some(
    (tok) => String(tok?.currency || "").toUpperCase() === "RLUSD",
  );
  const xrpAmount = parseFloat(balance?.xrp || 0) || 0;

  const isStablecoin = useCallback(
    (currency) =>
      USD_STABLECOINS.includes(String(currency || "").toUpperCase()),
    [],
  );
  const stableUsd = useMemo(
    () =>
      baseTokens
        .filter((tok) => isStablecoin(tok.currency))
        .reduce((sum, tok) => {
          const v = parseFloat(tok.value);
          return sum + (Number.isFinite(v) ? v : 0);
        }, 0),
    [baseTokens, isStablecoin],
  );
  const displayTokens = useMemo(
    () => [{ key: "XRP", currency: "XRP", issuer: "Native", value: xrpAmount }],
    [xrpAmount],
  );

  // ── UI state ───────────────────────────────────────────────
  const [activeAction, setActiveAction] = useState(null);
  const [showAdjustmentModal, setShowAdjustmentModal] = useState(false);
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] =
    useState(false);
  const [showRlusdSetupModal, setShowRlusdSetupModal] = useState(false);
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const desktopDefaultActionSetRef = useRef(false);
  const [activationBundleEnabled, setActivationBundleEnabled] = useState(false);
  const activationXrpAmount = activationBundleEnabled
    ? ACTIVATION_BUNDLE_XRP_AMOUNT
    : DEFAULT_ACTIVATION_XRP_AMOUNT;
  const activationXrpAmountLabel = activationBundleEnabled ? "1.40" : "1";

  // ── Desktop panel media query ──────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showDesktopStatementPanel) {
      setIsDesktopPanel(false);
      desktopDefaultActionSetRef.current = false;
      return;
    }
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktopPanel(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, [showDesktopStatementPanel]);

  // ── Wallet label ───────────────────────────────────────────
  const {
    walletLabel,
    walletLabelDraft,
    setWalletLabelDraft,
    isEditingWalletLabel,
    isWalletLabelRequired,
    isWalletLabelLocked,
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor: handleOpenWalletLabelEditor,
    saveWalletLabel: handleSaveWalletLabel,
    cancelWalletLabel: handleCancelWalletLabel,
    loadWalletLabel,
  } = useWalletLabel({
    walletAddress: wallet,
    isConnected,
    isPreviewMode: false,
    isWalletActivated,
    hasOnChainRlusd,
    defaultLabel: t("nav_wallet", "Wallet"),
    signTransaction,
  });
  const defaultWalletLabel = t("nav_wallet", "Wallet");
  const walletHasCustomLabel = Boolean(
    String(walletLabel || "").trim() &&
    String(walletLabel || "").trim() !== defaultWalletLabel,
  );
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: wallet,
    walletLabel,
    hideAddress: false,
  });

  // ── Currency lines (backend) ───────────────────────────────
  const backendWalletAddress = wallet || null;

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
  } = useWalletCurrencyLines(backendWalletAddress, { signTransaction });

  const {
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
  } = useCurrencyLinesForm();

  const { handleUpsertCurrencyLine: handleUpsertCurrencyLineReal } =
    useCurrencyLinesActions({
      backendWalletAddress,
      currencyLineCode,
      currencyLineAllocatedRlusd,
      setCurrencyLineCode,
      setCurrencyLineAllocatedRlusd,
      upsertCurrencyLine,
    });

  // ── Augmented currency lines (defaults + sorting + deficit) ─
  const {
    augmentedCurrencyLines,
    adjustmentDeficitRlusd,
    hasAdjustmentDeficit,
    currencyLineCodes,
  } = useAugmentedCurrencyLines({
    currencyLines,
    currencyLinesSummary,
    backendWalletAddress,
    refreshCurrencyLines,
  });

  // ── Tokens (augmented with currency lines) ─────────────────
  const { augmentedTokens, allocatedRlusdByCurrency, swapCurrencyOptions } =
    useWalletTokens({
      displayTokens,
      currencyLines: augmentedCurrencyLines,
    });

  const selectableTokens = useMemo(
    () =>
      (augmentedTokens || []).filter((token) => {
        const code = String(token?.currency || "")
          .trim()
          .toUpperCase();
        return code !== "XRP" && code !== "RLUSD";
      }),
    [augmentedTokens],
  );
  const hasRlusdTrustline = hasOnChainRlusd;

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } =
    useRlusdPerUnitRates(currencyLineCodes);

  // ===== SUB-ORCHESTRATORS ===================================

  const swapState = useWalletSwapOrchestrator({
    isConnected,
    backendWalletAddress,
    wallet,
    signTransaction,
    refreshBalance,
    hasOnChainRlusd,
    swapCurrencyOptions,
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
  });

  const sendState = useWalletSendOrchestrator({
    wallet,
    isConnected,
    isDesktopPanel,
    backendWalletAddress,
    signTransaction,
    refreshBalance,
    hasOnChainRlusd,
    augmentedTokens,
    selectableTokens,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
    closeQrModal,
    toast,
    confirm,
    setActiveAction,
  });

  useWalletIncomingToast({ backendWalletAddress, flashWalletHeaderToast });

  // ── Token display labels ───────────────────────────────────
  const {
    displayTokensWithCurrencyLines,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectLabelMobileByAssetKey,
    selectIconByAssetKey,
    tokenListTokens,
  } = useTokenDisplayLabels({
    augmentedTokens,
    allocatedRlusdByCurrency,
    rlusdPerUnitRates,
    locale,
  });

  // ── Activation ─────────────────────────────────────────────
  const {
    handleInstallRequiredTrustline,
    handleOpenRlusdSetup,
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  } = useWalletActivation({
    isConnected,
    wallet,
    signTransaction,
    refreshBalance,
    loadWalletLabel,
    toast,
    confirm,
    closeInlineQr: sendState.closeInlineQr,
    setWalletInfoOpen,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowRlusdSetupModal,
    setActivationBundleEnabled,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setCashModalTab: swapState.setCashModalTab,
    setActiveAction,
    activationXrpAmount,
    activationXrpAmountLabel,
  });

  // ── Navigation ─────────────────────────────────────────────
  const {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
    handleOpenCurrencyLines,
    handleOpenCurrencyStatement,
    handleOpenInfo,
    handleOpenGlobalStatement,
    handleCopyAddress,
    handleRefreshWallet,
  } = useWalletNavigation({
    wallet,
    isConnected,
    backendWalletAddress,
    isDesktopPanel,
    isConnecting,
    isRefreshing,
    setIsRefreshing,
    refreshBalance,
    currencyLines,
    handleUpsertCurrencyLineReal,
    activeAction,
    hasAdjustmentDeficit,
    showAdjustmentModal,
    closeInlineQr: sendState.closeInlineQr,
    setActiveAction,
    setWalletInfoOpen,
    setSwapDefaultView: swapState.setSwapDefaultView,
    setSwapLockedView: swapState.setSwapLockedView,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setShowAdjustmentModal,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowGlobalStatement,
    setShowCurrencyStatement,
    setSelectedStatementToken,
    setConvertBaseCurrency: swapState.setConvertBaseCurrency,
    setConvertQuoteCurrency: swapState.setConvertQuoteCurrency,
    setConvertAmount: swapState.setConvertAmount,
    flashWalletHeaderToast,
    isWalletLabelRequired,
    t,
    toast,
  });

  // ── Token row renderer ─────────────────────────────────────
  const renderTokenRow = useCallback(
    (token) => (
      <WalletDashboardTokenRow
        key={token.key}
        token={token}
        tokenRowClass={layout.tokenRowClass}
        onInstallTrustline={handleInstallRequiredTrustline}
        isWalletActivated={isWalletActivated}
        hasRlusdTrustline={hasRlusdTrustline}
        onActivateWallet={handleOpenActivationModal}
        onOpenRlusdSetup={handleOpenRlusdSetup}
        onClick={() => handleOpenCurrencyStatement(token)}
      />
    ),
    [
      handleInstallRequiredTrustline,
      handleOpenActivationModal,
      handleOpenCurrencyStatement,
      handleOpenRlusdSetup,
      hasRlusdTrustline,
      isWalletActivated,
      layout.tokenRowClass,
    ],
  );

  // ── Total label ────────────────────────────────────────────
  const { usdRates, totalLabel } = useUsdTotalLabel({
    augmentedTokens,
    isPreviewMode: false,
    stableUsd,
    xrpAmount,
    demoTotalUsd: 0,
    isStablecoin,
    cryptoIcons: CRYPTO_ICONS,
    getAllMarkets: xcannesApi.getAllMarkets,
    getTicker: xcannesApi.getTicker,
    getFxEod: xcannesApi.getFxEod,
    rlusdOnChain: currencyLinesSummary?.rlusdOnChain ?? null,
  });

  const xrplConnectionIndicator = useXrplConnectionIndicator({
    isPreviewMode: false,
    isConnecting,
    isConnected,
  });

  // ── Desktop: default action on mount ───────────────────────
  useEffect(() => {
    if (!isDesktopPanel) {
      desktopDefaultActionSetRef.current = false;
      return;
    }
    if (desktopDefaultActionSetRef.current) return;
    if (
      activeAction ||
      showAdjustmentModal ||
      showActivationModal ||
      showActivationRequestModal ||
      walletInfoOpen ||
      showCurrencyStatement
    ) {
      return;
    }
    swapState.setSwapDefaultView("convert");
    swapState.setSwapLockedView(null);
    setActiveAction("swap");
    desktopDefaultActionSetRef.current = true;
  }, [
    activeAction,
    isDesktopPanel,
    showActivationModal,
    showActivationRequestModal,
    showAdjustmentModal,
    showCurrencyStatement,
    walletInfoOpen,
    swapState,
  ]);

  // ── Desktop inline flags ───────────────────────────────────
  const inlineFlags = useDesktopInlineFlags({
    isDesktopPanel,
    qrModalData,
    qrScannerOpen: sendState.qrScannerOpen,
    activeAction,
    sendPaymentRequest: sendState.sendPaymentRequest,
    showAdjustmentModal,
    showActivationModal,
    showActivationRequestModal,
    walletInfoOpen,
    showCurrencyStatement,
    selectedStatementToken,
  });

  // ── Modal props (shared desktop & mobile) ──────────────────
  const modalProps = useWalletModalProps({
    wallet,
    isConnected,
    variant,
    isWalletActivated,
    hasRlusdTrustline,
    hasOnChainRlusd,
    walletLabel,
    walletHasCustomLabel,
    renderWalletMeta,
    signTransaction,
    connect,
    activeAction,
    setActiveAction,
    qrSizingVariant,
    selectableTokens,
    augmentedTokens,
    selectLabelByAssetKey,
    selectLabelRightByAssetKey,
    selectIconByAssetKey,
    selectLabelMobileByAssetKey,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    payreqDecorProps,
    handleCopyAddress,
    handleInstallRequiredTrustline,
    handleActivateCurrencyLine,
    effectiveRefreshCurrencyLines: refreshCurrencyLines,
    effectiveCurrencyLinesLoading: currencyLinesLoading,
    effectiveCurrencyLinesError: currencyLinesError,
    effectiveCurrencyLinesSummary: currencyLinesSummary,
    effectiveCurrencyLines: augmentedCurrencyLines,
    currencyLineCode,
    setCurrencyLineCode,
    currencyLineAllocatedRlusd,
    setCurrencyLineAllocatedRlusd,
    handleUpsertCurrencyLine,
    showAdjustmentModal,
    setShowAdjustmentModal,
    adjustmentDeficitRlusd,
    refreshBalance,
    adjustmentFeeRlusd: ADJUSTMENT_FEE_RLUSD,
    showActivationModal,
    setShowActivationModal,
    handleActivationSendFromWallet,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    activationBundleEnabled,
    setActivationBundleEnabled,
    activationXrpAmount,
    showActivationRequestModal,
    setShowActivationRequestModal,
    showRlusdSetupModal,
    setShowRlusdSetupModal,
    handleRlusdSetupConfirm,
    walletInfoOpen,
    setWalletInfoOpen,
    displayTokensWithCurrencyLines,
    backendWalletAddress,
    isFullPageView,
    statementVariant,
    usdRates,
    showGlobalStatement,
    setShowGlobalStatement,
    showCurrencyStatement,
    setShowCurrencyStatement,
    selectedStatementToken,
    setSelectedStatementToken,
    qrModalData,
    closeQrModal,
    // Spread sub-orchestrator state (keys match useWalletModalProps params)
    ...sendState,
    ...swapState,
  });

  // ── Body scroll lock ───────────────────────────────────────
  const allowBackgroundScrollForStatements =
    !isDesktopPanel && (showGlobalStatement || showCurrencyStatement);
  const allowBackgroundScrollForActions =
    !isDesktopPanel &&
    (activeAction === "cash" ||
      (activeAction === "swap" && swapState.swapLockedView === "lines") ||
      (activeAction === "send" && sendState.sendTab === "payreq"));
  const lockForActiveAction = Boolean(
    activeAction && !allowBackgroundScrollForActions,
  );
  const lockForStatements = Boolean(
    (showGlobalStatement || showCurrencyStatement) &&
    !allowBackgroundScrollForStatements,
  );
  const shouldLockBodyScroll =
    !isDesktopPanel &&
    !allowBackgroundScrollOnMobile &&
    Boolean(
      lockForActiveAction ||
      showAdjustmentModal ||
      showActivationModal ||
      showActivationRequestModal ||
      walletInfoOpen ||
      sendState.qrScannerOpen ||
      sendState.showSaveAddressPrompt ||
      lockForStatements,
    );

  useEffect(() => {
    if (!shouldLockBodyScroll) return;
    return lockBodyScroll();
  }, [shouldLockBodyScroll]);

  // ── Render ─────────────────────────────────────────────────
  return (
    <>
      <div
        className={`bg-[#0b0f10] h-full min-h-0 ${layout.containerClass} ${
          showDesktopStatementPanel
            ? "flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,600px)] lg:gap-6"
            : "flex flex-col"
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Header */}
          <WalletDashboardHeader
            layout={layout}
            isConnected={isConnected}
            wallet={wallet}
            onDisconnect={disconnect}
            totalLabel={totalLabel}
            xrplConnectionIndicator={xrplConnectionIndicator}
            walletLabel={walletLabel}
            walletHeaderToast={walletHeaderToast}
            onOpenWalletLabelEditor={handleOpenWalletLabelEditor}
            onCopyAddress={handleCopyAddress}
            onRefreshWallet={handleRefreshWallet}
            isConnecting={isConnecting}
            isRefreshing={isRefreshing}
            isEditingWalletLabel={isEditingWalletLabel}
            isWalletLabelRequired={isWalletLabelRequired}
            isWalletLabelLocked={isWalletLabelLocked}
            walletLabelDraft={walletLabelDraft}
            onWalletLabelDraftChange={setWalletLabelDraft}
            onSaveWalletLabel={handleSaveWalletLabel}
            onCancelWalletLabel={handleCancelWalletLabel}
            showMobileHomeLink={showMobileHomeLink}
          />

          {/* Action row: Send / Receive / Exchange / Buy */}
          <WalletDashboardActionRow layout={layout} onAction={handleAction} />

          {/* Pending payment requests */}
          {sendState.pendingCount > 0 ? (
            <div className="px-1">
              <WalletPendingPayreqs
                pendingPayreqs={sendState.pendingPayreqs}
                onResume={sendState.handleResumePayreq}
                onRemove={sendState.removePayreq}
              />
            </div>
          ) : null}

          {/* Token list */}
          <div className="flex-1 flex flex-col min-h-0">
            <WalletDashboardTokenList
              layout={layout}
              tokens={tokenListTokens}
              renderTokenRow={renderTokenRow}
              headerTitle={
                <button
                  type="button"
                  onClick={handleOpenGlobalStatement}
                  className="text-sm md:text-xs text-white/70 hover:text-white transition-colors"
                >
                  {t(
                    "ui_consult_global_statement_3b89f4a7a2",
                    "Consulter votre Relevé global",
                  )}
                </button>
              }
              className="touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
              disableInternalScroll={allowPageScrollOnMobile && !isDesktopPanel}
            />
          </div>

          <WalletDashboardFooter
            layout={layout}
            xrplConnectionIndicator={xrplConnectionIndicator}
            isFullPageView={isFullPageView}
            onOpenInfo={handleOpenInfo}
          />
          {!isDesktopPanel ? (
            <WalletMobileModals
              {...modalProps}
              showSaveAddressPrompt={sendState.showSaveAddressPrompt}
              setShowSaveAddressPrompt={sendState.setShowSaveAddressPrompt}
              addressToSave={sendState.addressToSave}
              setAddressToSave={sendState.setAddressToSave}
              addressLabel={sendState.addressLabel}
              setAddressLabel={sendState.setAddressLabel}
              saveAddress={sendState.saveAddress}
            />
          ) : null}
        </div>

        {isDesktopPanel ? (
          <WalletDesktopModals {...inlineFlags} {...modalProps} />
        ) : null}
      </div>
      <WalletToastOverlay
        toasts={toasts}
        confirmState={confirmState}
        dismissToast={dismissToast}
        resolveConfirm={resolveConfirm}
      />
    </>
  );
}
