import { useCallback } from "react";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { buildWalletLabelMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";

/**
 * Encapsulates all wallet-activation and trustline-installation logic:
 *
 * - `handleInstallRequiredTrustline`  — signs a TrustSet tx via Xumm
 * - `handleOpenRlusdSetup`           — opens RLUSD setup modal
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
  // UI state setters
  closeInlineQr,
  setWalletInfoOpen,
  setShowActivationModal,
  setShowActivationRequestModal,
  setShowRlusdSetupModal,
  setActivationBundleEnabled,
  setCashBuyPrefill,
  setCashModalTab,
  setActiveAction,
  // Activation XRP
  activationXrpAmount,
  activationXrpAmountLabel,
  // useWalletToast()
  toast,
  confirm,
}) {
  // ------------------------------------------------------------------
  // handleInstallRequiredTrustline
  // ------------------------------------------------------------------
  const handleInstallRequiredTrustline = useCallback(
    async (currencyCode, { walletSetup } = {}) => {
      const code = String(currencyCode || "").toUpperCase();
      if (!code) return;
      if (!isConnected || !wallet) {
        toast.error("Please connect your Xumm wallet first.");
        return;
      }

      const issuer = XRPL_KNOWN_ISSUERS?.[code] || null;
      if (!issuer) {
        toast.error(`Missing issuer configuration for ${code}.`);
        return;
      }

      const ok = await confirm(
        `Install XRPL trustline for ${code}?\n\nThis will open Xumm to sign a TrustSet transaction.`,
      );
      if (!ok) return;

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
          toast.success(`✅ Trustline ${code} submitted via Xumm.`);
          if (refreshBalance) {
            setTimeout(() => refreshBalance(), 2500);
          }
          // If label was set via TrustSet memo, refresh wallet label
          if (walletSetup?.label && loadWalletLabel) {
            setTimeout(() => loadWalletLabel(), 3000);
          }
        } else {
          toast.warn("Transaction cancelled or expired.");
        }
      } catch (err) {
        console.error("Install trustline error:", err);
        toast.error(
          "Error while preparing trustline: " + (err?.message || String(err)),
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
  // RLUSD setup (opens form → triggers trustline with wallet_label memo)
  // ------------------------------------------------------------------
  const handleOpenRlusdSetup = useCallback(() => {
    setShowRlusdSetupModal(true);
  }, [setShowRlusdSetupModal]);

  const handleRlusdSetupConfirm = useCallback(
    ({ label, defaultCurrency } = {}) => {
      setShowRlusdSetupModal(false);
      handleInstallRequiredTrustline("RLUSD", {
        walletSetup: { label, defaultCurrency },
      });
    },
    [handleInstallRequiredTrustline, setShowRlusdSetupModal],
  );

  // ------------------------------------------------------------------
  // Activation modal navigation
  // ------------------------------------------------------------------
  const handleOpenActivationModal = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setActivationBundleEnabled(false);
    setShowActivationModal(true);
  }, [
    closeInlineQr,
    setActivationBundleEnabled,
    setShowActivationModal,
    setWalletInfoOpen,
  ]);

  const handleActivationRequestFromThirdParty = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    setShowActivationModal(false);
    setShowActivationRequestModal(true);
  }, [
    closeInlineQr,
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
      amount: activationXrpAmountLabel,
      amountType: "crypto",
    });
    setCashModalTab("buy");
    setActiveAction("cash");
  }, [
    activationXrpAmountLabel,
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
      toast.error("Please connect your Xumm wallet first.");
      return;
    }

    const amountDrops = String(
      Math.round(Number(activationXrpAmount) * 1_000_000),
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
    activationXrpAmount,
    refreshBalance,
    setShowActivationModal,
    signTransaction,
    wallet,
  ]);

  return {
    handleInstallRequiredTrustline,
    handleOpenRlusdSetup,
    handleRlusdSetupConfirm,
    handleOpenActivationModal,
    handleActivationRequestFromThirdParty,
    handleActivationBuyViaMoonpay,
    handleActivationSendFromWallet,
  };
}
