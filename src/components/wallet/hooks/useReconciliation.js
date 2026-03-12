import { useState, useCallback, useMemo } from "react";
import { buildXrplJsonMemo, buildReconcileMemo } from "@/utils/xrplMemo";
import { buildRlusdPaymentTxjson } from "@/utils/walletSpread";

/**
 * useReconciliation — manages external-spend reconciliation workflow.
 *
 * When the user spends RLUSD via external wallets (Xumm, Sologenic, etc.),
 * the Xcannes replay allocations total MORE than the actual on-chain balance.
 * This hook detects the deficit and lets the user confirm the adjustment
 * via a "J'ai compris" button, which sends a tiny self-payment with a
 * reconcile memo to permanently record the correction on-chain.
 *
 * @param {object} options
 * @param {object|null} options.reconciliation - Reconciliation data from backend API.
 * @param {string} options.address - XRPL wallet address.
 * @param {function} options.signTransaction - (txJson) => Promise<{ signed }> — unified sign+submit.
 * @param {function} options.onComplete - () => void — called after successful reconciliation.
 */
export function useReconciliation({
  reconciliation = null,
  address = null,
  signTransaction = null,
  onComplete = null,
} = {}) {
  const [dismissed, setDismissed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [txHash, setTxHash] = useState(null);

  const needed = Boolean(
    reconciliation?.needed &&
      reconciliation?.deficit > 0 &&
      Array.isArray(reconciliation?.operations) &&
      reconciliation.operations.length > 0
  );

  const visible = needed && !dismissed && !txHash;

  const deficit = needed ? reconciliation.deficit : 0;
  const operations = needed ? reconciliation.operations : [];
  const lineStates = needed ? reconciliation.lineStates || [] : [];

  /** Format a human-readable summary of operations. */
  const operationsSummary = useMemo(() => {
    if (!operations.length) return [];
    return operations.map((op) => ({
      currencyCode: op.currencyCode,
      deductedRlusd: op.deductedRlusd,
      label: `−${op.deductedRlusd.toFixed(2)} RLUSD from ${op.currencyCode}`,
    }));
  }, [operations]);

  /**
   * Build the reconcile memo payload for on-chain recording.
   */
  const buildMemoPayload = useCallback(() => {
    if (!needed) return null;
    return buildReconcileMemo({
      deficit,
      operations: operations.map((op) => ({
        currencyCode: op.currencyCode,
        deductedRlusd: op.deductedRlusd,
      })),
      lineStates: lineStates.map((ls) => ({
        currencyCode: ls.currencyCode,
        allocatedRlusdAfter: ls.allocatedRlusdAfter,
      })),
    });
  }, [needed, deficit, operations, lineStates]);

  /**
   * Build the full XRPL transaction JSON for the reconcile self-payment.
   * Uses a minimal 0.000001 RLUSD payment to self with reconcile memo.
   */
  const buildReconcileTx = useCallback(() => {
    if (!address || !needed) return null;

    const memoPayload = buildMemoPayload();
    if (!memoPayload) return null;

    const memos = buildXrplJsonMemo(memoPayload);
    if (!memos) return null;

    // Minimal self-payment of 0.000001 RLUSD
    const txJson = buildRlusdPaymentTxjson({
      account: address,
      destination: address,
      amountRlusd: 0.000001,
    });
    if (!txJson) return null;

    txJson.Memos = memos;
    return txJson;
  }, [address, needed, buildMemoPayload]);

  /**
   * Execute the reconciliation:
   * 1. Build transaction
   * 2. Sign + submit via signTransaction
   * 3. Complete
   */
  const confirm = useCallback(async () => {
    if (!needed || submitting) return;
    if (!signTransaction) {
      setError("Signing handler not available");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const txJson = buildReconcileTx();
      if (!txJson) {
        setError("Failed to build reconciliation transaction");
        return;
      }

      const result = await signTransaction(txJson, {
        action: "wallet:reconcile",
      });

      if (result?.signed) {
        setTxHash(result.hash || "confirmed");
        if (typeof onComplete === "function") {
          onComplete();
        }
      } else {
        setError("Transaction not signed");
      }
    } catch (err) {
      console.error("[useReconciliation] Error:", err);
      setError(err?.message || "Reconciliation failed");
    } finally {
      setSubmitting(false);
    }
  }, [needed, submitting, signTransaction, onComplete, buildReconcileTx]);

  /**
   * Dismiss the banner (user chooses to ignore for now).
   */
  const dismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  /**
   * Reset state (for re-check after refresh).
   */
  const reset = useCallback(() => {
    setDismissed(false);
    setError(null);
    setTxHash(null);
  }, []);

  return {
    needed,
    visible,
    deficit,
    operations,
    operationsSummary,
    submitting,
    error,
    txHash,
    confirm,
    dismiss,
    reset,
    buildReconcileTx,
  };
}
