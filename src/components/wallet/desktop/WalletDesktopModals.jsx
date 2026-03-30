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
import WalletDashboardCashChoiceModal from "../modals/WalletDashboardCashChoiceModal";
import WalletDashboardUsdSwapModal from "../modals/WalletDashboardUsdSwapModal";
import WalletDashboardCashModal from "../modals/WalletDashboardCashModal";
import WalletActivationModal from "../modals/WalletActivationModal";
import WalletActivationRequestModal from "../modals/WalletActivationRequestModal";
import WalletInfoModal from "../modals/WalletInfoModal";
import WalletDashboardStatementModals from "../modals/WalletDashboardStatementModals";

export default function WalletDesktopModals({
  // visibility flags (calculés par WalletDashboard)
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
  showInlineInfo,
  showInlineCurrencyStatement,
  showInlineGlobalStatement,

  // shared modal prop bundles (from useWalletModalProps)
  sendModalProps,
  payreqModalProps,
  receiveModalProps,
  swapModalProps,
  cashModalProps,
  activationModalProps,
  activationRequestModalProps,
  infoModalProps,
  statementSharedProps,

  // open/close handlers
  setActiveAction,
  setShowActivationModal,
  setShowActivationRequestModal,
  setWalletInfoOpen,
  setSendPaymentRequest,
  setCashBuyPrefill,
  resetSendForm,
  resetReceiveForm,
  resetSwapForm,
  resetCashForm,
  setQrScannerOpen,
  handleAddressScan,

  // desktop cash uses wallet tokens compatible with MoonPay
  augmentedTokens,
}) {
  return (
    <aside className="hidden lg:flex lg:flex-col min-h-0 h-full relative overflow-hidden">
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
          onClose={() => {
            resetSendForm?.();
            setActiveAction(null);
          }}
          {...sendModalProps}
        />
      ) : null}

      {showInlineReceive ? (
        <WalletDashboardReceiveModal
          open
          inline
          onClose={() => {
            resetReceiveForm?.();
            setActiveAction("send");
          }}
          {...receiveModalProps}
        />
      ) : null}

      {showInlineSwap ? (
        <WalletDashboardSwapModal
          open
          inline
          onClose={() => {
            resetSwapForm?.();
            setActiveAction(null);
          }}
          {...swapModalProps}
        />
      ) : null}

      {showInlineCashChoice ? (
        <WalletDashboardCashChoiceModal
          open
          inline
          onClose={() => {
            resetCashForm?.();
            setActiveAction(null);
            setCashBuyPrefill(null);
          }}
          onChooseBuy={() => {
            cashModalProps?.setCashModalTab?.("buy");
            setActiveAction("cash");
          }}
          onChooseSell={() => {
            cashModalProps?.setCashModalTab?.("sell");
            setActiveAction("cash");
          }}
          onChooseUsdSwap={() => setActiveAction("cashUsdSwap")}
        />
      ) : null}

      {showInlineCashUsdSwap ? (
        <WalletDashboardUsdSwapModal
          open
          inline
          onClose={() => setActiveAction("cashChoice")}
          walletLabel={cashModalProps?.walletLabel || ""}
          walletAddress={cashModalProps?.walletAddress || ""}
        />
      ) : null}

      {showInlineCash ? (
        <WalletDashboardCashModal
          open
          inline
          onClose={() => {
            resetCashForm?.();
            setActiveAction(null);
            setCashBuyPrefill(null);
          }}
          {...cashModalProps}
          availableTokens={augmentedTokens}
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

      {/* Desktop: open "Infos & frais" as a real modal (portal to body). */}
      <WalletInfoModal
        isOpen={showInlineInfo}
        onClose={() => setWalletInfoOpen(false)}
        {...infoModalProps}
      />

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
