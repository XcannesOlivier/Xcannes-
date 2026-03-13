import { useState, useCallback, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

// ─── Lightweight per-address localStorage cache (SWR) ────────────────────────

const CACHE_KEY_PREFIX = "xcannes_cl_";
const CACHE_TTL_MS = 120_000; // serve stale up to 2 min, revalidate async

function readClCache(address) {
  if (!address || typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CACHE_KEY_PREFIX + address);
    if (!raw) return null;
    const entry = JSON.parse(raw);
    if (!entry || typeof entry !== "object") return null;
    const age = Date.now() - (entry.ts || 0);
    if (age > CACHE_TTL_MS) {
      window.localStorage.removeItem(CACHE_KEY_PREFIX + address);
      return null;
    }
    return entry.data ?? null;
  } catch { return null; }
}

function writeClCache(address, data) {
  if (!address || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CACHE_KEY_PREFIX + address,
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch { /* quota exceeded — non-critical */ }
}

// ─── Apply API response to state ─────────────────────────────────────────────

function applyData(data, { setLines, setSummary, setReconciliation, setWalletLabel, setDefaultCurrency }) {
  setLines(Array.isArray(data.lines) ? data.lines : []);
  setSummary({
    rlusdOnChain: data.rlusdOnChain ?? null,
    totalAllocatedRlusd: Number(data.totalAllocatedRlusd || 0),
    unallocatedRlusd: data.unallocatedRlusd ?? null,
  });
  setReconciliation(data.reconciliation || null);
  setWalletLabel(data.walletLabel || '');
  setDefaultCurrency(data.defaultCurrency || null);
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useWalletCurrencyLines(address) {
  const [lines, setLines] = useState([]);
  const [summary, setSummary] = useState({
    rlusdOnChain: null,
    totalAllocatedRlusd: 0,
    unallocatedRlusd: null,
  });
  const [reconciliation, setReconciliation] = useState(null);
  const [walletLabel, setWalletLabel] = useState('');
  const [defaultCurrency, setDefaultCurrency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const hydratedRef = useRef(false);

  const setters = { setLines, setSummary, setReconciliation, setWalletLabel, setDefaultCurrency };

  const fetchCurrencyLines = useCallback(async ({ silent = false } = {}) => {
    if (!address) {
      setLines([]);
      setSummary({
        rlusdOnChain: null,
        totalAllocatedRlusd: 0,
        unallocatedRlusd: null,
      });
      setReconciliation(null);
      setWalletLabel('');
      setDefaultCurrency(null);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      if (!silent) setLoading(true);
      setError(null);

      const res = await fetch(
        apiUrl(`/wallet/currency-lines?address=${encodeURIComponent(address)}`),
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load wallet currency lines");
      }

      applyData(data, setters);
      writeClCache(address, data);
    } catch (err) {
      console.error("[useWalletCurrencyLines] Error:", err);
      setError(err.message || "Unknown error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [address]);

  const upsertCurrencyLine = useCallback(
    async ({
      currencyCode,
      allocatedRlusd,
      fxRate,
      fxSource,
    } = {}) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(apiUrl("/wallet/currency-lines"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            currencyCode,
            allocatedRlusd,
            fxRate,
            fxSource,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to save wallet currency line");
        }

        applyData(data, setters);
        writeClCache(address, data);

        return data;
      } catch (err) {
        console.error(
          "[useWalletCurrencyLines] upsertCurrencyLine error:",
          err,
        );
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [address],
  );

  // ── SWR: hydrate from localStorage on mount, then revalidate ──────────────
  useEffect(() => {
    if (!address) { fetchCurrencyLines(); return; }

    // 1. Stale read — instant render
    if (!hydratedRef.current) {
      const cached = readClCache(address);
      if (cached) {
        applyData(cached, setters);
        hydratedRef.current = true;
        // 2. Revalidate silently (no loading spinner)
        fetchCurrencyLines({ silent: true });
        return;
      }
    }

    // 3. Cold start — normal fetch with loading=true
    fetchCurrencyLines();
  }, [fetchCurrencyLines]);

  return {
    lines,
    summary,
    reconciliation,
    walletLabel,
    defaultCurrency,
    loading,
    error,
    refresh: fetchCurrencyLines,
    upsertCurrencyLine,
  };
}
