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
import {
  WalletDesktopHelpPage,
  WalletDesktopSecurityPage,
  WalletDesktopTermsPage,
} from "./WalletDesktopSupportPages";

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
  showInlineSecurity,
  showInlineHelp,
  showInlineTerms,
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
  activeAction,
  setActiveAction,
  setShowActivationModal,
  setShowActivationRequestModal,
  setWalletInfoOpen,
  setDesktopSettingsPage,
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
  const closeSettingsPage = () => {
    setDesktopSettingsPage?.(null);
    try {
      if (
        typeof window !== "undefined" &&
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__
      ) {
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__ = false;
        window.dispatchEvent(new CustomEvent("xcannes:wallet-settings-open"));
      }
    } catch {
      // ignore
    }
  };

  return (
    <aside
      id="wallet-desktop-inline-panel"
      className="hidden lg:flex lg:flex-col min-h-0 h-full relative overflow-hidden border-l border-white/10"
    >
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
          onChooseUsdSwapOut={() => {
            setActiveAction("cashUsdSwapOut");
          }}
          onChooseUsdSwapIn={() => {
            setActiveAction("cashUsdSwapIn");
          }}
        />
      ) : null}

      {showInlineCashUsdSwap ? (
        <WalletDashboardUsdSwapModal
          open
          inline
          onClose={() => setActiveAction("cashChoice")}
          walletLabel={cashModalProps?.walletLabel || ""}
          walletAddress={cashModalProps?.walletAddress || ""}
          initialDirection={
            activeAction === "cashUsdSwapIn" ? "stable_to_rlusd" : "rlusd_to_stable"
          }
        />
      ) : null}

      {showInlineCash ? (
        <WalletDashboardCashModal
          open
          inline
          onClose={() => {
            resetCashForm?.();
            setActiveAction("cashChoice");
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

      {showInlineSecurity ? (
        <div className="flex-1 min-h-0">
          <WalletDesktopSecurityPage onBack={closeSettingsPage} />
        </div>
      ) : null}

      {showInlineHelp ? (
        <div className="flex-1 min-h-0">
          <WalletDesktopHelpPage onBack={closeSettingsPage} />
        </div>
      ) : null}

      {showInlineTerms ? (
        <div className="flex-1 min-h-0">
          <WalletDesktopTermsPage onBack={closeSettingsPage} />
        </div>
      ) : null}

      {/* Desktop: "Infos & frais" in the right panel */}
      <WalletInfoModal
        isOpen={showInlineInfo}
        inline
        onClose={() => {
          setWalletInfoOpen(false);
          closeSettingsPage();
        }}
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
