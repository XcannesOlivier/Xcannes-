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
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [helpOpenIndex, setHelpOpenIndex] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Close help modal on Escape
  useEffect(() => {
    if (!showHelpModal) return;
    const handler = (e) => {
      if (e.key === "Escape") setShowHelpModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showHelpModal]);

  // Close security modal on Escape
  useEffect(() => {
    if (!showSecurityModal) return;
    const handler = (e) => {
      if (e.key === "Escape") setShowSecurityModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showSecurityModal]);

  // Close terms modal on Escape
  useEffect(() => {
    if (!showTermsModal) return;
    const handler = (e) => {
      if (e.key === "Escape") setShowTermsModal(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [showTermsModal]);

  const HELP_QA = [
    {
      q: t("ui_help_q1", "Comment recevoir des fonds ?"),
      a: t(
        "ui_help_a1",
        "Ouvrez “Recevoir”, partagez le QR code ou copiez votre adresse publique.",
      ),
    },
    {
      q: t("ui_help_q2", "Quels sont les frais ?"),
      a: t(
        "ui_help_a2",
        "Les frais XRPL varient selon le réseau. XCANNES affiche les coûts avant validation quand c’est possible.",
      ),
    },
    {
      q: t("ui_help_q3", "Pourquoi une conversion RLUSD ?"),
      a: t(
        "ui_help_a3",
        "Certaines opérations utilisent RLUSD comme base. Vous pouvez convertir depuis/vers vos lignes de devises.",
      ),
    },
    {
      q: t("ui_help_q4", "Que faire si une transaction est en attente ?"),
      a: t(
        "ui_help_a4",
        "Attendez la validation sur le ledger. Si le réseau est lent, relancez le rafraîchissement du wallet.",
      ),
    },
    {
      q: t("ui_help_q5", "Sécurité : comment verrouiller mon wallet ?"),
      a: t(
        "ui_help_a5",
        "Le wallet se déconnecte automatiquement après inactivité et lors du changement d’onglet (hors mode PWA).",
      ),
    },
  ];

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

  const arrowPositionClass =
    position === "footer"
      ? "md:bottom-[-7px] md:right-3 md:rotate-45"
      : "md:top-[-7px] md:right-3 md:rotate-45";

  const isDesktop = typeof window !== "undefined"
    ? window.matchMedia?.("(min-width: 768px)")?.matches
    : false;

  return (
    <div className={visibilityClass} ref={ref}>
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
              "fixed inset-0 z-50 overflow-y-auto bg-elevated",
              "md:inset-auto md:w-[320px] md:rounded-xl md:border md:border-white/10 md:bg-elevated md:shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:overflow-visible md:animate-walletSettingsIn",
              dropdownPositionClass,
            ].join(" ")}
          >
            {/* Pointer (desktop) */}
            <div
              className={[
                "hidden md:block absolute h-3.5 w-3.5 bg-elevated border border-white/10",
                arrowPositionClass,
              ].join(" ")}
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
                className="h-10 w-10 text-white/50 hover:text-white/80 flex items-center justify-center transition-colors"
                aria-label={t("close", "Fermer")}
              >
                ✕
              </button>
            </div>

            {/* Desktop header */}
            <div className="hidden md:flex items-center justify-between px-4 py-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="inline-flex h-6 w-6 items-center justify-center rounded-lg bg-white/5 border border-white/10 text-white/60">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z" />
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
                className="h-8 w-8 text-white/45 hover:text-white/80 flex items-center justify-center transition-colors duration-150"
                aria-label={t("close", "Fermer")}
              >
                ✕
              </button>
            </div>

            <div className="px-3 pb-4 md:px-3 md:pb-3">
              {/* Section: Comptes */}
              <div className="pt-2 md:pt-2.5">
                <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
                  {t("ui_settings_section_accounts", "Comptes")}
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);

                    // PWA embedded: navigate directly to choice screen (already authenticated)
                    if (goToChoice) {
                      goToChoice();
                      return;
                    }

                    // Desktop: show QR modal for wallet-app to scan
                    if (isDesktop) {
                      setShowQrModal(true);
                    } else {
                      // Non-PWA mobile: open wallet-app in new tab
                      window.open("/wallet-app/?action=choice", "_blank");
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-white/10 bg-white/3 hover:bg-white/5 hover:border-white/15 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/60 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
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

              {/* Section: Préférences */}
              {preferredCurrency && (
                <>
                  <div className="mt-4">
	                    <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
	                      {t("ui_settings_section_preferences", "Préférences")}
	                    </div>
	                    <div className="rounded-[10px] border border-white/10 bg-black/20 p-2.5 focus-within:border-xcannes-green/60 focus-within:ring-2 focus-within:ring-xcannes-green/20 transition-colors duration-150">
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
                </>
              )}

              {/* Section: Support */}
              <div className="mt-4">
                <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] uppercase text-white/35">
                  {t("ui_settings_section_support", "Support")}
                </div>

                <a
                  href="https://rlusd.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsOpen(false)}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/85 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 6v4m0 4h.01" />
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
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/85 shrink-0">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M12 2a10 10 0 100 20 10 10 0 000-20z" />
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

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowSecurityModal(true);
                  }}
                  className="mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/85 shrink-0">
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
                        d="M12 22s8-4 8-10V6l-8-4-8 4v6c0 6 8 10 8 10z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 12l2 2 4-4"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/85">
                      {t("ui_security", "Sécurité")}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {t("ui_security_hint", "Comprendre la protection du compte")}
                    </div>
                  </div>
                  <span className="text-white/20 text-lg">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setHelpOpenIndex(0);
                    setShowHelpModal(true);
                  }}
                  className="mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/85 shrink-0">
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
                        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a10.2 10.2 0 01-4.4-1l-3.6 1 1.2-3.2A7.61 7.61 0 013 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/85">
                      {t("ui_questions_and_help", "Questions et aides")}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {t("ui_questions_and_help_hint", "FAQ rapide et réponses")}
                    </div>
                  </div>
                  <span className="text-white/20 text-lg">›</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    setShowTermsModal(true);
                  }}
                  className="mt-2 w-full flex items-center gap-3 px-3 py-3 rounded-[10px] border border-transparent hover:border-white/10 hover:bg-white/5 transition-colors duration-150 text-left focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20"
                >
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-[10px] bg-white/5 border border-white/10 text-white/85 shrink-0">
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
                        d="M7 3h10a2 2 0 012 2v14a2 2 0 01-2 2H7a2 2 0 01-2-2V5a2 2 0 012-2z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 7h6M9 11h6M9 15h4"
                      />
                    </svg>
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-medium text-white/85">
                      {t("ui_terms_of_use", "Conditions d'utilisations")}
                    </div>
                    <div className="text-[11px] text-white/40 mt-0.5">
                      {t("ui_terms_of_use_hint", "Lire les conditions d'utilisation")}
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
	              {t("ui_scan_qr_to_open_app", "Scannez avec votre mobile pour ouvrir XCANNES App")}
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

      {/* Fullscreen security modal */}
      {showSecurityModal && (
        <div
          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
          role="dialog"
          aria-modal="true"
          aria-label={t("ui_security", "Sécurité")}
        >
          <div className="h-full w-full flex flex-col">
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                    {t("ui_security", "Sécurité")}
                  </div>
                  <div className="text-[12px] text-white/80 mt-1 truncate">
                    {t("ui_security_subtitle", "Protection du compte XCANNES")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowSecurityModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  aria-label={t("close", "Fermer")}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_account", "Compte")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_security_account_body",
                    "XCANNES protège l’accès à vos opérations via la connexion au wallet (Xumm / PWA) et des mécanismes de verrouillage automatique. Nous n’affichons pas vos clés privées dans l’interface.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_lock", "Verrouillage")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_security_lock_body",
                    "Le wallet peut se déconnecter automatiquement après une période d’inactivité et lors du changement d’onglet (selon le mode). Utilisez aussi le bouton de déconnexion pour verrouiller immédiatement.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_tips", "Bonnes pratiques")}
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-white/75">
                  <li>
                    {t(
                      "ui_security_tip_1",
                      "Ne partagez jamais vos phrases de récupération / secrets.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_security_tip_2",
                      "Vérifiez toujours l’adresse et le montant avant de signer.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_security_tip_3",
                      "Évitez les réseaux Wi‑Fi publics pour des opérations sensibles.",
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen help modal (FAQ) */}
      {showHelpModal && (
        <div
          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
          role="dialog"
          aria-modal="true"
          aria-label={t("ui_questions_and_help", "Questions et aides")}
        >
          <div className="h-full w-full flex flex-col">
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                    {t("ui_questions_and_help", "Questions et aides")}
                  </div>
                  <div className="text-[12px] text-white/80 mt-1 truncate">
                    {t("ui_questions_and_help_subtitle", "Réponses rapides")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelpModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  aria-label={t("close", "Fermer")}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
              {HELP_QA.map((item, idx) => {
                const open = helpOpenIndex === idx;
                const id = `wallet-help-${idx}`;
                return (
                  <div
                    key={id}
                    className="rounded-[14px] border border-white/10 bg-white/5 overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                      onClick={() => setHelpOpenIndex(open ? -1 : idx)}
                      aria-expanded={open}
                      aria-controls={`${id}-panel`}
                    >
                      <div className="text-[14px] font-medium text-white/90">
                        {item.q}
                      </div>
                      <svg
                        className={[
                          "w-5 h-5 text-white/50 transition-transform",
                          open ? "rotate-180" : "",
                        ].join(" ")}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19 9l-7 7-7-7"
                        />
                      </svg>
                    </button>

                    {open && (
                      <div
                        id={`${id}-panel`}
                        className="px-4 pb-4 text-[12px] leading-relaxed text-white/70"
                      >
                        {item.a}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen terms modal */}
      {showTermsModal && (
        <div
          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
          role="dialog"
          aria-modal="true"
          aria-label={t("ui_terms_of_use", "Conditions d'utilisations")}
        >
          <div className="h-full w-full flex flex-col">
            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                    {t("ui_terms_of_use", "Conditions d'utilisations")}
                  </div>
                  <div className="text-[12px] text-white/80 mt-1 truncate">
                    {t("ui_terms_subtitle", "Conditions d'utilisation XCANNES")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTermsModal(false)}
                  className="h-10 w-10 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors"
                  aria-label={t("close", "Fermer")}
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_scope", "Portée")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_terms_scope_body",
                    "Ces conditions encadrent l’utilisation du wallet et des services XCANNES. Elles ne constituent pas un conseil financier.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_user", "Responsabilités")}
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-white/75">
                  <li>
                    {t(
                      "ui_terms_user_1",
                      "Vous êtes responsable des adresses, montants et destinataires avant signature.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_terms_user_2",
                      "Ne partagez jamais vos secrets / phrases de récupération.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_terms_user_3",
                      "Respectez les lois applicables à votre juridiction.",
                    )}
                  </li>
                </ul>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_limits", "Limites")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_terms_limits_body",
                    "XCANNES s’appuie sur XRPL et des fournisseurs tiers. La disponibilité, les délais de validation et les frais réseau peuvent varier.",
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
