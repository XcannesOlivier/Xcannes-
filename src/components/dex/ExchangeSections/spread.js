"use client";

const SPREAD_FRACTIONS = {
  A: 0.006, // 0.60%
  B: 0.01, // 1.00%
  C: 0.018, // 1.80%
};

const TIER_A_SET = new Set(
  "EUR,USD,GBP,CHF,CAD,AUD,NZD,JPY,SGD,HKD"
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
);

const TIER_B_SET = new Set(
  "CNY,INR,AED,SAR,BRL,MXN,ZAR,TRY,PLN,CZK,HUF,RON,SEK,NOK,DKK"
    .split(",")
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
);

export function currencyTier(code) {
  const upper = String(code || "").trim().toUpperCase();
  if (!upper) return "C";
  if (upper === "RLUSD") return "A";
  if (TIER_A_SET.has(upper)) return "A";
  if (TIER_B_SET.has(upper)) return "B";
  return "C";
}

export function spreadFractionForTier(tier) {
  return SPREAD_FRACTIONS[tier] ?? SPREAD_FRACTIONS.C;
}

export function spreadFractionForPair(base, quote) {
  const baseTier = currencyTier(base);
  const quoteTier = currencyTier(quote);
  const baseSpread = spreadFractionForTier(baseTier);
  const quoteSpread = spreadFractionForTier(quoteTier);
  return Math.max(baseSpread, quoteSpread);
}

export function applySpreadToMid(mid, spreadFraction) {
  const price = Number(mid);
  if (!Number.isFinite(price) || price <= 0) {
    return { bid: 0, ask: 0, mid: Number.isFinite(price) ? price : 0 };
  }
  const spread = Number(spreadFraction);
  const half = (Number.isFinite(spread) ? spread : SPREAD_FRACTIONS.C) / 2;
  return {
    mid: price,
    bid: price * (1 - half),
    ask: price * (1 + half),
  };
}

function clamp(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  if (Number.isFinite(min) && num < min) return min;
  if (Number.isFinite(max) && num > max) return max;
  return num;
}

function hash32(input = "") {
  const str = String(input);
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pairBias(pairKey) {
  const h = hash32(pairKey);
  let bias = ((h % 2000) / 1000) - 1; // [-1, +1)
  // Ensure some asymmetry for most pairs
  if (Math.abs(bias) < 0.2) bias = bias < 0 ? -0.2 : 0.2;
  return bias;
}

/**
 * Dynamic spread model:
 * - mid is NEVER altered (PYTH/FAWAZ stays the reference)
 * - totalSpread = baseSpread(exotism) + factor * xrplSpreadPct
 * - bid/ask split is asymmetric via a skew derived from xrpl spread changes (delta) + pair bias
 */
export function applyDynamicSpreadToMid(
  mid,
  {
    base,
    quote,
    xrplSpreadPct = 0,
    xrplSpreadDelta = 0,
    factor = 1.0,
    skewMax = 0.6,
    deltaScale = 0.001, // 0.10% delta -> skew 0.1
    minMultiplier = 0.75,
    maxMultiplier = 3.0,
    pairKey = null,
  } = {}
) {
  const price = Number(mid);
  if (!Number.isFinite(price) || price <= 0) {
    return { bid: 0, ask: 0, mid: Number.isFinite(price) ? price : 0, spread: 0, baseSpread: 0, skew: 0 };
  }

  const baseSpread = spreadFractionForPair(base, quote);
  const xrplPct = clamp(xrplSpreadPct, 0, 0.2);
  const dynamicAdd = clamp(Number(factor) * xrplPct, 0, 0.2);
  const totalSpread = clamp(
    baseSpread + dynamicAdd,
    baseSpread * minMultiplier,
    baseSpread * maxMultiplier
  );

  const half = totalSpread / 2;
  const delta = Number.isFinite(Number(xrplSpreadDelta)) ? Number(xrplSpreadDelta) : 0;
  const globalSkew = clamp(deltaScale > 0 ? delta / deltaScale : 0, -skewMax, skewMax);
  const bias = pairBias(pairKey || `${String(base || "").toUpperCase()}_${String(quote || "").toUpperCase()}`);
  const skew = clamp(globalSkew * bias, -skewMax, skewMax);

  // Asymmetric distribution around mid. Invariant: bid < mid < ask if |skew| < 1.
  let bid = price * (1 - half * (1 - skew));
  let ask = price * (1 + half * (1 + skew));

  // Hard safety: keep ordering even with edge cases
  if (!Number.isFinite(bid) || !Number.isFinite(ask)) {
    const sym = applySpreadToMid(price, totalSpread);
    bid = sym.bid;
    ask = sym.ask;
  }
  if (bid >= price) bid = price * (1 - 1e-12);
  if (ask <= price) ask = price * (1 + 1e-12);
  if (bid >= ask) {
    const sym = applySpreadToMid(price, totalSpread);
    bid = sym.bid;
    ask = sym.ask;
  }

  return {
    mid: price,
    bid,
    ask,
    spread: totalSpread,
    baseSpread,
    dynamicAdd,
    skew,
  };
}
