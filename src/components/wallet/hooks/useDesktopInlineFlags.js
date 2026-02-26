/**
 * useDesktopInlineFlags — Computes all showInline* booleans for the desktop
 * side-panel layout (which inline panel is currently visible).
 */
export function useDesktopInlineFlags({
  isDesktopPanel,
  qrModalData,
  qrScannerOpen,
  activeAction,
  sendPaymentRequest,
  showAdjustmentModal,
  showActivationModal,
  showActivationRequestModal,
  walletInfoOpen,
  showCurrencyStatement,
  selectedStatementToken,
}) {
  const isXummInlineOpen = Boolean(
    qrModalData && (qrModalData.visible ?? true),
  );
  const showInlineXumm = isDesktopPanel && isXummInlineOpen;
  const showInlineQrScanner =
    isDesktopPanel && !showInlineXumm && qrScannerOpen;
  const hasPayreq = Boolean(sendPaymentRequest);
  const showInlineSend =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "send" &&
    !hasPayreq;
  const showInlinePayreq =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "send" &&
    hasPayreq;
  const showInlineReceive =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "receive";
  const showInlineSwap =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "swap";
  const showInlineCash =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    activeAction === "cash";
  const showInlineAdjust =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    showAdjustmentModal;
  const showInlineActivation =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    showActivationModal;
  const showInlineActivationRequest =
    isDesktopPanel &&
    !showInlineXumm &&
    !showInlineQrScanner &&
    showActivationRequestModal;
  const showInlineInfo =
    isDesktopPanel && !showInlineXumm && !showInlineQrScanner && walletInfoOpen;
  const hasInlineModal =
    showInlineXumm ||
    showInlineQrScanner ||
    showInlineSend ||
    showInlinePayreq ||
    showInlineReceive ||
    showInlineSwap ||
    showInlineCash ||
    showInlineAdjust ||
    showInlineActivation ||
    showInlineActivationRequest ||
    showInlineInfo;
  const showInlineCurrencyStatement =
    isDesktopPanel &&
    !hasInlineModal &&
    showCurrencyStatement &&
    selectedStatementToken;
  const showInlineGlobalStatement =
    isDesktopPanel && !hasInlineModal && !showInlineCurrencyStatement;

  return {
    showInlineXumm,
    showInlineQrScanner,
    showInlineSend,
    showInlinePayreq,
    showInlineReceive,
    showInlineSwap,
    showInlineCash,
    showInlineAdjust,
    showInlineActivation,
    showInlineActivationRequest,
    showInlineInfo,
    showInlineCurrencyStatement,
    showInlineGlobalStatement,
  };
}
