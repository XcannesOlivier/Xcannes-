import { useState, useCallback, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

// ── localStorage SWR helpers ─────────────────────────────────
const CL_CACHE_TTL_MS = 120_000; // 2 minutes (fresh window)
const CL_CACHE_MAX_STALE_MS = 24 * 60 * 60 * 1000; // 24h (SWR hydration window)

function clCacheKey(addr) {
  return `xcannes_cl_${addr}`;
}

function readClCache(addr) {
  try {
    const raw = localStorage.getItem(clCacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() - parsed.ts > CL_CACHE_TTL_MS) {
      localStorage.removeItem(clCacheKey(addr));
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}

function peekClCache(addr) {
  try {
    const raw = localStorage.getItem(clCacheKey(addr));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const ts = Number(parsed.ts || 0);
    if (!Number.isFinite(ts)) return null;
    if (Date.now() - ts > CL_CACHE_MAX_STALE_MS) return null;
    return parsed.data ?? null;
  } catch {
    return null;
  }
}

function writeClCache(addr, data) {
  try {
    localStorage.setItem(
      clCacheKey(addr),
      JSON.stringify({ ts: Date.now(), data }),
    );
  } catch {
    /* quota exceeded – ignore */
  }
}

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
  const [initialReady, setInitialReady] = useState(false);

  const hydratedRef = useRef(false);
  const activeAddressRef = useRef(address || "");
  const requestSeqRef = useRef(0);

  // Keep current address available synchronously to async completions.
  activeAddressRef.current = String(address || "");

  // ── Apply a data payload to all state slices ───────────────
  const applyData = useCallback((data) => {
    setLines(Array.isArray(data.lines) ? data.lines : []);
    setSummary({
      rlusdOnChain: data.rlusdOnChain ?? null,
      totalAllocatedRlusd: Number(data.totalAllocatedRlusd || 0),
      unallocatedRlusd: data.unallocatedRlusd ?? null,
    });
    setReconciliation(data.reconciliation || null);
    setWalletLabel(data.walletLabel || '');
    setDefaultCurrency(data.defaultCurrency || null);
  }, []);

  const fetchCurrencyLines = useCallback(async ({ silent = false, bustCache = false } = {}) => {
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
      setInitialReady(true);
      return;
    }

    const seq = (requestSeqRef.current += 1);
    const requestAddress = String(address || "");

    try {
      if (!silent) setLoading(true);
      setError(null);

      const params = new URLSearchParams({ address });
      if (bustCache) params.set("bustCache", "true");

      const res = await fetch(apiUrl(`/wallet/currency-lines?${params.toString()}`));
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load wallet currency lines");
      }

      if (seq !== requestSeqRef.current) return;
      if (activeAddressRef.current !== requestAddress) return;

      applyData(data);
      writeClCache(address, data);
      setInitialReady(true);
    } catch (err) {
      if (seq !== requestSeqRef.current) return;
      if (activeAddressRef.current !== requestAddress) return;
      console.error("[useWalletCurrencyLines] Error:", err);
      setError(err.message || "Unknown error");
      setInitialReady(true);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [address, applyData]);

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

        applyData(data);
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
    [address, applyData],
  );

  // ── Mount: try cache hydration, then silent revalidate ─────
  useEffect(() => {
    hydratedRef.current = false;
    // Prevent label/data from a previous wallet leaking into the new wallet UI
    // during async fetch/hydration.
    setLines([]);
    setSummary({
      rlusdOnChain: null,
      totalAllocatedRlusd: 0,
      unallocatedRlusd: null,
    });
    setReconciliation(null);
    setWalletLabel("");
    setDefaultCurrency(null);
    setError(null);
    setInitialReady(false);
    if (!address) {
      fetchCurrencyLines();
      return;
    }
    // SWR: hydrate from stale cache (up to CL_CACHE_MAX_STALE_MS), then revalidate.
    const cached = peekClCache(address) || readClCache(address);
    if (cached) {
      applyData(cached);
      setInitialReady(true);
      hydratedRef.current = true;
      // Revalidate silently in the background
      fetchCurrencyLines({ silent: true });
    } else {
      fetchCurrencyLines();
    }
  }, [address, applyData, fetchCurrencyLines]);

  return {
    lines,
    summary,
    reconciliation,
    walletLabel,
    defaultCurrency,
    loading,
    error,
    initialReady,
    refresh: fetchCurrencyLines,
    upsertCurrencyLine,
  };
}
