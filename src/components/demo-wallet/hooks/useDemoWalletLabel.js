/**
 * useDemoWalletLabel — wallet label editing, header toast & address copy.
 *
 * Encapsulates the label-editing state machine:
 * - open / cancel / save the inline label editor
 * - flash a "Copié" header toast on address copy
 * - auto-lock after first save (labelLocked)
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { clone } from "../utils/demoWalletHelpers";

export function useDemoWalletLabel({
  activeWalletId,
  walletContextLabel,
  walletAddress,
  isWalletLabelLocked,
  state,
  setState,
}) {
  const { t } = useTranslation("common");

  const [isEditingWalletLabel, setIsEditingWalletLabel] = useState(false);
  const [walletLabelDraft, setWalletLabelDraft] = useState(walletContextLabel);
  const [walletHeaderToast, setWalletHeaderToast] = useState("");
  const toastTimerRef = useRef(null);

  // Keep draft in sync when the external label changes.
  useEffect(() => {
    setWalletLabelDraft(walletContextLabel);
  }, [walletContextLabel]);

  // Cleanup timer on unmount.
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
        toastTimerRef.current = null;
      }
    };
  }, []);

  const flashWalletHeaderToast = useCallback((message) => {
    const text = String(message || "").trim();
    if (!text) return;
    setWalletHeaderToast(text);
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    toastTimerRef.current = window.setTimeout(() => {
      setWalletHeaderToast("");
      toastTimerRef.current = null;
    }, 1300);
  }, []);

  // Auto-close editor when label becomes locked.
  useEffect(() => {
    if (isWalletLabelLocked && isEditingWalletLabel)
      setIsEditingWalletLabel(false);
  }, [isEditingWalletLabel, isWalletLabelLocked]);

  const handleOpenWalletLabelEditor = useCallback(() => {
    if (isWalletLabelLocked) return;
    setWalletLabelDraft(walletContextLabel);
    setIsEditingWalletLabel(true);
  }, [isWalletLabelLocked, walletContextLabel]);

  const handleCancelWalletLabel = useCallback(() => {
    setIsEditingWalletLabel(false);
    setWalletLabelDraft(walletContextLabel);
  }, [walletContextLabel]);

  const handleSaveWalletLabel = useCallback(() => {
    if (isWalletLabelLocked) return;
    const nextLabel = String(walletLabelDraft || "").trim();
    if (!nextLabel) {
      handleCancelWalletLabel();
      return;
    }
    if (nextLabel === "Mr et Mme Dupont") {
      handleCancelWalletLabel();
      return;
    }
    const nextState = clone(state);
    const wallet = nextState?.wallets?.[activeWalletId];
    if (wallet) {
      wallet.label = nextLabel.slice(0, 40);
      wallet.labelLocked = true;
    }
    setState(nextState);
    setIsEditingWalletLabel(false);
  }, [
    activeWalletId,
    handleCancelWalletLabel,
    isWalletLabelLocked,
    setState,
    state,
    walletLabelDraft,
  ]);

  const handleCopyWalletAddress = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(walletAddress);
      flashWalletHeaderToast(t("demo_copied", "Copié"));
    } catch {
      // noop
    }
  }, [walletAddress, flashWalletHeaderToast, t]);

  return {
    isEditingWalletLabel,
    setIsEditingWalletLabel,
    walletLabelDraft,
    setWalletLabelDraft,
    walletHeaderToast,
    setWalletHeaderToast,
    handleOpenWalletLabelEditor,
    handleCancelWalletLabel,
    handleSaveWalletLabel,
    handleCopyWalletAddress,
  };
}
