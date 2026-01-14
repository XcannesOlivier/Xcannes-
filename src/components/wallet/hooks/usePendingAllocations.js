"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

export function usePendingAllocations(address) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchPending = useCallback(async () => {
    if (!address) {
      setPending([]);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        apiUrl(`/wallet/pending-allocations?address=${encodeURIComponent(address)}`)
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
  }, [address]);

  const activatePending = useCallback(
    async (currencyCode) => {
      if (!address || !currencyCode) return null;
      const res = await fetch(apiUrl("/wallet/pending-allocations/activate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, currencyCode }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to activate pending allocation");
      }
      return data;
    },
    [address]
  );

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  return {
    pending,
    loading,
    error,
    refresh: fetchPending,
    activatePending,
  };
}
