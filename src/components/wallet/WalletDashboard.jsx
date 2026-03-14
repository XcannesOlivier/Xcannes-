import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useWallet } from "@/context/WalletContext";
import { apiUrl } from "@/lib/runtimeConfig";
import TransactionProgressModal from "./modals/TransactionProgressModal";

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
import ReconciliationBanner from "./components/ReconciliationBanner";
import { useTranslation } from "next-i18next";
import {
  WALLET_LAYOUT,
  USD_STABLECOINS,
  WALLET_ACCEPTED_TOKENS,
} from "./walletDashboardConfig";

// Sub-orchestrator hooks
import { useWalletSendOrchestrator } from "./hooks/useWalletSendOrchestrator";
import { useWalletSwapOrchestrator } from "./hooks/useWalletSwapOrchestrator";
import { useWalletIncomingToast } from "./hooks/useWalletIncomingToast";
import { useDesktopInlineFlags } from "./hooks/useDesktopInlineFlags";
import { useAugmentedCurrencyLines } from "./hooks/useAugmentedCurrencyLines";
import { useReconciliation } from "./hooks/useReconciliation";
import { usePreferredCurrency } from "./hooks/usePreferredCurrency";

function isAcceptedOnChainToken(currency) {
  const code = String(currency || "").toUpperCase();
  return WALLET_ACCEPTED_TOKENS.has(code);
}

