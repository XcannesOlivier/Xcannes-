import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useXumm } from "@/context/XummContext";
import { useTranslation } from "next-i18next";

const XUMM_ACCOUNT_STORAGE_KEY = "xcannes_xumm_account_status";

function getStoredXummStatus() {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(XUMM_ACCOUNT_STORAGE_KEY);
  } catch (err) {
    return null;
  }
}

function markXummAccountKnown() {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(XUMM_ACCOUNT_STORAGE_KEY, "has_account");
  } catch (err) {


    // Ignore storage errors (private mode, etc.)
  }}
function isXummBrowser() {
  if (typeof navigator === "undefined") return false;
  return /xumm|xaman/i.test(navigator.userAgent || "");
}

function isMobileDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  const isMobileUa = /android|iphone|ipad|ipod|mobile/i.test(ua);
  // iPadOS peut se présenter comme "Macintosh" (Safari en mode desktop).
  const isIpadOs =
  /Macintosh/i.test(ua) && Number(navigator.maxTouchPoints || 0) > 1;
  return isMobileUa || isIpadOs;
}

export default function XummConnectButton({
  small = false,
  variant = "default",
  mode = "full",
  className = "",
  connectedClassName = "",
  connectLabel,
  connectedLabel
}) {
  const { wallet, isConnected, isConnecting, connect, disconnect } = useXumm();
  const { t } = useTranslation("common");
  const [showSetupModal, setShowSetupModal] = useState(false);
  const setupModalLockRef = useRef({
    locked: false,
    overflow: "",
    paddingRight: "",
    htmlOverflow: "",
  });

  useEffect(() => {
    if (isConnected) {
      markXummAccountKnown();
      setShowSetupModal(false);
    }
  }, [isConnected]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const { body, documentElement: html } = document;
    if (showSetupModal) {
      if (!setupModalLockRef.current.locked) {
        setupModalLockRef.current = {
          locked: true,
          overflow: body.style.overflow,
          paddingRight: body.style.paddingRight,
          htmlOverflow: html.style.overflow,
        };
        const scrollbarWidth = window.innerWidth - html.clientWidth;
        html.style.overflow = "hidden";
        body.style.overflow = "hidden";
        if (scrollbarWidth > 0) {
          body.style.paddingRight = `${scrollbarWidth}px`;
        }
      }
      return;
    }
    if (setupModalLockRef.current.locked) {
      html.style.overflow = setupModalLockRef.current.htmlOverflow;
      body.style.overflow = setupModalLockRef.current.overflow;
      body.style.paddingRight = setupModalLockRef.current.paddingRight;
      setupModalLockRef.current.locked = false;
    }
  }, [showSetupModal]);

  const handleConnectClick = () => {
    if (isConnected) return;

    // Sur mobile, on tente directement la connexion: le navigateur ne peut pas
    // détecter de manière fiable si l'app Xumm/Xaman est installée.
    if (isMobileDevice()) {
      connect();
      return;
    }

    const storedStatus = getStoredXummStatus();
    const hasAccount = storedStatus === "has_account";
    const shouldPrompt = !hasAccount && !isXummBrowser();

    if (shouldPrompt) {
      setShowSetupModal(true);
      return;
    }

    connect();
  };

  const handleAlreadyHaveXumm = () => {
    markXummAccountKnown();
    setShowSetupModal(false);
    connect();
  };

  const handleCreateXumm = () => {
    setShowSetupModal(false);
    if (typeof window !== "undefined") {
      window.open("https://xumm.app", "_blank", "noopener,noreferrer");
    }
  };

  if (isConnected && mode === "full") {
    return (
      <>
        <div className="inline-flex items-center gap-3">
          {/* Badge connecté (info rapide, non cliquable) */}
          <div
            className={`flex items-center gap-3 ${
            small ? "px-4 py-2" : "px-6 py-3"} bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg backdrop-blur-sm group`
            }>

            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse" />
              <span
                className={`${
                small ? "text-xs" : "text-sm"} font-medium text-xcannes-green group-hover:text-xcannes-green`
                }>

                {t("wallet_connected")}
              </span>
            </div>
            <span
              className={`${
              small ? "text-xs" : "text-sm"} font-mono text-white/60 group-hover:text-white`
              }>

              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
          </div>

          {/* Bouton déconnexion */}
          <button
            onClick={disconnect}
            className={`${
            small ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"} bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10 hover:border-red-500/40 rounded-lg font-medium transition-all duration-300`
            }
            aria-label={t("ui_logout_wallet_558f860cac", "Se déconnecter du wallet")}>

            <span className="hidden sm:inline">{t("wallet_disconnect")}</span>
            <span className="sm:hidden">✕</span>
          </button>
        </div>

      </>);

  }

  const connectClass =
  variant === "statement" ?
  "px-4 py-1.5 text-sm md:text-xs bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green font-medium rounded-lg transition-all duration-200 border border-xcannes-green/30 hover:scale-105" :
  variant === "statement-blue" ?
  "px-4 py-1.5 text-sm md:text-xs bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#0f7fe1] font-medium rounded-lg transition-all duration-200 border border-[#0f7fe1]/40 hover:scale-105" :
  `${small ? "px-4 py-1.5 text-xs" : "px-5 py-2 text-sm"} bg-[#3052ff] hover:bg-[#2642d9] text-white font-medium rounded-lg transition-all duration-200`;

  const setupModal =
  showSetupModal && typeof document !== "undefined" ?
  createPortal(
    <div
      className="fixed inset-0 z-[10050] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          setShowSetupModal(false);
        }
      }}>

            <div className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-900 p-5 text-white shadow-2xl">
              <h3 className="text-lg font-semibold">
                {t(
            "xumm_setup_title",
            "Xumm requis pour connecter votre wallet"
          )}
              </h3>
              <p className="mt-2 text-sm text-white/70">
                {t(
            "xumm_setup_body",
            "Vous n'avez pas encore de compte Xumm ? Installez l'app et suivez la creation en quelques minutes."
          )}
              </p>
              <ol className="mt-3 space-y-1 text-xs text-white/60">
                <li>{t("ui_1_installez_xumm_on_your_m_c547f9ed37", "1. Installez Xumm sur votre mobile.")}</li>
                <li>{t("ui_2_open_app_and_create_wallet_09babc8e9b", "2. Ouvrez l'app et creez votre wallet.")}</li>
                <li>{t("ui_3_come_back_and_connect_09ed783355", "3. Revenez ici et connectez-vous via QR code.")}</li>
              </ol>
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <a
            href="https://apps.apple.com/app/xumm/id1492302343"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-semibold">{t("ui_app_store_bbc2185535", "App Store")}


          </a>
                <a
            href="https://play.google.com/store/apps/details?id=com.xrpllabs.xumm"
            target="_blank"
            rel="noreferrer"
            className="flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-semibold">{t("ui_google_play_3c43341c63", "Google Play")}


          </a>
              </div>
              <div className="mt-4 flex flex-col gap-2">
                <button
            type="button"
            onClick={handleAlreadyHaveXumm}
            className="w-full rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-sm font-semibold">

                  {t("xumm_setup_existing", "J'ai deja Xumm")}
                </button>
                <button
            type="button"
            onClick={handleCreateXumm}
            className="w-full rounded-lg bg-xcannes-green hover:bg-xcannes-green/90 text-black px-4 py-2 text-sm font-semibold">

                  {t("xumm_setup_create", "Ouvrir le site Xumm")}
                </button>
                <button
            type="button"
            onClick={() => setShowSetupModal(false)}
            className="w-full rounded-lg border border-white/10 px-4 py-2 text-sm text-white/60 hover:text-white hover:border-white/20">

                  {t("close", "Fermer")}
                </button>
              </div>
            </div>
          </div>,
    document.body
  ) :
  null;

  if (mode === "single") {
    if (isConnected) {
      const resolvedConnectedClass = connectedClassName || connectClass;
      return (
        <button
          type="button"
          disabled
          className={resolvedConnectedClass}
          aria-label={t("ui_wallet_connect_2e772de308", "Wallet connecté")}>

          {connectedLabel || t("wallet_connected")}
        </button>);

    }

    return (
      <>
        <button
          onClick={handleConnectClick}
          disabled={isConnecting}
          className={`${className || connectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
          aria-label={t("ui_connect_your_wallet_xrpl_73361356ca", "Connecter votre wallet XRPL")}>

          {isConnecting
            ? t("ui_connecting_2c59b8f12e", "Connecting...")
            : (connectLabel || t("wallet_connect"))}
        </button>
        {setupModal}
      </>);

  }

  return (
    <>
      <button
        onClick={handleConnectClick}
        disabled={isConnecting}
        className={`${className || connectClass} disabled:opacity-60 disabled:cursor-not-allowed`}
        aria-label={t("ui_connect_your_wallet_xrpl_73361356ca", "Connecter votre wallet XRPL")}>

        {isConnecting
          ? t("ui_connecting_2c59b8f12e", "Connecting...")
          : (connectLabel || t("wallet_connect"))}
      </button>
      {setupModal}
    </>);

}
