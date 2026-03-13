"use client";

import { useTranslation } from "next-i18next";

/**
 * ReconciliationBanner — alert shown when external RLUSD spend is detected.
 *
 * Displayed when the user has spent RLUSD via another wallet (Xumm, Sologenic…)
 * and the Xcannes currency-line allocations exceed the real on-chain balance.
 *
 * The "J'ai compris" button creates a minimal self-payment with a reconcile
 * memo, permanently recording the adjustment on-chain.
 */
export default function ReconciliationBanner({
  visible = false,
  deficit = 0,
  operationsSummary = [],
  submitting = false,
  error = null,
  txHash = null,
  onConfirm,
}) {
  const { t } = useTranslation("common");

  if (!visible) return null;

  const deficitFormatted = deficit.toFixed(2);

  return (
    <div
      role="alert"
      className="
        mx-4 mb-3 rounded-xl
        bg-amber-500/10 border border-amber-500/30
        p-4
        animate-in fade-in slide-in-from-top-2
      "
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <span className="text-amber-400 text-xl shrink-0" aria-hidden>
          ⚠
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-amber-300 mb-1">
            {t("wallet.reconciliation.title", "Dépense externe détectée")}
          </h3>
          <p className="text-xs text-white/70 leading-relaxed">
            {t(
              "wallet.reconciliation.description",
              "Des fonds RLUSD ont été dépensés en dehors de Xcannes (Xumm, Sologenic…). Une correction de {{amount}} USD est nécessaire pour resynchroniser vos soldes.",
              { amount: deficitFormatted }
            )}
          </p>
        </div>
      </div>

      {/* Operation details */}
      {operationsSummary.length > 0 && (
        <div className="mt-3 ml-8 space-y-1">
          {operationsSummary.map((op, i) => (
            <div
              key={`${op.currencyCode}-${i}`}
              className="flex items-center justify-between text-xs"
            >
              <span className="text-white/60">{op.currencyCode}</span>
              <span className="text-amber-300 font-mono">
                −{op.deductedRlusd.toFixed(2)} USD
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between text-xs border-t border-white/10 pt-1 mt-1">
            <span className="text-white/80 font-medium">
              {t("wallet.reconciliation.total", "Total")}
            </span>
            <span className="text-amber-400 font-mono font-semibold">
              −{deficitFormatted} USD
            </span>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <p className="mt-2 ml-8 text-xs text-red-400">{error}</p>
      )}

      {/* Success message */}
      {txHash && (
        <p className="mt-2 ml-8 text-xs text-emerald-400">
          {t("wallet.reconciliation.success", "Correction enregistrée avec succès.")}
        </p>
      )}

      {/* Actions */}
      <div className="mt-3 ml-8 flex items-center gap-2">
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="
            px-4 py-1.5 rounded-lg text-xs font-semibold
            bg-amber-500 text-black
            hover:bg-amber-400
            disabled:opacity-50 disabled:cursor-not-allowed
            transition-colors
          "
        >
          {submitting
            ? t("wallet.reconciliation.submitting", "Correction en cours…")
            : t("wallet.reconciliation.confirm", "J'ai compris")}
        </button>

      </div>
    </div>
  );
}
