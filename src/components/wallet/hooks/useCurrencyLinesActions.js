"use client";

import { useCallback } from "react";

export function useCurrencyLinesActions({
  backendWalletAddress,
  currencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineCode,
  setCurrencyLineAllocatedRlusd,
  upsertCurrencyLine,
}) {
  const handleUpsertCurrencyLine = useCallback(async () => {
    if (!backendWalletAddress) {
      alert("Please connect your wallet first.");
      return;
    }

    const code = String(currencyLineCode || "")
      .trim()
      .toUpperCase();
    if (!code || code.length < 2) {
      alert("Select a valid currency.");
      return;
    }
    if (code === "RLUSD") {
      alert("RLUSD is the pool (unallocated). Choose another currency.");
      return;
    }

    const allocated = Number.parseFloat(currencyLineAllocatedRlusd);
    if (!Number.isFinite(allocated) || allocated < 0) {
      alert("Enter a valid allocated RLUSD amount (>= 0).");
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
  ]);

  return { handleUpsertCurrencyLine };
}
