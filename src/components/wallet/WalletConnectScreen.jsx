/**
 * WalletConnectScreen — Full-page wallet connection screen
 *
 * Three modes depending on device & wallet state:
 *
 * 1. DESKTOP → QR code relay challenge + "Pas encore l'app?" section
 * 2. MOBILE + wallet exists (IndexedDB) → auto-redirect to /wallet-app/
 * 3. MOBILE + no wallet → embedded iframe /wallet-app/ for full onboarding
 *    (Welcome → Terms → PIN → Create/Import → Backup → Scanner)
 *    then listens for postMessage to get the wallet address
 *
 * After connection, isConnected flips → parent (wallet.jsx) swaps to Dashboard.
 */

"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useWallet } from "@/context/WalletContext";
import { useTranslation } from "next-i18next";
import { detectWalletApp } from "@/lib/walletAppDetect";
import dynamic from "next/dynamic";
import Link from "next/link";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

// ── Helpers ────────────────────────────────────────────────────
function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const ua = navigator.userAgent || "";
    const isMob =
      /android|iphone|ipad|ipod|mobile/i.test(ua) ||
      (/Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1);
    setMobile(isMob);
  }, []);
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

  // Detection state (mobile only)
  const [walletDetection, setWalletDetection] = useState(null); // null = loading
  const [showOnboardingIframe, setShowOnboardingIframe] = useState(false);
  const [iframeReady, setIframeReady] = useState(false);
  const iframeRef = useRef(null);
  const detectionRanRef = useRef(false);

  // ── Detect wallet (mobile only) ──────────────────────────────
  useEffect(() => {
    if (!isMobile) return;
    if (detectionRanRef.current) return;
    detectionRanRef.current = true;

    detectWalletApp().then((info) => {
      setWalletDetection(info);
    });
  }, [isMobile]);

  // ── Mobile + wallet exists → redirect to /wallet-app/ ───────
  useEffect(() => {
    if (!isMobile) return;
    if (!walletDetection) return;
    if (!walletDetection.hasWallet || !walletDetection.hasAuth) return;

    // Wallet-app has a configured wallet → redirect to it
    // It will do Face ID/PIN unlock → open embedded dashboard
    window.location.href = "/wallet-app/";
  }, [isMobile, walletDetection]);

  // ── Mobile + no wallet → show onboarding iframe ─────────────
  useEffect(() => {
    if (!isMobile) return;
    if (!walletDetection) return;
    if (walletDetection.hasWallet && walletDetection.hasAuth) return;

    // No wallet → show the wallet-app in an iframe for onboarding
    setShowOnboardingIframe(true);
  }, [isMobile, walletDetection]);

  // ── Listen for postMessage from wallet-app iframe ────────────
  useEffect(() => {
    if (!showOnboardingIframe) return;

    function handleMessage(event) {
      const data = event.data;
      if (!data || !data.type) return;

      // The wallet-app sends INIT with address after the user creates
      // a wallet and reaches the home/embedded screen
      if (data.type === "WALLET_CREATED" || data.type === "INIT") {
        if (data.address) {
          // Wallet created in the iframe — now trigger the relay connect
          // so the wallet address is saved in the session
          setShowOnboardingIframe(false);

          // Store address temporarily and trigger connection
          sessionStorage.setItem("xcannes_native_wallet", data.address);
          window.location.reload();
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [showOnboardingIframe]);

  // ── Desktop: auto-trigger connect ────────────────────────────
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

  // ── MOBILE: onboarding iframe (full wallet-app) ──────────────
  if (isMobile && showOnboardingIframe) {
    return (
      <main className="fixed inset-0 bg-[#0a0a0a] z-50">
        <iframe
          ref={iframeRef}
          src="/wallet-app/"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          allow="camera; clipboard-write"
          title="Xcannes Wallet — Configuration"
          onLoad={() => setIframeReady(true)}
        />
        {!iframeReady && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#0a0a0a]">
            <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
          </div>
        )}
      </main>
    );
  }

  // ── MOBILE: loading detection ────────────────────────────────
  if (isMobile && !walletDetection) {
    return (
      <main className="min-h-[100svh] flex items-center justify-center bg-[#0b0f10] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
          <p className="text-sm text-white/40">Vérification du wallet…</p>
        </div>
      </main>
    );
  }

  // ── DESKTOP (or mobile redirecting) ──────────────────────────
  return (
    <main className="min-h-[100svh] flex flex-col items-center justify-center bg-[#0b0f10] text-white font-montserrat px-4 py-8 relative">
      {/* Back to home */}
      <div className="absolute top-5 left-6 z-40">
        <Link
          href="/"
          className="text-white/50 hover:text-white transition-colors text-2xl leading-none"
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
        <p className="text-white/50 text-sm text-center max-w-xs">
          {t("wallet_connect_subtitle", "Connectez votre wallet pour accéder à vos comptes.")}
        </p>
      </div>

      {/* QR Code section (desktop) */}
      <div className="w-full max-w-sm">
        {showQR && qrValue && !isExpired ? (
          <div className="rounded-2xl border border-white/10 bg-[#111518] p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-white mb-1 text-center">
              {t("wallet_connect_qr_title", "Connecter votre wallet")}
            </h3>
            <p className="text-sm text-white/50 mb-6 text-center">
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
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span className="text-base">🔐</span>
          <span>{t("wallet_connect_feature_1", "Clés chiffrées sur votre appareil")}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span className="text-base">👆</span>
          <span>{t("wallet_connect_feature_2", "Déverrouillage biométrique")}</span>
        </div>
        <div className="flex items-center gap-3 text-sm text-white/50">
          <span className="text-base">🌐</span>
          <span>{t("wallet_connect_feature_3", "Connexion à Xcannes en un scan")}</span>
        </div>
      </div>

      {/* "Pas encore l'app ?" section (desktop) */}
      <div className="mt-8 max-w-sm w-full rounded-2xl border border-white/10 bg-[#111518]/60 p-5">
        <p className="text-sm font-medium text-white/70 mb-3 text-center">
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
            <img
              src="https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83"
              alt="App Store"
              className="h-10 w-auto"
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
            <img
              src="https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png"
              alt="Google Play"
              className="h-[52px] w-auto"
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
