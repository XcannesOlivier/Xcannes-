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
import { apiUrl } from "@/lib/runtimeConfig";
import dynamic from "next/dynamic";
import Link from "next/link";

const QRCodeCanvas = dynamic(
  () => import("qrcode.react").then((m) => m.QRCodeCanvas),
  { ssr: false }
);

const PENDING_CONNECT_KEY = "xcannes_pending_connect";
const NATIVE_WALLET_KEY = "xcannes_native_wallet";

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

  // Mobile: redirect flow state
  const [mobileStatus, setMobileStatus] = useState("init"); // init | redirecting | polling | connected | expired
  const mobileInitRef = useRef(false);
  const pollRef = useRef(null);

  // ── Mobile: redirect-based connect flow ──────────────────────
  useEffect(() => {
    if (!isMobile) return;
    if (mobileInitRef.current) return;
    mobileInitRef.current = true;

    const pendingId = sessionStorage.getItem(PENDING_CONNECT_KEY);
    if (pendingId) {
      // Returning from wallet-app → poll for result
      setMobileStatus("polling");
      startPolling(pendingId);
    } else {
      // Create challenge and redirect to wallet-app
      setMobileStatus("redirecting");
      createChallengeAndRedirect();
    }
  }, [isMobile]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function createChallengeAndRedirect() {
    try {
      const res = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "connect",
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Challenge failed");

      sessionStorage.setItem(PENDING_CONNECT_KEY, data.challengeId);
      window.location.href = `/wallet-app/?connect=${data.challengeId}`;
    } catch (err) {
      console.error("[mobile connect] Challenge error:", err);
      // Fallback: redirect to wallet-app without challenge
      window.location.href = "/wallet-app/";
    }
  }

  function startPolling(challengeId) {
    let attempts = 0;
    const maxAttempts = 90; // 3 minutes at 2s

    pollRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        sessionStorage.removeItem(PENDING_CONNECT_KEY);
        setMobileStatus("expired");
        return;
      }

      try {
        const res = await fetch(apiUrl(`/wallet-relay/status/${challengeId}`));
        const data = await res.json();

        if (data.status === "completed" || data.status === "signed") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          sessionStorage.removeItem(PENDING_CONNECT_KEY);

          if (data.result?.address) {
            // Store in session for NativeWalletContext to pick up
            sessionStorage.setItem(NATIVE_WALLET_KEY, data.result.address);
            if (Array.isArray(data.result.addresses)) {
              sessionStorage.setItem(
                NATIVE_WALLET_KEY + "_addresses",
                JSON.stringify(data.result.addresses)
              );
            }
            setMobileStatus("connected");
            // Reload so NativeWalletContext restores the session
            setTimeout(() => window.location.reload(), 800);
          }
        } else if (data.status === "expired" || data.status === "error") {
          clearInterval(pollRef.current);
          pollRef.current = null;
          sessionStorage.removeItem(PENDING_CONNECT_KEY);
          setMobileStatus("expired");
        }
      } catch { /* network error — retry */ }
    }, 2000);
  }

  function handleMobileRetry() {
    sessionStorage.removeItem(PENDING_CONNECT_KEY);
    setMobileStatus("redirecting");
    mobileInitRef.current = false;
    createChallengeAndRedirect();
  }

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

  // ── MOBILE: redirect-based connect flow ─────────────────────
  if (isMobile) {
    return (
      <main className="min-h-[100svh] flex flex-col items-center justify-center bg-[#0b0f10] text-white font-montserrat px-4">
        <div className="flex flex-col items-center gap-4 max-w-xs text-center">
          {/* Branding */}
          <div className="w-16 h-16 rounded-full bg-[#c9a84c] flex items-center justify-center mb-2 shadow-[0_0_24px_rgba(201,168,76,0.3)]">
            <span className="text-[#0a0a0a] text-2xl font-bold font-orbitron">X</span>
          </div>

          {mobileStatus === "redirecting" && (
            <>
              <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
              <p className="text-sm text-white/50">
                {t("wallet_mobile_redirecting", "Ouverture de Xcannes Wallet…")}
              </p>
            </>
          )}

          {mobileStatus === "polling" && (
            <>
              <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
              <p className="text-sm text-white/50">
                {t("wallet_mobile_polling", "Connexion en cours…")}
              </p>
              <p className="text-xs text-white/30 mt-2">
                {t("wallet_mobile_polling_hint", "Validez la connexion dans Xcannes Wallet puis revenez ici.")}
              </p>
            </>
          )}

          {mobileStatus === "connected" && (
            <>
              <svg className="w-12 h-12 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-sm text-green-400 font-medium">
                {t("wallet_mobile_connected", "Connecté !")}
              </p>
            </>
          )}

          {mobileStatus === "expired" && (
            <>
              <p className="text-sm text-red-400 mb-2">
                {t("wallet_mobile_expired", "La demande a expiré. Veuillez réessayer.")}
              </p>
              <button
                onClick={handleMobileRetry}
                className="px-6 py-3 bg-[#c9a84c] hover:bg-[#b89a40] text-[#0a0a0a] font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
              >
                {t("wallet_connect_retry", "Réessayer")}
              </button>
            </>
          )}

          {mobileStatus === "init" && (
            <>
              <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
              <p className="text-sm text-white/40">{t("wallet_connect_loading", "Préparation de la connexion…")}</p>
            </>
          )}
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
