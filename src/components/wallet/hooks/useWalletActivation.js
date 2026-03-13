import { useCallback } from "react";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { buildWalletLabelMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import {
  buildRlusdPaymentTxjson,
  XCANNES_RECONCILE_DESTINATION,
} from "@/utils/walletSpread";

/**
 * Encapsulates all wallet-activation and trustline-installation logic:
 *
 * - `handleInstallRequiredTrustline`  — signs a TrustSet tx via the wallet

 * - `handleRlusdSetupConfirm`        — confirms setup + triggers trustline
 * - `handleOpenActivationModal`      — opens XRP activation modal
 * - `handleActivationRequestFromThirdParty` — switches to 3rd-party request
 * - `handleActivationBuyViaMoonpay`  — redirects to MoonPay XRP buy
 * - `handleActivationSendFromWallet` — self-send XRP to activate wallet
 */
export function useWalletActivation({
  // useWallet()
  isConnected,
  wallet,
  signTransaction,
  refreshBalance,
  // Wallet label
  loadWalletLabel,
  // Trustline state
  hasRlusdTrustline,
  // UI state setters
  closeInlineQr,
  setWalletInfoOpen,
  setShowActivationModal,
  setShowActivationRequestModal,
  setCashBuyPrefill,
  setCashModalTab,
  setActiveAction,
  // useWalletToast()
  toast,
  confirm,
}) {
  // ------------------------------------------------------------------
  // handleInstallRequiredTrustline
  // ------------------------------------------------------------------
  const handleInstallRequiredTrustline = useCallback(
    async (currencyCode, { walletSetup, skipConfirm = false } = {}) => {
      const code = String(currencyCode || "").toUpperCase();
      if (!code) return;
      if (!isConnected || !wallet) {
        toast.error("Please connect your wallet first.");
        return;
      }

      const issuer = XRPL_KNOWN_ISSUERS?.[code] || null;
      if (!issuer) {
        toast.error(`Missing issuer configuration for ${code}.`);
        return;
      }

      // When called from setup dropdown, the user already clicked "Valider"
      // — skip the redundant confirmation dialog.
      if (!skipConfirm) {
        const ok = await confirm(
          `Install XRPL trustline for ${code}?\n\nThis will sign a TrustSet transaction.`,
        );
        if (!ok) return;
      }

      const currency = encodeXrplCurrencyCode(code);
      const txjson = {
        TransactionType: "TrustSet",
        Account: wallet,
        LimitAmount: {
          currency,
          issuer,
          value: "1000000000",
        },
      };

      // Attach wallet_label memo when setup info is provided (name + optional default currency)
      if (walletSetup?.label) {
        const memoData = { label: walletSetup.label };
        if (walletSetup.defaultCurrency) {
          memoData.defaultCurrency = walletSetup.defaultCurrency;
        }
        const memoPayload = buildWalletLabelMemo(memoData);
        if (memoPayload) {
          const memos = buildXrplJsonMemo(memoPayload);
          if (memos) {
            txjson.Memos = memos;
          }
        }
      }

      try {
        const result = await signTransaction(txjson);
        if (result && result.signed) {
          // Check XRPL result code — the tx may have been signed but rejected by the ledger
          const engineResult =
            result.txResult?.result?.engine_result ||
            result.txResult?.engine_result ||
            "";
          if (engineResult && engineResult !== "tesSUCCESS" && engineResult !== "terQUEUED") {
            // Map common error codes to user-friendly messages
            if (engineResult === "tecINSUF_RESERVE_LINE" || engineResult === "tecNO_LINE_INSUF_RESERVE") {
              toast.error(
                "❌ Réserve XRP insuffisante pour créer la trustline. " +
                "Vous avez besoin d'au moins 1.2 XRP (1 réserve + 0.2 par trustline).",
              );
            } else {
              toast.error(`❌ Trustline rejetée par le ledger : ${engineResult}`);
            }
            return;
          }

          toast.success(`✅ Trustline ${code} activée.`);
          if (refreshBalance) {
            setTimeout(() => refreshBalance(), 2500);
          }
          // If label was set via TrustSet memo, refresh wallet label
          if (walletSetup?.label && loadWalletLabel) {
            setTimeout(() => loadWalletLabel(), 3000);
          }
        } else {
          toast.warn("Transaction annulée ou expirée.");
        }
      } catch (err) {
        console.error("Install trustline error:", err);
        toast.error(
          "Erreur lors de la préparation de la trustline : " + (err?.message || String(err)),
        );
      }
    },
    [
      isConnected,
      loadWalletLabel,
      refreshBalance,
      signTransaction,
      toast,
      confirm,
      wallet,
    ],
  );

  // ------------------------------------------------------------------
  // RLUSD setup
  //
  // Two modes:
  //   A) Trustline NOT yet installed → TrustSet with wallet_label memo
  //   B) Trustline already installed (activated on Xumm, Sologenic…)
  //      → Mini RLUSD payment (0.000001) to the Xcannes spread wallet
  //        carrying the wallet_label memo.  Self-payments are rejected
  //        by XRPL (temREDUNDANT) so the destination MUST be the
  //        spread wallet.
  // ------------------------------------------------------------------
  const handleRlusdSetupConfirm = useCallback(
    async ({ label, defaultCurrency } = {}) => {
      // ── Mode A: trustline does not exist yet ─────────────────────
      if (!hasRlusdTrustline) {
        handleInstallRequiredTrustline("RLUSD", {
          walletSetup: { label, defaultCurrency },
          skipConfirm: true,
        });
        return;
      }

      // ── Mode B: trustline already exists → mini Payment with memo ─
      if (!isConnected || !wallet) {
        toast.error("Please connect your wallet first.");
        return;
      }

      // Build wallet_label memo
      const memoData = { label };
      if (defaultCurrency) memoData.defaultCurrency = defaultCurrency;
      const memoPayload = buildWalletLabelMemo(memoData);
      if (!memoPayload) {
        toast.error("Unable to build wallet label memo.");
        return;
      }
      const memos = buildXrplJsonMemo(memoPayload);
      if (!memos) {
        toast.error("Unable to encode wallet label memo.");
        return;
      }

      // Build minimal RLUSD payment (0.000001) → spread wallet
      const txjson = buildRlusdPaymentTxjson({
        account: wallet,
        destination: XCANNES_RECONCILE_DESTINATION,
        amountRlusd: 0.000001,
      });
      if (!txjson) {
        toast.error("Unable to build naming transaction.");
        return;
      }
      txjson.Memos = memos;

      try {
        const result = await signTransaction(txjson);
        if (result?.signed) {
          const engineResult =
            result.txResult?.result?.engine_result ||
            result.txResult?.engine_result ||
            "";
          if (
            engineResult &&
            engineResult !== "tesSUCCESS" &&
            engineResult !== "terQUEUED"
          ) {
            toast.error(`❌ Transaction rejetée : ${engineResult}`);
            return;
          }
          toast.success("✅ Wallet configuré avec succès.");
          if (refreshBalance) setTimeout(() => refreshBalance(), 2500);
          if (loadWalletLabel) setTimeout(() => loadWalletLabel(), 3000);
        } else {
          toast.warn("Transaction annulée ou expirée.");
        }
      } catch (err) {
        console.error("[useWalletActivation] Mini-payment naming error:", err);
        toast.error(
          "Erreur lors de la transaction de nommage : " +
            (err?.message || String(err)),
        );
      }
    },
    [
      hasRlusdTrustline,
      handleInstallRequiredTrustline,
      isConnected,
      loadWalletLabel,
      refreshBalance,
      signTransaction,
      toast,
      wallet,
    ],
  );

  // ------------------------------------------------------------------
  // Activation modal navigation
  // ------------------------------------------------------------------
  const handleOpenActivationModal = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setActiveAction(null);
    setShowActivationModal(true);
  }, [
    closeInlineQr,
    setActiveAction,
    setShowActivationModal,
    setWalletInfoOpen,
  ]);

  const handleActivationRequestFromThirdParty = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setActiveAction(null);
    setShowActivationModal(false);
    setShowActivationRequestModal(true);
  }, [
    closeInlineQr,
    setActiveAction,
    setShowActivationModal,
    setShowActivationRequestModal,
    setWalletInfoOpen,
  ]);

  const handleActivationBuyViaMoonpay = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setShowActivationModal(false);
    setCashBuyPrefill({
      currency: "XRP",
      amount: "1",
      amountType: "crypto",
    });
    setCashModalTab("buy");
    setActiveAction("cash");
  }, [
    closeInlineQr,
    setActiveAction,
    setCashBuyPrefill,
    setCashModalTab,
    setShowActivationModal,
    setWalletInfoOpen,
  ]);

  // ------------------------------------------------------------------
  // Self-send XRP to activate wallet
  // ------------------------------------------------------------------
  const handleActivationSendFromWallet = useCallback(async () => {
    setShowActivationModal(false);
    if (!wallet || !signTransaction) {
      toast.error("Please connect your wallet first.");
      return;
    }

    const amountDrops = String(
      Math.round(1 * 1_000_000),
    );
    const txjson = {
      TransactionType: "Payment",
      Destination: wallet,
      Amount: amountDrops,
    };

    const result = await signTransaction(txjson, {
      action: "wallet:activate_xrp",
    });
    if (result?.signed && refreshBalance) {
      setTimeout(() => refreshBalance(), 3000);
    }
  }, [
    refreshBalance,
    setShowActivationModal,
    signTransaction,
    toast,
    wallet,
  ]);

  return {
    handleInstallRequiredTrustline,
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  };
}
