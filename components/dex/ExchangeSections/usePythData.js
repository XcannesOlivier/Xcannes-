import xcannesApi from "../../../lib/xcannesApi";
import { buildSparklineFromCandles } from "./sparklineHelpers";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

/**
 * Hook pour charger les données Pyth
 * - Ticker WebSocket temps réel
 * - Sparkline depuis /klines (candles Pyth, PAS Fawaz)
 */

export async function loadPythData(base, quote, symbol, wsTicker) {
  const backendPair = symbol || `${base}_${quote}`;
  let ticker = null;

  // Vérifier le ticker WebSocket
  if (wsTicker) {
    const priceSource =
      wsTicker.lastPrice ??
      wsTicker.price ??
      wsTicker.midPrice ??
      wsTicker.bidPrice ??
      wsTicker.askPrice;

    const valueSource =
      wsTicker.change24h ?? wsTicker.change_24h ?? wsTicker.change;

    const percentSource =
      wsTicker.changePercent24h ??
      wsTicker.percent_change_24h ??
      wsTicker.change_percent_24h ??
      wsTicker.changePercent;

    const priceNum =
      priceSource !== undefined && priceSource !== null
        ? Number(priceSource)
        : null;
    const valueNum =
      valueSource !== undefined && valueSource !== null
        ? Number(valueSource)
        : null;
    const percentNum =
      percentSource !== undefined && percentSource !== null
        ? Number(percentSource)
        : null;

    if (
      Number.isFinite(priceNum) &&
      priceNum > 0 &&
      Number.isFinite(percentNum)
    ) {
      ticker = wsTicker;
    }
  }

  // Fallback API si pas de ticker WS
  if (!ticker) {
    ticker = await xcannesApi.getTicker(backendPair);
  }

  let sparkline = null;

  // ✅ Charger les candles PYTH depuis l'API (pas Fawaz!)
  try {
    const klines = await xcannesApi.getKlines(backendPair, "1h", 30);
    if (Array.isArray(klines) && klines.length > 0) {
      sparkline = buildSparklineFromCandles(klines);
    }
  } catch (e) {
    // Fallback silencieux si les candles Pyth ne sont pas dispo
    if (DEBUG_LOGS) {
      console.warn(`Candles Pyth indisponibles pour ${backendPair}:`, e.message);
    }
  }

  if (ticker) {
    const priceSource =
      ticker.lastPrice ??
      ticker.price ??
      ticker.midPrice ??
      ticker.bidPrice ??
      ticker.askPrice;

    const valueSource =
      ticker.change24h ?? ticker.change_24h ?? ticker.change;

    const percentSource =
      ticker.changePercent24h ??
      ticker.percent_change_24h ??
      ticker.change_percent_24h ??
      ticker.changePercent;

    const price = Number(priceSource) || 0;
    const change =
      valueSource !== undefined && valueSource !== null
        ? Number(valueSource)
        : 0;
    const changePercent =
      percentSource !== undefined && percentSource !== null
        ? Number(percentSource)
        : 0;

    const rawBid = ticker.bidPrice ?? ticker.bid ?? ticker.bestBidPrice;
    const rawAsk = ticker.askPrice ?? ticker.ask ?? ticker.bestAskPrice;

    const bid = Number(rawBid);
    const ask = Number(rawAsk);

    return {
      price,
      bid: Number.isFinite(bid) ? bid : price,
      ask: Number.isFinite(ask) ? ask : price,
      change,
      changePercent,
      mode: "ticker",
      sparkline,
    };
  }

  return null;
}
