import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

export function useWalletLines(address) {
  const [lines, setLines] = useState([]);
  const [totalLockedXcs, setTotalLockedXcs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLines = useCallback(async () => {
    if (!address) {
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
        apiUrl(`/wallet/lines?address=${encodeURIComponent(address)}`)
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
  }, [address]);

  const addLine = useCallback(
    async (currencyCode, lockedXcs) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(apiUrl("/wallet/lines"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            currencyCode,
            lockedXcs,
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
    [address, fetchLines]
  );

  const removeLine = useCallback(
    async (currencyCode) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(apiUrl("/wallet/lines"), {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            address,
            currencyCode,
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
    [address, fetchLines]
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
