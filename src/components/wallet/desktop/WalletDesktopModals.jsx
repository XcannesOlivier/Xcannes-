/**
 * WalletDesktopModals
 * -------------------
 * Version desktop (inline dans le panneau <aside>) de toutes les modales
 * du wallet. Les props universelles sont fournies par useWalletModalProps ;
 * seuls les flags d'ouverture en mode inline sont gérés ici.
 */

import QRScanner from "../components/QRScanner";
import { useCallback, useRef, useState } from "react";
import WalletDashboardSendModal from "../modals/WalletDashboardSendModal";
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
  const scanFromSendChoiceRef = useRef(false);
  const qrScanResultCallbackRef = useRef(null);
  const scanFromPayreqRef = useRef(false);
  const qrPayreqResultCallbackRef = useRef(null);

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

  const resetCashChoiceState = useCallback(() => {
    setCashSellSelectTitleOverride?.("");
    setCashSellDestinationMode?.("");
    setCashBuyPrefill(null);
  }, [setCashSellSelectTitleOverride, setCashSellDestinationMode, setCashBuyPrefill]);

  const handleCashTab = useCallback((tab) => {
    resetCashChoiceState();
    cashModalProps?.setCashModalTab?.(tab);
    setActiveAction("cash");
  }, [resetCashChoiceState, cashModalProps, setActiveAction]);

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
      className="inline-panel hidden lg:flex lg:flex-col min-h-0 h-full relative overflow-hidden"
    >
      {showInlineQrScanner ? (
        <div className="flex-1 min-h-0">
          <QRScanner
            isOpen
            embedded
            onScan={(data) => {
              if (scanFromPayreqRef.current) {
                scanFromPayreqRef.current = false;
                setQrScannerOpen(false);
                setActiveAction?.('sendChoice');
                setTimeout(() => {
                  qrPayreqResultCallbackRef.__inject?.(data);
                }, 120);
                return;
              }
              if (scanFromSendChoiceRef.current) {
                scanFromSendChoiceRef.current = false;
                setQrScannerOpen(false);
                setActiveAction?.('sendChoice');
                setTimeout(() => {
                  qrScanResultCallbackRef.__inject?.(data);
                }, 120);
                return;
              }
              handleAddressScan?.(data);
            }}
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
            scanFromSendChoiceRef.current = true;
            setActiveAction(null);
            setQrScannerOpen(true);
          }}
          onChoosePayreqScan={() => {
            scanFromPayreqRef.current = true;
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
          savedAddresses={sendModalProps?.savedAddresses}
          currentWalletAddress={sendModalProps?.currentWalletAddress}
          toast={sendModalProps?.toast}
          renderWalletMeta={sendModalProps?.renderWalletMeta}
          onQrScanResult={qrScanResultCallbackRef}
          onQrPayreqScanResult={qrPayreqResultCallbackRef}
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
          onBack={() => {
            resetSendForm?.();
            setActiveAction("sendChoice");
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
	          walletLabel={cashModalProps?.walletLabel || ""}
	          onClose={() => {
	            resetCashForm?.();
	            setActiveAction(null);
	            setCashBuyPrefill(null);
	          }}
	          onChooseBuy={() => handleCashTab("buy")}
	          onChooseSell={() => handleCashTab("sell")}
		          onChooseUsdSwapOut={() => {
		            resetCashChoiceState();
		            openUsdSwapOut("", {
		              direction: "stable_to_rlusd",
		              accentVariant: "simpleSwapBlue",
		              targetSelectionMode: "wallet",
		              initialTargetCurrency: "USD",
		              titleOverride: "Vendre vos stablecoins",
			              subtitleOverride:
			                "Sélectionnez le stablecoin, indiquez le montant et choisissez la devise qui sera créditée à votre compte",
			            });
			          }}
			          onChooseUsdSwapIn={() => {
			            resetCashChoiceState();
			            const walletLabelForSubtitle = String(cashModalProps?.walletLabel || "").trim() || "[Nom du compte]";
			            openUsdSwapOut("", {
			              direction: "rlusd_to_stable",
			              accentVariant: "binanceYellow",
			              sourceSelectionMode: "wallet",
			              initialSourceCurrency: "USD",
				              titleOverride: "Acheter des stablecoins",
				              subtitleOverride:
				                `Depuis le compte Voyant Lumineux jaune – ${walletLabelForSubtitle}, sélectionnez la devise et le montant, puis choisissez le stablecoin à recevoir.`,
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
