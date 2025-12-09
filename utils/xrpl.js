import { Buffer } from "buffer";
import xcannesApi from "../lib/xcannesApi";

export const pairToBackendFormat = (pair) => pair.replace("/", "_");

const RLUSD_HEX = "524C555344000000000000000000000000000000";
const RLUSD_ISSUER = "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De";
const XCS_ISSUER = "rBXXYQ3e4JmLtDaSUgmLvtKC5dYvmCggxX";
const FALLBACK_ISSUERS = {
  XCS: XCS_ISSUER,
  RLUSD: RLUSD_ISSUER
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
        source: market.source || market.type || 'xrpl',
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
  return pair.includes("_") ? pair : pair.replace("/", "_");
}

function resolveIssuer(currency, providedIssuer) {
  if (currency === "RLUSD") return RLUSD_ISSUER;
  return providedIssuer || FALLBACK_ISSUERS[currency] || null;
}

function buildTakerObject(currency, issuer) {
  if (currency === "XRP") return { currency: "XRP" };
  if (currency === "RLUSD") {
    return { currency: RLUSD_HEX, issuer: RLUSD_ISSUER };
  }
  if (!issuer) {
    console.warn(`[getBookIdFromPair] Issuer manquant pour ${currency}`);
    return null;
  }
  if (currency.length > 3) {
    const hex = Buffer.from(currency, "utf8").toString("hex").toUpperCase().padEnd(40, "0");
    return { currency: hex, issuer };
  }
  return { currency, issuer };
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

  // Pyth/external pair: aucun carnet XRPL requis, seul backendPair est utile
  if (isExternalPair) {
    return {
      backendPair,
      source: 'pyth',
      type: 'external'
    };
  }

  const baseIssuer = resolveIssuer(base, meta?.baseIssuer);
  const counterIssuer = resolveIssuer(counter, meta?.counterIssuer);

  const taker_gets = buildTakerObject(base, baseIssuer);
  const taker_pays = buildTakerObject(counter, counterIssuer);

  if (!taker_gets || !taker_pays) {
    return meta ? { backendPair, source: meta.source || 'unknown' } : null;
  }

  return {
    taker_gets,
    taker_pays,
    url: formatOrderbookUrl(taker_gets, taker_pays),
    backendPair,
    source: meta?.source || 'xrpl'
  };
};
