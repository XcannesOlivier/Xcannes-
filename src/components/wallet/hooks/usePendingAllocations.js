"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { getWalletSessionHeaders } from "@/lib/walletSession";
import { useXumm } from "@/context/XummContext";

export function usePendingAllocations(address) {
  const xumm = useXumm();
  const walletSessionToken = xumm?.walletSessionToken || null;
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    if (!address || !walletSessionToken) {
      setPending([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        apiUrl(`/wallet/pending-allocations?address=${encodeURIComponent(address)}`),
        { headers: getWalletSessionHeaders(walletSessionToken) }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to load pending allocations");
      }
      setPending(Array.isArray(data.pending) ? data.pending : []);
    } catch (err) {
      console.error("[usePendingAllocations] Error:", err);
      setError(err.message || "Unknown error");
      setPending([]);
    } finally {
      setLoading(false);
    }
  }, [address, walletSessionToken]);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return {
    pending,
    loading,
    error,
    refresh: fetchPending,
  };
}
