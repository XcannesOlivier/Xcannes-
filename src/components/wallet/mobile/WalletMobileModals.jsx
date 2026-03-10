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
import QRScanner from "../components/QRScanner";
import WalletDashboardSendModal from "../modals/WalletDashboardSendModal";
import WalletDashboardPayreqModal from "../modals/WalletDashboardPayreqModal";
import WalletDashboardReceiveModal from "../modals/WalletDashboardReceiveModal";
import WalletDashboardSwapModal from "../modals/WalletDashboardSwapModal";
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

  // QR scanner
  qrScannerOpen,
  setQrScannerOpen,
  handleAddressScan,

  // Save address prompt
  showSaveAddressPrompt,
  setShowSaveAddressPrompt,
  addressToSave,
  setAddressToSave,
  addressLabel,
  setAddressLabel,
  saveAddress,

  // toast
  toast,

  // mobile cash uses augmentedTokens (not selectableTokens)
  augmentedTokens,
}) {
  return (
    <>
      {/* Modales non-portalisées, affichées sous le header en mobile */}
      <WalletInfoModal
        isOpen={walletInfoOpen}
        onClose={() => setWalletInfoOpen(false)}
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
              open={activeAction === "send" && !hasPayreq}
              onClose={() => {
                setActiveAction(null);
              }}
              {...sendModalProps}
            />
            <WalletDashboardPayreqModal
              open={activeAction === "send" && hasPayreq}
              onClose={() => {
                setSendPaymentRequest(null);
                setActiveAction(null);
              }}
              {...payreqModalProps}
            />

            <WalletDashboardReceiveModal
              open={activeAction === "receive"}
              onClose={() => setActiveAction(null)}
              {...receiveModalProps}
            />

            <WalletDashboardSwapModal
              open={activeAction === "swap"}
              onClose={() => setActiveAction(null)}
              {...swapModalProps}
            />

            <WalletDashboardCashModal
              open={activeAction === "cash"}
              onClose={() => {
                setActiveAction(null);
                setCashBuyPrefill(null);
              }}
              {...cashModalProps}
              availableTokens={augmentedTokens}
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
        addressLabel={addressLabel}
        setAddressLabel={setAddressLabel}
        onClose={() => {
          setShowSaveAddressPrompt(false);
          setAddressLabel("");
          setAddressToSave("");
        }}
        onSave={() => {
          saveAddress(addressToSave, addressLabel);
          setShowSaveAddressPrompt(false);
          setAddressLabel("");
          setAddressToSave("");
          toast?.success("Address saved!");
        }}
      />

      <WalletDashboardStatementModals {...statementSharedProps} />
    </>
  );
}
