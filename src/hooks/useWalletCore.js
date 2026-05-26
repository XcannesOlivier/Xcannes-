/**
 * useWalletCore — Shared wallet logic for NativeWalletContext & PwaEmbeddedContext
 *
 * Encapsulates all the duplicated state & functions:
 *   - balance fetching, statement cache warming, cached-statement refresh
 *   - WebSocket real-time wallet updates (subscribe/unsubscribe)
 *   - wallet activation / deactivation / switch
 *   - transaction autofill via backend
 *
 * Each context only adds its mode-specific transport:
 *   - NativeWalletContext → relay QR + WebSocket challenge flow
 *   - PwaEmbeddedContext  → postMessage bridge to PWA parent
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import wsClient from "@/lib/xcannesWebSocket";
import {
  listCachedStatementKeys,
  setCachedStatement,
} from "@/lib/walletStatementCache";
import { peekCachedBalance, setCachedBalance } from "@/lib/walletBalanceCache";
import { fetchWalletStatementJson } from "@/lib/walletStatementFetch";
import { decodeXrplCurrencyCode } from "@/utils/xrpl";

export function useWalletCore({ logPrefix = "Wallet" } = {}) {
  // ─── Shared state ────────────────────────────────────────────────
  const [wallet, setWallet] = useState("");
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [balance, setBalance] = useState(null);
  const [isWalletActivated, setIsWalletActivated] = useState(null);
  const [walletAddresses, setWalletAddresses] = useState([]);

  /** Stable ref — always holds the current wallet address for callbacks */
  const walletRef = useRef("");
  const warmFullReplayTimeoutRef = useRef(null);
  const warmFullReplayLastAddressRef = useRef("");

  const clearWarmFullReplayTimeout = useCallback(() => {
    if (warmFullReplayTimeoutRef.current) {
      clearTimeout(warmFullReplayTimeoutRef.current);
      warmFullReplayTimeoutRef.current = null;
    }
  }, []);

  // ─── fetchBalance ────────────────────────────────────────────────
  const fetchBalance = useCallback(async (address) => {
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
          xrpReserveBase: data.xrpReserveBase ?? null,
          xrpReserveInc: data.xrpReserveInc ?? null,
          xrpOwnerCount: data.xrpOwnerCount ?? null,
          xrpReserved: data.xrpReserved ?? 0,
          xrpAvailable: data.xrpAvailable ?? 0,
          xrpLowAlert: Boolean(data.xrpLowAlert),
          tokens,
        });
        try {
          setCachedBalance(address, {
            isWalletActivated: true,
            balance: {
              xrp: data.xrp,
              xrpReserveBase: data.xrpReserveBase ?? null,
              xrpReserveInc: data.xrpReserveInc ?? null,
              xrpOwnerCount: data.xrpOwnerCount ?? null,
              xrpReserved: data.xrpReserved ?? 0,
              xrpAvailable: data.xrpAvailable ?? 0,
              xrpLowAlert: Boolean(data.xrpLowAlert),
              tokens,
            },
          });
        } catch {
          // ignore cache write errors
        }
        return;
      }
      if (
        res.status === 404 &&
        String(data?.message || "")
          .toLowerCase()
          .includes("not activated")
      ) {
        setIsWalletActivated(false);
        const emptyBalance = {
          xrp: 0,
          xrpReserveBase: null,
          xrpReserveInc: null,
          xrpOwnerCount: null,
          xrpReserved: 0,
          xrpAvailable: 0,
          xrpLowAlert: false,
          tokens: [],
        };
        setBalance(emptyBalance);
        try {
          setCachedBalance(address, { isWalletActivated: false, balance: emptyBalance });
        } catch {
          // ignore
        }
      }
    } catch (error) {
      console.error(`[${logPrefix}] Fetch balance error:`, error);
    }
  }, [logPrefix]);

  // ─── warmFullReplay ──────────────────────────────────────────────
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
      const { response, data } = await fetchWalletStatementJson(url);
      if (response.ok) {
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

  const scheduleWarmFullReplay = useCallback(
    (address) => {
      const addr = String(address || "").trim();
      if (!addr) return;

      clearWarmFullReplayTimeout();
      warmFullReplayLastAddressRef.current = addr;

      // Skip aggressive warm-up when we already have any statement cache for this wallet
      // (or when we warmed up recently). This reduces cold-start network pressure.
      try {
        const cacheKeys = listCachedStatementKeys();
        const hasAnyForAddress = cacheKeys.some(
          (key) =>
            key.includes("/wallet/statement") &&
            key.includes(`address=${encodeURIComponent(addr)}`),
        );
        const lastWarmKey = `xcannes_wallet_last_warm_full_replay:${addr}`;
        const lastWarm =
          typeof window !== "undefined"
            ? Number(window.localStorage?.getItem(lastWarmKey) || 0)
            : 0;
        const warmedRecently = Number.isFinite(lastWarm) && Date.now() - lastWarm < 20 * 60 * 1000;
        if (hasAnyForAddress && warmedRecently) return;
      } catch {
        // ignore
      }

      warmFullReplayTimeoutRef.current = setTimeout(() => {
        try {
          if (walletRef.current !== addr) return;
          warmFullReplay(addr);
          try {
            if (typeof window !== "undefined") {
              window.localStorage?.setItem(
                `xcannes_wallet_last_warm_full_replay:${addr}`,
                String(Date.now()),
              );
            }
          } catch {
            // ignore
          }
        } catch {
          // best-effort only
        }
      }, 2200);
    },
    [clearWarmFullReplayTimeout, warmFullReplay],
  );

  // ─── refreshCachedStatementsForAddress ────────────────────────────
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
        const { response, data } = await fetchWalletStatementJson(fetchUrl);
        if (response.ok) setCachedStatement(url, data);
      } catch {
        /* best-effort */
      }
    }
  }, []);

  // ─── activateWallet / deactivateWallet ────────────────────────────
  const activateWallet = useCallback(
    (account) => {
      clearWarmFullReplayTimeout();
      walletRef.current = account;
      setWallet(account);
      setIsConnected(true);
      setIsWalletActivated(null);
      try {
        const cached = peekCachedBalance(account);
        const snapshot = cached?.data || null;
        if (snapshot && typeof snapshot === "object") {
          if (typeof snapshot.isWalletActivated === "boolean") {
            setIsWalletActivated(snapshot.isWalletActivated);
          }
          if (snapshot.balance) {
            setBalance(snapshot.balance);
          }
        }
      } catch {
        // ignore hydration errors
      }
      fetchBalance(account);
      scheduleWarmFullReplay(account);
    },
    [clearWarmFullReplayTimeout, fetchBalance, scheduleWarmFullReplay]
  );

  const deactivateWallet = useCallback(() => {
    clearWarmFullReplayTimeout();
    walletRef.current = "";
    setWallet("");
    setIsConnected(false);
    setBalance(null);
    setIsWalletActivated(null);
  }, [clearWarmFullReplayTimeout]);

  // ─── switchToWallet (reset balance then re-fetch) ─────────────────
  const switchToWallet = useCallback(
    (address) => {
      if (!address) return;
      clearWarmFullReplayTimeout();
      walletRef.current = address;
      setWallet(address);
      setIsWalletActivated(null);
      try {
        const cached = peekCachedBalance(address);
        const snapshot = cached?.data || null;
        if (snapshot && typeof snapshot === "object" && snapshot.balance) {
          if (typeof snapshot.isWalletActivated === "boolean") {
            setIsWalletActivated(snapshot.isWalletActivated);
          }
          setBalance(snapshot.balance);
        } else {
          setBalance(null);
        }
      } catch {
        setBalance(null);
      }
      fetchBalance(address);
      scheduleWarmFullReplay(address);
    },
    [clearWarmFullReplayTimeout, fetchBalance, scheduleWarmFullReplay]
  );

  // ─── refreshBalance ──────────────────────────────────────────────
  const refreshBalance = useCallback(() => {
    if (walletRef.current) fetchBalance(walletRef.current);
  }, [fetchBalance]);

  // ─── autofillTransaction ─────────────────────────────────────────
  const autofillTransaction = useCallback(
    async (txjson, address) => {
      try {
        const afRes = await fetch(apiUrl("/wallet-relay/autofill"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ txjson, address }),
        });
        if (afRes.ok) {
          const afData = await afRes.json();
          if (afData.txjson) return afData.txjson;
        } else {
          console.warn(
            `[${logPrefix}] Autofill failed, signing without:`,
            await afRes.text()
          );
        }
      } catch (afErr) {
        console.warn(
          `[${logPrefix}] Autofill error, signing without:`,
          afErr
        );
      }
      return txjson;
    },
    [logPrefix]
  );

  // ─── WebSocket real-time wallet updates ───────────────────────────
  const walletWsRefreshRef = useRef(0);

  useEffect(() => {
    if (!wallet) return;
    let cancelled = false;
    const address = wallet;
    const channelKey = `wallet:${address}`;

    wsClient
      .connect()
      .then(() => {
        if (cancelled) return;
        wsClient.subscribe("wallet", address);
      })
      .catch(() => {});

    const handleWalletUpdate = (message) => {
      if (cancelled) return;
      const channel = message?.channel;
      const data = message?.data || {};
      if (channel && channel !== channelKey) return;
      if (data?.address && data.address !== address) return;
      const now = Date.now();
      if (now - walletWsRefreshRef.current < 5000) return;
      walletWsRefreshRef.current = now;
      refreshCachedStatementsForAddress(address);
      fetchBalance(address);
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:refresh", { detail: { address } })
        );
      }
    };

    wsClient.on("wallet", handleWalletUpdate);
    return () => {
      cancelled = true;
      wsClient.off("wallet", handleWalletUpdate);
      wsClient.unsubscribe("wallet", address);
    };
  }, [fetchBalance, refreshCachedStatementsForAddress, wallet]);

  // ─── Public API ──────────────────────────────────────────────────
  return {
    // State (read)
    wallet,
    isConnected,
    isConnecting,
    isSessionReady,
    balance,
    isWalletActivated,
    walletAddresses,
    walletRef,

    // Setters needed by mode-specific logic
    setIsConnecting,
    setIsSessionReady,
    setWalletAddresses,

    // Shared actions
    fetchBalance,
    refreshCachedStatementsForAddress,
    activateWallet,
    deactivateWallet,
    switchToWallet,
    refreshBalance,
    autofillTransaction,
  };
}
