/**
 * WalletRelayQRModal — Global QR modal for overlay wallet connect / sign.
 *
 * Rendered in _app.jsx so it works from any page (Header "Se connecter",
 * WalletDashboard sign actions, etc.).
 *
 * Shows a QR code when the NativeWalletContext sets qrModalData.
 * On the /wallet page the WalletDashboard has its own inline handling,
 * so this modal hides itself to avoid duplicates.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useWallet } from "@/context/WalletContext";
import dynamic from "next/dynamic";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

export default function WalletRelayQRModal() {
  const router = useRouter();
  const { qrModalData, closeQrModal, isConnected } = useWallet();
  const [closing, setClosing] = useState(false);

  // Don't render on /wallet — the dashboard handles its own QR display
  const isWalletPage = router.pathname === "/wallet";

  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      closeQrModal();
      setClosing(false);
    }, 250);
  }, [closeQrModal]);

  // Auto-close when connected (after successful scan)
  useEffect(() => {
    if (qrModalData?.status === "signed" || (isConnected && qrModalData?.type === "connect")) {
      const timer = setTimeout(handleClose, 1500);
      return () => clearTimeout(timer);
    }
  }, [qrModalData?.status, isConnected, qrModalData?.type, handleClose]);

  // Close on Escape
  useEffect(() => {
    if (!qrModalData?.visible) return;
    const handler = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [qrModalData?.visible, handleClose]);

  if (!qrModalData?.visible || isWalletPage) return null;

  const qrValue =
    typeof qrModalData.qrData === "string"
      ? qrModalData.qrData
      : JSON.stringify(qrModalData.qrData);

  const isConnect = qrModalData.type === "connect";
  const isSigned = qrModalData.status === "signed";

  return (
    <div
      className={`fixed inset-0 z-[10100] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 transition-opacity duration-250 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-white/10 bg-[#111518] p-6 shadow-2xl transition-all duration-250 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
          aria-label="Fermer"
        >
          ✕
        </button>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-1">
          {isConnect ? "Connecter votre wallet" : "Signer la transaction"}
        </h3>
        <p className="text-sm text-white/60 mb-6">
          {isConnect
            ? "Scannez ce QR code avec votre wallet Xcannes."
            : "Confirmez la transaction dans votre wallet."}
        </p>

        {/* QR Code */}
        <div className="flex justify-center mb-6">
          <div className="bg-white rounded-xl p-4">
            {isSigned ? (
              <div className="w-[200px] h-[200px] flex items-center justify-center">
                <svg
                  className="w-16 h-16 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
            ) : (
              <QRCodeCanvas
                value={qrValue}
                size={200}
                level="M"
                includeMargin={false}
              />
            )}
          </div>
        </div>

        {/* Status */}
        <div className="text-center">
          {isSigned ? (
            <p className="text-sm text-green-400 font-medium">
              ✓ {isConnect ? "Connecté !" : "Signé avec succès !"}
            </p>
          ) : qrModalData.status === "expired" ? (
            <p className="text-sm text-red-400">
              Ce QR code a expiré. Veuillez réessayer.
            </p>
          ) : (
            <div className="flex items-center justify-center gap-2 text-sm text-white/50">
              <span className="inline-block w-2 h-2 bg-white/40 rounded-full animate-pulse" />
              En attente…
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
