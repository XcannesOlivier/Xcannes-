"use client";

import { useCallback } from "react";

export function useCurrencyLinesActions({
  backendWalletAddress,
  currencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineCode,
  setCurrencyLineAllocatedRlusd,
  upsertCurrencyLine,
  toast,
}) {
  const handleUpsertCurrencyLine = useCallback(async () => {
    if (!backendWalletAddress) {
      toast?.error("Please connect your wallet first.");
      return;
    }

    const code = String(currencyLineCode || "")
      .trim()
      .toUpperCase();
    if (!code || code.length < 2) {
      toast?.error("Select a valid currency.");
      return;
    }
    if (code === "RLUSD") {
      toast?.error("RLUSD is the pool (unallocated). Choose another currency.");
      return;
    }

    const allocated = Number.parseFloat(currencyLineAllocatedRlusd);
    if (!Number.isFinite(allocated) || allocated < 0) {
      toast?.error("Enter a valid allocated RLUSD amount (>= 0).");
      return;
    }

    await upsertCurrencyLine?.({
      currencyCode: code,
      allocatedRlusd: allocated,
    });

    setCurrencyLineCode("");
    setCurrencyLineAllocatedRlusd("");
  }, [
    backendWalletAddress,
    currencyLineAllocatedRlusd,
    currencyLineCode,
    setCurrencyLineAllocatedRlusd,
    setCurrencyLineCode,
    upsertCurrencyLine,
    toast,
  ]);

  return { handleUpsertCurrencyLine };
}
