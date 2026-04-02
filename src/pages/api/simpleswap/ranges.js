import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * GET /api/simpleswap/ranges
 * Proxifie GET https://api.simpleswap.io/v3/ranges
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    fixed = "false",
    tickerFrom,
    tickerTo,
    networkFrom,
    networkTo,
    reverse = "false",
  } = req.query || {};

  if (!tickerFrom || !tickerTo || !networkFrom || !networkTo) {
    return res.status(400).json({
      error: "Missing params",
      required: ["tickerFrom", "networkFrom", "tickerTo", "networkTo"],
    });
  }

  try {
    const data = await simpleSwapRequest("/ranges", {
      query: {
        fixed: String(fixed),
        tickerFrom: String(tickerFrom),
        tickerTo: String(tickerTo),
        networkFrom: String(networkFrom),
        networkTo: String(networkTo),
        reverse: String(reverse),
      },
    });
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to fetch SimpleSwap ranges",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}

