"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import {
  AVAILABLE_DEFAULT_CURRENCIES,
  validateWalletLabel,
} from "../walletDashboardConfig";

/**
 * WalletSetupDropdown — centralised 2-step activation panel.
 *
 * Displayed below the total balance / wallet name block when the wallet
 * setup is not yet complete. Two steps only:
 *
 *   Step 1 — Fund wallet with ≥ 1 XRP (covers base reserve).
 *   Step 2 — Choose wallet name + preferred currency, then validate.
 *            The validation triggers the RLUSD TrustSet with a
 *            wallet_label memo containing both the name and the currency.
 *
 * The dropdown disappears once both steps are done.
 */
export default function WalletSetupDropdown({
  // Wallet state
  isWalletActivated,
  hasRlusdTrustline,
  walletLabel,
  isWalletLabelLocked,
  // Actions
  onActivateWallet,
  onConfirmSetup, // ({ label, defaultCurrency }) => void — triggers RLUSD TrustSet
  activeAction, // when another modal/action opens, auto-close this dropdown
}) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // ── Grace period: delay initial render by 150 ms so walletLabel
  //    has time to arrive from the server, avoiding a flash of
  //    "Configuration requise" on wallets that are already set up. ──
  const [graceElapsed, setGraceElapsed] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setGraceElapsed(true), 400);
    return () => clearTimeout(id);
  }, []);

  // ── Step 2 local form state ─────────────────────────────────
  const [labelDraft, setLabelDraft] = useState("");
  const [currencyDraft, setCurrencyDraft] = useState("");
  const [labelError, setLabelError] = useState("");

  // ── Computed step statuses ──────────────────────────────────
  const isStep1Done = isWalletActivated === true;
  const isStep2Done =
    hasRlusdTrustline === true &&
    Boolean(String(walletLabel || "").trim() && isWalletLabelLocked);

  const completedCount = (isStep1Done ? 1 : 0) + (isStep2Done ? 1 : 0);
  const totalSteps = 2;
  const allDone = isStep1Done && isStep2Done;

  // ── Auto-close when another inline modal/action opens ──────
  useEffect(() => {
    if (activeAction) setIsOpen(false);
  }, [activeAction]);

  // ── Close on outside click ─────────────────────────────────
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // ── Form submit ────────────────────────────────────────────
  const handleValidate = useCallback(() => {
    const trimmed = labelDraft.trim();
    if (!validateWalletLabel(trimmed)) {
      setLabelError(
        t(
          "ui_wallet_label_validation_error_f4",
          "1 ou 2 mots, 7 lettres max par mot, A-Z uniquement.",
        ),
      );
      return;
    }
    setLabelError("");
    setIsOpen(false);
    onConfirmSetup?.({
      label: trimmed,
      defaultCurrency: currencyDraft || null,
    });
  }, [currencyDraft, labelDraft, onConfirmSetup, t]);

  // ── Keyboard shortcut for step 2 input ─────────────────────
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleValidate();
      }
    },
    [handleValidate],
  );

  // Don't render anything if everything is done
  // (MUST be after all hooks to respect React rules of hooks)
  if (allDone) return null;

  // Hide during the initial grace period to avoid flashing "Configuration
  // requise" while the walletLabel fetch is still in-flight (~100-200 ms).
  if (!graceElapsed) return null;

  // ── Progress bar width ─────────────────────────────────────
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  // ── Step icon helper ───────────────────────────────────────
  const stepIcon = (done, num) =>
    done ? (
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400 text-[11px]">
        ✓
      </span>
    ) : (
      <span className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white/60 text-[10px] font-semibold">
        {num}
      </span>
    );

  return (
    <div className="relative w-full max-w-[460px]" ref={dropdownRef}>
      {/* ── Trigger button ── */}
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-amber-500/8 hover:bg-amber-500/12 border border-amber-400/20 hover:border-amber-400/30 transition-all"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {/* Animated pulse indicator */}
          <span className="relative flex h-2.5 w-2.5 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/60" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-amber-400" />
          </span>
          <span className="text-[11px] text-amber-200/90 font-medium truncate">
            {t("ui_setup_steps_remaining", "Configuration requise")}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-amber-300/70 font-mono">
            {completedCount}/{totalSteps}
          </span>
          <svg
            className={`w-3.5 h-3.5 text-amber-300/50 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {/* ── Dropdown panel ── */}
      {isOpen && (
        <div className="fixed inset-0 z-50 bg-[#111418] overflow-y-auto md:absolute md:inset-auto md:left-0 md:right-0 md:mt-1.5 md:rounded-xl md:border md:border-white/10 md:shadow-2xl md:overflow-hidden">
          {/* Close button (mobile fullscreen) */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 md:hidden">
            <span className="text-sm font-semibold text-white/80">
              {t("ui_setup_steps_remaining", "Configuration requise")}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-white/60 hover:text-white transition-colors text-xl"
            >
              ✕
            </button>
          </div>
          {/* Progress bar */}
          <div className="h-1 w-full bg-white/5">
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>

          <div className="p-3 space-y-2">
            {/* ────────────────────────────────────────────────
                STEP 1 — Fund wallet with 1 XRP
               ──────────────────────────────────────────────── */}
            <button
              type="button"
              disabled={isStep1Done}
              onClick={() => {
                setIsOpen(false);
                onActivateWallet?.();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-left ${
                isStep1Done
                  ? "bg-white/3 opacity-60 cursor-default"
                  : "bg-white/5 hover:bg-white/8 border border-white/10 hover:border-white/20 cursor-pointer"
              }`}
            >
              {stepIcon(isStep1Done, 1)}
              <div className="flex-1 min-w-0">
                <div
                  className={`text-[12px] font-semibold ${isStep1Done ? "text-white/60 line-through" : "text-white/90"}`}
                >
                  {t("ui_setup_step_xrp", "Activer le wallet")}
                </div>
                <div className="text-[10px] text-white/40 mt-0.5">
                  {isStep1Done
                    ? t("ui_setup_step_done", "Effectué")
                    : t(
                        "ui_setup_step_xrp_desc",
                        "1 XRP requis pour activer le compte",
                      )}
                </div>
              </div>
              {!isStep1Done && (
                <span className="text-white/30 text-sm">›</span>
              )}
            </button>

            {/* ────────────────────────────────────────────────
                STEP 2 — Name + Currency → Validate = RLUSD TrustSet
               ──────────────────────────────────────────────── */}
            <div
              className={`w-full rounded-lg transition-all ${
                isStep2Done
                  ? "bg-white/3 opacity-60 px-3 py-2.5"
                  : !isStep1Done
                    ? "bg-white/3 opacity-40 px-3 py-2.5"
                    : "bg-white/5 border border-white/10 px-3 py-3"
              }`}
            >
              {/* Step header */}
              <div className="flex items-center gap-3">
                {stepIcon(isStep2Done, 2)}
                <div className="flex-1 min-w-0">
                  <div
                    className={`text-[12px] font-semibold ${
                      isStep2Done
                        ? "text-white/60 line-through"
                        : !isStep1Done
                          ? "text-white/30"
                          : "text-white/90"
                    }`}
                  >
                    {t("ui_setup_step_name_currency", "Configurer le wallet")}
                  </div>
                  <div className="text-[10px] text-white/40 mt-0.5">
                    {isStep2Done
                      ? `${t("ui_setup_step_done", "Effectué")} — ${walletLabel}`
                      : !isStep1Done
                        ? t(
                            "ui_setup_step_requires_xrp",
                            "Nécessite 1 XRP d'abord",
                          )
                        : t(
                            "ui_setup_step_name_currency_desc",
                            "Nom du wallet, devise préférée, puis activation USD",
                          )}
                  </div>
                </div>
              </div>

              {/* ── Inline form (only when step 1 done + step 2 not done) ── */}
              {isStep1Done && !isStep2Done && (
                <div className="mt-3 space-y-3 pl-8">
                  {/* Wallet name input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                      {t("ui_setup_label_name", "Nom du wallet")} *
                    </label>
                    <input
                      type="text"
                      value={labelDraft}
                      onChange={(e) => {
                        setLabelDraft(e.target.value);
                        setLabelError("");
                      }}
                      onKeyDown={handleKeyDown}
                      placeholder={t(
                        "ui_rlusd_setup_placeholder_f4",
                        "ex: John ou My Wallet",
                      )}
                      autoFocus
                      maxLength={15}
                      className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
                    />
                    {labelError && (
                      <p className="text-[10px] text-red-400">{labelError}</p>
                    )}
                    <p className="text-[9px] text-white/40">
                      {t(
                        "ui_setup_label_hint",
                        "1 ou 2 mots, 7 lettres max par mot, A-Z uniquement",
                      )}
                    </p>
                  </div>

                  {/* Currency selector */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-semibold text-white/60 uppercase tracking-wider">
                      {t("ui_setup_label_currency", "Devise préférée")}
                      <span className="ml-1 text-white/30 font-normal normal-case">
                        ({t("ui_optional_f4", "optionnel")})
                      </span>
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {AVAILABLE_DEFAULT_CURRENCIES.map((code) => (
                        <button
                          key={code}
                          type="button"
                          onClick={() =>
                            setCurrencyDraft((prev) =>
                              prev === code ? "" : code,
                            )
                          }
                          className={[
                            "px-2.5 py-1 rounded-md border text-[11px] font-mono transition-all active:scale-95",
                            currencyDraft === code
                              ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                              : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80",
                          ].join(" ")}
                        >
                          {code}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Validate button — triggers RLUSD TrustSet with memo */}
                  <button
                    type="button"
                    onClick={handleValidate}
                    disabled={!labelDraft.trim()}
                    className={`w-full rounded-lg px-4 py-2 text-xs font-semibold transition-all ${
                      labelDraft.trim()
                        ? "border border-emerald-400/30 bg-emerald-400/15 text-emerald-300 hover:bg-emerald-400/25 hover:text-emerald-200"
                        : "border border-white/10 bg-white/5 text-white/30 cursor-not-allowed"
                    }`}
                  >
                    {t(
                      "ui_setup_validate",
                      "Valider et activer USD (RLUSD)",
                    )}
                  </button>
                  <p className="text-[9px] text-white/30 text-center leading-snug">
                    {t(
                      "ui_setup_validate_hint",
                      "La validation active la trustline RLUSD avec votre nom et devise en mémo on-chain.",
                    )}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
