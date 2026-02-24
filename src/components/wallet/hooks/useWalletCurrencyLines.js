import { useState, useCallback, useEffect } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

export function useWalletCurrencyLines(address, { signTransaction } = {}) {
  const [lines, setLines] = useState([]);
  const [summary, setSummary] = useState({
    rlusdOnChain: null,
    totalAllocatedRlusd: 0,
    unallocatedRlusd: null,
    invariantOk: null,
    excessAllocatedRlusd: null,
  });
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

  const fetchCurrencyLines = useCallback(async () => {
    if (!address) {
      setLines([]);
      setSummary({
        rlusdOnChain: null,
        totalAllocatedRlusd: 0,
        unallocatedRlusd: null,
        invariantOk: null,
        excessAllocatedRlusd: null,
      });
      setLoading(false);
      setError(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch(
        apiUrl(`/wallet/currency-lines?address=${encodeURIComponent(address)}`)
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load wallet currency lines");
      }

      setLines(Array.isArray(data.lines) ? data.lines : []);
      setSummary({
        rlusdOnChain: data.rlusdOnChain ?? null,
        totalAllocatedRlusd: Number(data.totalAllocatedRlusd || 0),
        unallocatedRlusd: data.unallocatedRlusd ?? null,
        invariantOk: data.invariantOk ?? null,
        excessAllocatedRlusd: data.excessAllocatedRlusd ?? null,
      });
    } catch (err) {
      console.error("[useWalletCurrencyLines] Error:", err);
      setError(err.message || "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [address]);

  const upsertCurrencyLine = useCallback(
    async ({ currencyCode, allocatedRlusd, fxRate, fxSource, xummUuid } = {}) => {
      if (!address || !currencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const signatureUuid =
          xummUuid ||
          (await requestWalletSignature("wallet:currency-lines:upsert"));
        if (!signatureUuid) return;

        const res = await fetch(apiUrl("/wallet/currency-lines"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // no session headers
          },
          body: JSON.stringify({
            address,
            currencyCode,
            allocatedRlusd,
            fxRate,
            fxSource,
            xummUuid: signatureUuid,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to save wallet currency line");
        }

        setLines(Array.isArray(data.lines) ? data.lines : []);
        setSummary({
          rlusdOnChain: data.rlusdOnChain ?? null,
          totalAllocatedRlusd: Number(data.totalAllocatedRlusd || 0),
          unallocatedRlusd: data.unallocatedRlusd ?? null,
          invariantOk: data.invariantOk ?? null,
          excessAllocatedRlusd: data.excessAllocatedRlusd ?? null,
        });

        return data;
      } catch (err) {
        console.error("[useWalletCurrencyLines] upsertCurrencyLine error:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [address, requestWalletSignature]
  );

  const convertAllocation = useCallback(
    async ({
      fromCurrencyCode,
      toCurrencyCode,
      amountRlusd,
      fromFxRate,
      fromFxSource,
      toFxRate,
      toFxSource,
      xummUuid,
    } = {}) => {
      if (!address || !fromCurrencyCode || !toCurrencyCode) return;

      try {
        setLoading(true);
        setError(null);

        const signatureUuid =
          xummUuid || (await requestWalletSignature("wallet:convert"));
        if (!signatureUuid) return;

        const res = await fetch(apiUrl("/wallet/convert"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // no session headers
          },
          body: JSON.stringify({
            address,
            fromCurrencyCode,
            toCurrencyCode,
            amountRlusd,
            fromFxRate,
            fromFxSource,
            toFxRate,
            toFxSource,
            xummUuid: signatureUuid,
          }),
        });

        const data = await res.json();
        if (!res.ok || data.error) {
          throw new Error(data.error || "Failed to convert wallet allocations");
        }

        setLines(Array.isArray(data.lines) ? data.lines : []);
        setSummary({
          rlusdOnChain: data.rlusdOnChain ?? null,
          totalAllocatedRlusd: Number(data.totalAllocatedRlusd || 0),
          unallocatedRlusd: data.unallocatedRlusd ?? null,
          invariantOk: data.invariantOk ?? null,
          excessAllocatedRlusd: data.excessAllocatedRlusd ?? null,
        });

        return data;
      } catch (err) {
        console.error("[useWalletCurrencyLines] convertAllocation error:", err);
        setError(err.message || "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [address, requestWalletSignature]
  );

  useEffect(() => {
    fetchCurrencyLines();
  }, [fetchCurrencyLines]);

  return {
    lines,
    summary,
    loading,
    error,
    refresh: fetchCurrencyLines,
    upsertCurrencyLine,
    convertAllocation,
  };
}
