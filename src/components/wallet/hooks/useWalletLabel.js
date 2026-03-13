"use client";

/**
 * useWalletLabel — Display wallet label from the backend.
 *
 * Cleaned up on 6 mars 2026:
 * - Removed dead editing logic (openWalletLabelEditor, saveWalletLabel, cancelWalletLabel)
 * - Removed unused params (isPreviewMode, isWalletActivated, hasOnChainRlusd, signTransaction)
 * - Removed unused states (walletLabelDraft, isEditingWalletLabel, isWalletLabelRequired,
 *   isWalletLabelLoading, defaultCurrency)
 * - The "wallet label required" feature was decided as NOT needed (D1 resolved).
 *
 * Updated 13 mars 2026:
 * - Label is now provided by useWalletCurrencyLines (externalLabel/externalDefaultCurrency)
 *   to avoid a duplicate XRPL replay. loadWalletLabel is kept as a callback that triggers
 *   the parent refresh (refreshCurrencyLines) so useWalletActivation call sites remain unchanged.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export function useWalletLabel({
  walletAddress,
  isConnected,
  defaultLabel = "",
  externalLabel,
  externalDefaultCurrency,
  onRefresh,
} = {}) {
  const [walletLabel, setWalletLabel] = useState(defaultLabel);
  const [isWalletLabelLocked, setIsWalletLabelLocked] = useState(false);
  const [defaultCurrency, setDefaultCurrency] = useState(null);
  const [walletHeaderToast, setWalletHeaderToast] = useState("");
  const toastTimeoutRef = useRef(null);

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

  // Sync from external source (useWalletCurrencyLines)
  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setWalletLabel(defaultLabel);
      setIsWalletLabelLocked(false);
      setDefaultCurrency(null);
      return;
    }
    if (externalLabel != null) {
      const label = String(externalLabel || "").trim();
      setWalletLabel(label || defaultLabel);
      setIsWalletLabelLocked(Boolean(label));
    }
    if (externalDefaultCurrency !== undefined) {
      setDefaultCurrency(externalDefaultCurrency || null);
    }
  }, [defaultLabel, externalDefaultCurrency, externalLabel, isConnected, walletAddress]);

  // loadWalletLabel is now a thin alias for the parent refresh callback
  // so that useWalletActivation call sites (setTimeout(() => loadWalletLabel(), 3000))
  // continue to work without any changes.
  const loadWalletLabel = useCallback(() => {
    if (typeof onRefresh === "function") onRefresh();
  }, [onRefresh]);

  return {
    walletLabel,
    isWalletLabelLocked,
    defaultCurrency,
    walletHeaderToast,
    flashWalletHeaderToast,
    loadWalletLabel,
  };
}
