"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { buildRlusdPaymentTxjson, XCANNES_ACTIVATION_WALLET_ADDRESS } from "@/utils/walletSpread";
import { buildXrplJsonMemo } from "@/utils/xrplMemo";

export function useWalletLabel({
  walletAddress,
  isConnected,
  storageKey,
  defaultLabel = "",
  signTransaction,
  activationDestination = XCANNES_ACTIVATION_WALLET_ADDRESS,
  renameFeeRlusd = 1,
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

  const saveWalletLabel = useCallback(async () => {
    if (!walletAddress) return;
    const trimmed = String(walletLabelDraft || "").trim();
    if (trimmed === walletLabel) {
      setIsEditingWalletLabel(false);
      return;
    }

    if (!isConnected || !signTransaction) {
      flashWalletHeaderToast("Connect wallet to rename.", 2000);
      return;
    }

    const destination = String(activationDestination || "").trim();
    if (!destination) {
      flashWalletHeaderToast("Activation wallet not configured.", 2000);
      return;
    }

    const fee = Number(renameFeeRlusd);
    if (!Number.isFinite(fee) || fee <= 0) {
      flashWalletHeaderToast("Invalid rename fee.", 2000);
      return;
    }

    const txjson = buildRlusdPaymentTxjson({
      account: walletAddress,
      destination,
      amountRlusd: fee,
    });
    if (!txjson) {
      flashWalletHeaderToast("Unable to build rename payment.", 2000);
      return;
    }

    const memoPayload = {
      xcannes: "wallet_label",
      schema: "xcannes-wallet-label-v1",
      v: 1,
      label: trimmed,
    };
    const memos = buildXrplJsonMemo(memoPayload);
    if (memos) txjson.Memos = memos;

    const result = await signTransaction(txjson, { action: "wallet:label" });
    if (!result?.signed) {
      flashWalletHeaderToast("Rename payment cancelled.", 2000);
      return;
    }

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
  }, [
    activationDestination,
    flashWalletHeaderToast,
    isConnected,
    renameFeeRlusd,
    signTransaction,
    storageKey,
    walletAddress,
    walletLabel,
    walletLabelDraft,
  ]);

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
