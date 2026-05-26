/**
 * WalletRelayQRModal — Global QR modal for overlay wallet connect / sign.
 *
 * Rendered in _app.jsx so it works from any page (Header "Se connecter",
 * WalletDashboard sign actions, etc.).
 *
 * Shows a QR code when the NativeWalletContext sets qrModalData.
 * On the /wallet page the WalletDashboard has its own inline handling,
 * so this modal hides itself to avoid duplicates.
 *
 * On mobile, when qrModalData.mobile is true, shows a "Ouvrir votre wallet"
 * button instead of a QR code — the wallet-app handles biometric/PIN auth.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { useWallet } from "@/context/WalletContext";
import dynamic from "next/dynamic";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

export default function WalletRelayQRModal() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { qrModalData, closeQrModal, isConnected } = useWallet();
  const [closing, setClosing] = useState(false);

  // Don't render on /wallet unless it's a sign flow (connect handled elsewhere)
  const isWalletPage = router.pathname === "/wallet";

  // Clean up connect-type challenges when leaving /wallet → prevents
  // the global modal from popping up on the index page after navigating back.
  useEffect(() => {
    if (!isWalletPage && qrModalData?.visible && qrModalData?.type === "connect") {
      closeQrModal();
    }
  }, [isWalletPage, qrModalData?.visible, qrModalData?.type, closeQrModal]);

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

  // On mobile, auto-redirect to wallet-app for signing
  useEffect(() => {
    if (!qrModalData?.visible || !qrModalData?.mobile || !qrModalData?.walletAppUrl) return;
    // Short delay then redirect to wallet-app
    const timer = setTimeout(() => {
      window.location.href = qrModalData.walletAppUrl;
    }, 600);
    return () => clearTimeout(timer);
  }, [qrModalData?.visible, qrModalData?.mobile, qrModalData?.walletAppUrl]);

  if (!qrModalData?.visible) return null;
  if (isWalletPage && qrModalData?.type !== "sign") return null;

  // Never show a stale connect QR outside /wallet (prevents flash when navigating back)
  if (qrModalData?.type === "connect" && !isWalletPage) return null;

  const isMobile = qrModalData.mobile;

  const qrValue =
    typeof qrModalData.qrData === "string"
      ? qrModalData.qrData
      : JSON.stringify(qrModalData.qrData);

  const isConnect = qrModalData.type === "connect";
  const isSigned = qrModalData.status === "signed";
  const isSendSign =
    !isConnect && String(qrModalData?.action || "").trim().toLowerCase() === "wallet:send";
  const relayProgressDetails = qrModalData?.progressDetails || null;
  const relayAmountLabel = String(relayProgressDetails?.amountLabel || "").trim();
  const relayBeneficiaryLabel = String(relayProgressDetails?.beneficiaryLabel || "").trim();
  const relayBeneficiaryAddress = String(relayProgressDetails?.beneficiaryAddress || "").trim();

  const relayParsedAmount = (() => {
    const raw = String(relayAmountLabel || "").trim();
    if (!raw) return { amount: "", currency: "" };
    const parts = raw.split(/\s+/);
    if (parts.length < 2) return { amount: raw, currency: "" };
    const currencyCandidate = parts[parts.length - 1];
    const amountPart = parts.slice(0, -1).join(" ");
    if (/^[A-Z]{2,10}$/u.test(currencyCandidate)) {
      return { amount: amountPart, currency: currencyCandidate };
    }
    return { amount: raw, currency: "" };
  })();

  const relayBeneficiaryDisplay = (() => {
    if (relayBeneficiaryLabel) return relayBeneficiaryLabel;
    if (!relayBeneficiaryAddress) return "";
    if (relayBeneficiaryAddress.length <= 18) return relayBeneficiaryAddress;
    return `${relayBeneficiaryAddress.slice(0, 8)}…${relayBeneficiaryAddress.slice(-6)}`;
  })();

  const titleText = isConnect
    ? t("wallet_relay_title_connect", "Connecter votre wallet")
    : isSendSign
      ? "Validez votre envoi sur l’APP XCANNES"
      : t("wallet_relay_title_sign", "Signer la transaction");

  const subtitleText = isMobile
    ? t("wallet_relay_desc_mobile", "Ouvrez votre wallet pour confirmer l’opération.")
    : isConnect
      ? t("wallet_relay_desc_desktop_connect", "Scannez ce QR code avec votre wallet XCANNES.")
      : isSendSign
        ? "Scannez ce QR code pour valider la transaction"
        : t("wallet_relay_desc_desktop_sign", "Confirmez la transaction dans votre wallet.");

  return (
    <div
      className={`fixed inset-0 z-[20000] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 transition-opacity duration-250 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className={`relative w-full max-w-sm rounded-2xl border border-white/10 bg-xcannes-surface-demo overflow-hidden p-6 shadow-2xl transition-all duration-250 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        }`}
      >
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          <div className="absolute inset-0 bg-xcannes-surface-demo bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.025),transparent_55%)]" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/70" />
        </div>
        <div className="relative z-10">
        {/* Close button */}
        <button
          type="button"
          onClick={handleClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-colors"
          aria-label={t("close")}
        >
          ✕
        </button>

        {/* Title */}
        <h3 className="text-lg font-semibold text-white mb-1">{titleText}</h3>
        <p className="text-sm text-white/60 mb-6">
          {subtitleText}
        </p>

        {/* QR Code / Mobile redirect */}
        <div className="flex justify-center mb-6">
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
          ) : isMobile ? (
            <div className="flex flex-col items-center gap-4 py-4">
              {/* Mobile: show redirect message and manual button */}
              <div className="w-16 h-16 rounded-full bg-xcannes-green/10 border border-xcannes-green/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-xcannes-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-xs text-white/60 text-center">
                Redirection vers votre wallet…
              </p>
              {qrModalData.walletAppUrl && (
                <a
	                  href={qrModalData.walletAppUrl}
	                  className="px-5 py-2.5 bg-xcannes-green/80 hover:bg-xcannes-green text-white text-sm font-medium rounded-xl transition-colors"
	                >
	                  Ouvrir XCANNES Wallet
	                </a>
	              )}
            </div>
          ) : (
            <div className="bg-white rounded-xl p-4">
              <QRCodeCanvas
                value={qrValue}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
          )}
        </div>

        {/* Send details (desktop only) */}
        {!isMobile && isSendSign && !isSigned ? (
          <div className="mb-6 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left">
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-x-3 gap-y-2 text-sm">
              <div className="text-white/45">{t("ui_amount", "Montant")}</div>
              <div className="text-white/90 font-semibold tabular-nums">
                {relayParsedAmount.amount || (relayAmountLabel || "—")}
              </div>
              <div className="text-white/45">{t("ui_currency", "Devise")}</div>
              <div className="text-white/80 font-semibold">
                {relayParsedAmount.currency || "—"}
              </div>
              <div className="text-white/45">
                {t("ui_recipient_wallet", "Wallet destinataire")}
              </div>
              <div className="text-white/80 font-semibold truncate">
                {relayBeneficiaryDisplay || "—"}
              </div>
            </div>
          </div>
        ) : null}

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
            <div className="flex items-center justify-center gap-2 text-sm text-white/60">
              <span className="inline-block w-2 h-2 bg-white/40 rounded-full animate-pulse" />
              En attente de confirmation…
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
