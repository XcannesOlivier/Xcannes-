/**
 * WalletMobileModals
 * ------------------
 * Version mobile (portalisée dans document.body) de toutes les modales
 * du wallet. Les props universelles sont fournies par useWalletModalProps.
 *
 * Inclut également les modales (Info, Activation, ActivationRequest, RLUSD
 * setup) rendues sans portal mais uniquement en mode mobile (sous le header),
 * le QR Scanner mobile, le prompt de sauvegarde d'adresse, et le
 * WalletDashboardStatementModals mobile.
 */

import { createPortal } from "react-dom";
import { useCallback, useState } from "react";
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
import WalletDashboardSaveAddressPrompt from "../components/WalletDashboardSaveAddressPrompt";

export default function WalletMobileModals({
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
  hasPayreq,
  setActiveAction,
  showActivationModal,
  setShowActivationModal,
  showActivationRequestModal,
  setShowActivationRequestModal,
  walletInfoOpen,
  setWalletInfoOpen,
  setSendPaymentRequest,
  setCashBuyPrefill,
  setCashSellSelectTitleOverride,
  setCashSellDestinationMode,
  resetSendForm,
  resetReceiveForm,
  resetSwapForm,
  resetCashForm,

  // QR scanner
  qrScannerOpen,
  setQrScannerOpen,
  handleAddressScan,

  // Save address prompt
  showSaveAddressPrompt,
  setShowSaveAddressPrompt,
  addressToSave,
  setAddressToSave,
  saveAddress,

  // toast
  toast,

  // mobile cash uses augmentedTokens (not selectableTokens)
  augmentedTokens,
}) {
  const [usdSwapPrefillAmount, setUsdSwapPrefillAmount] = useState("");
  const [usdSwapAccentVariant, setUsdSwapAccentVariant] = useState("");

  const openUsdSwapOut = useCallback(
    (amount, options = {}) => {
      const next = amount == null ? "" : String(amount);
      setUsdSwapPrefillAmount(next);
      setUsdSwapAccentVariant(String(options?.accentVariant || "").trim());
      const dir = String(options?.direction || "").trim().toLowerCase();
      setActiveAction?.(dir === "stable_to_rlusd" ? "cashUsdSwapIn" : "cashUsdSwapOut");
    },
    [setActiveAction],
  );

  return (
    <>
      {/* Modales non-portalisées, affichées sous le header en mobile */}
      <WalletInfoModal
        isOpen={walletInfoOpen}
        onClose={() => {
          setWalletInfoOpen(false);
          try {
            if (
              typeof window !== "undefined" &&
              window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__
            ) {
              window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__ = false;
              window.dispatchEvent(
                new CustomEvent("xcannes:wallet-settings-open"),
              );
            }
          } catch {
            // ignore
          }
        }}
        {...infoModalProps}
      />
      <WalletActivationModal
        open={showActivationModal}
        onClose={() => setShowActivationModal(false)}
        {...activationModalProps}
      />
      <WalletActivationRequestModal
        open={showActivationRequestModal}
        onClose={() => setShowActivationRequestModal(false)}
        {...activationRequestModalProps}
      />

      {/* Modales via Portal pour éviter les problèmes de z-index et overflow */}
      {typeof document !== "undefined" &&
        createPortal(
          <>
            <WalletDashboardSendModal
              open={activeAction === "send"}
              onClose={() => {
                resetSendForm?.();
                setActiveAction(null);
              }}
              {...sendModalProps}
            />

            <WalletDashboardReceiveModal
              open={activeAction === "receive"}
              onClose={() => {
                resetReceiveForm?.();
                setActiveAction(null);
              }}
              {...receiveModalProps}
            />

            <WalletDashboardSwapModal
              open={activeAction === "swap"}
              onClose={() => {
                resetSwapForm?.();
                setActiveAction(null);
              }}
              {...swapModalProps}
            />

	            <WalletDashboardCashChoiceModal
	              open={activeAction === "cashChoice"}
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
		                // "Recevoir des dollars" utilise le même parcours que "Ajouter de l'argent"
		                // (pré-sélection USD côté devise créditée).
		                setCashSellSelectTitleOverride?.("");
		                setCashSellDestinationMode?.("");
		                setCashBuyPrefill({
		                  currency: "USD",
		                  titleOverride: "Recevoir des stablecoins",
		                  partnerOverride: "simpleswap",
		                });
		                cashModalProps?.setCashModalTab?.("buy");
		                setActiveAction("cash");
		              }}
		              onChooseUsdSwapIn={() => {
		                // "Envoyer des dollars" utilise le même parcours que "Retirer vers la banque"
		                // (MoonPay Sell 1/3 + 2/3).
		                setCashSellSelectTitleOverride?.(
		                  "Envoyer vers un wallet",
		                );
		                setCashSellDestinationMode?.("other_blockchains");
		                setCashBuyPrefill(null);
		                cashModalProps?.setCashModalTab?.("sell");
		                setActiveAction("cash");
		              }}
	            />

            <WalletDashboardUsdSwapModal
              open={
                activeAction === "cashUsdSwapOut" || activeAction === "cashUsdSwapIn"
              }
              onClose={() => {
                setUsdSwapPrefillAmount("");
                setUsdSwapAccentVariant("");
                setActiveAction("cashChoice");
              }}
              walletLabel={cashModalProps?.walletLabel || ""}
              walletAddress={cashModalProps?.walletAddress || ""}
              initialDirection={
                activeAction === "cashUsdSwapIn" ? "stable_to_rlusd" : "rlusd_to_stable"
              }
              initialAmount={usdSwapPrefillAmount}
              accentVariant={usdSwapAccentVariant}
            />

            <WalletDashboardCashModal
              open={activeAction === "cash"}
              onClose={() => {
                resetCashForm?.();
                setActiveAction("cashChoice");
                setCashBuyPrefill(null);
              }}
              {...cashModalProps}
              availableTokens={augmentedTokens}
              onOpenUsdSwapOut={openUsdSwapOut}
            />
          </>,
          document.body,
        )}

      {/* QR Scanner Modal for Address */}
      <QRScanner
        isOpen={qrScannerOpen}
        onScan={handleAddressScan}
        onClose={() => setQrScannerOpen(false)}
        hideTitle
      />

      <WalletDashboardSaveAddressPrompt
        open={showSaveAddressPrompt}
        addressToSave={addressToSave}
        onClose={() => {
          setShowSaveAddressPrompt(false);
          setAddressToSave("");
        }}
        onSave={() => {
          saveAddress(addressToSave, "");
          setShowSaveAddressPrompt(false);
          setAddressToSave("");
          toast?.success("Address saved!");
        }}
      />

      <WalletDashboardStatementModals {...statementSharedProps} />
    </>
  );
}
