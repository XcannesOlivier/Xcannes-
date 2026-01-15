import xcannesApi from "@/lib/xcannesApi";
import {
  encodeXrplCurrencyCode,
  XRPL_KNOWN_ISSUERS,
  pairToBackendFormat
} from "@/utils/xrpl";

const RLUSD_HEX = encodeXrplCurrencyCode("RLUSD");
const RLUSD_ISSUER = (XRPL_KNOWN_ISSUERS.RLUSD || "").trim();
const XCS_ISSUER = (XRPL_KNOWN_ISSUERS.XCS || "").trim();
const FALLBACK_ISSUERS = {
  XCS: XCS_ISSUER,
  RLUSD: RLUSD_ISSUER,
};

const marketMetadata = new Map();
let hydratePromise = null;

async function hydrateMarkets() {
  try {
    const data = await xcannesApi.getAllMarkets();
    const allMarkets = [
      ...(data?.trading || []),
      ...(data?.display || []),
      ...(data?.pyth || []),
    ];

    allMarkets.forEach((market) => {
      if (!market?.symbol || !market.base || !market.quote) return;
      marketMetadata.set(market.symbol.toUpperCase(), {
        base: market.base,
        counter: market.quote,
        baseIssuer: market.baseIssuer || null,
        counterIssuer: market.quoteIssuer || null,
        source: market.source || market.type || "xrpl",
      });
    });
  } catch (error) {
    console.warn("[getBookIdFromPair] hydrateMarkets failed:", error?.message || error);
  } finally {
    hydratePromise = null;
  }
}

function ensureMarketMetadata() {
  if (typeof window === "undefined") return;
  if (marketMetadata.size > 0 || hydratePromise) return;
  hydratePromise = hydrateMarkets();
}

function normalizePair(pair) {
  if (!pair) return null;
  if (pair.includes("_")) return pair;
  return pairToBackendFormat(pair);
}

function resolveIssuer(currency, providedIssuer) {
  if (currency === "RLUSD") return RLUSD_ISSUER;
  return providedIssuer || FALLBACK_ISSUERS[currency] || null;
}

function buildTakerObject(currency, issuer) {
  const code = String(currency || "").toUpperCase();
  if (code === "XRP") return { currency: "XRP" };
  if (code === "RLUSD") {
    return { currency: RLUSD_HEX, issuer: RLUSD_ISSUER };
  }
  if (!issuer) {
    console.warn(`[getBookIdFromPair] Issuer manquant pour ${code}`);
    return null;
  }
  return { currency: encodeXrplCurrencyCode(code), issuer };
}

function formatOrderbookUrl(takerGets, takerPays) {
  const formatLeg = (leg) => {
    if (leg.currency === "XRP") return "XRP";
    if (leg.currency === RLUSD_HEX) return `${leg.issuer}_RLUSD`;
    return `${leg.issuer}_${leg.currency}`;
  };
  return `${formatLeg(takerGets)}/${formatLeg(takerPays)}`;
}

export const getBookIdFromPair = (pair) => {
  if (!pair) return null;
  ensureMarketMetadata();

  const backendPair = normalizePair(pair).toUpperCase();
  const [rawBase, rawCounter] = backendPair.split("_");
  if (!rawBase || !rawCounter) return null;

  const meta = marketMetadata.get(backendPair) || null;
  const base = meta?.base || rawBase;
  const counter = meta?.counter || rawCounter;

  const isExternalPair =
    meta?.source === "pyth" ||
    (!meta && base !== "XRP" && !FALLBACK_ISSUERS[base]);

  if (isExternalPair) {
    return {
      backendPair,
      source: "pyth",
      type: "external",
    };
  }

  const baseIssuer = resolveIssuer(base, meta?.baseIssuer);
  const counterIssuer = resolveIssuer(counter, meta?.counterIssuer);

  const taker_gets = buildTakerObject(base, baseIssuer);
  const taker_pays = buildTakerObject(counter, counterIssuer);

  if (!taker_gets || !taker_pays) {
    return meta ? { backendPair, source: meta.source || "unknown" } : null;
  }

  return {
    taker_gets,
    taker_pays,
    url: formatOrderbookUrl(taker_gets, taker_pays),
    backendPair,
    source: meta?.source || "xrpl",
  };
};
