/**
 * Helpers communs pour les statistiques 24h
 * basées sur des bougies OHLCV.
 */

/**
 * Normalise une bougie brute provenant du backend
 * vers un format numérique cohérent.
 */
export const normalizeCandle = (candle) => {
  if (!candle) return null;

  const time = candle.time != null ? Number(candle.time) : null;
  if (!Number.isFinite(time)) return null;

  const asNumber = (value, fallback) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const open = asNumber(candle.open, 0);
  const high = asNumber(candle.high, open);
  const low = asNumber(candle.low, open);
  const close = asNumber(candle.close, open);
  const volume = asNumber(candle.volume, 0);

  return { time, open, high, low, close, volume };
};

/**
 * Extrait la variation 24h (valeur et pourcentage) depuis
 * un objet ticker hétérogène (XRPL, Pyth, backend interne).
 *
 * Permet de partager une logique unique entre useMarketData,
 * PriceTicker et d'autres composants.
 */
export const extractPercentChange = (src) => {
  if (!src) return null;

  const valueSource =
    src.change24h ??
    src.change_24h ??
    src.change;

  const percentSource =
    src.changePercent24h ??
    src.percent_change_24h ??
    src.change_percent_24h ??
    src.changePercent;

  const valueNum =
    valueSource !== undefined && valueSource !== null
      ? Number(valueSource)
      : null;
  const percentNum =
    percentSource !== undefined && percentSource !== null
      ? Number(percentSource)
      : null;

  if (!Number.isFinite(percentNum)) return null;

  return {
    value: Number.isFinite(valueNum) ? valueNum : 0,
    percent: percentNum,
  };
};

/**
 * Calcule les stats 24h (high, low, volume, change, changePercent)
 * à partir d'un tableau de bougies OHLCV.
 *
 * Les bougies peuvent être brutes (backend) ou déjà normalisées.
 */
export const compute24hStatsFromCandles = (candles) => {
  if (!Array.isArray(candles) || candles.length === 0) return null;

  const normalized = candles
    .map((c) => {
      if (!c) return null;
      if (
        typeof c.time === "number" &&
        c.time != null &&
        typeof c.open === "number" &&
        typeof c.high === "number" &&
        typeof c.low === "number" &&
        typeof c.close === "number"
      ) {
        return c;
      }
      return normalizeCandle(c);
    })
    .filter((c) => c && Number.isFinite(c.time));

  if (normalized.length === 0) return null;

  const now = Math.floor(Date.now() / 1000);
  const h24ago = now - 86400;

  const windowCandles = normalized
    .filter((c) => c.time >= h24ago)
    .sort((a, b) => a.time - b.time);

  if (windowCandles.length === 0) return null;

  const high = Math.max(...windowCandles.map((c) => c.high));
  const low = Math.min(...windowCandles.map((c) => c.low));
  const volume = windowCandles.reduce(
    (sum, c) => sum + (Number.isFinite(c.volume) ? c.volume : 0),
    0
  );

  const firstPrice = windowCandles[0].open;
  const lastPrice = windowCandles[windowCandles.length - 1].close;

  if (!Number.isFinite(firstPrice) || firstPrice === 0 || !Number.isFinite(lastPrice)) {
    return null;
  }

  const change = lastPrice - firstPrice;
  const changePercent = (change / firstPrice) * 100;

  return {
    high,
    low,
    volume,
    change,
    changePercent,
    basePrice: firstPrice,
    lastPrice,
  };
};
