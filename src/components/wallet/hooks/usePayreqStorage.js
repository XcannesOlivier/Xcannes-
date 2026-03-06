"use client";

import { useState, useCallback, useEffect } from "react";

/**
 * usePayreqStorage — persiste les demandes de paiement (payreq) en localStorage
 * afin que l'utilisateur puisse fermer la modale, convertir ses devises,
 * et revenir payer plus tard.
 *
 * Clé localStorage : `xcannes_pending_payreqs_<walletAddress>`
 * Chaque entrée contient la payreq d'origine + un ID unique + un timestamp.
 *
 * @param {{ walletAddress: string | null }} opts
 * @returns {{
 *   pendingPayreqs: Array<object>,
 *   savePayreq: (payreq: object) => string | null,
 *   removePayreq: (id: string) => void,
 *   pendingCount: number,
 * }}
 */
export function usePayreqStorage({ walletAddress } = {}) {
  const storageKey = walletAddress
    ? `xcannes_pending_payreqs_${walletAddress}`
    : null;

  // ----------------------------------------------------------------
  // Read from localStorage
  // ----------------------------------------------------------------
  const readFromStorage = useCallback(() => {
    if (!storageKey || typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [storageKey]);

  const [pendingPayreqs, setPendingPayreqs] = useState(() => readFromStorage());

  // Sync when walletAddress changes
  useEffect(() => {
    setPendingPayreqs(readFromStorage());
  }, [readFromStorage]);

  // ----------------------------------------------------------------
  // Write to localStorage
  // ----------------------------------------------------------------
  const writeToStorage = useCallback(
    (list) => {
      if (!storageKey || typeof window === "undefined") return;
      try {
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch {
        // quota exceeded — silently ignore
      }
    },
    [storageKey],
  );

  // ----------------------------------------------------------------
  // Save a payreq (deduplication by destination + amount + currency)
  // ----------------------------------------------------------------
  const savePayreq = useCallback(
    (payreq) => {
      if (!payreq || !storageKey) return null;
      const id = `pr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const entry = {
        id,
        savedAt: new Date().toISOString(),
        payreq: { ...payreq },
      };

      // Deduplicate: same destination + same amount + same currency → update
      const dest = String(payreq.to || "").trim();
      const amount = Number(payreq.amountRlusd || payreq.displayAmount || 0);
      const currency = String(
        payreq.targetCurrencyCode || payreq.displayCurrency || "",
      ).toUpperCase();

      setPendingPayreqs((prev) => {
        const filtered = prev.filter((p) => {
          const pDest = String(p.payreq?.to || "").trim();
          const pAmount = Number(
            p.payreq?.amountRlusd || p.payreq?.displayAmount || 0,
          );
          const pCurrency = String(
            p.payreq?.targetCurrencyCode || p.payreq?.displayCurrency || "",
          ).toUpperCase();
          return !(
            pDest === dest &&
            pAmount === amount &&
            pCurrency === currency
          );
        });
        const updated = [entry, ...filtered].slice(0, 20); // max 20 pending
        writeToStorage(updated);
        return updated;
      });

      return id;
    },
    [storageKey, writeToStorage],
  );

  // ----------------------------------------------------------------
  // Remove a payreq by ID
  // ----------------------------------------------------------------
  const removePayreq = useCallback(
    (id) => {
      if (!id || !storageKey) return;
      setPendingPayreqs((prev) => {
        const updated = prev.filter((p) => p.id !== id);
        writeToStorage(updated);
        return updated;
      });
    },
    [storageKey, writeToStorage],
  );

  return {
    pendingPayreqs,
    savePayreq,
    removePayreq,
    pendingCount: pendingPayreqs.length,
  };
}
