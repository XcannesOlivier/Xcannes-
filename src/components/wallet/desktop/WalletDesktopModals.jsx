/**
 * WalletDesktopModals
 * -------------------
 * Version desktop (inline dans le panneau <aside>) de toutes les modales
 * du wallet. Les props universelles sont fournies par useWalletModalProps ;
 * seuls les flags d'ouverture en mode inline sont gérés ici.
 */

import QRScanner from "../components/QRScanner";
import WalletDashboardSendModal from "../modals/WalletDashboardSendModal";
import WalletDashboardPayreqModal from "../modals/WalletDashboardPayreqModal";
import WalletDashboardReceiveModal from "../modals/WalletDashboardReceiveModal";
import WalletDashboardSwapModal from "../modals/WalletDashboardSwapModal";
import WalletDashboardCashModal from "../modals/WalletDashboardCashModal";
import WalletDashboardAdjustModal from "../modals/WalletDashboardAdjustModal";
import WalletActivationModal from "../modals/WalletActivationModal";
import WalletActivationRequestModal from "../modals/WalletActivationRequestModal";
import WalletRlusdSetupModal from "../modals/WalletRlusdSetupModal";
import WalletInfoModal from "../modals/WalletInfoModal";
import WalletDashboardStatementModals from "../modals/WalletDashboardStatementModals";

export default function WalletDesktopModals({
  // visibility flags (calculés par WalletDashboard)
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
  showRlusdSetupModal,

  // shared modal prop bundles (from useWalletModalProps)
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

  // open/close handlers
  setActiveAction,
  setShowAdjustmentModal,
  setShowActivationModal,
  setShowActivationRequestModal,
  setShowRlusdSetupModal,
  setWalletInfoOpen,
  setSendPaymentRequest,
  setCashBuyPrefill,
  setQrScannerOpen,
  handleAddressScan,

  // desktop cash uses selectableTokens
  selectableTokens,
}) {
  return (
    <aside className="hidden lg:flex lg:flex-col min-h-0 relative">
      {showInlineQrScanner ? (
        <div className="flex-1 min-h-0">
          <QRScanner
            isOpen
            embedded
            onScan={handleAddressScan}
            onClose={() => setQrScannerOpen(false)}
            hideTitle
            hideWhenUnavailable
            className="h-full"
          />
        </div>
      ) : null}

      {showInlineSend ? (
        <WalletDashboardSendModal
          open
          inline
          onClose={() => setActiveAction(null)}
          {...sendModalProps}
        />
      ) : null}

      {showInlinePayreq ? (
        <WalletDashboardPayreqModal
          open
          inline
          onClose={() => {
            setSendPaymentRequest(null);
            setActiveAction(null);
          }}
          {...payreqModalProps}
        />
      ) : null}

      {showInlineReceive ? (
        <WalletDashboardReceiveModal
          open
          inline
          onClose={() => setActiveAction(null)}
          {...receiveModalProps}
        />
      ) : null}

      {showInlineSwap ? (
        <WalletDashboardSwapModal
          open
          inline
          onClose={() => setActiveAction(null)}
          {...swapModalProps}
        />
      ) : null}

      {showInlineCash ? (
        <WalletDashboardCashModal
          open
          inline
          onClose={() => {
            setActiveAction(null);
            setCashBuyPrefill(null);
          }}
          {...cashModalProps}
          availableTokens={selectableTokens}
        />
      ) : null}

      {showInlineAdjust ? (
        <WalletDashboardAdjustModal
          open
          inline
          onClose={() => setShowAdjustmentModal(false)}
          {...adjustModalProps}
        />
      ) : null}

      {showInlineActivation ? (
        <WalletActivationModal
          open
          inline
          onClose={() => setShowActivationModal(false)}
          {...activationModalProps}
        />
      ) : null}

      {showInlineActivationRequest ? (
        <WalletActivationRequestModal
          open
          inline
          onClose={() => setShowActivationRequestModal(false)}
          {...activationRequestModalProps}
        />
      ) : null}

      {showRlusdSetupModal ? (
        <WalletRlusdSetupModal
          open
          onClose={() => setShowRlusdSetupModal(false)}
          {...rlusdSetupModalProps}
        />
      ) : null}

      {showInlineInfo ? (
        <WalletInfoModal
          isOpen
          inline
          onClose={() => setWalletInfoOpen(false)}
          {...infoModalProps}
        />
      ) : null}

      {showInlineCurrencyStatement ? (
        <WalletDashboardStatementModals
          {...statementSharedProps}
          inlineCurrencyStatement
          inlineCurrencyStatementClassName="flex-1 min-h-0"
          inlineStatementVariant="inline-desktop"
        />
      ) : null}

      {showInlineGlobalStatement ? (
        <WalletDashboardStatementModals
          {...statementSharedProps}
          inlineGlobalStatement
          inlineGlobalStatementClassName="flex-1 min-h-0"
          inlineStatementVariant="inline-desktop"
        />
      ) : null}
    </aside>
  );
}
