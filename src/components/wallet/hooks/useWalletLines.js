import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { getWalletSessionHeaders } from "@/lib/walletSession";
import { useXumm } from "@/context/XummContext";

export function useWalletLines(address, { signTransaction } = {}) {
  const xumm = useXumm();
  const walletSessionToken = xumm?.walletSessionToken || null;
  const [lines, setLines] = useState([]);
  const [totalLockedXcs, setTotalLockedXcs] = useState(0);
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

  const fetchLines = useCallback(async () => {
    if (!address || !walletSessionToken) {
      setLines([]);
      setTotalLockedXcs(0);
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        apiUrl(`/wallet/lines?address=${encodeURIComponent(address)}`),
        { headers: getWalletSessionHeaders(walletSessionToken) }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load wallet lines");
      }

      setLines(Array.isArray(data.lines) ? data.lines : []);
      setTotalLockedXcs(Number(data.totalLockedXcs || 0));
    } catch (err) {
      console.error("[useWalletLines] Error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [address, walletSessionToken]);

  const addLine = useCallback(
    async (currencyCode, lockedXcs) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const xummUuid = await requestWalletSignature("wallet:lines:upsert");
        if (!xummUuid) return;

        const res = await fetch(apiUrl("/wallet/lines"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getWalletSessionHeaders(walletSessionToken),
          },
          body: JSON.stringify({
            address,
            currencyCode,
            lockedXcs,
            xummUuid,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to save wallet line");
        }

        await fetchLines();
        return data;
      } catch (err) {
        console.error("[useWalletLines] addLine error:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [address, fetchLines, requestWalletSignature, walletSessionToken]
  );

  const removeLine = useCallback(
    async (currencyCode) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const xummUuid = await requestWalletSignature("wallet:lines:delete");
        if (!xummUuid) return;

        const res = await fetch(apiUrl("/wallet/lines"), {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            ...getWalletSessionHeaders(walletSessionToken),
          },
          body: JSON.stringify({
            address,
            currencyCode,
            xummUuid,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to delete wallet line");
        }

        await fetchLines();
        return data;
      } catch (err) {
        console.error("[useWalletLines] removeLine error:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [address, fetchLines, requestWalletSignature, walletSessionToken]
  );

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  return {
    lines,
    totalLockedXcs,
    loading,
    error,
    refresh: fetchLines,
    addLine,
    removeLine,
  };
}
