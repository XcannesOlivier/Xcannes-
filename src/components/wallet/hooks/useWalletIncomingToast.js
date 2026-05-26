"use client";

import { useEffect, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { fetchWalletStatementJson } from "@/lib/walletStatementFetch";

/**
 * useWalletIncomingToast — Polls /wallet/statement every 12s to detect
 * incoming payments and flash a toast notification ("crédité en EUR", etc.).
 */
export function useWalletIncomingToast({
  backendWalletAddress,
  flashWalletHeaderToast,
}) {
  const lastIncomingToastRef = useRef(null);
  const mountedAtRef = useRef(Date.now());
  const rateLimitedUntilRef = useRef(0);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!backendWalletAddress) return;

    const storageKey = `xcannes_wallet_last_incoming:${backendWalletAddress}`;
    try {
      lastIncomingToastRef.current = window.sessionStorage.getItem(storageKey);
    } catch {
      // ignore
    }

    let cancelled = false;

    const fetchLatestIncoming = async () => {
      if (cancelled) return;
      if (Date.now() < rateLimitedUntilRef.current) return;
      try {
        const params = new URLSearchParams();
        params.set("address", backendWalletAddress);
        params.set("limit", "5");
        params.set("source", "onchain");
        const { response, data } = await fetchWalletStatementJson(
          apiUrl(`/wallet/statement?${params.toString()}`),
        );
        if (response.status === 429) {
          const header = Number(response.headers?.get("Retry-After"));
          const retryAfter = Number.isFinite(header)
            ? header
            : Number(data?.retryAfter);
          const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10;
          rateLimitedUntilRef.current = Date.now() + waitSec * 1000;
          return;
        }
        if (!response.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const incoming = movements.find(
          (m) => String(m?.kind || "").toUpperCase() === "PAYMENT_IN",
        );
        if (!incoming) return;

        const movementId = String(incoming?.movementId || incoming?._id || "");
        if (!movementId) return;
        if (movementId && lastIncomingToastRef.current === movementId) return;

        const createdAt = incoming?.createdAt
          ? new Date(incoming.createdAt)
          : null;
        const createdAtMs =
          createdAt && Number.isFinite(createdAt.getTime())
            ? createdAt.getTime()
            : null;
        if (createdAtMs != null && createdAtMs < mountedAtRef.current) {
          lastIncomingToastRef.current = movementId;
          try {
            window.sessionStorage.setItem(storageKey, movementId);
          } catch {
            // ignore
          }
          return;
        }

        const toCurrency = String(incoming?.toCurrencyCode || "").toUpperCase();
        const amountRlusd = Number(incoming?.amountRlusd ?? 0);
        const fxRate = Number(incoming?.fxRate ?? 0);

        let message = "";
        if (toCurrency && Number.isFinite(amountRlusd) && amountRlusd > 0) {
          if (Number.isFinite(fxRate) && fxRate > 0) {
            const amountFx = amountRlusd / fxRate;
            message = `+${amountFx.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })} ${toCurrency} crédités`;
          } else {
            message = `+${amountRlusd.toLocaleString("en-US", {
              maximumFractionDigits: 2,
            })} RLUSD crédités`;
          }
        }

        if (message) {
          flashWalletHeaderToast(message, 5000);
        }

        lastIncomingToastRef.current = movementId;
        try {
          window.sessionStorage.setItem(storageKey, movementId);
        } catch {
          // ignore
        }
      } catch (error) {
        // Best effort only.
        if (process.env.NEXT_PUBLIC_DEBUG_LOGS === "true") {
          console.warn(
            "[wallet] incoming toast poll failed:",
            error?.message || error,
          );
        }
      }
    };

    fetchLatestIncoming();
    const interval = window.setInterval(fetchLatestIncoming, 12000);

    // Réagit immédiatement aux événements WebSocket (transaction on-chain détectée)
    // sans attendre le prochain tick du polling.
    const handleWalletRefresh = (event) => {
      if (event?.detail?.address && event.detail.address !== backendWalletAddress) return;
      fetchLatestIncoming();
    };
    window.addEventListener("xcannes:wallet:refresh", handleWalletRefresh);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("xcannes:wallet:refresh", handleWalletRefresh);
    };
  }, [backendWalletAddress, flashWalletHeaderToast]);
}
