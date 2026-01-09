"use client";import { useTranslation } from "next-i18next";

export default function WalletDashboardCurrencyLinesPanel({
  currencyLinesLoading,
  currencyLinesError,
  currencyLinesSummary,
  currencyLines,
  onRefresh,
  onDelete
}) {const { t } = useTranslation("common");
  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-white/80">{t("ui_currency_lines_allocations_r_d87a98865f", "Currency lines (allocations RLUSD)")}

        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRefresh?.();
          }}
          className="px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 text-[10px] text-white/60 border border-white/10 transition-colors"
          disabled={currencyLinesLoading}>{t("ui_refresh_e781061534", "Refresh")}


        </button>
      </div>

      {currencyLinesError &&
      <div className="text-[11px] text-red-400">{currencyLinesError}</div>
      }

      <div className="grid grid-cols-3 gap-2 text-[10px] text-white/60">
        <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
          <div className="text-white/40">{t("ui_on_chain_da60620342", "On-chain")}</div>
          <div className="font-mono text-white/80">
            {currencyLinesSummary?.rlusdOnChain == null ?
            "—" :
            Number(currencyLinesSummary.rlusdOnChain).toLocaleString("en-US", {
              maximumFractionDigits: 6
            })}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
          <div className="text-white/40">{t("ui_allocated_9efb034adc", "Allocated")}</div>
          <div className="font-mono text-white/80">
            {Number(currencyLinesSummary?.totalAllocatedRlusd || 0).toLocaleString(
              "en-US",
              { maximumFractionDigits: 6 }
            )}
          </div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
          <div className="text-white/40">{t("ui_unallocated_00e808616c", "Unallocated")}</div>
          <div className="font-mono text-white/80">
            {currencyLinesSummary?.unallocatedRlusd == null ?
            "—" :
            Number(currencyLinesSummary.unallocatedRlusd).toLocaleString("en-US", {
              maximumFractionDigits: 6
            })}
          </div>
        </div>
      </div>

      <div className="space-y-1">
        {(currencyLines || []).length === 0 ?
        <div className="text-[11px] text-white/40">{t("ui_no_currency_lines_yet_9630af229d", "No currency lines yet.")}</div> :

        currencyLines.map((line) => {
          const code = String(line?.currencyCode || "").toUpperCase();
          const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
          return (
            <div
              key={code}
              className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">

                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-white/80">
                    {code}
                  </div>
	                  <div className="text-[10px] text-white/40">
	                    {allocated.toLocaleString("en-US", {
	                    maximumFractionDigits: 6
	                  })}{" "}
	                    {t("currency_rlusd_code", "RLUSD")}
	                  </div>
	                </div>
                <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete?.(code);
                }}
                className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-[10px] text-red-200 border border-red-500/30 transition-colors">

	                  {t("delete", "Delete")}
	                </button>
              </div>);

        })
        }
      </div>
    </div>);

}
