"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function useWalletLabel({
  walletAddress,
  isConnected,
  storageKey,
  defaultLabel = "",
} = {}) {
  const [walletLabel, setWalletLabel] = useState(defaultLabel);
  const [walletLabelDraft, setWalletLabelDraft] = useState(defaultLabel);
  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
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
    [clearToastTimer]
  );

  useEffect(() => {
    clearToastTimer();
    return () => clearToastTimer();
  }, [clearToastTimer]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setWalletLabel(defaultLabel);
      setWalletLabelDraft(defaultLabel);
      setIsEditingWalletLabel(false);
      return;
    }

    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      const labels = raw ? JSON.parse(raw) : {};
      const label = labels[walletAddress] || defaultLabel;
      setWalletLabel(label);
      setWalletLabelDraft(label);
    } catch (err) {
      console.error("[useWalletLabel] Error loading wallet label:", err);
    }
  }, [defaultLabel, isConnected, storageKey, walletAddress]);

  const openWalletLabelEditor = useCallback(() => {
    if (!walletAddress) return;
    setWalletLabelDraft(walletLabel || "");
    setIsEditingWalletLabel(true);
  }, [walletAddress, walletLabel]);

  const saveWalletLabel = useCallback(() => {
    if (!walletAddress) return;
    const trimmed = String(walletLabelDraft || "").trim();
    setWalletLabel(trimmed);
    setIsEditingWalletLabel(false);

    if (typeof window !== "undefined") {
      try {
        const raw = window.localStorage.getItem(storageKey);
        const labels = raw ? JSON.parse(raw) : {};
        if (trimmed) {
          labels[walletAddress] = trimmed;
        } else {
          delete labels[walletAddress];
        }
        window.localStorage.setItem(storageKey, JSON.stringify(labels));
      } catch (err) {
        console.error("[useWalletLabel] Error saving wallet label:", err);
      }
    }

    flashWalletHeaderToast("Nom enregistré", 1600);
  }, [flashWalletHeaderToast, storageKey, walletAddress, walletLabelDraft]);

  const cancelWalletLabel = useCallback(() => {
    setWalletLabelDraft(walletLabel);
    setIsEditingWalletLabel(false);
  }, [walletLabel]);

  return {
    walletLabel,
    walletLabelDraft,
    setWalletLabelDraft,
    isEditingWalletLabel,
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor,
    saveWalletLabel,
    cancelWalletLabel,
  };
}

