"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import PreferredCurrencySelector from "@/components/wallet/components/PreferredCurrencySelector";

/**
 * DemoWalletSettingsDropdown — settings gear button + dropdown menu.
 * Mirrors the real wallet settings dropdown visual language.
 */
export default function DemoWalletSettingsDropdown({
  onOpenInfo,
  preferredCurrency = "USD",
  topCurrencies = [],
  fawazCurrencies = [],
  fawazLoading = false,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
}) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className={[
          "shrink-0 h-9 w-9 flex items-center justify-center rounded-lg border transition-all active:scale-95",
          isOpen
            ? "bg-white/5 border-white/12 text-white shadow-[0_0_0_1px_rgba(255,255,255,0.06)]"
            : "bg-transparent border-transparent text-white/60 hover:text-white hover:bg-white/5",
        ].join(" ")}
        aria-label={t("ui_settings_label", "Paramètres")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
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
        <>
          {/* Backdrop on mobile (tap to close) */}
          <button
            type="button"
            aria-label={t("close", "Fermer")}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="menu"
            className={[
              "fixed inset-0 z-50 overflow-y-auto bg-xcannes-surface-demo demo-wallet-tooltip-scope",
              "md:inset-auto md:w-[320px] md:rounded-xl md:border md:border-white/10 md:bg-xcannes-surface-demo md:shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:overflow-visible md:animate-walletSettingsIn",
              "md:absolute md:right-0 md:top-full md:mt-1.5",
            ].join(" ")}
          >
            {/* Pointer (desktop) */}
            <div
              className="hidden md:block absolute h-3.5 w-3.5 bg-xcannes-surface-demo border border-white/10 md:top-[-7px] md:right-3 md:rotate-45"
              aria-hidden
            />

            {/* Mobile header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3 md:hidden">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                  {t("ui_settings_label", "Paramètres")}
                </div>
	                <div className="text-[12px] text-white/80 mt-1 truncate">
	                  {t("ui_wallet_settings_subtitle", "Gestion du compte")}
	                </div>
	              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                aria-label={t("close", "Fermer")}
              >
                ✕
              </button>
            </div>

            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60">
                  <svg
                    className="w-3.5 h-3.5"
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
                </span>
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.22em] uppercase text-white/60">
                    {t("ui_settings_label", "Paramètres")}
	                  </div>
	                  <div className="text-[12px] text-white/80 truncate">
	                    {t("ui_wallet_settings_subtitle", "Gestion du compte")}
	                  </div>
	                </div>
	              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-8 w-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white/80 flex items-center justify-center transition-colors duration-150"
                aria-label={t("close", "Fermer")}
              >
                ✕
              </button>
            </div>

            <div className="px-3 pb-4 md:px-3 md:pb-3">
              {/* Comptes */}
              <div className="pt-2 md:pt-2.5">
                <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                  {t("ui_settings_section_accounts", "Comptes")}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    window.open("/wallet-app/?action=choice", "_blank");
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-white/10 bg-white/3 hover:bg-white/5 hover:border-white/15 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/60 shrink-0">
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
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
	                  <div className="text-[13px] font-medium text-white/90">
	                      {t("ui_add_wallet", "Ajouter un compte")}
	                  </div>
	                  <div className="text-[11px] text-white/45 mt-0.5">
	                    {t(
	                      "ui_add_wallet_hint",
	                      "Créer ou importer un compte existant",
	                    )}
	                  </div>
                  </div>
                  <span className="text-white/25 text-lg">›</span>
                </button>
              </div>

              {/* Préférences */}
              {preferredCurrency ? (
                <div className="mt-4">
	                  <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
	                    {t("ui_settings_section_preferences", "Préférences")}
	                  </div>
	                  <div className="rounded-[10px] border border-white/10 bg-black/20 p-2.5 focus-within:border-xcannes-green/60 focus-within:ring-2 focus-within:ring-xcannes-green/20 transition-colors duration-150">
	                    <PreferredCurrencySelector
	                      currentCurrency={preferredCurrency}
	                      topCurrencies={topCurrencies}
	                      allCurrencies={fawazCurrencies}
	                      isLoading={fawazLoading}
                      onSelect={(code) => onPreferredCurrencyChange?.(code)}
                      onOpen={onLoadFawazCurrencies}
                    />
                  </div>
                </div>
              ) : null}

              {/* Support */}
              <div className="mt-4">
                <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                  {t("ui_settings_section_support", "Support")}
                </div>

                <a
                  href="https://rlusd.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/55 shrink-0">
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
                        d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4m0 4h.01"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/85">
                      {t("ui_stablecoin_rlusd", "Stablecoin RLUSD")}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {t("ui_stablecoin_rlusd_hint", "Ouvrir rlusd.com")}
                    </div>
                  </div>
                  <span className="text-white/20 text-lg">↗</span>
                </a>

                <button
                  type="button"
                  onClick={() => {
                    onOpenInfo?.();
                    setIsOpen(false);
                  }}
                  className="mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/55 shrink-0">
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
                        d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/85">
                      {t("ui_fees_and_how_it_works", "Frais et fonctionnement")}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {t("ui_settings_info_hint", "Comprendre les frais et le fonctionnement")}
                    </div>
                  </div>
                  <span className="text-white/20 text-lg">›</span>
                </button>
              </div>
            </div>
          </div>

          <style jsx global>{`
            @keyframes walletSettingsIn {
              from {
                opacity: 0;
                transform: translateY(4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .animate-walletSettingsIn {
              animation: walletSettingsIn 150ms ease-out both;
            }
          `}</style>
        </>
      )}
    </div>
  );
}
