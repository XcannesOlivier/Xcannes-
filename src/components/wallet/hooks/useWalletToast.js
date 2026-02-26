"use client";

import { useCallback, useRef, useState } from "react";

/**
 * Wallet-scoped notification system that replaces native alert()/confirm().
 *
 * Usage:
 *   const { toasts, confirmState, toast, confirm, dismissToast, resolveConfirm } = useWalletToast();
 *
 *   toast.success("Payment submitted!");
 *   toast.error("Insufficient balance.");
 *   toast.warn("Rate mismatch.");
 *   toast.info("2 signatures needed.");
 *
 *   const ok = await confirm("Proceed with payment?\n\nTotal: 100 RLUSD");
 *   if (!ok) return;
 *
 * The hook returns render state (`toasts`, `confirmState`) that
 * `WalletToastOverlay` consumes to display the UI.
 */
export function useWalletToast() {
  const idCounter = useRef(0);
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null); // { id, message, resolve }
  const confirmResolveRef = useRef(null);

  // ── Toast API ─────────────────────────────────────────────────────
  const pushToast = useCallback((message, variant = "info", durationMs = 4000) => {
    const id = ++idCounter.current;
    setToasts((prev) => [...prev, { id, message, variant, durationMs }]);
    if (durationMs > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    }
    return id;
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = {
    success: (msg, ms = 3500) => pushToast(msg, "success", ms),
    error: (msg, ms = 5000) => pushToast(msg, "error", ms),
    warn: (msg, ms = 5000) => pushToast(msg, "warning", ms),
    info: (msg, ms = 4000) => pushToast(msg, "info", ms),
  };

  // ── Confirm API (async, returns Promise<boolean>) ─────────────────
  const confirm = useCallback((message) => {
    return new Promise((resolve) => {
      // If a previous confirm is still pending, dismiss it as false.
      if (confirmResolveRef.current) {
        confirmResolveRef.current(false);
      }
      const id = ++idCounter.current;
      confirmResolveRef.current = resolve;
      setConfirmState({ id, message });
    });
  }, []);

  const resolveConfirm = useCallback((accepted) => {
    if (confirmResolveRef.current) {
      confirmResolveRef.current(accepted);
      confirmResolveRef.current = null;
    }
    setConfirmState(null);
  }, []);

  return {
    // render state
    toasts,
    confirmState,
    // API
    toast,
    confirm,
    dismissToast,
    resolveConfirm,
  };
}
