import { simpleSwapRequest } from "@/lib/simpleswapServer";

/**
 * POST /api/simpleswap/create-exchange
 * Proxifie POST https://api.simpleswap.io/v3/exchanges
 */

const SIMPLESWAP_TAG_RLUSD_RAW = process.env.SIMPLESWAP_TAG_RLUSD;
const SIMPLESWAP_TAG_RLUSD_PARSED = Number.parseInt(SIMPLESWAP_TAG_RLUSD_RAW, 10);
const SIMPLESWAP_TAG_RLUSD = Number.isFinite(SIMPLESWAP_TAG_RLUSD_PARSED)
  ? SIMPLESWAP_TAG_RLUSD_PARSED
  : 591;

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
    const normalizedTickerTo = String(tickerTo || "").trim().toLowerCase();
    const normalizedNetworkTo = String(networkTo || "").trim().toLowerCase();
    const normalizedExtraIdTo = String(extraIdTo || "").trim();
    const resolvedExtraIdTo =
      normalizedTickerTo === "rlusd" && normalizedNetworkTo === "xrpl"
        ? String(SIMPLESWAP_TAG_RLUSD)
        : normalizedExtraIdTo;

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
        extraIdTo: String(resolvedExtraIdTo || ""),
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
