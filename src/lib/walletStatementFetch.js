import { apiUrl } from "@/lib/runtimeConfig";

// In-flight request coalescing for /wallet/statement
const inflightByKey = new Map();
const INFLIGHT_TTL_MS = 15_000;

function safeJson(response) {
  return response.json().catch(() => ({}));
}

function normalizeKey(url) {
  return String(url || "").trim();
}

/**
 * fetchWalletStatementJson
 * - Deduplicates concurrent requests for the exact same URL (coalescing in-flight).
 * - Returns { response, data } so callers can inspect status/headers.
 *
 * Notes:
 * - This does NOT add caching; it only prevents duplicate network calls.
 * - Use distinct URLs (query params) when you truly need distinct payloads.
 */
export async function fetchWalletStatementJson(url, { signal } = {}) {
  const key = normalizeKey(url);
  if (!key) throw new Error("Missing statement URL");

  const now = Date.now();
  const existing = inflightByKey.get(key);
  if (existing && now - existing.ts < INFLIGHT_TTL_MS) {
    return existing.promise;
  }

  const promise = (async () => {
    const response = await fetch(key, { signal });
    const data = await safeJson(response);
    return { response, data };
  })();

  inflightByKey.set(key, { ts: now, promise });

  try {
    return await promise;
  } finally {
    // Remove immediately on settle; TTL guard is only for safety.
    const current = inflightByKey.get(key);
    if (current?.promise === promise) inflightByKey.delete(key);
  }
}

export function buildWalletStatementUrl(params = {}) {
  const url = new URL(apiUrl("/wallet/statement"));
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value == null || value === "") return;
    url.searchParams.set(key, String(value));
  });
  // Ensure consistent key for dedup across callers.
  if (!url.searchParams.has("source")) url.searchParams.set("source", "onchain");
  return url.toString();
}

