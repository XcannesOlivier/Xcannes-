import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * GET /api/simpleswap/estimates
 * Proxifie GET https://api.simpleswap.io/v3/estimates
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
    amount,
  } = req.query || {};

  if (!tickerFrom || !tickerTo || !networkFrom || !networkTo || !amount) {
    return res.status(400).json({
      error: "Missing params",
      required: [
        "tickerFrom",
        "networkFrom",
        "tickerTo",
        "networkTo",
        "amount",
      ],
    });
  }

  try {
    const data = await simpleSwapRequest("/estimates", {
      query: {
        fixed: String(fixed),
        tickerFrom: String(tickerFrom),
        tickerTo: String(tickerTo),
        networkFrom: String(networkFrom),
        networkTo: String(networkTo),
        reverse: String(reverse),
        amount: String(amount),
      },
    });
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to fetch SimpleSwap estimate",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}

