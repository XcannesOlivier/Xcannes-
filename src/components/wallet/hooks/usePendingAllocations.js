"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { getWalletSessionHeaders } from "@/lib/walletSession";

export function usePendingAllocations(address, { signTransaction } = {}) {
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const requestWalletSignature = useCallback(async (action) => {
    if (!signTransaction) {
      setError("Xumm signature required. Please connect your wallet.");
      return null;
    }

    const result = await signTransaction(
      { TransactionType: "SignIn" },
      { action }
    );
    if (!result?.signed || !result?.uuid) {
      setError("Signature cancelled or expired.");
      return null;
    }

    return result.uuid;
  }, [signTransaction]);

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
        apiUrl(`/wallet/pending-allocations?address=${encodeURIComponent(address)}`),
        { headers: getWalletSessionHeaders() }
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
    async (currencyCode, { xummUuid } = {}) => {
      if (!address || !currencyCode) return null;

      const signatureUuid =
        xummUuid ||
        (await requestWalletSignature("wallet:pending-allocations:activate"));
      if (!signatureUuid) return null;

      const res = await fetch(apiUrl("/wallet/pending-allocations/activate"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, currencyCode, xummUuid: signatureUuid }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to activate pending allocation");
      }
      return data;
    },
    [address, requestWalletSignature]
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
