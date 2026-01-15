export default class LruCache {
  constructor({ maxEntries = 100, defaultTtlMs = null } = {}) {
    const max = Number.isFinite(maxEntries) ? Math.floor(maxEntries) : 0;
    this.maxEntries = Math.max(0, max);
    this.defaultTtlMs = defaultTtlMs === undefined ? null : defaultTtlMs;
    this.map = new Map();
  }

  get(key) {
    const entry = this.map.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== null && entry.expiresAt <= Date.now()) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, entry);
    return entry.value;
  }

  set(key, value, ttlMs) {
    const resolvedTtl = ttlMs === undefined ? this.defaultTtlMs : ttlMs;
    if (resolvedTtl !== null) {
      if (!Number.isFinite(resolvedTtl) || resolvedTtl <= 0) {
        this.map.delete(key);
        return;
      }
    }
    const expiresAt =
      resolvedTtl === null ? null : Date.now() + Math.floor(resolvedTtl);
    if (this.map.has(key)) {
      this.map.delete(key);
    }
    this.map.set(key, { value, expiresAt });
    this.enforceLimit();
  }

  delete(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }

  enforceLimit() {
    if (this.maxEntries <= 0) return;
    while (this.map.size > this.maxEntries) {
      const oldestKey = this.map.keys().next().value;
      if (oldestKey === undefined) break;
      this.map.delete(oldestKey);
    }
  }
}
