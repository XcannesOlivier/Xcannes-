"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";

export default function WalletDashboardCurrencyLinesPanel({
  currencyLinesLoading,
  currencyLinesError,
  currencyLinesSummary,
  currencyLines,
  onRefresh,
  onDelete
}) {const { t } = useTranslation("common");
  const normalizedLines = useMemo(() => {
    return (currencyLines || []).map((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
      return { code, allocated };
    });
  }, [currencyLines]);
  const [selectedLineCode, setSelectedLineCode] = useState("");

  useEffect(() => {
    if (!normalizedLines.length) {
      if (selectedLineCode) setSelectedLineCode("");
      return;
    }
    if (!normalizedLines.some((line) => line.code === selectedLineCode)) {
      setSelectedLineCode(normalizedLines[0].code);
    }
  }, [normalizedLines, selectedLineCode]);

  const selectedLine = normalizedLines.find(
    (line) => line.code === selectedLineCode
  );
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

      <div className="space-y-2">
        {normalizedLines.length === 0 ?
        <div className="text-[11px] text-white/40">{t("ui_no_currency_lines_yet_9630af229d", "No currency lines yet.")}</div> :

        <>
            <select
            value={selectedLineCode}
            onChange={(e) => setSelectedLineCode(e.target.value)}
            className="w-full bg-black/30 border border-white/10 rounded-lg px-2 py-2 text-xs text-white/80 outline-none focus:border-xcannes-green/80">

              {normalizedLines.map((line) =>
            <option key={line.code} value={line.code}>
                  {line.code} — {line.allocated.toLocaleString("en-US", { maximumFractionDigits: 6 })}{" "}
                  {t("currency_rlusd_code", "RLUSD")}
                </option>
            )}
            </select>

            {selectedLine ?
          <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-1.5">
                <div className="min-w-0">
                  <div className="font-mono text-[11px] text-white/80">
                    {selectedLine.code}
                  </div>
                  <div className="text-[10px] text-white/40">
                    {selectedLine.allocated.toLocaleString("en-US", {
                    maximumFractionDigits: 6
                  })}{" "}
                    {t("currency_rlusd_code", "RLUSD")}
                  </div>
                </div>
                <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete?.(selectedLine.code);
              }}
              className="px-2 py-1 rounded-md bg-red-500/15 hover:bg-red-500/25 text-[10px] text-red-200 border border-red-500/30 transition-colors">

                  {t("delete", "Delete")}
                </button>
              </div> :
          null}
          </>
        }
      </div>
    </div>);

}
