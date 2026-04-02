import {
  isUsdStableCurrency,
  normalizeSimpleSwapCurrency,
  simpleSwapRequest,
} from "@/lib/simpleswapServer";

/**
 * GET /api/simpleswap/currencies
 * - Default: retourne RLUSD (si présent) + stablecoins USD (multi-chain)
 * - ?all=1 : retourne toutes les devises (peut être volumineux)
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const debug = String(req.query?.debug || "") === "1";
  const includeAll = String(req.query?.all || "") === "1";
  const rlusdTicker = String(process.env.SIMPLESWAP_RLUSD_TICKER || "rlusd")
    .trim()
    .toLowerCase();
  const rlusdNetwork = String(process.env.SIMPLESWAP_RLUSD_NETWORK || "xrpl")
    .trim()
    .toLowerCase();

  try {
    const data = await simpleSwapRequest("/currencies");
    const rawList = Array.isArray(data)
      ? data
      : Array.isArray(data?.currencies)
        ? data.currencies
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.data?.currencies)
            ? data.data.currencies
            : Array.isArray(data?.result)
              ? data.result
              : [];
    const normalized = rawList
      .map((item) => normalizeSimpleSwapCurrency(item))
      .filter(Boolean);

    if (!normalized.length && debug) {
      return res.status(200).json({
        currencies: [],
        total: 0,
        rlusd: { ticker: rlusdTicker, network: rlusdNetwork },
        debug: {
          upstreamType: Array.isArray(data) ? "array" : typeof data,
          upstreamKeys:
            data && typeof data === "object" && !Array.isArray(data)
              ? Object.keys(data).slice(0, 50)
              : null,
          upstreamPreview: Array.isArray(rawList) ? rawList.slice(0, 1) : null,
        },
      });
    }

    const filtered = includeAll
      ? normalized
      : normalized.filter((cur) => {
          if (cur.ticker === rlusdTicker && cur.network === rlusdNetwork) return true;
          return isUsdStableCurrency(cur);
        });

    return res.status(200).json({
      currencies: filtered.map(({ raw, ...rest }) => rest),
      total: filtered.length,
      rlusd: { ticker: rlusdTicker, network: rlusdNetwork },
    });
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to fetch SimpleSwap currencies",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}
