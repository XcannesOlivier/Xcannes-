import xcannesApi from "@/lib/xcannesApi";
import { buildSparklineFromCandles } from "./sparklineHelpers";

/**
 * Hook pour charger les données XRPL
 * - Ticker WebSocket temps réel
 * - Sparkline depuis /klines (candles XRPL)
 */

export async function loadXrplData(base, quote, symbol, wsTicker, tickersRef) {
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

  if (ticker) {
    // 1) Sparkline native 24h si fournie par le backend
    const sparkSource = Array.isArray(ticker.sparkline24h)
      ? ticker.sparkline24h
      : null;

    if (sparkSource && sparkSource.length > 1) {
      sparkline = buildSparklineFromCandles(
        sparkSource.map((v) => ({ close: v }))
      );
    } else {
      // 2) Fallback: bougies 1h depuis /klines (Mongo XRPL)
      try {
        const klines = await xcannesApi.getKlines(backendPair, "1h", 48);
        sparkline = buildSparklineFromCandles(klines);
      } catch (_) {
        // silencieux – sparkline restera null si indisponible
      }
    }

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
