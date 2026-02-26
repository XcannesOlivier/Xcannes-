import { useEffect, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

/**
 * useStatementWalletLabel
 * -----------------------
 * Fetches the wallet label from the API (or uses the override).
 * Shared by CurrencyStatement & GlobalStatement.
 */
export default function useStatementWalletLabel(
  walletAddress,
  walletLabelOverride = "",
) {
  const resolvedOverride = String(walletLabelOverride || "").trim();
  const [walletLabel, setWalletLabel] = useState("");

  useEffect(() => {
    let cancelled = false;

    if (resolvedOverride) {
      setWalletLabel(resolvedOverride);
      return () => {};
    }
    if (!walletAddress) {
      setWalletLabel("");
      return () => {};
    }

    const loadLabel = async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(walletAddress)}`),
        );
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load wallet label");
        }
        if (cancelled) return;
        setWalletLabel(String(data?.label || "").trim());
      } catch (err) {
        console.error("Error loading wallet label:", err);
        if (!cancelled) setWalletLabel("");
      }
    };

    loadLabel();
    return () => {
      cancelled = true;
    };
  }, [resolvedOverride, walletAddress]);

  return walletLabel;
}
