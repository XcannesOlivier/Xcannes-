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

function uniqueLower(values) {
  const seen = new Set();
  const out = [];
  for (const value of values || []) {
    const normalized = String(value || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

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

  const rlusdTicker = String(process.env.SIMPLESWAP_RLUSD_TICKER || "rlusd")
    .trim()
    .toLowerCase();
  const rlusdNetworkPreferred = String(process.env.SIMPLESWAP_RLUSD_NETWORK || "xrp")
    .trim()
    .toLowerCase();
  const rlusdNetworks = uniqueLower([rlusdNetworkPreferred, "xrp", "xrpl"]);
  const isRlusdTicker = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === rlusdTicker || normalized === "rlusd";
  };
  const isXrplLikeNetwork = (value) => {
    const normalized = String(value || "").trim().toLowerCase();
    return normalized === "xrp" || normalized === "xrpl";
  };

  const requestCreate = async ({
    tickerFrom: tf,
    networkFrom: nf,
    tickerTo: tt,
    networkTo: nt,
    extraIdTo: eid,
  }) => {
    const normalizedTickerTo = String(tt || "").trim().toLowerCase();
    const normalizedNetworkTo = String(nt || "").trim().toLowerCase();
    const normalizedExtraIdTo = String(eid || "").trim();
    const resolvedExtraIdTo =
      isRlusdTicker(normalizedTickerTo) && isXrplLikeNetwork(normalizedNetworkTo)
        ? String(SIMPLESWAP_TAG_RLUSD)
        : normalizedExtraIdTo;

    return simpleSwapRequest("/exchanges", {
      method: "POST",
      body: {
        fixed: Boolean(fixed),
        tickerFrom: String(tf),
        tickerTo: String(tt),
        amount: String(amount),
        networkFrom: String(nf),
        networkTo: String(nt),
        reverse: Boolean(reverse),
        addressTo: String(addressTo),
        extraIdTo: String(resolvedExtraIdTo || ""),
        userRefundAddress: String(userRefundAddress || ""),
        userRefundExtraId: String(userRefundExtraId || ""),
        rateId,
        customFee,
      },
    });
  };

  try {
    const original = {
      tickerFrom: String(tickerFrom),
      networkFrom: String(networkFrom),
      tickerTo: String(tickerTo),
      networkTo: String(networkTo),
      extraIdTo: String(extraIdTo || ""),
    };

    try {
      const data = await requestCreate(original);
      return res.status(200).json(data);
    } catch (error) {
      const status = Number(error?.status) || 500;
      const fromIsRlusd = isRlusdTicker(original.tickerFrom);
      const toIsRlusd = isRlusdTicker(original.tickerTo);
      const shouldRetry = status === 404 && (fromIsRlusd || toIsRlusd);
      if (!shouldRetry) throw error;

      const fromCandidates = fromIsRlusd ? rlusdNetworks : [String(original.networkFrom).trim().toLowerCase()];
      const toCandidates = toIsRlusd ? rlusdNetworks : [String(original.networkTo).trim().toLowerCase()];

      for (const nf of fromCandidates) {
        for (const nt of toCandidates) {
          const candidate = {
            ...original,
            networkFrom: fromIsRlusd ? nf : original.networkFrom,
            networkTo: toIsRlusd ? nt : original.networkTo,
          };
          if (
            String(candidate.networkFrom).trim().toLowerCase() ===
              String(original.networkFrom).trim().toLowerCase() &&
            String(candidate.networkTo).trim().toLowerCase() ===
              String(original.networkTo).trim().toLowerCase()
          ) {
            continue;
          }
          try {
            const data = await requestCreate(candidate);
            return res.status(200).json({
              ...data,
              xcannesResolved: candidate,
            });
          } catch {
            // keep trying
          }
        }
      }

      throw error;
    }
  } catch (error) {
    const status = Number(error?.status) || 500;
    return res.status(status).json({
      error: "Failed to create SimpleSwap exchange",
      message: error?.message || "Unknown error",
      details: error?.data || null,
    });
  }
}
