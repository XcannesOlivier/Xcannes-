"use client";

import { useMemo } from "react";
import { useTranslation } from "next-i18next";

export default function WalletDashboardCurrencyLinesPanel({
  currencyLinesLoading,
  currencyLinesError,
  currencyLines,
  onRefresh,
  onDelete
}) {
  const { t } = useTranslation("common");
  const neutralActionBtnMuted =
    "rounded-lg border border-white/20 bg-white/5 text-white/70 font-semibold transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const redActionBtnMuted =
    "rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171] font-semibold transition-all duration-200 hover:bg-[#EF4444]/20 hover:text-[#FCA5A5] hover:scale-105 active:scale-95";
  const normalizedLines = useMemo(() => {
    return (currencyLines || []).map((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
      return { code, allocated };
    });
  }, [currencyLines]);
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-white/80">{t("ui_currency_lines_267fc2eff3", "Currency lines")}

        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh?.();
          }}
          className={`px-2 py-1 text-[10px] ${neutralActionBtnMuted}`}
          disabled={currencyLinesLoading}>{t("ui_refresh_e781061534", "Refresh")}


        </button>
      </div>

      {currencyLinesError &&
      <div className="text-[11px] text-red-400">{currencyLinesError}</div>
      }

      <div className="space-y-2">
        {normalizedLines.length === 0 ?
        <div className="text-[11px] text-white/40">{t("ui_no_currency_lines_yet_9630af229d", "No currency lines yet.")}</div> :

        <div className="max-h-48 overflow-y-auto pr-1 space-y-2">
            {normalizedLines.map((line) =>
          <div
                key={line.code}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2">

                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-white/80">
                    {line.code}
                  </div>
                  <div className="text-[10px] text-white/40">
                    {line.allocated.toLocaleString("en-US", {
                    maximumFractionDigits: 6
                  })}{" "}
                    {t("currency_rlusd_code", "RLUSD")}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete?.(line.code);
                  }}
                  className={`px-2 py-1 text-[10px] ${redActionBtnMuted}`}>

                  {t("delete", "Delete")}
                </button>
              </div>
          )}
          </div>
        }
      </div>
    </div>);

}
