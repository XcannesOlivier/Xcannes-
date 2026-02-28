const STATEMENT_CACHE_KEY = "xcannes_wallet_statement_cache_v1";
const DEFAULT_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 25;

function readCache() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STATEMENT_CACHE_KEY);
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
    window.localStorage.setItem(STATEMENT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // ignore storage errors (quota, disabled)
  }
}

export function getCachedStatement(cacheKey, { ttlMs = DEFAULT_TTL_MS } = {}) {
  if (!cacheKey) return null;
  const cache = readCache();
  const entry = cache?.[cacheKey];
  if (!entry || typeof entry !== "object") return null;
  const ts = Number(entry.ts || 0);
  if (!Number.isFinite(ts)) return null;
  if (ttlMs > 0 && Date.now() - ts > ttlMs) {
    delete cache[cacheKey];
    writeCache(cache);
    return null;
  }
  return entry.data ?? null;
}

export function setCachedStatement(cacheKey, data) {
  if (!cacheKey) return;
  const cache = readCache();
  cache[cacheKey] = { ts: Date.now(), data };
  const keys = Object.keys(cache);
  if (keys.length > MAX_ENTRIES) {
    keys
      .sort((a, b) => (cache[a]?.ts || 0) - (cache[b]?.ts || 0))
      .slice(0, keys.length - MAX_ENTRIES)
      .forEach((key) => delete cache[key]);
  }
  writeCache(cache);
}

export function listCachedStatementKeys() {
  const cache = readCache();
  return Object.keys(cache || {});
}

function clearStatementCache() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STATEMENT_CACHE_KEY);
  } catch {
    // ignore
  }
}
