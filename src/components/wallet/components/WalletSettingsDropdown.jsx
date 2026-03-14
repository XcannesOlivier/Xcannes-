"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslation } from "next-i18next";
import { QRCodeSVG } from "qrcode.react";
import { useWallet } from "@/context/WalletContext";
import PreferredCurrencySelector from "./PreferredCurrencySelector";

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
  // Preferred currency props
  preferredCurrency,
  topCurrencies,
  fawazCurrencies,
  fawazLoading,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
}) {
  const { t } = useTranslation("common");
  const { goToChoice } = useWallet();
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

  // header → visible on md+ only ; footer → mobile only ; inline → always visible
  const visibilityClass =
    position === "header"
      ? "hidden md:relative md:block"
      : position === "footer"
        ? "relative md:hidden"
        : "relative";

  // dropdown opens downward from header/inline, upward from footer
  // md: prefixed so it doesn't override mobile fullscreen (fixed inset-0)
  const dropdownPositionClass =
    position === "footer"
      ? "md:absolute md:right-0 md:bottom-full md:mb-1.5"
      : "md:absolute md:right-0 md:top-full md:mt-1.5";

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
          className={`fixed inset-0 z-50 bg-[#151b1e] overflow-y-auto ${dropdownPositionClass} md:inset-auto md:w-48 md:rounded-xl md:bg-[#151b1e] md:border md:border-white/10 md:shadow-2xl md:overflow-hidden md:animate-in md:fade-in md:slide-in-from-top-1 md:duration-150`}
        >
          {/* Mobile fullscreen header with close button */}
          <div className="flex items-center justify-between px-4 pt-4 pb-3 md:hidden">
            <span className="text-sm font-semibold text-white/80">
              {t("ui_settings_label", "Paramètres")}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
          <div className="py-1 px-2 md:px-0">
            {/* Info & Fees */}
            <button
              type="button"
              onClick={() => {
                onOpenInfo?.();
                setIsOpen(false);
              }}
              className="w-full flex items-center gap-3 md:gap-2.5 px-4 md:px-3.5 py-3.5 md:py-2 text-sm md:text-[12px] text-white/80 hover:text-white hover:bg-white/5 transition-colors rounded-xl md:rounded-none"
            >
              <span className="inline-flex h-5 w-5 md:h-4 md:w-4 items-center justify-center rounded-full bg-white/8 border border-white/10 text-xs md:text-[10px] text-white/40 leading-none font-semibold">
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
              className="w-full flex items-center gap-3 md:gap-2.5 px-4 md:px-3.5 py-3.5 md:py-2 text-sm md:text-[12px] text-white/80 hover:text-white hover:bg-white/5 transition-colors rounded-xl md:rounded-none"
            >
              <svg
                className="w-5 h-5 md:w-4 md:h-4 text-white/40"
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
              className="w-full flex items-center gap-3 md:gap-2.5 px-4 md:px-3.5 py-3.5 md:py-2 text-sm md:text-[12px] text-white/80 hover:text-white hover:bg-white/5 transition-colors rounded-xl md:rounded-none"
            >
              <svg
                className="w-5 h-5 md:w-4 md:h-4 text-white/40"
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

            {/* Preferred currency selector */}
            {preferredCurrency && (
              <>
                <div className="my-1 mx-3 border-t border-white/8" />
                <div className="px-2 md:px-1.5 py-2">
                  <PreferredCurrencySelector
                    currentCurrency={preferredCurrency}
                    topCurrencies={topCurrencies}
                    allCurrencies={fawazCurrencies}
                    isLoading={fawazLoading}
                    onSelect={(code) => {
                      onPreferredCurrencyChange?.(code);
                    }}
                    onOpen={onLoadFawazCurrencies}
                  />
                </div>
              </>
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
