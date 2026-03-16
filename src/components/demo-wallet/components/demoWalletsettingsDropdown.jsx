"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import PreferredCurrencySelector from "@/components/wallet/components/PreferredCurrencySelector";

/**
 * DemoWalletSettingsDropdown — settings gear that opens a modal (demo wallet).
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
  const { shouldRender, isClosing } = useModalTransition(isOpen);

  const close = () => setIsOpen(false);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") close();
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

      {shouldRender ? (
        <>
          {/* Backdrop */}
          <div
            className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
              isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
            }`}
            onClick={close}
          />

          <div className="fixed inset-0 z-[10001] flex items-end md:items-center justify-center px-0 pb-0 md:px-4 md:pb-0 pointer-events-none">
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t("ui_settings_label", "Paramètres")}
              className={[
                "relative w-full h-screen md:h-auto md:max-h-[92vh] md:max-w-lg rounded-none md:rounded-2xl overflow-hidden flex flex-col pointer-events-auto",
                "wallet-modal-panel border border-white/10",
                "bg-xcannes-surface-demo demo-wallet-tooltip-scope",
                isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in",
              ].join(" ")}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Top stripe */}
              <div className="h-1 w-full bg-gradient-to-r from-xcannes-green/70 via-xcannes-green/15 to-transparent" />

              {/* Header */}
              <div className="flex items-center justify-between px-4 pt-4 pb-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                    {t("ui_settings_label", "Paramètres")}
                  </div>
                  <div className="text-[12px] text-white/80 mt-1 truncate">
                    {t("ui_demo_wallet_settings_subtitle", "Démo — mise en place")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                  }}
                  className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  aria-label={t("close", "Fermer")}
                >
                  ✕
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-3 pb-4">
                {/* Section: Actions (disabled scaffold) */}
                <div className="pt-2">
                  <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
                    {t("ui_settings_section_actions", "Actions")}
                  </div>
                  <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/3 text-left opacity-60">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/60 shrink-0">
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
                      <div className="text-[13px] font-medium text-white/85">
                        {t(
                          "ui_create_or_import_wallet",
                          "Créer ou importer un compte",
                        )}
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {t(
                          "ui_settings_demo_placeholder_desc",
                          "Aucun lien activé pour le moment",
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="my-3 border-t border-white/10" />

                {/* Section: Display (disabled scaffold) */}
                <div className="pt-0.5">
                  <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
                    {t("ui_settings_section_display", "Affichage")}
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/20 p-2.5">
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
                </div>
              </div>

              {/* Bottom actions */}
              <div className="shrink-0 border-t border-white/10 bg-black/20 px-3 py-3">
                <a
                  href="https://ripple.com/solutions/stablecoin/transparency/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => close()}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-colors"
                  title={t(
                    "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
                    "Stablecoin RLUSD (détails)",
                  )}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 shrink-0">
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
                        d="M12 3l7 4v5c0 5-3 9-7 9s-7-4-7-9V7l7-4z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/90">
                      {t(
                        "ui_stablecoin_usd_r_gul_d_details_80d8d1ba32",
                        "Stablecoin RLUSD (détails)",
                      )}
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">
                      {t(
                        "ui_stablecoin_transparency_hint",
                        "Transparence et réserves",
                      )}
                    </div>
                  </div>
                </a>

                <div className="h-2" />

                <button
                  type="button"
                  onClick={() => {
                    close();
                    onOpenInfo?.();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-left transition-colors"
                  title={t("wallet_footer_info_title", "Wallet info & fees")}
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 border border-white/10 text-white/70 shrink-0 font-semibold">
                    i
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/90">
                      {t("wallet_footer_info_fees", "Info & Fees")}
                    </div>
                    <div className="text-[11px] text-white/45 mt-0.5">
                      {t("ui_settings_open_info_hint", "Infos du wallet et frais")}
                    </div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
