const DEFAULT_SIMPLESWAP_BASE_URL = "https://api.simpleswap.io/v3";

function getBaseUrl() {
  const raw = String(process.env.SIMPLESWAP_API_BASE_URL || DEFAULT_SIMPLESWAP_BASE_URL).trim();
  return raw.replace(/\/+$/, "");
}

function getApiKey() {
  const apiKey = String(process.env.SIMPLESWAP_API_KEY || "").trim();
  if (!apiKey) {
    const error = new Error("Missing SIMPLESWAP_API_KEY");
    error.code = "SIMPLESWAP_MISSING_API_KEY";
    throw error;
  }
  return apiKey;
}

export async function simpleSwapRequest(path, { method = "GET", query, body } = {}) {
  const apiKey = getApiKey();
  const baseUrl = getBaseUrl();

  const url = new URL(`${baseUrl}${String(path || "").startsWith("/") ? "" : "/"}${path}`);
  if (query && typeof query === "object") {
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined || value === null || value === "") continue;
      url.searchParams.set(key, String(value));
    }
  }

  const response = await fetch(url.toString(), {
    method,
    headers: {
      accept: "application/json",
      "x-api-key": apiKey,
      ...(method === "GET"
        ? {}
        : {
            "content-type": "application/json",
          }),
    },
    body: method === "GET" ? undefined : JSON.stringify(body ?? {}),
  });

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text };
  }

  // If upstream returns HTML (misconfigured base URL / WAF page), surface it as an error.
  if (response.ok && contentType && !contentType.includes("json")) {
    const error = new Error("Unexpected non-JSON response from SimpleSwap");
    error.status = 502;
    error.data = { contentType, preview: String(text || "").slice(0, 200) };
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.message || data?.error || `SimpleSwap HTTP ${response.status}`,
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export function normalizeSimpleSwapCurrency(raw) {
  const ticker = String(raw?.ticker || raw?.symbol || raw?.code || "").trim().toLowerCase();
  const network = String(raw?.network || raw?.chain || raw?.blockchain || "").trim().toLowerCase();
  const name = String(raw?.name || raw?.title || raw?.fullName || "").trim();
  const hasExtraId =
    Boolean(raw?.hasExtraId) ||
    Boolean(raw?.has_extra_id) ||
    Boolean(raw?.hasExtraID) ||
    Boolean(raw?.extraId) ||
    Boolean(raw?.extra_id);
  const extraIdName = String(raw?.extraIdName || raw?.extra_id_name || "").trim();
  const image = String(raw?.image || raw?.icon || raw?.logo || "").trim();

  if (!ticker || !network) return null;
  return {
    ticker,
    network,
    name,
    hasExtraId,
    extraIdName,
    image,
    raw,
  };
}

const USD_STABLE_TICKERS = new Set([
  // "USD*" tickers
  "usdc",
  "usdt",
  "usdp",
  "usdd",
  "usde",
  "usdy",
  "usd0",
  "usdn",
  "gusd",
  "tusd",
  "fdusd",
  "pyusd",
  "sUSD".toLowerCase(),
  // Major USD-pegged stables without USD in ticker
  "dai",
  "frax",
  "lusd",
  "crvusd",
  "mim",
]);

export function isUsdStableCurrency(currency) {
  const ticker = String(currency?.ticker || "").toLowerCase();
  const name = String(currency?.name || "").toLowerCase();
  if (!ticker) return false;
  if (USD_STABLE_TICKERS.has(ticker)) return true;
  if (ticker.includes("usd")) return true;
  if (name.includes("usd")) return true;
  if (name.includes("us dollar")) return true;
  return false;
}
