import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * GET /api/simpleswap/exchange?id=...
 * Proxifie GET https://api.simpleswap.io/v3/exchanges/:id
 */
export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const id = String(req.query?.id || "").trim();
  if (!id) {
    return res.status(400).json({ error: "Missing id" });
  }

  try {
    const data = await simpleSwapRequest(`/exchanges/${encodeURIComponent(id)}`);
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to fetch SimpleSwap exchange",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}

