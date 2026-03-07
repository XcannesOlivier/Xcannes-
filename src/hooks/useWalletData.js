/**
 * useWalletData — Shared wallet data utilities
 *
 * Extracts the fetchBalance, warmFullReplay, and
 * refreshCachedStatementsForAddress logic that is common to both
 * NativeWalletContext and PwaEmbeddedContext into a single reusable hook,
 * preventing duplication and ensuring consistent behaviour across providers.
 */

import { useCallback } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  listCachedStatementKeys,
  setCachedStatement,
} from "@/lib/walletStatementCache";
import { decodeXrplCurrencyCode } from "@/utils/xrpl";

/**
 * @param {Function} setBalance          — React state setter for balance
 * @param {Function} setIsWalletActivated — React state setter for activation status
 * @returns {{ fetchBalance, warmFullReplay, refreshCachedStatementsForAddress }}
 */
export function useWalletData(setBalance, setIsWalletActivated) {
  const fetchBalance = useCallback(
    async (address) => {
      try {
        const res = await fetch(apiUrl(`/wallet/balance?address=${address}`));
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setIsWalletActivated(true);
          const tokens = Array.isArray(data?.tokens)
            ? data.tokens.map((token) => ({
                ...token,
                currency: decodeXrplCurrencyCode(token?.currency),
              }))
            : [];
          setBalance({
            xrp: data.xrp,
            xrpReserved: data.xrpReserved ?? 0,
            xrpAvailable: data.xrpAvailable ?? 0,
            xrpLowAlert: Boolean(data.xrpLowAlert),
            tokens,
          });
          return;
        }
        if (
          res.status === 404 &&
          String(data?.message || "")
            .toLowerCase()
            .includes("not activated")
        ) {
          setIsWalletActivated(false);
          setBalance({
            xrp: 0,
            xrpReserved: 0,
            xrpAvailable: 0,
            xrpLowAlert: false,
            tokens: [],
          });
        }
      } catch (error) {
        console.error("[Wallet] Fetch balance error:", error);
      }
    },
    [setBalance, setIsWalletActivated]
  );

  const warmFullReplay = useCallback(async (address) => {
    if (!address) return;
    try {
      const params = new URLSearchParams();
      params.set("address", address);
      params.set("limit", "100");
      params.set("forceFullReplay", "true");
      params.set("includeRaw", "true");
      params.set("source", "onchain");
      const url = apiUrl(`/wallet/statement?${params.toString()}`);
      const res = await fetch(url);
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setCachedStatement(url, data);
        const rawlessParams = new URLSearchParams(params);
        rawlessParams.delete("includeRaw");
        setCachedStatement(
          apiUrl(`/wallet/statement?${rawlessParams.toString()}`),
          data
        );
      }
    } catch {
      // best-effort
    }
  }, []);

  const refreshCachedStatementsForAddress = useCallback(async (address) => {
    if (!address) return;
    const cacheKeys = listCachedStatementKeys();
    const targetKeys = cacheKeys.filter((key) => {
      if (!key.includes("/wallet/statement")) return false;
      if (!key.includes(`address=${encodeURIComponent(address)}`)) return false;
      if (key.includes("cursor=")) return false;
      return true;
    });
    const urls =
      targetKeys.length > 0
        ? targetKeys
        : (() => {
            const p = new URLSearchParams();
            p.set("address", address);
            p.set("limit", "100");
            p.set("source", "onchain");
            return [apiUrl(`/wallet/statement?${p.toString()}`)];
          })();
    for (const url of urls) {
      const fetchUrl = (() => {
        try {
          const parsed = new URL(url);
          if (!parsed.searchParams.has("includeRaw"))
            parsed.searchParams.set("includeRaw", "true");
          return parsed.toString();
        } catch {
          return url;
        }
      })();
      try {
        const res = await fetch(fetchUrl);
        const data = await res.json().catch(() => ({}));
        if (res.ok) setCachedStatement(url, data);
      } catch {
        /* best-effort */
      }
    }
  }, []);

  return { fetchBalance, warmFullReplay, refreshCachedStatementsForAddress };
}
