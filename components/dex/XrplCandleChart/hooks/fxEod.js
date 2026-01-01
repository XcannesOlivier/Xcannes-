"use client";

import xcannesApi from "../../../../lib/xcannesApi";

// Charge et formate les bougies FX EOD depuis l'API backend.
export async function fetchFxEodCandles(fxBase, fxQuote, limit = 365) {
  const data = await xcannesApi.getFxEod(fxBase, fxQuote, limit);
  const candlesEod = data?.candles || [];

  return candlesEod
    .map((c) => ({
      time: c.time,
      open: Number(c.open),
      high: Number(c.high),
      low: Number(c.low),
      close: Number(c.close),
      volume: Number(c.volume || 0),
    }))
    .sort((a, b) => a.time - b.time);
}
