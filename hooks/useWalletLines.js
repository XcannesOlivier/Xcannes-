/**
 * 🪝 Hook pour gérer les "lignes" de devises d'un wallet
 * Stockées côté backend dans la collection wallet_lines.
 */

import { useCallback, useEffect, useState } from "react";
import { apiUrl, getApiBaseUrl } from "../lib/runtimeConfig";

if (typeof window !== "undefined") {
  // Debug simple pour vérifier la base API côté navigateur
  // (peut être retiré une fois la configuration validée)
  // eslint-disable-next-line no-console
  console.log("[useWalletLines] API_BASE =", getApiBaseUrl());
}

export function useWalletLines(address) {
  const [lines, setLines] = useState([]);
  const [totalLockedXcs, setTotalLockedXcs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLines = useCallback(async () => {
    if (!address) {
      setLines([]);
      setTotalLockedXcs(0);
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

        // Mise à jour optimiste locale pour éviter d'attendre un nouveau fetch
        const normalized = String(currencyCode).toUpperCase();
        setLines((prev) => {
          let removedLocked = 0;
          const remaining = prev.filter((line) => {
            const match =
              String(line.currencyCode || "").toUpperCase() === normalized;
            if (match) {
              const v = Number.parseFloat(line.lockedXcs || 0);
              if (Number.isFinite(v)) {
                removedLocked += v;
              }
            }
            return !match;
          });

          if (removedLocked) {
            setTotalLockedXcs((prevTotal) =>
              Math.max(0, prevTotal - removedLocked)
            );
          }

          return remaining;
        });

        // On tente quand même un refresh en arrière-plan (si échec, l'état local reste cohérent)
        fetchLines().catch((err) => {
          console.error("[useWalletLines] background refresh error:", err);
        });

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
    // Charger automatiquement les lignes quand l'adresse change
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
