import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * GET /api/simpleswap/pairs
 * Proxifie GET https://api.simpleswap.io/v3/pairs
 *
 * Options:
 * - /api/simpleswap/pairs?fixed=false
 * - /api/simpleswap/pairs?fixed=false&ticker=usdt&network=eth  -> /pairs/usdt/eth
 *
 * Note: le format upstream est documenté ici :
 * https://simpleswap.io/affiliate-program/help-center/article/public-api-guide
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const fixed = String(req.query?.fixed ?? "false");
  const ticker = String(req.query?.ticker ?? "").trim();
  const network = String(req.query?.network ?? "").trim();

  try {
    const path = ticker && network ? `/pairs/${ticker}/${network}` : "/pairs";
    const data = await simpleSwapRequest(path, {
      query: { fixed },
    });
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to fetch SimpleSwap pairs",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}

