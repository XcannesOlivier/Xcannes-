import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * POST /api/simpleswap/create-exchange
 * Proxifie POST https://api.simpleswap.io/v3/exchanges
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const {
    fixed = false,
    tickerFrom,
    tickerTo,
    amount,
    networkFrom,
    networkTo,
    reverse = false,
    addressTo,
    extraIdTo = "",
    userRefundAddress = "",
    userRefundExtraId = "",
    rateId = null,
    customFee = null,
  } = req.body || {};

  if (!tickerFrom || !tickerTo || !networkFrom || !networkTo || !amount || !addressTo) {
    return res.status(400).json({
      error: "Missing fields",
      required: [
        "tickerFrom",
        "networkFrom",
        "tickerTo",
        "networkTo",
        "amount",
        "addressTo",
      ],
    });
  }

  try {
    const data = await simpleSwapRequest("/exchanges", {
      method: "POST",
      body: {
        fixed: Boolean(fixed),
        tickerFrom: String(tickerFrom),
        tickerTo: String(tickerTo),
        amount: String(amount),
        networkFrom: String(networkFrom),
        networkTo: String(networkTo),
        reverse: Boolean(reverse),
        addressTo: String(addressTo),
        extraIdTo: String(extraIdTo || ""),
        userRefundAddress: String(userRefundAddress || ""),
        userRefundExtraId: String(userRefundExtraId || ""),
        rateId,
        customFee,
      },
    });
    return res.status(200).json(data);
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to create SimpleSwap exchange",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}

