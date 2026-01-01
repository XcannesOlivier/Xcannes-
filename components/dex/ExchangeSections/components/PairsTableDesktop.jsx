import SparklineMini from "../../../marketGlobal/SparklineMini";
import { getPairDisplay, getPairMetrics } from "../displayHelpers";

export default function PairsTableDesktop({
  pairs,
  eodData,
  loadingPairs,
  flashStates,
  isCustomPair,
  onRemoveCustomPair,
  t,
}) {
  return (
    <div className="hidden md:block max-h-[520px] overflow-y-auto rounded-xl bg-base">
      <table className="min-w-full text-sm">
        <thead className="bg-base sticky top-0 z-10">
          <tr className="text-xs font-medium text-white/50 uppercase tracking-wide">
            <th className="px-4 py-3 text-left">
              {t("market", "Market")}
            </th>
            <th className="px-4 py-3 text-right">
              {t("change_24h", "24h Change")}
            </th>
            <th className="px-4 py-3">
              <div className="flex justify-end">
                <div className="min-w-[110px] md:min-w-[140px] text-center">
                  {t("sell", "Sell")}
                </div>
              </div>
            </th>
            <th className="px-4 py-3">
              <div className="flex justify-end">
                <div className="min-w-[110px] md:min-w-[140px] text-center">
                  {t("buy", "Buy")}
                </div>
              </div>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-800/50">
          {pairs.length === 0 ? (
            <tr>
              <td
                colSpan={4}
                className="px-4 py-10 text-center text-white/40"
              >
                {t("no_pairs_found", "No pairs found")}
              </td>
            </tr>
          ) : (
            pairs.map((pair, index) => {
              const pairKey = `${pair.base}/${pair.quote}`;
              const metrics = getPairMetrics(pair, eodData);
              const isLoading = !metrics && loadingPairs.has(pairKey);
              const flash = flashStates.get(pairKey);

              return (
                <tr
                  key={`${pair.base}-${pair.quote}-desktop-${index}`}
                  className="hover:bg-slate-800/40 transition-colors"
                >
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-between gap-2">
                      {getPairDisplay(pair)}
                      {isCustomPair &&
                        isCustomPair(pair.base, pair.quote) && (
                          <button
                            onClick={() =>
                              onRemoveCustomPair?.(pair.base, pair.quote)
                            }
                            className="ml-2 text-[11px] text-slate-500 hover:text-red-400 transition-colors"
                            title={t("remove", "Remove")}
                          >
                            ✕
                          </button>
                        )}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {isLoading || !metrics ? (
                      <div className="flex items-center justify-end gap-2 text-white/40 text-xs">
                        <div className="w-3 h-3 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
                        <span>{t("loading", "Loading...")}</span>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex flex-col leading-tight">
                          <span
                            className={`font-mono text-sm ${
                              metrics.isPositive
                                ? "text-price-up"
                                : "text-price-down"
                            }`}
                          >
                            {metrics.isPositive ? "+" : ""}
                            {metrics.change.toFixed(5)}
                          </span>
                          <span
                            className={`font-mono text-xs ${
                              metrics.isPositive
                                ? "text-price-up"
                                : "text-price-down"
                            }`}
                          >
                            {metrics.isPositive ? "+" : ""}
                            {metrics.changePercent.toFixed(2)}%
                          </span>
                        </div>
                        {metrics.sparkline &&
                          metrics.sparkline.length > 1 && (
                            <div className="flex-shrink-0 mt-1">
                              <SparklineMini
                                values={metrics.sparkline}
                                width={80}
                                height={24}
                                showArea
                                strokeColor="rgba(74,222,128,1)"
                                areaColor="rgba(34,197,94,0.35)"
                                className="w-24 h-6"
                              />
                            </div>
                          )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {metrics ? (
                      <div className="flex justify-end">
                        <div
                          className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-subtle text-primary font-mono text-sm min-w-[110px] md:min-w-[140px] ${
                            flash?.flashBidClass || ""
                          }`}
                        >
                          {metrics.bid.toFixed(5)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-white/40">--</span>
                    )}
                  </td>
                  <td className="px-4 py-4 text-right">
                    {metrics ? (
                      <div className="flex justify-end">
                        <div
                          className={`inline-flex items-center justify-center px-4 py-1.5 rounded-full bg-subtle text-primary font-mono text-sm min-w-[110px] md:min-w-[140px] ${
                            flash?.flashAskClass || ""
                          }`}
                        >
                          {metrics.ask.toFixed(5)}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-white/40">--</span>
                    )}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
