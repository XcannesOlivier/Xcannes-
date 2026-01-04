import { getPairDisplay, getPairMetrics } from "../displayHelpers";

export default function PairsListMobile({
  pairs,
  eodData,
  loadingPairs,
  flashStates,
  isCustomPair,
  onRemoveCustomPair,
  t,
}) {
  return (
    <div className="md:hidden max-h-[520px] overflow-y-auto bg-base rounded-xl">
      {/* Header fixe type "Market / Sell / Buy" */}
      <div className="sticky top-0 z-10 bg-base px-4 py-2 rounded-t-xl">
        <div className="flex items-center justify-between gap-3 text-[13px] font-medium uppercase tracking-wide text-white/60">
          <span>{t("market", "Market")}</span>
          <div className="flex items-center gap-2">
            <div className="min-w-[84px] text-center">
              <span>{t("sell", "Sell")}</span>
            </div>
            <div className="min-w-[84px] text-center">
              <span>{t("buy", "Buy")}</span>
            </div>
          </div>
        </div>
      </div>

      {pairs.length === 0 ? (
        <div className="px-4 py-8 text-center text-white/40">
          {t("no_pairs_found", "No pairs found")}
        </div>
      ) : (
        <div className="divide-y divide-slate-800/60">
          {pairs.map((pair, index) => {
            const pairKey = `${pair.base}/${pair.quote}`;
            const metrics = getPairMetrics(pair, eodData);
            const isLoading = !metrics && loadingPairs.has(pairKey);

            return (
              <div
                key={`${pair.base}-${pair.quote}-mobile-${index}`}
                className="px-4 py-3 flex items-center gap-3 justify-between"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {getPairDisplay(pair)}
                      </div>
                      <div className="mt-1">
                        {isLoading || !metrics ? (
                          <div className="flex items-center gap-2 text-white/40 text-[11px]">
                            <div className="w-3 h-3 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
                            <span>{t("loading", "Loading...")}</span>
                          </div>
                        ) : (
                          <div
                            className={`font-mono text-[11px] ${
                              metrics.isPositive
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {metrics.isPositive ? "+" : ""}
                            {metrics.change.toFixed(5)} (
                            {metrics.isPositive ? "+" : ""}
                            {metrics.changePercent.toFixed(2)}%)
                          </div>
                        )}
                      </div>
                    </div>

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
                </div>

                <div className="flex flex-col items-end gap-1">
                  <div className="flex gap-2">
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-subtle text-primary font-mono text-xs min-w-[84px] justify-center ${
                        flashStates.get(pairKey)?.flashBidClass || ""
                      }`}
                      style={{
                        "--eod-flash-duration": flashStates.get(pairKey)
                          ? `${Math.min(
                              1.5,
                              0.4 +
                                Math.min(
                                  0.8,
                                  Math.abs(
                                    (flashStates.get(pairKey).bidDelta || 0) /
                                      (metrics ? metrics.bid || 1 : 1)
                                  ) * 4
                                )
                            ).toFixed(2)}s`
                          : undefined,
                      }}
                    >
                      {metrics ? metrics.bid.toFixed(5) : "--"}
                    </div>
                    <div
                      className={`inline-flex items-center px-3 py-1 rounded-full bg-subtle text-primary font-mono text-xs min-w-[84px] justify-center ${
                        flashStates.get(pairKey)?.flashAskClass || ""
                      }`}
                      style={{
                        "--eod-flash-duration": flashStates.get(pairKey)
                          ? `${Math.min(
                              1.5,
                              0.4 +
                                Math.min(
                                  0.8,
                                  Math.abs(
                                    (flashStates.get(pairKey).askDelta || 0) /
                                      (metrics ? metrics.ask || 1 : 1)
                                  ) * 4
                                )
                            ).toFixed(2)}s`
                          : undefined,
                      }}
                    >
                      {metrics ? metrics.ask.toFixed(5) : "--"}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
