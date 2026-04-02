/**
 * useDesktopInlineFlags — Computes all showInline* booleans for the desktop
 * side-panel layout (which inline panel is currently visible).
 */
export function useDesktopInlineFlags({
  isDesktopPanel,
  qrScannerOpen,
  activeAction,
  sendPaymentRequest,
  showActivationModal,
  showActivationRequestModal,
  walletInfoOpen,
  desktopSettingsPage,
  showCurrencyStatement,
  selectedStatementToken,
}) {
  const showInlineQrScanner =
    isDesktopPanel && qrScannerOpen;
  const hasPayreq = Boolean(sendPaymentRequest);
  const showInlineSend =
    isDesktopPanel &&
    !showInlineQrScanner &&
    activeAction === "send";
  const showInlinePayreq = false;
  const showInlineReceive =
    isDesktopPanel &&
    !showInlineQrScanner &&
    activeAction === "receive";
  const showInlineSwap =
    isDesktopPanel &&
    !showInlineQrScanner &&
    activeAction === "swap";
  const showInlineCashChoice =
    isDesktopPanel &&
    !showInlineQrScanner &&
    activeAction === "cashChoice";
  const showInlineCashUsdSwap =
    isDesktopPanel &&
    !showInlineQrScanner &&
    (activeAction === "cashUsdSwapOut" || activeAction === "cashUsdSwapIn");
  const showInlineCash =
    isDesktopPanel &&
    !showInlineQrScanner &&
    activeAction === "cash";
  const showInlineActivation =
    isDesktopPanel &&
    !showInlineQrScanner &&
    showActivationModal;
  const showInlineActivationRequest =
    isDesktopPanel &&
    !showInlineQrScanner &&
    showActivationRequestModal;
  const showInlineSecurity =
    isDesktopPanel &&
    !showInlineQrScanner &&
    desktopSettingsPage === "security";
  const showInlineHelp =
    isDesktopPanel &&
    !showInlineQrScanner &&
    desktopSettingsPage === "help";
  const showInlineTerms =
    isDesktopPanel &&
    !showInlineQrScanner &&
    desktopSettingsPage === "terms";
  const showInlineInfo =
    isDesktopPanel &&
    !showInlineQrScanner &&
    !desktopSettingsPage &&
    walletInfoOpen;
  const hasInlineModal =
    showInlineQrScanner ||
    showInlineSend ||
    showInlinePayreq ||
    showInlineReceive ||
    showInlineSwap ||
    showInlineCashChoice ||
    showInlineCashUsdSwap ||
    showInlineCash ||
    showInlineActivation ||
    showInlineActivationRequest ||
    showInlineSecurity ||
    showInlineHelp ||
    showInlineTerms ||
    showInlineInfo;
  const showInlineCurrencyStatement =
    isDesktopPanel &&
    !hasInlineModal &&
    showCurrencyStatement &&
    selectedStatementToken;
  const showInlineGlobalStatement =
    isDesktopPanel && !hasInlineModal && !showInlineCurrencyStatement;

  return {
    showInlineQrScanner,
    showInlineSend,
    showInlinePayreq,
    showInlineReceive,
    showInlineSwap,
    showInlineCashChoice,
    showInlineCashUsdSwap,
    showInlineCash,
    showInlineActivation,
    showInlineActivationRequest,
    showInlineSecurity,
    showInlineHelp,
    showInlineTerms,
    showInlineInfo,
    showInlineCurrencyStatement,
    showInlineGlobalStatement,
  };
}
