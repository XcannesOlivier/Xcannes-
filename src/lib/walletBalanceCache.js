const BALANCE_CACHE_KEY = "xcannes_wallet_balance_cache_v1";
const DEFAULT_TTL_MS = 10 * 60 * 1000; // 10 minutes
const MAX_ENTRIES = 8;

function readCache() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(BALANCE_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function writeCache(cache) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(BALANCE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors (quota, disabled)
  }
}

function normalizeAddress(address) {
  return String(address || "").trim();
}

/**
 * peekCachedBalance — returns cached balance snapshot even if stale.
 * Used for immediate hydration (SWR).
 */
export function peekCachedBalance(address) {
  const addr = normalizeAddress(address);
  if (!addr) return null;
  const cache = readCache();
  const entry = cache?.[addr];
  if (!entry || typeof entry !== "object") return null;
  const ts = Number(entry.ts || 0);
  if (!Number.isFinite(ts)) return null;
  return { ts, data: entry.data ?? null };
}

/**
 * getCachedBalance — returns cached snapshot only if still fresh (TTL).
 */
export function getCachedBalance(address, { ttlMs = DEFAULT_TTL_MS } = {}) {
  const addr = normalizeAddress(address);
  if (!addr) return null;
  const cache = readCache();
  const entry = cache?.[addr];
  if (!entry || typeof entry !== "object") return null;
  const ts = Number(entry.ts || 0);
  if (!Number.isFinite(ts)) return null;
  if (ttlMs > 0 && Date.now() - ts > ttlMs) {
    delete cache[addr];
    writeCache(cache);
    return null;
  }
  return entry.data ?? null;
}

export function setCachedBalance(address, data) {
  const addr = normalizeAddress(address);
  if (!addr) return;
  const cache = readCache();
  cache[addr] = { ts: Date.now(), data };
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (cache[a]?.ts || 0) - (cache[b]?.ts || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete cache[key]);
  }
  writeCache(cache);
}

export function clearCachedBalance(address) {
  const addr = normalizeAddress(address);
  if (!addr) return;
  const cache = readCache();
  if (!cache?.[addr]) return;
  delete cache[addr];
  writeCache(cache);
}

