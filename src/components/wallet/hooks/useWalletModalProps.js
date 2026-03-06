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
  wallet,
  isConnected,
  isWalletActivated,
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
  hasPayreq,
  savePayreq,
  removePayreq,

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
  handleDemoConvert,

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
  usdRates,
  showGlobalStatement,
  setShowGlobalStatement,
  showCurrencyStatement,
  setShowCurrencyStatement,
  selectedStatementToken,
  setSelectedStatementToken,

  // --- QR ---
  qrScannerOpen,
  handleAddressScan,

  // --- Toast ---
  toast,
}) {
  // --- Send modal props ---
  const sendModalProps = useMemo(
    () => ({
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
      toast,
    }),
    [
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
      toast,
    ],
  );

  // --- Payreq modal props ---
  const payreqModalProps = useMemo(
    () => ({
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
      savePayreq,
      removePayreq,
    }),
    [
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
      savePayreq,
      removePayreq,
    ],
  );

  // --- Receive modal props ---
  const receiveModalProps = useMemo(
    () => ({
      dashboardVariant: "full",
      receiveTab,
      setReceiveTab,
      renderWalletMeta,
      wallet,
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
      receiveTab,
      setReceiveTab,
      renderWalletMeta,
      wallet,
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
    ],
  );

  // --- Swap modal props ---
  const swapModalProps = useMemo(
    () => ({
      renderWalletMeta,
      defaultView: swapDefaultView,
      lockedView: swapLockedView,
      dashboardVariant: "full",
      isConnected,
      isWalletActivated,
      walletAddress: wallet,
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
      handleDemoConvert,
      convertProcessing,
      rlusdPerUnitRates,
    }),
    [
      renderWalletMeta,
      swapDefaultView,
      swapLockedView,
      isConnected,
      isWalletActivated,
      wallet,
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
      handleDemoConvert,
      convertProcessing,
      rlusdPerUnitRates,
    ],
  );

  // --- Cash modal props ---
  const cashModalProps = useMemo(
    () => ({
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
      walletAddress: wallet || "",
      buyPrefill: cashBuyPrefill,
    }),
    [
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
      wallet,
      cashBuyPrefill,
    ],
  );

  // --- Adjust modal props ---
  const adjustModalProps = useMemo(
    () => ({
      renderWalletMeta,
      walletAddress: wallet,
      signTransaction,
      deficitRlusd: adjustmentDeficitRlusd,
      currencyLines: effectiveCurrencyLines,
      rlusdPerUnitRates,
      refreshBalance,
      refreshCurrencyLines: effectiveRefreshCurrencyLines,
      adjustmentFeeRlusd,
      toast,
    }),
    [
      renderWalletMeta,
      wallet,
      signTransaction,
      adjustmentDeficitRlusd,
      effectiveCurrencyLines,
      rlusdPerUnitRates,
      refreshBalance,
      effectiveRefreshCurrencyLines,
      adjustmentFeeRlusd,
      toast,
    ],
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
    }),
    [
      handleActivationSendFromWallet,
      handleActivationRequestFromThirdParty,
      handleActivationBuyViaMoonpay,
      activationBundleEnabled,
      setActivationBundleEnabled,
      activationXrpAmount,
    ],
  );

  // --- Activation Request modal props ---
  const activationRequestModalProps = useMemo(
    () => ({
      walletAddress: wallet,
      activationAmountXrp: activationXrpAmount,
    }),
    [
      wallet,
      activationXrpAmount,
    ],
  );

  // --- Info modal props ---
  const infoModalProps = useMemo(
    () => ({}),
    [],
  );

  // --- Statement shared props ---
  const statementSharedProps = useMemo(
    () => ({
      augmentedTokens: displayTokensWithCurrencyLines || augmentedTokens,
      backendWalletAddress,
      wallet,
      walletDisplayLabel: walletHasCustomLabel ? walletLabel : "",
      isWalletActivated,
      isFullPageView: true,
      statementVariant: "full",
      usdRates,
      showGlobalStatement,
      setShowGlobalStatement,
      showCurrencyStatement,
      setShowCurrencyStatement,
      selectedStatementToken,
      setSelectedStatementToken,
      toast,
    }),
    [
      displayTokensWithCurrencyLines,
      augmentedTokens,
      backendWalletAddress,
      wallet,
      walletHasCustomLabel,
      walletLabel,
      isWalletActivated,
      usdRates,
      showGlobalStatement,
      setShowGlobalStatement,
      showCurrencyStatement,
      setShowCurrencyStatement,
      selectedStatementToken,
      setSelectedStatementToken,
      toast,
    ],
  );

  // --- RLUSD Setup modal props ---
  const rlusdSetupModalProps = useMemo(
    () => ({
      onConfirm: handleRlusdSetupConfirm,
    }),
    [handleRlusdSetupConfirm],
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

    // Cash modal uses different availableTokens in desktop vs mobile
    selectableTokens,
    augmentedTokens,
  };
}
