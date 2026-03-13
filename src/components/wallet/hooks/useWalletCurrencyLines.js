import { useState, useCallback, useEffect, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

// ── localStorage SWR helpers ─────────────────────────────────
const CL_CACHE_TTL_MS = 120_000; // 2 minutes

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
      setInitialReady(true);
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

      applyData(data);
      writeClCache(address, data);
      setInitialReady(true);
    } catch (err) {
      console.error("[useWalletCurrencyLines] Error:", err);
      setError(err.message || "Unknown error");
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
    if (!address) {
      fetchCurrencyLines();
      return;
    }
    const cached = readClCache(address);
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
