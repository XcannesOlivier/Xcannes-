"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { getWalletSessionHeaders } from "@/lib/walletSession";
import { buildRlusdPaymentTxjson, XCANNES_ACTIVATION_WALLET_ADDRESS } from "@/utils/walletSpread";
import { buildXrplJsonMemo, buildWalletLabelMemo } from "@/utils/xrplMemo";
import { useXumm } from "@/context/XummContext";

export function useWalletLabel({
  walletAddress,
  isConnected,
  defaultLabel = "",
  signTransaction,
  activationDestination = XCANNES_ACTIVATION_WALLET_ADDRESS,
  renameFeeRlusd = 1,
} = {}) {
  const xumm = useXumm();
  const walletSessionToken = xumm?.walletSessionToken || null;
  const [walletLabel, setWalletLabel] = useState(defaultLabel);
  const [walletLabelDraft, setWalletLabelDraft] = useState(defaultLabel);
  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
  const [isWalletLabelRequired, setIsWalletLabelRequired] = useState(false);
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
    if (!isConnected || !walletAddress || !walletSessionToken) return;
    const token = ++loadTokenRef.current;
    setIsWalletLabelLoading(true);
    try {
      const res = await fetch(
        apiUrl(`/wallet/label?address=${encodeURIComponent(walletAddress)}`),
        { headers: getWalletSessionHeaders(walletSessionToken) }
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
  }, [defaultLabel, flashWalletHeaderToast, isConnected, walletAddress, walletSessionToken]);

  useEffect(() => {
    if (!isConnected || !walletAddress || !walletSessionToken) {
      setWalletLabel(defaultLabel);
      setWalletLabelDraft(defaultLabel);
      setIsEditingWalletLabel(false);
      setIsWalletLabelRequired(false);
      setIsWalletLabelLoading(false);
      loadTokenRef.current += 1;
      return;
    }
    loadWalletLabel();
  }, [defaultLabel, isConnected, loadWalletLabel, walletAddress, walletSessionToken]);

  const openWalletLabelEditor = useCallback(() => {
    if (!walletAddress) return;
    setWalletLabelDraft(walletLabel || "");
    setIsEditingWalletLabel(true);
  }, [walletAddress, walletLabel]);

  const saveWalletLabel = useCallback(async () => {
    if (!walletAddress) return;
    const trimmed = String(walletLabelDraft || "").trim();
    const words = trimmed.split(/\s+/).filter(Boolean);
    const wordPattern = /^\p{L}+$/u;
    const isValid =
      words.length >= 1 &&
      words.length <= 2 &&
      words.every((word) => word.length <= 6 && wordPattern.test(word));
    if (!isValid) {
      flashWalletHeaderToast(
        "Nom du wallet: 1 ou 2 mots, 6 lettres max par mot, lettres uniquement.",
        2600
      );
      return;
    }
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
    loadWalletLabel();

    flashWalletHeaderToast("Nom enregistré", 1600);
  }, [
    activationDestination,
    flashWalletHeaderToast,
    isConnected,
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
    isWalletLabelLoading,
    walletHeaderToast,
    flashWalletHeaderToast,
    openWalletLabelEditor,
    saveWalletLabel,
    cancelWalletLabel,
    loadWalletLabel,
  };
}
