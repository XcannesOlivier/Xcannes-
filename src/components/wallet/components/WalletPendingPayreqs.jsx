"use client";

import { useTranslation } from "next-i18next";
import { formatAmountWithSymbol } from "../walletDashboardConfig";

/**
 * WalletPendingPayreqs — panneau repliable affichant les demandes de paiement
 * sauvegardées (en attente de conversion). Chaque entrée peut être reprise
 * (→ ouvre le PayreqModal) ou supprimée.
 */
export default function WalletPendingPayreqs({
  pendingPayreqs = [],
  onResume,
  onRemove,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";

  if (!pendingPayreqs.length) return null;

  return (
    <div className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] uppercase tracking-wide text-amber-200/70 font-semibold flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-400/30 text-amber-100 text-[9px] font-bold">
            {pendingPayreqs.length}
          </span>
          {t("ui_pending_payreqs_title", "Demandes en attente")}
        </div>
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
        {pendingPayreqs.map((entry) => {
          const pr = entry.payreq || {};
          const beneficiary =
            pr.beneficiaryLabel || pr.to
              ? pr.beneficiaryLabel ||
                `${String(pr.to || "").slice(0, 6)}...${String(pr.to || "").slice(-4)}`
              : t("ui_wallet_unknown", "Unknown wallet");
          const currency = String(
            pr.targetCurrencyCode || pr.displayCurrency || "",
          ).toUpperCase();
          const displayAmount = pr.displayAmount ?? pr.amountRlusd ?? null;
          const amountLabel =
            displayAmount != null && currency
              ? formatAmountWithSymbol(
                  locale,
                  Number(displayAmount),
                  currency,
                  {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 6,
                  },
                )
              : null;

          const savedDate = entry.savedAt
            ? new Date(entry.savedAt).toLocaleDateString(locale, {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              })
            : null;

          return (
            <div
              key={entry.id}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/8 bg-black/20 px-2.5 py-2 group"
            >
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="text-xs text-white/80 font-medium truncate">
                  {beneficiary}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-white/60">
                  {amountLabel ? (
                    <span className="font-mono">{amountLabel}</span>
                  ) : null}
                  {savedDate ? <span>· {savedDate}</span> : null}
                </div>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => onResume?.(entry)}
                  className="rounded-md border border-xcannes-green/40 bg-xcannes-green/20 px-2 py-1 text-[10px] text-xcannes-green font-semibold hover:bg-xcannes-green/30 transition-colors"
                  title={t("ui_resume_payreq", "Reprendre")}
                >
                  {t("ui_pay_button", "Payer")}
                </button>
                <button
                  type="button"
                  onClick={() => onRemove?.(entry.id)}
                  className="rounded-md border border-white/10 bg-white/5 px-1.5 py-1 text-[10px] text-white/40 hover:text-red-300 hover:border-red-400/30 transition-colors"
                  title={t("ui_delete_payreq", "Supprimer")}
                >
                  ✕
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
