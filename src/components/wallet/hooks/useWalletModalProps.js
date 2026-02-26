/**
 * useWalletModalProps
 * -------------------
 * Centralise la construction des props partagées entre les versions desktop
 * (inline / aside) et mobile (portalisées) des modales du wallet.
 *
 * L'objectif est d'éliminer la duplication : chaque jeu de props est calculé
 * une seule fois, puis consommé par WalletDesktopModals et WalletMobileModals.
 */

import { useMemo } from "react";

export function useWalletModalProps({
  // --- identité du wallet ---
  effectiveWallet,
  effectiveIsConnected,
  variant,
  isWalletActivated,
  hasRlusdTrustline,
  hasOnChainRlusd,
  walletLabel,
  walletHasCustomLabel,
  renderWalletMeta,
  signTransaction,
  connect,

  // --- actions / state machines ---
  activeAction,
  setActiveAction,

  // --- Send ---
  qrSizingVariant,
  selectableTokens,
  augmentedTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  sendAmount,
  setSendAmount,
  sendPaymentRequest,
  setSendPaymentRequest,
  selectLabelByAssetKey,
  selectLabelRightByAssetKey,
  selectIconByAssetKey,
  selectLabelMobileByAssetKey,
  savedAddresses,
  sendDestination,
  setSendDestination,
  setQrScannerOpen,
  handlePaymentRequestScan,
  handleSendSubmit,
  sendProcessing,
  payreqDecorProps,
  hasPayreq,

  // --- Receive ---
  receiveTab,
  setReceiveTab,
  handleCopyAddress,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  requestMemo,
  setRequestMemo,
  rlusdPerUnitRates,
  rlusdPerUnitSources,

  // --- Swap / Convert ---
  swapDefaultView,
  swapLockedView,
  swapCurrencyOptionsForModal,
  convertBaseCurrency,
  setConvertBaseCurrency,
  convertQuoteCurrency,
  setConvertQuoteCurrency,
  convertAmount,
  setConvertAmount,
  convertPreview,
  convertProcessing,
  handleInstallRequiredTrustline,
  handleActivateCurrencyLine,
  effectiveRefreshCurrencyLines,
  effectiveCurrencyLinesLoading,
  effectiveCurrencyLinesError,
  effectiveCurrencyLinesSummary,
  effectiveCurrencyLines,
  currencyLineCode,
  setCurrencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineAllocatedRlusd,
  handleUpsertCurrencyLine,

  // --- Cash ---
  cashModalTab,
  setCashModalTab,
  cashBuyPrefill,
  setCashBuyPrefill,

  // --- Adjust ---
  showAdjustmentModal,
  setShowAdjustmentModal,
  adjustmentDeficitRlusd,
  refreshBalance,
  adjustmentFeeRlusd,

  // --- Activation ---
  showActivationModal,
  setShowActivationModal,
  handleActivationSendFromWallet,
  handleActivationRequestFromThirdParty,
  handleActivationBuyViaMoonpay,
  activationBundleEnabled,
  setActivationBundleEnabled,
  activationXrpAmount,

  // --- Activation Request ---
  showActivationRequestModal,
  setShowActivationRequestModal,

  // --- RLUSD Setup ---
  showRlusdSetupModal,
  setShowRlusdSetupModal,
  handleRlusdSetupConfirm,

  // --- Info ---
  walletInfoOpen,
  setWalletInfoOpen,

  // --- Statements ---
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

  // --- QR ---
  qrModalData,
  closeQrModal,
  qrScannerOpen,
  handleAddressScan,
}) {
  // --- Send modal props ---
  const sendModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
      qrSizingVariant,
      renderWalletMeta,
      augmentedTokens: selectableTokens,
      selectedSendToken,
      sendFxInfo,
      setSendAssetKey,
      sendAmount,
      setSendAmount,
      sendPaymentRequest,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      savedAddresses,
      sendDestination,
      setSendDestination,
      setQrScannerOpen,
      handlePaymentRequestScan,
      handleSendSubmit,
      sendProcessing,
      enableSaveAddress: true,
      ...payreqDecorProps,
    }),
    [
      isWalletActivated,
      hasRlusdTrustline,
      qrSizingVariant,
      renderWalletMeta,
      selectableTokens,
      selectedSendToken,
      sendFxInfo,
      setSendAssetKey,
      sendAmount,
      setSendAmount,
      sendPaymentRequest,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      savedAddresses,
      sendDestination,
      setSendDestination,
      setQrScannerOpen,
      handlePaymentRequestScan,
      handleSendSubmit,
      sendProcessing,
      payreqDecorProps,
    ]
  );

  // --- Payreq modal props ---
  const payreqModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
      renderWalletMeta,
      augmentedTokens: selectableTokens,
      selectedSendToken,
      sendFxInfo,
      setSendAssetKey,
      setSendAmount,
      sendPaymentRequest,
      sendDestination,
      sendAmount,
      sendProcessing,
      handleSendSubmit,
      savedAddresses,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      enableSaveAddress: true,
    }),
    [
      isWalletActivated,
      hasRlusdTrustline,
      renderWalletMeta,
      selectableTokens,
      selectedSendToken,
      sendFxInfo,
      setSendAssetKey,
      setSendAmount,
      sendPaymentRequest,
      sendDestination,
      sendAmount,
      sendProcessing,
      handleSendSubmit,
      savedAddresses,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
    ]
  );

  // --- Receive modal props ---
  const receiveModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
      dashboardVariant: variant,
      receiveTab,
      setReceiveTab,
      renderWalletMeta,
      effectiveWallet,
      handleCopyAddress,
      requestAmount,
      setRequestAmount,
      requestCurrency,
      setRequestCurrency,
      selectLabelByCurrency: selectLabelByAssetKey,
      selectLabelRightByCurrency: selectLabelRightByAssetKey,
      selectIconByCurrency: selectIconByAssetKey,
      selectLabelMobileByCurrency: selectLabelMobileByAssetKey,
      augmentedTokens: selectableTokens,
      requestMemo,
      setRequestMemo,
      rlusdPerUnitRates,
      rlusdPerUnitSources,
      walletLabel,
    }),
    [
      isWalletActivated,
      hasRlusdTrustline,
      variant,
      receiveTab,
      setReceiveTab,
      renderWalletMeta,
      effectiveWallet,
      handleCopyAddress,
      requestAmount,
      setRequestAmount,
      requestCurrency,
      setRequestCurrency,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      selectableTokens,
      requestMemo,
      setRequestMemo,
      rlusdPerUnitRates,
      rlusdPerUnitSources,
      walletLabel,
    ]
  );

  // --- Swap modal props ---
  const swapModalProps = useMemo(
    () => ({
      renderWalletMeta,
      defaultView: swapDefaultView,
      lockedView: swapLockedView,
      dashboardVariant: variant,
      effectiveIsConnected,
      isWalletActivated,
      hasRlusdTrustline,
      walletAddress: effectiveWallet,
      onConnectWallet: connect,
      hasOnChainRlusd,
      onInstallTrustline: handleInstallRequiredTrustline,
      onActivateCurrencyLine: handleActivateCurrencyLine,
      refreshCurrencyLines: effectiveRefreshCurrencyLines,
      currencyLinesLoading: effectiveCurrencyLinesLoading,
      currencyLinesError: effectiveCurrencyLinesError,
      currencyLinesSummary: effectiveCurrencyLinesSummary,
      currencyLines: effectiveCurrencyLines,
      swapCurrencyOptions: swapCurrencyOptionsForModal,
      convertBaseCurrency,
      setConvertBaseCurrency,
      convertQuoteCurrency,
      setConvertQuoteCurrency,
      convertAmount,
      setConvertAmount,
      convertPreview,
      selectLabelByCurrency: selectLabelByAssetKey,
      selectLabelRightByCurrency: selectLabelRightByAssetKey,
      selectIconByCurrency: selectIconByAssetKey,
      selectLabelMobileByCurrency: selectLabelMobileByAssetKey,
      currencyLineCode,
      setCurrencyLineCode,
      currencyLineAllocatedRlusd,
      setCurrencyLineAllocatedRlusd,
      handleUpsertCurrencyLine,
      convertProcessing,
      rlusdPerUnitRates,
    }),
    [
      renderWalletMeta,
      swapDefaultView,
      swapLockedView,
      variant,
      effectiveIsConnected,
      isWalletActivated,
      hasRlusdTrustline,
      effectiveWallet,
      connect,
      hasOnChainRlusd,
      handleInstallRequiredTrustline,
      handleActivateCurrencyLine,
      effectiveRefreshCurrencyLines,
      effectiveCurrencyLinesLoading,
      effectiveCurrencyLinesError,
      effectiveCurrencyLinesSummary,
      effectiveCurrencyLines,
      swapCurrencyOptionsForModal,
      convertBaseCurrency,
      setConvertBaseCurrency,
      convertQuoteCurrency,
      setConvertQuoteCurrency,
      convertAmount,
      setConvertAmount,
      convertPreview,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      currencyLineCode,
      setCurrencyLineCode,
      currencyLineAllocatedRlusd,
      setCurrencyLineAllocatedRlusd,
      handleUpsertCurrencyLine,
      convertProcessing,
      rlusdPerUnitRates,
    ]
  );

  // --- Cash modal props ---
  const cashModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
      cashModalTab,
      setCashModalTab,
      renderWalletMeta,
      walletLabel,
      hideWalletAddress: walletHasCustomLabel,
      rlusdPerUnitRates,
      selectLabelByCurrency: selectLabelByAssetKey,
      selectLabelRightByCurrency: selectLabelRightByAssetKey,
      selectIconByCurrency: selectIconByAssetKey,
      selectLabelMobileByCurrency: selectLabelMobileByAssetKey,
      walletAddress: effectiveWallet || "",
      buyPrefill: cashBuyPrefill,
    }),
    [
      isWalletActivated,
      hasRlusdTrustline,
      cashModalTab,
      setCashModalTab,
      renderWalletMeta,
      walletLabel,
      walletHasCustomLabel,
      rlusdPerUnitRates,
      selectLabelByAssetKey,
      selectLabelRightByAssetKey,
      selectIconByAssetKey,
      selectLabelMobileByAssetKey,
      effectiveWallet,
      cashBuyPrefill,
    ]
  );

  // --- Adjust modal props ---
  const adjustModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
      renderWalletMeta,
      walletAddress: effectiveWallet,
      signTransaction,
      deficitRlusd: adjustmentDeficitRlusd,
      currencyLines: effectiveCurrencyLines,
      rlusdPerUnitRates,
      refreshBalance,
      refreshCurrencyLines: effectiveRefreshCurrencyLines,
      adjustmentFeeRlusd,
    }),
    [
      isWalletActivated,
      hasRlusdTrustline,
      renderWalletMeta,
      effectiveWallet,
      signTransaction,
      adjustmentDeficitRlusd,
      effectiveCurrencyLines,
      rlusdPerUnitRates,
      refreshBalance,
      effectiveRefreshCurrencyLines,
      adjustmentFeeRlusd,
    ]
  );

  // --- Activation modal props ---
  const activationModalProps = useMemo(
    () => ({
      onSendFromWallet: handleActivationSendFromWallet,
      onRequestFromThirdParty: handleActivationRequestFromThirdParty,
      onBuyViaMoonpay: handleActivationBuyViaMoonpay,
      activationBundleEnabled,
      onToggleActivationBundle: setActivationBundleEnabled,
      activationAmountXrp: activationXrpAmount,
      isWalletActivated,
      hasRlusdTrustline,
    }),
    [
      handleActivationSendFromWallet,
      handleActivationRequestFromThirdParty,
      handleActivationBuyViaMoonpay,
      activationBundleEnabled,
      setActivationBundleEnabled,
      activationXrpAmount,
      isWalletActivated,
      hasRlusdTrustline,
    ]
  );

  // --- Activation Request modal props ---
  const activationRequestModalProps = useMemo(
    () => ({
      walletAddress: effectiveWallet,
      walletLabel,
      activationAmountXrp: activationXrpAmount,
      isWalletActivated,
      hasRlusdTrustline,
    }),
    [effectiveWallet, walletLabel, activationXrpAmount, isWalletActivated, hasRlusdTrustline]
  );

  // --- Info modal props ---
  const infoModalProps = useMemo(
    () => ({
      isWalletActivated,
      hasRlusdTrustline,
    }),
    [isWalletActivated, hasRlusdTrustline]
  );

  // --- Statement shared props ---
  const statementSharedProps = useMemo(
    () => ({
      augmentedTokens: displayTokensWithCurrencyLines || augmentedTokens,
      backendWalletAddress,
      effectiveWallet,
      walletDisplayLabel: walletHasCustomLabel ? walletLabel : "",
      isWalletActivated,
      isFullPageView,
      statementVariant,
      usdRates,
      showGlobalStatement,
      setShowGlobalStatement,
      showCurrencyStatement,
      setShowCurrencyStatement,
      selectedStatementToken,
      setSelectedStatementToken,
    }),
    [
      displayTokensWithCurrencyLines,
      augmentedTokens,
      backendWalletAddress,
      effectiveWallet,
      walletHasCustomLabel,
      walletLabel,
      isWalletActivated,
      isFullPageView,
      statementVariant,
      usdRates,
      showGlobalStatement,
      setShowGlobalStatement,
      showCurrencyStatement,
      setShowCurrencyStatement,
      selectedStatementToken,
      setSelectedStatementToken,
    ]
  );

  // --- RLUSD Setup modal props ---
  const rlusdSetupModalProps = useMemo(
    () => ({
      onConfirm: handleRlusdSetupConfirm,
    }),
    [handleRlusdSetupConfirm]
  );

  // --- Xumm QR modal props ---
  const xummQrProps = useMemo(
    () => ({
      onClose: closeQrModal,
      uuid: qrModalData?.uuid,
      qrUrl: qrModalData?.qrUrl,
      deepLink: qrModalData?.deepLink,
      type: qrModalData?.type || "connect",
      status: qrModalData?.status,
      enablePolling: false,
    }),
    [closeQrModal, qrModalData]
  );

  return {
    sendModalProps,
    payreqModalProps,
    receiveModalProps,
    swapModalProps,
    cashModalProps,
    adjustModalProps,
    activationModalProps,
    activationRequestModalProps,
    infoModalProps,
    statementSharedProps,
    rlusdSetupModalProps,
    xummQrProps,

    // open / close handlers needed by both desktop & mobile
    activeAction,
    setActiveAction,
    hasPayreq,
    showAdjustmentModal,
    setShowAdjustmentModal,
    showActivationModal,
    setShowActivationModal,
    showActivationRequestModal,
    setShowActivationRequestModal,
    showRlusdSetupModal,
    setShowRlusdSetupModal,
    walletInfoOpen,
    setWalletInfoOpen,
    setSendPaymentRequest,
    setCashBuyPrefill,
    qrScannerOpen,
    setQrScannerOpen: setQrScannerOpen,
    handleAddressScan,
    qrModalData,

    // Cash modal uses different availableTokens in desktop vs mobile
    selectableTokens,
    augmentedTokens,
  };
}
