/**
 * WalletConnectScreen — Full-page wallet connection screen
 *
 * Two independent modes:
 *
 * 1. DESKTOP → QR code relay challenge (scan with mobile wallet app)
 * 2. MOBILE  → Embedded wallet-app iframe for direct onboarding
 *    (Welcome → Terms → PIN → Create/Import → Backup)
 *    Listens for postMessage(WALLET_CREATED) to get the address.
 *
 * wallet-app and the site connection are independent flows.
 * After connection, isConnected flips → parent (wallet.jsx) swaps to Dashboard.
 */

import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import dynamic from "next/dynamic";
import Link from "next/link";
import { isMobileDevice } from "@/utils/deviceDetect";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

const NATIVE_WALLET_KEY = "xcannes_native_wallet";

// ── Helpers ────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => setMobile(isMobileDevice()), []);
  return mobile;
}

// ── Main Component ─────────────────────────────────────────────
export default function WalletConnectScreen() {
  const { t } = useTranslation("common");
  const {
    connect,
    isConnecting,
    isConnected,
    qrModalData,
    closeQrModal,
  } = useWallet();

  const isMobile = useIsMobile();

  // ── Mobile: embedded wallet-app iframe ───────────────────────
  const [mobileConnected, setMobileConnected] = useState(false);

  useEffect(() => {
    if (!isMobile) return;

    function handleMessage(event) {
      const msg = event.data;
      if (!msg || msg.type !== "WALLET_CREATED") return;
      if (!msg.address) return;

      // Store address in session so NativeWalletContext picks it up
      sessionStorage.setItem(NATIVE_WALLET_KEY, msg.address);
      if (msg.publicKey) {
        sessionStorage.setItem(NATIVE_WALLET_KEY + "_publicKey", msg.publicKey);
      }
      setMobileConnected(true);

      // Reload so NativeWalletContext restores the session → dashboard
      setTimeout(() => window.location.reload(), 800);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [isMobile]);

  // ── Desktop: auto-trigger QR relay connect ───────────────────
  const [showQR, setShowQR] = useState(false);
  const hasAutoConnected = useRef(false);

  useEffect(() => {
    if (isMobile) return;
    if (hasAutoConnected.current) return;
    if (isConnected || isConnecting) return;
    hasAutoConnected.current = true;
    connect();
  }, [connect, isConnected, isConnecting, isMobile]);

  useEffect(() => {
    if (qrModalData?.visible && qrModalData?.qrData) {
      setShowQR(true);
    }
  }, [qrModalData]);

  const handleRetry = useCallback(() => {
    closeQrModal();
    hasAutoConnected.current = false;
    setTimeout(() => connect(), 300);
  }, [closeQrModal, connect]);

  const isSigned = qrModalData?.status === "signed";
  const isExpired =
    qrModalData?.status === "expired" || qrModalData?.status === "error";

  const qrValue =
    qrModalData?.qrData
      ? typeof qrModalData.qrData === "string"
        ? qrModalData.qrData
        : JSON.stringify(qrModalData.qrData)
      : null;

  // ── MOBILE: embedded onboarding ──────────────────────────────
  if (isMobile) {
    if (mobileConnected) {
      return (
        <main className="min-h-[100svh] flex flex-col items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-4">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="w-16 h-16 rounded-full bg-[#c9a84c] flex items-center justify-center shadow-[0_0_24px_rgba(201,168,76,0.3)]">
              <span className="text-[#0a0a0a] text-2xl font-bold font-orbitron">X</span>
            </div>
            <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            <p className="text-sm text-green-400 font-medium">
              {t("wallet_mobile_connected", "Connecté !")}
            </p>
          </div>
        </main>
      );
    }

    return (
      <main className="h-[100svh] w-full bg-xcannes-surface-demo overflow-hidden relative">
        {/* Back to home */}
        <div className="absolute top-3 left-3 z-50">
          <Link
            href="/"
            className="text-white/60 hover:text-white transition-colors text-2xl leading-none"
            aria-label={t("nav_home", "Accueil")}
          >
            ‹
          </Link>
        </div>

        {/* Embedded wallet-app — full onboarding flow */}
        <iframe
          src="/wallet-app/"
          title="Xcannes Wallet"
          className="w-full h-full border-0"
          allow="camera; publickey-credentials-get; publickey-credentials-create"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
        />
      </main>
    );
  }

  // ── DESKTOP: QR code relay flow ──────────────────────────────
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-4 py-8 relative">
      {/* Back to home */}
      <div className="absolute top-5 left-6 z-40">
        <Link
          href="/"
          className="text-white/60 hover:text-white transition-colors text-2xl leading-none"
          aria-label={t("nav_home", "Accueil")}
        >
          ‹
        </Link>
      </div>

      {/* Branding */}
      <div className="flex flex-col items-center mb-8">
        <div className="w-16 h-16 rounded-full bg-[#c9a84c] flex items-center justify-center mb-4 shadow-[0_0_24px_rgba(201,168,76,0.3)]">
          <span className="text-[#0a0a0a] text-2xl font-bold font-orbitron">X</span>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight mb-1">
          Xcannes Wallet
        </h1>
        <p className="text-white/60 text-sm text-center max-w-xs">
          {t("wallet_connect_subtitle", "Connectez votre wallet pour accéder à vos comptes.")}
        </p>
      </div>

      {/* QR Code section (desktop only) */}
      <div className="w-full max-w-sm">
        {showQR && qrValue && !isExpired ? (
          <div className="rounded-2xl border border-white/10 bg-[#111518] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">
              {t("wallet_connect_qr_title", "Connecter votre wallet")}
            </h3>
            <p className="text-sm text-white/60 mb-6 text-center">
              {t("wallet_connect_qr_desc", "Scannez ce QR code avec votre wallet Xcannes.")}
            </p>

            {/* QR */}
            <div className="flex justify-center mb-6">
              <div className="bg-white rounded-xl p-4 transition-all duration-300">
                {isSigned ? (
                  <div className="w-[220px] h-[220px] flex items-center justify-center">
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
                    size={220}
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
                  ✓ {t("wallet_connect_success", "Connecté !")}
                </p>
              ) : (
                <div className="flex items-center justify-center gap-2 text-sm text-white/40">
                  <span className="inline-block w-2 h-2 bg-white/40 rounded-full animate-pulse" />
                  {t("wallet_connect_waiting", "En attente du scan…")}
                </div>
              )}
            </div>
          </div>
        ) : isExpired ? (
          <div className="rounded-2xl border border-white/10 bg-[#111518] p-6 shadow-2xl text-center">
            <p className="text-sm text-red-400 mb-4">
              {t("wallet_connect_expired", "Le QR code a expiré. Veuillez réessayer.")}
            </p>
            <button
              onClick={handleRetry}
              className="px-6 py-3 bg-[#c9a84c] hover:bg-[#b89a40] text-[#0a0a0a] font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
            >
              {t("wallet_connect_retry", "Réessayer")}
            </button>
          </div>
        ) : (
          /* Loading state while challenge is being created */
          <div className="rounded-2xl border border-white/10 bg-[#111518] p-8 shadow-2xl flex flex-col items-center">
            <div className="w-[220px] h-[220px] flex items-center justify-center">
              <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
            </div>
            <p className="text-sm text-white/40 mt-4">
              {t("wallet_connect_loading", "Préparation de la connexion…")}
            </p>
          </div>
        )}
      </div>

      {/* Feature list */}
      <div className="mt-8 max-w-sm w-full space-y-3">
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span className="text-base">🔐</span>
          <span>{t("wallet_connect_feature_1", "Clés chiffrées sur votre appareil")}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span className="text-base">👆</span>
          <span>{t("wallet_connect_feature_2", "Déverrouillage biométrique")}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/60">
          <span className="text-base">🌐</span>
          <span>{t("wallet_connect_feature_3", "Connexion à Xcannes en un scan")}</span>
        </div>
      </div>

      {/* "Pas encore l'app ?" section (desktop only) */}
      <div className="mt-8 max-w-sm w-full rounded-2xl border border-white/10 bg-[#111518]/60 p-5">
        <p className="text-sm font-medium text-white/80 mb-3 text-center">
          {t("wallet_connect_no_app_title", "Vous n'avez pas encore l'app ?")}
        </p>
        <p className="text-xs text-white/40 mb-4 text-center">
          {t(
            "wallet_connect_no_app_desc",
            "Téléchargez Xcannes Wallet sur votre téléphone pour créer un wallet sécurisé et scanner le QR code."
          )}
        </p>
        <div className="flex items-center justify-center gap-3">
          {/* App Store badge */}
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            className="opacity-80 hover:opacity-100 transition-opacity"
            aria-label="App Store"
          >
            <Image
              src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83"
              alt="App Store"
              width={125}
              height={42}
              className="h-10 w-auto"
              unoptimized
            />
          </a>
          {/* Google Play badge */}
          <a
            href="#"
            target="_blank"
            rel="noreferrer"
            className="opacity-80 hover:opacity-100 transition-opacity"
            aria-label="Google Play"
          >
            <Image
              src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
              alt="Google Play"
              width={170}
              height={52}
              className="h-[52px] w-auto"
              unoptimized
            />
          </a>
        </div>
        {/* Web fallback */}
        <div className="mt-3 text-center">
          <a
            href="/wallet-app/"
            className="text-xs text-[#c9a84c]/70 hover:text-[#c9a84c] underline underline-offset-2 transition-colors"
          >
            {t("wallet_connect_web_app", "Ou utilisez la version web")}
          </a>
        </div>
      </div>

      {/* Help text */}
      <p className="mt-6 text-xs text-white/30 text-center max-w-xs">
        {t("wallet_connect_help", "Ouvrez l'app Xcannes Wallet sur votre téléphone, puis scannez le QR code ci-dessus.")}
      </p>
    </main>
  );
}
