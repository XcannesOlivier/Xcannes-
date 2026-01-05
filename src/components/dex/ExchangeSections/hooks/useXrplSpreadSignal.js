"use client";

import { useEffect, useMemo, useRef, useState } from "react";

function extractNumber(value) {
  const num = value != null ? Number(value) : Number.NaN;
  return Number.isFinite(num) ? num : Number.NaN;
}

function computeSpreadPctFromTicker(ticker) {
  const rawBid =
    ticker?.bidPrice ?? ticker?.bid ?? ticker?.bestBidPrice ?? ticker?.bestBid;
  const rawAsk =
    ticker?.askPrice ?? ticker?.ask ?? ticker?.bestAskPrice ?? ticker?.bestAsk;

  const bid = extractNumber(rawBid);
  const ask = extractNumber(rawAsk);
  if (!Number.isFinite(bid) || !Number.isFinite(ask) || bid <= 0 || ask <= 0) {
    return null;
  }

  const mid = (bid + ask) / 2;
  if (!Number.isFinite(mid) || mid <= 0) return null;

  const pct = (ask - bid) / mid;
  if (!Number.isFinite(pct) || pct < 0) return null;
  return pct;
}

function ema(prev, value, alpha) {
  if (!Number.isFinite(value)) return prev;
  if (!Number.isFinite(prev)) return value;
  const a = Number(alpha);
  const k = Number.isFinite(a) ? Math.min(Math.max(a, 0), 1) : 0.15;
  return k * value + (1 - k) * prev;
}

export function useXrplRlusdXrpSpreadSignal({
  tickers,
  tickersVersion,
  symbols = ["XRP_RLUSD", "RLUSD_XRP"],
  alphaPct = 0.15,
  alphaDelta = 0.25,
  clampMaxPct = 0.2, // safety cap: 20% spread is already extreme
} = {}) {
  const [signal, setSignal] = useState(() => ({
    symbol: null,
    rawPct: null,
    emaPct: null,
    emaDelta: 0,
    updatedAt: null,
  }));

  const refs = useRef({
    prevRawPct: Number.NaN,
    emaPct: Number.NaN,
    emaDelta: 0,
  });

  const tickerMap = useMemo(() => (tickers instanceof Map ? tickers : new Map()), [tickers]);

  useEffect(() => {
    const findTicker = () => {
      for (const symbol of symbols || []) {
        if (!symbol) continue;
        const t = tickerMap.get(symbol);
        if (t) return { symbol, ticker: t };
      }
      // Try loose matching in case the map uses backendPair but we got a symbol from markets.
      for (const [key, value] of tickerMap.entries()) {
        if (!key) continue;
        const upper = String(key).toUpperCase();
        if (upper === "XRP_RLUSD" || upper === "RLUSD_XRP") return { symbol: upper, ticker: value };
      }
      return null;
    };

    const found = findTicker();
    if (!found) return;

    const raw = computeSpreadPctFromTicker(found.ticker);
    if (raw == null) return;

    const capped = Math.min(Math.max(raw, 0), clampMaxPct);
    const prevRaw = refs.current.prevRawPct;
    const deltaRaw = Number.isFinite(prevRaw) ? capped - prevRaw : 0;

    const nextEmaPct = ema(refs.current.emaPct, capped, alphaPct);
    const nextEmaDelta = ema(refs.current.emaDelta, deltaRaw, alphaDelta);

    refs.current.prevRawPct = capped;
    refs.current.emaPct = nextEmaPct;
    refs.current.emaDelta = nextEmaDelta;

    setSignal({
      symbol: found.symbol,
      rawPct: capped,
      emaPct: Number.isFinite(nextEmaPct) ? nextEmaPct : null,
      emaDelta: Number.isFinite(nextEmaDelta) ? nextEmaDelta : 0,
      updatedAt: Date.now(),
    });
  }, [alphaDelta, alphaPct, clampMaxPct, symbols, tickerMap, tickersVersion]);

  return signal;
}

