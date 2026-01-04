/**
 * Helpers pour l'affichage et le calcul des métriques des paires
 */

import { getFlag } from "./currencyHelpers";

/**
 * Affichage d'une paire avec drapeaux
 */
export function getPairDisplay(pair) {
  const baseFlag = getFlag(pair.base);
  const quoteFlag = getFlag(pair.quote);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        <span className="text-xl">{baseFlag}</span>
        <span className="text-xl">{quoteFlag}</span>
      </div>
      <span className="font-semibold text-sm">
        {pair.base}/{pair.quote}
      </span>
    </div>
  );
}

/**
 * Calcul des métriques d'une paire depuis les données EOD
 */
export function getPairMetrics(pair, eodData) {
  const pairKey = `${pair.base}/${pair.quote}`;
  const data = eodData[pairKey];
  if (!data) return null;

  const price = Number(data.price ?? data.close ?? 0) || 0;
  const rawBid = Number(data.bid);
  const rawAsk = Number(data.ask);
  const bid = Number.isFinite(rawBid) ? rawBid : price;
  const ask = Number.isFinite(rawAsk) ? rawAsk : price;
  const change = Number(data.change ?? 0) || 0;
  const changePercent = Number(data.changePercent ?? 0) || 0;
  const isPositive = change >= 0;
  const isTickerMode = data.mode === "ticker";

  const sparkline = Array.isArray(data.sparkline) ? data.sparkline : null;

  return {
    price,
    bid,
    ask,
    change,
    changePercent,
    isPositive,
    isTickerMode,
    sparkline,
  };
}
