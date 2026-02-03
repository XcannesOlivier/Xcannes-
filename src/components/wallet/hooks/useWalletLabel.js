"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { buildRlusdPaymentTxjson, XCANNES_ACTIVATION_WALLET_ADDRESS } from "@/utils/walletSpread";
import { buildXrplJsonMemo, buildWalletLabelMemo } from "@/utils/xrplMemo";

export function useWalletLabel({
  walletAddress,
  isConnected,
  isPreviewMode = false,
  isWalletActivated = null,
  hasOnChainRlusd = null,
  defaultLabel = "",
  signTransaction,
  activationDestination = XCANNES_ACTIVATION_WALLET_ADDRESS,
  renameFeeRlusd = 1,
} = {}) {
  const [walletLabel, setWalletLabel] = useState(defaultLabel);
  const [walletLabelDraft, setWalletLabelDraft] = useState(defaultLabel);
  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
  const [isWalletLabelRequired, setIsWalletLabelRequired] = useState(false);
  const [isWalletLabelLocked, setIsWalletLabelLocked] = useState(false);
  const [isWalletLabelLoading, setIsWalletLabelLoading] = useState(false);
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
    [clearToastTimer]
  );

  useEffect(() => {
    clearToastTimer();
    return () => clearToastTimer();
  }, [clearToastTimer]);

  const loadWalletLabel = useCallback(async () => {
    if (!isConnected || !walletAddress) return;
    const token = ++loadTokenRef.current;
    setIsWalletLabelLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/wallet/label?address=${encodeURIComponent(walletAddress)}`),
        {}
      );
      const data = await res.json().catch(() => ({}));
      if (token !== loadTokenRef.current) return;
      if (!res.ok) {
        throw new Error(data?.error || "Unable to fetch wallet label");
      }
      const label = String(data?.label || "").trim();
      setWalletLabel(label || defaultLabel);
      setWalletLabelDraft(label || defaultLabel);
      const required = !label;
      setIsWalletLabelRequired(required);
      setIsWalletLabelLocked(Boolean(label));
      if (required) {
        setIsEditingWalletLabel(true);
      }
    } catch (err) {
      console.error("[useWalletLabel] Error fetching wallet label:", err);
      if (token === loadTokenRef.current) {
        setIsWalletLabelRequired(false);
      }
      flashWalletHeaderToast("Impossible de charger le nom du wallet.", 2200);
    } finally {
      if (token === loadTokenRef.current) {
        setIsWalletLabelLoading(false);
      }
    }
  }, [defaultLabel, flashWalletHeaderToast, isConnected, walletAddress]);

  useEffect(() => {
    if (!isConnected || !walletAddress) {
      setWalletLabel(defaultLabel);
      setWalletLabelDraft(defaultLabel);
      setIsEditingWalletLabel(false);
      setIsWalletLabelRequired(false);
      setIsWalletLabelLocked(false);
      setIsWalletLabelLoading(false);
      loadTokenRef.current += 1;
      return;
    }
    loadWalletLabel();
  }, [defaultLabel, isConnected, loadWalletLabel, walletAddress]);

  const openWalletLabelEditor = useCallback(() => {
    if (!walletAddress) return;
    if (isWalletLabelLocked) {
      flashWalletHeaderToast("Nom du wallet deja valide.", 2000);
      return;
    }
    setWalletLabelDraft(walletLabel || "");
    setIsEditingWalletLabel(true);
  }, [flashWalletHeaderToast, isWalletLabelLocked, walletAddress, walletLabel]);

  const saveWalletLabel = useCallback(async () => {
    if (!walletAddress) return;
    if (isWalletLabelLocked) {
      flashWalletHeaderToast("Nom du wallet deja valide.", 2000);
      setIsEditingWalletLabel(false);
      return;
    }
    const trimmed = String(walletLabelDraft || "").trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordPattern = /^[A-Za-z]+$/;
    const isValid =
      words.length >= 1 &&
      words.length <= 2 &&
      words.every((word) => word.length <= 7 && wordPattern.test(word));
    if (!isValid) {
      flashWalletHeaderToast(
        "Nom du wallet: 1 ou 2 mots, 7 lettres max par mot, lettres A-Z uniquement (sans accents).",
        2600
      );
      return;
    }
    if (trimmed === walletLabel) {
      setIsEditingWalletLabel(false);
      return;
    }

    if (isPreviewMode) {
      setWalletLabel(trimmed);
      setWalletLabelDraft(trimmed);
      setIsEditingWalletLabel(false);
      setIsWalletLabelRequired(false);
      flashWalletHeaderToast("Nom enregistré", 1600);
      return;
    }

    if (!isConnected || !signTransaction) {
      flashWalletHeaderToast("Connect wallet to rename.", 2000);
      return;
    }

    if (isWalletActivated === false) {
      flashWalletHeaderToast(
        "Wallet must be activated to rename.",
        2200
      );
      return;
    }

    if (hasOnChainRlusd === false) {
      flashWalletHeaderToast(
        "RLUSD trustline is not installed yet.",
        2200
      );
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

    const memoPayload = buildWalletLabelMemo({ label: trimmed });
    if (!memoPayload) {
      flashWalletHeaderToast("Invalid wallet label memo.", 2000);
      return;
    }
    const memos = buildXrplJsonMemo(memoPayload);
    if (!memos) {
      flashWalletHeaderToast("Invalid wallet label memo.", 2000);
      return;
    }
    txjson.Memos = memos;

    const result = await signTransaction(txjson, { action: "wallet:label" });
    if (!result?.signed) {
      flashWalletHeaderToast("Rename payment cancelled.", 2000);
      return;
    }

    setWalletLabel(trimmed);
    setIsEditingWalletLabel(false);
    setIsWalletLabelRequired(false);
    setIsWalletLabelLocked(true);
    loadWalletLabel();

    flashWalletHeaderToast("Nom enregistré", 1600);
  }, [
    activationDestination,
    flashWalletHeaderToast,
    hasOnChainRlusd,
    isConnected,
    isPreviewMode,
    isWalletActivated,
    isWalletLabelLocked,
    loadWalletLabel,
    renameFeeRlusd,
    signTransaction,
    walletAddress,
    walletLabel,
    walletLabelDraft,
  ]);

  const cancelWalletLabel = useCallback(() => {
    if (isWalletLabelRequired) {
      flashWalletHeaderToast("Nom du wallet requis.", 2000);
      setIsEditingWalletLabel(true);
      return;
    }
    setWalletLabelDraft(walletLabel);
    setIsEditingWalletLabel(false);
  }, [flashWalletHeaderToast, isWalletLabelRequired, walletLabel]);

  return {
    walletLabel,
    walletLabelDraft,
    setWalletLabelDraft,
    isEditingWalletLabel,
    isWalletLabelRequired,
    isWalletLabelLocked,
    isWalletLabelLoading,
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor,
    saveWalletLabel,
    cancelWalletLabel,
    loadWalletLabel,
  };
}
