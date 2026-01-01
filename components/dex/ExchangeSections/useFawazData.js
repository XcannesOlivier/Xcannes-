import xcannesApi from "../../../lib/xcannesApi";
import { buildSparklineFromCandles } from "./sparklineHelpers";

/**
 * Hook pour charger les données Fawaz
 * - EOD pur via /fx/eod (historique 24h)
 * - Utilisé uniquement pour paires non disponibles en temps réel
 */

export async function loadFawazData(base, quote) {
  const result = await xcannesApi.getFxEod(base, quote, 30);
  const candles = Array.isArray(result?.candles) ? result.candles : [];

  if (candles.length > 0) {
    const last = candles[candles.length - 1];
    const prev = candles.length > 1 ? candles[candles.length - 2] : null;

    const lastClose = Number(last?.close ?? last?.price ?? 0) || 0;
    let change = 0;
    let changePercent = 0;

    if (prev) {
      const prevClose = Number(prev?.close ?? prev?.price ?? 0) || 0;
      if (prevClose !== 0) {
        change = lastClose - prevClose;
        changePercent = (change / prevClose) * 100;
      }
    }

    const sparkline = buildSparklineFromCandles(candles);

    return {
      close: lastClose,
      // Pour les paires purement EOD, on affiche le même prix en bid/ask
      bid: lastClose,
      ask: lastClose,
      change,
      changePercent,
      mode: "eod",
      sparkline,
    };
  }

  return null;
}
