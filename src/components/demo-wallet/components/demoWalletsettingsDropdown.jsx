"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import PreferredCurrencySelector from "@/components/wallet/components/PreferredCurrencySelector";
import { AVAILABLE_DEFAULT_CURRENCIES } from "@/components/wallet/walletDashboardConfig";

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
  onCopyAddress,
  onResetDemo,
  resetDisabled = false,
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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
            onClick={() => setIsOpen(false)}
          />

          <div
            role="menu"
            className={[
              "fixed inset-0 z-50 overflow-y-auto bg-xcannes-surface-demo demo-wallet-tooltip-scope animate-walletSettingsIn",
            ].join(" ")}
          >
            {/* Mobile header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-3">
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

            <div className="px-3 pb-4">
              {/* Comptes */}
              <div className="pt-2">
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
                        allowedCurrencyCodes={AVAILABLE_DEFAULT_CURRENCIES}
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

                {(onCopyAddress || onResetDemo) ? (
                  <div className="mt-2 space-y-2">
                    {onCopyAddress ? (
                      <button
                        type="button"
                        onClick={() => {
                          onCopyAddress?.();
                          setIsOpen(false);
                        }}
                        className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/55 shrink-0">
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                            strokeWidth={1.8}
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 9h10v12H9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"
                            />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t(
                              "ui_copy_xrpl_address_4f63ed10fc",
                              "Copier l'adresse XRPL",
                            )}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>
                    ) : null}

                    {onResetDemo ? (
                      <button
                        type="button"
                        disabled={resetDisabled}
                        onClick={() => {
                          if (resetDisabled) return;
                          onResetDemo?.();
                          setIsOpen(false);
                        }}
                        className={[
                          "w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20",
                          resetDisabled ? "opacity-50 cursor-not-allowed" : "",
                        ].join(" ")}
                      >
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/55 shrink-0">
                          <svg
                            className="w-5 h-5"
                            fill="currentColor"
                            viewBox="0 0 24 24"
                            aria-hidden
                          >
                            <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
                          </svg>
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("demo_reset", "Réinitialiser")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("demo_tt_reset", "Réinitialiser la démo.")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>
                    ) : null}
                  </div>
                ) : null}

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
