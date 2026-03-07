"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "next-i18next";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@/context/WalletContext";
import { useNativeWallet } from "@/context/NativeWalletContext";
import { apiUrl } from "@/lib/runtimeConfig";

/**
 * Settings gear button + dropdown menu.
 * Shared between WalletDashboardHeader (desktop) and WalletDashboardFooter (mobile).
 *
 * @param {object} props
 * @param {"header"|"footer"} props.position – controls drop direction and responsive visibility
 */
export default function WalletSettingsDropdown({
  position = "header",
  onOpenInfo,
}) {
  const { t } = useTranslation("common");
  const { goToChoice } = useWallet();
  const { updateWallet } = useNativeWallet();
  const [isOpen, setIsOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrChallenge, setQrChallenge] = useState(null); // { challengeId, qrData, relay }
  const [qrStatus, setQrStatus] = useState("loading"); // loading | waiting | connected | error
  const pollIntervalRef = useRef(null);
  const ref = useRef(null);

  // Create relay challenge when QR modal opens
  const createNavigateChallenge = useCallback(async () => {
    try {
      setQrStatus("loading");
      setQrChallenge(null);
      const res = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "connect",
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create challenge");
      
      const { challengeId } = data;
      // Build QR data with navigate-connect type
      const relay = window.location.origin;
      const qrData = JSON.stringify({
        type: "xcannes:navigate-connect",
        screen: "choice",
        challengeId,
        relay,
      });
      setQrChallenge({ challengeId, qrData, relay });
      setQrStatus("waiting");
    } catch (error) {
      console.error("[WalletSettingsDropdown] Challenge creation error:", error);
      setQrStatus("error");
    }
  }, []);

  // Poll challenge status
  const pollChallengeStatus = useCallback((challengeId) => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    const maxAttempts = 150; // 5 minutes at 2s interval
    let attempts = 0;
    
    pollIntervalRef.current = setInterval(async () => {
      attempts++;
      if (attempts >= maxAttempts) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
        setQrStatus("error");
        return;
      }
      
      try {
        const res = await fetch(apiUrl(`/wallet-relay/status/${challengeId}`));
        const data = await res.json();
        
        if (data.status === "completed" || data.status === "signed") {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setQrStatus("connected");
          
          // Update wallet in NativeWalletContext
          if (data.result?.address) {
            const addr = data.result.address;
            const addrs = data.result.addresses;
            setTimeout(() => {
              updateWallet?.(addr, addrs);
              setShowQrModal(false);
              setQrChallenge(null);
            }, 1500);
          }
        } else if (data.status === "expired" || data.status === "error") {
          clearInterval(pollIntervalRef.current);
          pollIntervalRef.current = null;
          setQrStatus("error");
        }
      } catch (error) {
        console.error("[WalletSettingsDropdown] Polling error:", error);
      }
    }, 2000);
  }, [updateWallet]);

  // When QR modal opens, create challenge and start polling
  useEffect(() => {
    if (showQrModal) {
      createNavigateChallenge().then(() => {
        // Start polling after challenge is created - poll from the effect callback
      });
    } else {
      // Cleanup when modal closes
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      setQrChallenge(null);
      setQrStatus("loading");
    }
  }, [showQrModal, createNavigateChallenge]);

  // Start polling when challenge is ready
  useEffect(() => {
    if (qrChallenge?.challengeId && qrStatus === "waiting") {
      pollChallengeStatus(qrChallenge.challengeId);
    }
  }, [qrChallenge, qrStatus, pollChallengeStatus]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // header → visible on md+ only ; footer → mobile only ; inline → always visible
  const visibilityClass =
    position === "header"
      ? "hidden md:relative md:block"
      : position === "footer"
        ? "relative md:hidden"
        : "relative";

  // dropdown opens downward from header/inline, upward from footer
  const dropdownPositionClass =
    position === "footer"
      ? "absolute right-0 bottom-full mb-1.5"
      : "absolute right-0 top-full mt-1.5";

  return (
    <div className={visibilityClass} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="shrink-0 h-9 w-9 flex items-center justify-center rounded-lg bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white transition-all active:scale-95"
        aria-label={t("ui_settings_label", "Paramètres")}
      >
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </button>

      {isOpen && (
        <div
          className={`${dropdownPositionClass} z-50 w-48 rounded-xl bg-[#151b1e] border border-white/10 shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150`}
        >
          <div className="py-1">
            {/* Info & Fees */}
            <button
              type="button"
              onClick={() => {
                onOpenInfo?.();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-white/8 border border-white/10 text-[10px] text-white/40 leading-none font-semibold">
                i
              </span>
              {t("wallet_footer_info_fees", "Info & Fees")}
            </button>

            <div className="my-1 mx-3 border-t border-white/8" />

            {/* Créer ou importer */}
            {/* PWA embedded: use goToChoice | Desktop: QR code */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setIsOpen(false);
                
                // PWA mode: navigate directly to choice screen (already authenticated)
                if (goToChoice) {
                  goToChoice();
                  return;
                }
                
                // Desktop: show QR modal for wallet-app to scan
                const isDesktop = window.matchMedia("(min-width: 768px)").matches;
                if (isDesktop) {
                  setShowQrModal(true);
                } else {
                  // Non-PWA mobile: open wallet-app in new tab
                  window.open("/wallet-app/?action=choice", "_blank");
                }
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg
                className="w-4 h-4 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v16m8-8H4"
                />
              </svg>
              {t("ui_create_or_import_wallet", "Créer ou importer un compte")}
            </button>

            {/* Stablecoin détails */}
            <a
              href="https://rlusd.com"
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-white/75 hover:text-white hover:bg-white/5 transition-colors"
            >
              <svg
                className="w-4 h-4 text-white/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4m0 4h.01"
                />
              </svg>
              {t(
                "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
                "Stablecoin USD réglementé (détails)",
              )}
            </a>


          </div>
        </div>
      )}

      {/* QR Code modal (desktop) — scanné par wallet-app mobile + auto-connect */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative bg-[#151b1e] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
              aria-label="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            {qrStatus === "connected" ? (
              <>
                <div className="flex justify-center mb-4">
                  <svg className="w-16 h-16 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-green-400 font-medium">
                  {t("wallet_connect_success", "Connecté !")}
                </p>
              </>
            ) : qrStatus === "error" ? (
              <>
                <p className="text-sm text-red-400 mb-4">
                  {t("wallet_connect_expired", "Le QR code a expiré. Veuillez réessayer.")}
                </p>
                <button
                  onClick={() => {
                    createNavigateChallenge();
                  }}
                  className="px-6 py-3 bg-[#c9a84c] hover:bg-[#b89a40] text-[#0a0a0a] font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
                >
                  {t("wallet_connect_retry", "Réessayer")}
                </button>
              </>
            ) : qrStatus === "loading" || !qrChallenge?.qrData ? (
              <>
                <p className="text-sm text-white/80 font-medium mb-4">
                  {t("wallet_connect_loading", "Préparation de la connexion…")}
                </p>
                <div className="flex justify-center">
                  <div className="w-[200px] h-[200px] bg-white/5 rounded-xl flex items-center justify-center">
                    <div className="w-10 h-10 border-2 border-white/20 border-t-[#c9a84c] rounded-full animate-spin" />
                  </div>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-white/80 font-medium mb-4">
                  {t("ui_scan_qr_to_open_app", "Scannez avec votre mobile pour ouvrir Xcannes App")}
                </p>
                <div className="inline-block rounded-xl bg-white p-3">
                  <QRCodeSVG
                    value={qrChallenge.qrData}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
                <div className="mt-3 flex items-center justify-center gap-2 text-[11px] text-white/40">
                  <span className="inline-block w-2 h-2 bg-white/40 rounded-full animate-pulse" />
                  {t("wallet_connect_waiting", "En attente du scan…")}
                </div>
                <p className="mt-2 text-[10px] text-white/30">
                  {t("ui_create_or_import_wallet", "Créer ou importer un compte")}
                </p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
