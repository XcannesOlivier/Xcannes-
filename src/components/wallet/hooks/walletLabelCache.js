"use client";

// Bump version when label persistence semantics change.
const WALLET_LABEL_CACHE_KEY = "xcannes_wallet_labels_v2";
const WALLET_LABEL_CACHE_TTL_MS = 10 * 60_000; // 10 minutes

export function readWalletLabelCache() {
  try {
    const raw = localStorage.getItem(WALLET_LABEL_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const now = Date.now();
    const out = {};
    for (const [addr, entry] of Object.entries(parsed)) {
      const label = String(entry?.label || "").trim();
      const ts = Number(entry?.ts || 0);
      if (!addr || !label) continue;
      if (!Number.isFinite(ts) || now - ts > WALLET_LABEL_CACHE_TTL_MS) continue;
      out[addr] = label;
    }
    return out;
  } catch {
    return {};
  }
}

export function writeWalletLabelCache(labelsByAddress) {
  try {
    const now = Date.now();
    const payload = {};
    for (const [addr, label] of Object.entries(labelsByAddress || {})) {
      const t = String(label || "").trim();
      if (!addr || !t) continue;
      payload[addr] = { label: t, ts: now };
    }
    localStorage.setItem(WALLET_LABEL_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}
