/**
 * WalletDesktopModals
 * -------------------
 * Version desktop (inline dans le panneau <aside>) de toutes les modales
 * du wallet. Les props universelles sont fournies par useWalletModalProps ;
 * seuls les flags d'ouverture en mode inline sont gérés ici.
 */

import QRScanner from "../components/QRScanner";
import { useCallback, useState } from "react";
import WalletDashboardSendModal from "../modals/WalletDashboardSendModal";
import WalletDashboardPayreqModal from "../modals/WalletDashboardPayreqModal";
import WalletDashboardReceiveModal from "../modals/WalletDashboardReceiveModal";
import WalletDashboardSwapModal from "../modals/WalletDashboardSwapModal";
import WalletDashboardCashChoiceModal from "../modals/WalletDashboardCashChoiceModal";
import WalletDashboardSendChoiceModal from "../modals/WalletDashboardSendChoiceModal";
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
  showInlineSendChoice,
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
  signTransaction,

  // open/close handlers
  activeAction,
  setActiveAction,
  setShowActivationModal,
  setShowActivationRequestModal,
  setWalletInfoOpen,
  setDesktopSettingsPage,
  setSendPaymentRequest,
  setCashBuyPrefill,
  setCashSellSelectTitleOverride,
  setCashSellDestinationMode,
  resetSendForm,
  resetReceiveForm,
  resetSwapForm,
  resetCashForm,
  setQrScannerOpen,
  handleAddressScan,

  // desktop cash uses wallet tokens compatible with MoonPay
  augmentedTokens,
}) {
  const [usdSwapPrefillAmount, setUsdSwapPrefillAmount] = useState("");
  const [usdSwapAccentVariant, setUsdSwapAccentVariant] = useState("");
  const [usdSwapSourceSelectionMode, setUsdSwapSourceSelectionMode] = useState("");
  const [usdSwapInitialSourceCurrency, setUsdSwapInitialSourceCurrency] = useState("");
  const [usdSwapTargetSelectionMode, setUsdSwapTargetSelectionMode] = useState("");
  const [usdSwapInitialTargetCurrency, setUsdSwapInitialTargetCurrency] = useState("");
  const [usdSwapTitleOverride, setUsdSwapTitleOverride] = useState("");
  const [usdSwapSubtitleOverride, setUsdSwapSubtitleOverride] = useState("");

  const openUsdSwapOut = useCallback(
    (amount, options = {}) => {
      const next = amount == null ? "" : String(amount);
      setUsdSwapPrefillAmount(next);
      setUsdSwapAccentVariant(String(options?.accentVariant || "").trim());
      setUsdSwapSourceSelectionMode(String(options?.sourceSelectionMode || "").trim());
      setUsdSwapInitialSourceCurrency(String(options?.initialSourceCurrency || "").trim());
      setUsdSwapTargetSelectionMode(String(options?.targetSelectionMode || "").trim());
      setUsdSwapInitialTargetCurrency(String(options?.initialTargetCurrency || "").trim());
      setUsdSwapTitleOverride(String(options?.titleOverride || "").trim());
      setUsdSwapSubtitleOverride(String(options?.subtitleOverride || "").trim());
      const dir = String(options?.direction || "").trim().toLowerCase();
      setActiveAction?.(dir === "stable_to_rlusd" ? "cashUsdSwapIn" : "cashUsdSwapOut");
    },
    [setActiveAction],
  );

  const closeSettingsPage = () => {
    setDesktopSettingsPage?.(null);
    try {
      if (
        typeof window !== "undefined" &&
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__
      ) {
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__ = false;
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:restore-inline-view"),
        );
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

      {showInlineSendChoice ? (
        <WalletDashboardSendChoiceModal
          open
          inline
          onClose={() => {
            setActiveAction(null);
          }}
          onChooseQuickScan={() => {
            setActiveAction(null);
            setQrScannerOpen(true);
          }}
          onChooseSimpleSend={() => {
            setActiveAction("send");
          }}
          onChoosePayRequest={() => {
            setActiveAction("send");
          }}
          handlePaymentRequestScan={sendModalProps?.handlePaymentRequestScan}
          setSendDestination={sendModalProps?.setSendDestination}
          setSendDestinationLabel={sendModalProps?.setSendDestinationLabel}
          toast={sendModalProps?.toast}
        />
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
		            setCashSellSelectTitleOverride?.("");
		            setCashSellDestinationMode?.("");
		            setCashBuyPrefill(null);
		            cashModalProps?.setCashModalTab?.("buy");
		            setActiveAction("cash");
		          }}
		          onChooseSell={() => {
		            setCashSellSelectTitleOverride?.("");
		            setCashSellDestinationMode?.("");
		            setCashBuyPrefill(null);
		            cashModalProps?.setCashModalTab?.("sell");
		            setActiveAction("cash");
		          }}
		          onChooseUsdSwapOut={() => {
		            setCashSellSelectTitleOverride?.("");
		            setCashSellDestinationMode?.("");
		            setCashBuyPrefill(null);
		            openUsdSwapOut("", {
		              direction: "stable_to_rlusd",
		              accentVariant: "simpleSwapBlue",
		              targetSelectionMode: "wallet",
		              initialTargetCurrency: "USD",
		              titleOverride: "Recevoir des stablecoins",
		              subtitleOverride:
		                "Choisissez le stablecoin, le montant puis la devise XCANNES créditée sur votre wallet.",
		            });
		          }}
		          onChooseUsdSwapIn={() => {
		            setCashSellSelectTitleOverride?.("");
		            setCashSellDestinationMode?.("");
		            setCashBuyPrefill(null);
		            openUsdSwapOut("", {
		              direction: "rlusd_to_stable",
		              accentVariant: "binanceYellow",
		              sourceSelectionMode: "wallet",
		              initialSourceCurrency: "USD",
		              titleOverride: "Envoyer vers un wallet",
		              subtitleOverride:
		                "Choisissez une devise, le montant, le stablecoin souhaité puis l'adresse de votre wallet de réception.",
		            });
		          }}
	        />
	      ) : null}

      {showInlineCashUsdSwap ? (
        <WalletDashboardUsdSwapModal
          open
          inline
          onClose={() => {
            setUsdSwapPrefillAmount("");
            setUsdSwapAccentVariant("");
            setUsdSwapSourceSelectionMode("");
            setUsdSwapInitialSourceCurrency("");
            setUsdSwapTargetSelectionMode("");
            setUsdSwapInitialTargetCurrency("");
            setUsdSwapTitleOverride("");
            setUsdSwapSubtitleOverride("");
            setActiveAction("cashChoice");
          }}
          walletLabel={cashModalProps?.walletLabel || ""}
          walletAddress={cashModalProps?.walletAddress || ""}
          initialDirection={
            activeAction === "cashUsdSwapIn" ? "stable_to_rlusd" : "rlusd_to_stable"
          }
          initialAmount={usdSwapPrefillAmount}
          accentVariant={usdSwapAccentVariant}
          sourceSelectionMode={usdSwapSourceSelectionMode}
          initialSourceCurrency={usdSwapInitialSourceCurrency}
          targetSelectionMode={usdSwapTargetSelectionMode}
          initialTargetCurrency={usdSwapInitialTargetCurrency}
          titleOverride={usdSwapTitleOverride}
          subtitleOverride={usdSwapSubtitleOverride}
          signTransaction={signTransaction}
          availableTokens={augmentedTokens}
          rlusdPerUnitRates={cashModalProps?.rlusdPerUnitRates}
          selectLabelByCurrency={cashModalProps?.selectLabelByCurrency}
          selectLabelRightByCurrency={cashModalProps?.selectLabelRightByCurrency}
          selectIconByCurrency={cashModalProps?.selectIconByCurrency}
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
          signTransaction={signTransaction}
          availableTokens={augmentedTokens}
          onOpenUsdSwapOut={openUsdSwapOut}
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
