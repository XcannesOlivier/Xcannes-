"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { QRCodeSVG } from "qrcode.react";

/**
 * Settings gear button + dropdown menu.
 * Shared between WalletDashboardHeader (desktop) and WalletDashboardFooter (mobile).
 *
 * @param {object} props
 * @param {"header"|"footer"} props.position – controls drop direction and responsive visibility
 */
export default function WalletSettingsDropdown({
  position = "header",
  onDisconnect,
  onCopyAddress,
  onOpenWalletLabelEditor,
  onRefreshWallet,
  onOpenInfo,
  isConnecting,
  isRefreshing,
  isWalletLabelLocked,
}) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // header → visible on md+ only ; footer → visible on mobile only
  const visibilityClass =
    position === "header" ? "hidden md:relative md:block" : "relative md:hidden";

  // dropdown opens downward from header, upward from footer
  const dropdownPositionClass =
    position === "header"
      ? "absolute right-0 top-full mt-1.5"
      : "absolute right-0 bottom-full mb-1.5";

  return (
    <div className={visibilityClass} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={[
          "transition-all active:scale-95 rounded-lg",
          position === "footer"
            ? "shrink-0 h-9 w-9 flex items-center justify-center bg-transparent border border-transparent hover:bg-transparent text-white/60 hover:text-white"
            : "flex items-center gap-1.5 px-2.5 py-1.5 text-xs bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/60 hover:text-white/90",
        ].join(" ")}
        aria-label={t("ui_settings_label", "Paramètres")}
      >
        <svg
          className="w-5 h-5 md:w-4 md:h-4"
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
        <span className="hidden md:inline">
          {t("ui_settings_label", "Paramètres")}
        </span>
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
            {/* Mobile: lien direct | Desktop: QR code scanné par wallet-app */}
            <a
              href="/wallet-app/?action=choice"
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => {
                const isDesktop = window.matchMedia("(min-width: 768px)").matches;
                if (isDesktop) {
                  e.preventDefault();
                  setIsOpen(false);
                  setShowQrModal(true);
                } else {
                  setIsOpen(false);
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
            </a>

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

            {/* Séparateur masqué avec le bouton déconnecter */}
            {false && <div className="my-1 mx-3 border-t border-white/8" />}

            {/* Déconnecter — masqué (auto-lock gère la déconnexion) */}
            {false && (
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onDisconnect?.();
              }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-[12px] text-red-400/80 hover:text-red-400 hover:bg-red-400/5 transition-colors"
            >
              <svg
                className="w-4 h-4 text-red-400/50"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={1.8}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                />
              </svg>
              {t("nav_sign_out", "Se déconnecter")}
            </button>
            )}
          </div>
        </div>
      )}

      {/* QR Code modal (desktop) — scanné par wallet-app mobile */}
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
            <p className="text-sm text-white/80 font-medium mb-4">
              {t("ui_scan_qr_to_open_app", "Scannez avec votre mobile pour ouvrir Xcannes App")}
            </p>
            <div className="inline-block rounded-xl bg-white p-3">
              <QRCodeSVG
                value={JSON.stringify({ type: "xcannes:navigate", screen: "choice" })}
                size={200}
                level="M"
                includeMargin={false}
              />
            </div>
            <p className="mt-3 text-[11px] text-white/40">
              {t("ui_create_or_import_wallet", "Créer ou importer un compte")}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
