"use client";

import { useCallback, useState } from "react";
import { useTranslation } from "next-i18next";

const AVAILABLE_DEFAULT_CURRENCIES = [
  "EUR",
  "USD",
  "GBP",
  "CHF",
  "CAD",
  "JPY",
  "AUD",
];

/**
 * Modal shown when the user installs the RLUSD trustline.
 * Collects: wallet name (required) + default currency (optional).
 * The collected data will be embedded as a wallet_label memo
 * on the TrustSet transaction → free naming, no RLUSD payment.
 */
export default function WalletRlusdSetupModal({ open, onClose, onConfirm }) {
  const { t } = useTranslation("common");
  const [label, setLabel] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("");
  const [error, setError] = useState("");

  const validateLabel = useCallback((value) => {
    const trimmed = String(value || "").trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordPattern = /^[A-Za-z]+$/;
    if (words.length < 1 || words.length > 2) return false;
    return words.every((w) => w.length <= 7 && wordPattern.test(w));
  }, []);

  const handleConfirm = useCallback(() => {
    const trimmed = label.trim();
    if (!validateLabel(trimmed)) {
      setError(
        t(
          "ui_wallet_label_validation_error_f4",
          "1 or 2 words, max 7 letters per word, A-Z only.",
        ),
      );
      return;
    }
    setError("");
    onConfirm?.({
      label: trimmed,
      defaultCurrency: defaultCurrency || null,
    });
  }, [defaultCurrency, label, onConfirm, t, validateLabel]);

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleConfirm();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        onClose?.();
      }
    },
    [handleConfirm, onClose],
  );

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm mx-4 rounded-2xl border border-white/10 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a] p-5 shadow-2xl space-y-4">
        {/* Title */}
        <div className="text-center space-y-1">
          <h2 className="text-base font-semibold text-white">
            {t("ui_rlusd_setup_title_f4", "Set up your wallet")}
          </h2>
          <p className="text-[11px] text-white/50">
            {t(
              "ui_rlusd_setup_subtitle_f4",
              "Choose a name and optionally your default currency. This will be recorded on the RLUSD trustline activation.",
            )}
          </p>
        </div>

        {/* Wallet name */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-white/70">
            {t("ui_rlusd_setup_label_name_f4", "Wallet name")} *
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => {
              setLabel(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            placeholder={t(
              "ui_rlusd_setup_placeholder_f4",
              "e.g. John or My Wallet",
            )}
            autoFocus
            maxLength={15}
            className="w-full rounded-lg border border-white/15 bg-black/40 px-3 py-2 text-sm text-white placeholder-white/30 outline-none focus:border-white/30 focus:ring-1 focus:ring-white/20 transition-all"
          />
          {error && <p className="text-[10px] text-red-400">{error}</p>}
          <p className="text-[10px] text-white/40">
            {t(
              "ui_rlusd_setup_label_hint_f4",
              "1 or 2 words, max 7 letters each, A-Z only.",
            )}
          </p>
        </div>

        {/* Default currency (optional) */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-white/70">
            {t("ui_rlusd_setup_label_currency_f4", "Default currency")}
            <span className="ml-1 text-white/40 font-normal">
              ({t("ui_optional_f4", "optional")})
            </span>
          </label>
          <div className="flex flex-wrap gap-2">
            {AVAILABLE_DEFAULT_CURRENCIES.map((code) => (
              <button
                key={code}
                type="button"
                onClick={() =>
                  setDefaultCurrency((prev) => (prev === code ? "" : code))
                }
                className={[
                  "px-3 py-1.5 rounded-lg border text-xs font-mono transition-all",
                  defaultCurrency === code
                    ? "border-emerald-400/40 bg-emerald-400/15 text-emerald-300"
                    : "border-white/15 bg-white/5 text-white/60 hover:bg-white/10 hover:text-white/80",
                ].join(" ")}
              >
                {code}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs font-semibold text-white/70 hover:bg-white/10 hover:text-white transition-all"
          >
            {t("cancel", "Cancel")}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="flex-1 rounded-lg border border-emerald-400/30 bg-emerald-400/15 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-400/25 hover:text-emerald-200 transition-all"
          >
            {t("ui_rlusd_setup_confirm_f4", "Activate RLUSD")}
          </button>
        </div>
      </div>
    </div>
  );
}