export default function WalletDashboard({
  showDesktopStatement = false,
  qrSizingVariant = "default",
  showMobileHomeLink = false,
  allowBackgroundScrollOnMobile = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const statementVariant = WALLET_LAYOUT.statementVariant;
  const showDesktopStatementPanel = Boolean(showDesktopStatement);

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
    walletAddresses,
    switchWallet,
  } = useWallet();

  const { toasts, confirmState, toast, confirm, dismissToast, resolveConfirm } =
    useWalletToast();

  // ── Transaction progress modal state ────────────────────────
  const [txProgress, setTxProgress] = useState({
    visible: false,
    status: "pending",
    actionLabel: "",
    actionKey: "",
    errorMessage: "",
  });

  const TX_ACTION_LABELS = useMemo(() => ({
    "wallet:convert": t("ui_tx_label_conversion", "Conversion"),
    "wallet:send": t("ui_tx_label_payment", "Paiement"),
    "wallet:reconcile": t("ui_tx_label_reconciliation", "Réconciliation"),
    "wallet:activate_xrp": t("ui_tx_label_activation", "Activation"),
    "wallet:setup": t("ui_tx_label_setup", "Configuration"),
  }), [t]);

  const handleTxProgressClose = useCallback(() => {
    setTxProgress((prev) => {
      // Auto-close the swap panel after a successful conversion
      if (prev.status === "success" && prev.actionKey === "wallet:convert") {
        setActiveAction(null);
      }
      return { ...prev, visible: false };
    });
  }, []);

  /**
   * Poll XRPL tx-status endpoint until the transaction is validated
   * on-ledger, or give up after ~12 s.
   */
  const waitForTxValidation = useCallback(async (hash) => {
    const MAX_POLLS = 12;
    const INTERVAL = 1000; // 1 s
    for (let i = 0; i < MAX_POLLS; i++) {
      try {
        const res = await fetch(apiUrl(`/wallet/tx-status?hash=${encodeURIComponent(hash)}`));
        if (res.ok) {
          const data = await res.json();
          if (data.validated) return true;
        }
      } catch {
        /* network hiccup — keep polling */
      }
      await new Promise((r) => setTimeout(r, INTERVAL));
    }
    return false; // timeout — show success anyway (tesSUCCESS was received)
  }, []);

  /**
   * Wrapper around signTransaction — Xumm-style progress overlay
   * AFTER Face ID validation (post-sign). Flow:
   *   1. signTransaction() → QR → Face ID → XRPL submit (no modal yet)
   *   2. signed:true → show "pending" with 3 blinking dots
   *   3. poll XRPL for validated:true on the tx hash (non-blocking)
   *   4. validated → "Validé" + confetti
   *
   * IMPORTANT: polling runs in background — does NOT block the return.
   * Each hook's post-sign logic (toast, form reset, refreshBalance) runs immediately.
   */
  const signTransactionWithProgress = useCallback(
    async (txjson, options) => {
      const actionKey = options?.action || "";
      const label = TX_ACTION_LABELS[actionKey] || t("ui_tx_label_default", "Transaction");

      try {
        const result = await signTransaction(txjson, options);

        if (result?.signed) {
          // Show "en cours" with 3 blinking dots
          setTxProgress({
            visible: true,
            status: "pending",
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: "",
          });

          // Fire-and-forget: poll XRPL then switch to success
          const txHash = result.hash || "";
          (async () => {
            if (txHash) {
              await waitForTxValidation(txHash);
            }
            setTxProgress((prev) =>
              prev.visible ? { ...prev, status: "success" } : prev,
            );
          })();
        } else if (result?.rejected) {
          // XRPL rejected the transaction (tem*, tef*, tel*)
          setTxProgress({
            visible: true,
            status: "error",
            actionLabel: label,
            actionKey: actionKey,
            errorMessage: result.engineMessage || result.engineResult || t("ui_tx_rejected", "Transaction rejetée"),
          });
        }
        // If result is null (cancelled/expired), don't show anything

        return result;
      } catch (err) {
        setTxProgress({
          visible: true,
          status: "error",
          actionLabel: label,
          actionKey: actionKey,
          errorMessage: err?.message || String(err),
        });
        throw err;
      }
    },
    [signTransaction, TX_ACTION_LABELS, t, waitForTxValidation],
  );

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
  const [showActivationModal, setShowActivationModal] = useState(false);
  const [showActivationRequestModal, setShowActivationRequestModal] =
    useState(false);
  const [showGlobalStatement, setShowGlobalStatement] = useState(false);
  const [showCurrencyStatement, setShowCurrencyStatement] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [selectedStatementToken, setSelectedStatementToken] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isDesktopPanel, setIsDesktopPanel] = useState(false);
  const desktopDefaultActionSetRef = useRef(false);


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

  // ── Currency lines (backend) — called first so label can feed useWalletLabel
  const backendWalletAddress = wallet || null;

  const {
    lines: currencyLines,
    summary: currencyLinesSummary,
    reconciliation: reconciliationData,
    walletLabel: clWalletLabel,
    defaultCurrency: clDefaultCurrency,
    loading: currencyLinesLoading,
    error: currencyLinesError,
    initialReady: currencyLinesReady,
    refresh: refreshCurrencyLines,
    upsertCurrencyLine,
  } = useWalletCurrencyLines(backendWalletAddress);

  // ── Wallet label (fed by currency-lines, no extra XRPL call) ──
  const {
    walletLabel,
    isWalletLabelLocked,
    defaultCurrency,
    walletHeaderToast,
    flashWalletHeaderToast,
    loadWalletLabel,
  } = useWalletLabel({
    walletAddress: wallet,
    isConnected,
    defaultLabel: t("nav_wallet", "Wallet"),
    externalLabel: clWalletLabel,
    externalDefaultCurrency: clDefaultCurrency,
    onRefresh: refreshCurrencyLines,
  });
  const defaultWalletLabel = t("nav_wallet", "Wallet");
  const walletHasCustomLabel = Boolean(
    String(walletLabel || "").trim() &&
    String(walletLabel || "").trim() !== defaultWalletLabel,
  );
  const { renderWalletMeta } = useWalletMeta({
    walletAddress: wallet,
    walletLabel,
    hideAddress: true,
  });

  // ── Preferred currency ─────────────────────────────────────
  const {
    preferredCurrency,
    setPreferredCurrency,
    topCurrencies: prefTopCurrencies,
    fawazCurrencies: prefFawazCurrencies,
    fawazLoading: prefFawazLoading,
    loadFawazCurrencies: prefLoadFawazCurrencies,
  } = usePreferredCurrency({
    defaultCurrency,
  });

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
      toast,
    });

  // ── Reconciliation (external spend detection) ──────────────
  const reconciliation = useReconciliation({
    reconciliation: reconciliationData,
    address: wallet,
    signTransaction: signTransactionWithProgress,
    onComplete: () => {
      refreshBalance();
      refreshCurrencyLines();
    },
  });

  // ── Augmented currency lines (defaults + sorting + deficit) ─
  const {
    augmentedCurrencyLines,
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

  // ===== SUB-ORCHESTRATORS ===================================
  // swapState MUST be created before useRlusdPerUnitRates so that
  // the currently selected swap currencies (which may not yet exist
  // as wallet lines) are included in the rate-fetching codes.

  const swapState = useWalletSwapOrchestrator({
    isConnected,
    backendWalletAddress,
    wallet,
    signTransaction: signTransactionWithProgress,
    refreshBalance,
    hasOnChainRlusd,
    swapCurrencyOptions,
    currencyLinesSummary,
    allocatedRlusdByCurrency,
    refreshCurrencyLines,
    toast,
  });

  // Augment currency line codes with whatever the user has currently
  // selected in the swap modal — this ensures we fetch rates for new
  // currencies that are not yet in the wallet.
  const rateCodes = useMemo(() => {
    const codes = new Set(currencyLineCodes || []);
    const base = String(swapState.convertBaseCurrency || "").trim().toUpperCase();
    const quote = String(swapState.convertQuoteCurrency || "").trim().toUpperCase();
    if (base && base !== "USD" && base !== "RLUSD" && base !== "XRP") codes.add(base);
    if (quote && quote !== "USD" && quote !== "RLUSD" && quote !== "XRP") codes.add(quote);
    return Array.from(codes);
  }, [currencyLineCodes, swapState.convertBaseCurrency, swapState.convertQuoteCurrency]);

  const { usdPerUnit: rlusdPerUnitRates, sourceByCode: rlusdPerUnitSources } =
    useRlusdPerUnitRates(rateCodes);

  const sendState = useWalletSendOrchestrator({
    wallet,
    isConnected,
    isDesktopPanel,
    backendWalletAddress,
    signTransaction: signTransactionWithProgress,
    hasOnChainRlusd,
    augmentedTokens,
    selectableTokens,
    rlusdPerUnitRates,
    rlusdPerUnitSources,
    allocatedRlusdByCurrency,
    closeQrModal,
    toast,
    confirm,
    setActiveAction,
  });

  useWalletIncomingToast({ backendWalletAddress, flashWalletHeaderToast });

  // ── Reset previous action state on desktop inline switch ──
  const prevActionRef = useRef(null);
  const { resetSendForm, resetReceiveForm } = sendState;
  const { resetSwapForm, resetCashForm } = swapState;
  useEffect(() => {
    const prev = prevActionRef.current;
    prevActionRef.current = activeAction;
    if (prev && prev !== activeAction) {
      if (prev === "send") resetSendForm?.();
      if (prev === "receive") resetReceiveForm?.();
      if (prev === "swap") resetSwapForm?.();
      if (prev === "cash") resetCashForm?.();
    }
  }, [activeAction, resetSendForm, resetReceiveForm, resetSwapForm, resetCashForm]);

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
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  } = useWalletActivation({
    isConnected,
    wallet,
    signTransaction: signTransactionWithProgress,
    refreshBalance,
    loadWalletLabel,
    hasRlusdTrustline,
    toast,
    confirm,
    closeInlineQr: sendState.closeInlineQr,
    setWalletInfoOpen,
    setShowActivationModal,
    setShowActivationRequestModal,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setCashModalTab: swapState.setCashModalTab,
    setActiveAction,
  });

  // ── Navigation ─────────────────────────────────────────────
  const {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
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
    closeInlineQr: sendState.closeInlineQr,
    setActiveAction,
    setWalletInfoOpen,
    setSwapDefaultView: swapState.setSwapDefaultView,
    setSwapLockedView: swapState.setSwapLockedView,
    setCashBuyPrefill: swapState.setCashBuyPrefill,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowGlobalStatement,
    setShowCurrencyStatement,
    setSelectedStatementToken,
    setConvertBaseCurrency: swapState.setConvertBaseCurrency,
    setConvertQuoteCurrency: swapState.setConvertQuoteCurrency,
    setConvertAmount: swapState.setConvertAmount,
    flashWalletHeaderToast,
    t,
    toast,
  });

  // ── Token row renderer ─────────────────────────────────────
  const renderTokenRow = useCallback(
    (token) => (
      <WalletDashboardTokenRow
        key={token.key}
        token={token}
        onClick={() => handleOpenCurrencyStatement(token)}
      />
    ),
    [
      handleOpenCurrencyStatement,
    ],
  );

  // ── Total label ────────────────────────────────────────────
  const { usdRates, totalLabel, totalInUsd } = useUsdTotalLabel({
    augmentedTokens,
    isPreviewMode: false,
    stableUsd,
    demoTotalUsd: 0,
    isStablecoin,
    fiatRates: rlusdPerUnitRates,
    rlusdOnChain: currencyLinesSummary?.rlusdOnChain ?? null,
    preferredCurrency,
    locale,
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
    showCurrencyStatement,
    walletInfoOpen,
    swapState,
  ]);

  // ── Desktop inline flags ───────────────────────────────────
  const inlineFlags = useDesktopInlineFlags({
    isDesktopPanel,
    qrScannerOpen: sendState.qrScannerOpen,
    activeAction,
    sendPaymentRequest: sendState.sendPaymentRequest,
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
    isWalletActivated,
    hasOnChainRlusd,
    walletLabel,
    walletHasCustomLabel,
    renderWalletMeta,
    signTransaction: signTransactionWithProgress,
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
    showActivationModal,
    setShowActivationModal,
    handleActivationSendFromWallet,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    showActivationRequestModal,
    setShowActivationRequestModal,
    handleRlusdSetupConfirm,
    walletInfoOpen,
    setWalletInfoOpen,
    displayTokensWithCurrencyLines,
    backendWalletAddress,
    isFullPageView: true,
    statementVariant,
    usdRates,
    preferredCurrency,
    showGlobalStatement,
    setShowGlobalStatement,
    showCurrencyStatement,
    setShowCurrencyStatement,
    selectedStatementToken,
    setSelectedStatementToken,
    toast,
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

  // Gate: wait until currency-lines data is available (from cache or API)
  // to avoid a flash of empty wallet state on page load.
  if (backendWalletAddress && !currencyLinesReady) {
    return (
      <div className="bg-xcannes-surface-demo h-full min-h-0 flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <div
        className={`bg-xcannes-surface-demo h-full min-h-0 overflow-hidden ${
          showDesktopStatementPanel
            ? "flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(480px,600px)] lg:gap-0"
            : "flex flex-col"
        }`}
      >
        <div className="flex flex-col min-h-0">
          {/* Header */}
          <WalletDashboardHeader
            isConnected={isConnected}
            wallet={wallet}
            totalLabel={totalLabel}
            totalInUsd={totalInUsd}
            xrplConnectionIndicator={xrplConnectionIndicator}
            walletLabel={walletLabel}
            walletHeaderToast={walletHeaderToast}
            onCopyAddress={handleCopyAddress}
            onRefreshWallet={handleRefreshWallet}
            isConnecting={isConnecting}
            isRefreshing={isRefreshing}
            isWalletLabelLocked={isWalletLabelLocked}
            showMobileHomeLink={showMobileHomeLink}
            walletAddresses={walletAddresses}
            onSwitchWallet={switchWallet}
            onOpenInfo={handleOpenInfo}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            onActivateWallet={handleOpenActivationModal}
            onConfirmSetup={handleRlusdSetupConfirm}
            activeAction={activeAction}
            preferredCurrency={preferredCurrency}
            topCurrencies={prefTopCurrencies}
            fawazCurrencies={prefFawazCurrencies}
            fawazLoading={prefFawazLoading}
            onLoadFawazCurrencies={prefLoadFawazCurrencies}
            onPreferredCurrencyChange={setPreferredCurrency}
          />

          {/* Action row: Send / Receive / Exchange / Buy */}
          <WalletDashboardActionRow onAction={handleAction} />

          {/* Reconciliation banner (external RLUSD spend detected) */}
          <ReconciliationBanner
            visible={reconciliation.visible}
            deficit={reconciliation.deficit}
            operationsSummary={reconciliation.operationsSummary}
            submitting={reconciliation.submitting}
            error={reconciliation.error}
            txHash={reconciliation.txHash}
            onConfirm={reconciliation.confirm}
            onDismiss={reconciliation.dismiss}
          />

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
              tokens={tokenListTokens}
              renderTokenRow={renderTokenRow}
              headerTitle={
                <button
                  type="button"
                  onClick={handleOpenGlobalStatement}
                  className="text-sm md:text-xs text-white/80 hover:text-white transition-colors"
                >
                  {t(
                    "ui_consult_global_statement_3b89f4a7a2",
                    "Consulter votre Relevé global",
                  )}
                </button>
              }
              className="touch-pan-y"
              style={{ WebkitOverflowScrolling: "touch" }}
            />
          </div>

          <WalletDashboardFooter />
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
      <TransactionProgressModal
        visible={txProgress.visible}
        status={txProgress.status}
        actionLabel={txProgress.actionLabel}
        errorMessage={txProgress.errorMessage}
        onClose={handleTxProgressClose}
      />
      <WalletToastOverlay
        toasts={toasts}
        confirmState={confirmState}
        dismissToast={dismissToast}
        resolveConfirm={resolveConfirm}
      />
    </>
  );
}
