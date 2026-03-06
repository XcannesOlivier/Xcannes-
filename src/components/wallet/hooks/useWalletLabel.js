"use client";

/**
 * useWalletLabel — Fetch and display wallet label from the backend.
 *
 * Cleaned up on 6 mars 2026:
 * - Removed dead editing logic (openWalletLabelEditor, saveWalletLabel, cancelWalletLabel)
 * - Removed unused params (isPreviewMode, isWalletActivated, hasOnChainRlusd, signTransaction)
 * - Removed unused states (walletLabelDraft, isEditingWalletLabel, isWalletLabelRequired,
 *   isWalletLabelLoading, defaultCurrency)
 * - The "wallet label required" feature was decided as NOT needed (D1 resolved).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

export function useWalletLabel({
  walletAddress,
  isConnected,
  defaultLabel = "",
} = {}) {
  const [walletLabel, setWalletLabel] = useState(defaultLabel);
  const [isWalletLabelLocked, setIsWalletLabelLocked] = useState(false);
  const [walletHeaderToast, setWalletHeaderToast] = useState("");
  const toastTimeoutRef = useRef(null);
  const loadTokenRef = useRef(0);

  const clearToastTimer = useCallback(() => {
    if (!toastTimeoutRef.current) return;
    clearTimeout(toastTimeoutRef.current);
    toastTimeoutRef.current = null;
  }, []);

  const flashWalletHeaderToast = useCallback(
    (message, durationMs = 1600) => {
      clearToastTimer();
      setWalletHeaderToast(message);
      toastTimeoutRef.current = setTimeout(() => {
        setWalletHeaderToast("");
        toastTimeoutRef.current = null;
      }, durationMs);
    },
    [clearToastTimer],
  );

  useEffect(() => {
    clearToastTimer();
    return () => clearToastTimer();
  }, [clearToastTimer]);

  const loadWalletLabel = useCallback(async () => {
    if (!isConnected || !walletAddress) return;
    const token = ++loadTokenRef.current;
    try {
      const res = await fetch(
        apiUrl(`/wallet/label?address=${encodeURIComponent(walletAddress)}`),
        {},
      );
      const data = await res.json().catch(() => ({}));
      if (token !== loadTokenRef.current) return;
      if (!res.ok) {
        throw new Error(data?.error || "Unable to fetch wallet label");
      }
      const label = String(data?.label || "").trim();
      setWalletLabel(label || defaultLabel);
      setIsWalletLabelLocked(Boolean(label));
    } catch (err) {
      console.error("[useWalletLabel] Error fetching wallet label:", err);
      flashWalletHeaderToast("Impossible de charger le nom du wallet.", 2200);
    }
  }, [defaultLabel, flashWalletHeaderToast, isConnected, walletAddress]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setWalletLabel(defaultLabel);
      setIsWalletLabelLocked(false);
      loadTokenRef.current += 1;
      return;
    }
    loadWalletLabel();
  }, [defaultLabel, isConnected, loadWalletLabel, walletAddress]);

  return {
    walletLabel,
    isWalletLabelLocked,
    walletHeaderToast,
    flashWalletHeaderToast,
    loadWalletLabel,
  };
}
