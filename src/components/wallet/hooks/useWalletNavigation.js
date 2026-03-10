import { useCallback, useEffect, useRef } from "react";

/**
 * useWalletNavigation — Centralises all "open view" navigation handlers,
 * event-driven view openers, and utility actions (copy address, refresh).
 *
 * Extracted handlers:
 *   handleAction, handleOpenCurrencyLines, handleOpenCurrencyStatement,
 *   handleOpenInfo, handleOpenGlobalStatement, handleCopyAddress,
 *   handleRefreshWallet, handleActivateCurrencyLine, handleUpsertCurrencyLine
 *
 * Extracted effects:
 *   xcannes:wallet:open-convert, xcannes:wallet:open-adjustment,
 *   auto-open adjustment deficit, refresh timer cleanup
 */
export function useWalletNavigation({
  // wallet state
  wallet,
  backendWalletAddress,
  isDesktopPanel,
  isConnecting,
  isRefreshing,
  setIsRefreshing,
  refreshBalance,
  // currency lines
  currencyLines,
  handleUpsertCurrencyLineReal,
  activeAction,
  // navigation
  closeInlineQr,
  setActiveAction,
  setWalletInfoOpen,
  setSwapDefaultView,
  setSwapLockedView,
  setCashBuyPrefill,
  setShowActivationModal,
  setShowActivationRequestModal,
  setShowGlobalStatement,
  setShowCurrencyStatement,
  setSelectedStatementToken,
  // convert form
  setConvertBaseCurrency,
  setConvertQuoteCurrency,
  setConvertAmount,
  // wallet label
  flashWalletHeaderToast,
  // i18n & toast
  t,
  toast,
}) {
  const refreshTimerRef = useRef(null);

  // ─── Currency line activation (open converter) ────────────────────────

  const handleActivateCurrencyLine = useCallback(
    async (code) => {
      const currencyCode = String(code || "")
        .trim()
        .toUpperCase();
      if (!currencyCode || currencyCode.length < 2) return false;
      if (currencyCode === "RLUSD" || currencyCode === "XRP") return false;

      if (!backendWalletAddress) {
        toast.error("Please connect your wallet first.");
        return false;
      }

      const alreadyActive = (currencyLines || []).some(
        (line) =>
          String(line?.currencyCode || "").toUpperCase() === currencyCode,
      );
      if (alreadyActive) {
        toast.info(
          t("ui_currency_line_already_active", {
            defaultValue: "Cette devise est déjà activée dans votre wallet.",
          }),
        );
        return false;
      }

      // Ouvrir le convertisseur avec la devise présélectionnée (activation gratuite)
      setConvertBaseCurrency("RLUSD");
      setConvertQuoteCurrency(currencyCode);
      setConvertAmount("");
      setSwapDefaultView("convert");
      setSwapLockedView(null);
      setActiveAction("swap");
      return true;
    },
    [
      backendWalletAddress,
      currencyLines,
      setActiveAction,
      setConvertAmount,
      setConvertBaseCurrency,
      setConvertQuoteCurrency,
      setSwapDefaultView,
      setSwapLockedView,
      t,
      toast,
    ],
  );

  // ─── Currency line upsert (delegate) ──────────────────────────────────

  const handleUpsertCurrencyLine = useCallback(async () => {
    await handleUpsertCurrencyLineReal?.();
  }, [handleUpsertCurrencyLineReal]);

  // ─── Action navigation ────────────────────────────────────────────────

  const handleAction = useCallback(
    (nextAction) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      // Label requirement disabled — will be re-enabled later.
      // if (isConnected && isWalletLabelRequired) {
      //   flashWalletHeaderToast("Nom du wallet requis.", 2000);
      // }
      if (nextAction === "swap") {
        setSwapDefaultView("convert");
        setSwapLockedView(null);
      }
      if (nextAction === "cash") {
        setCashBuyPrefill(null);
      }
      setActiveAction(nextAction);
    },
    [
      closeInlineQr,
      setActiveAction,
      setWalletInfoOpen,
      setSwapDefaultView,
      setSwapLockedView,
      setCashBuyPrefill,
    ],
  );

  // ─── Open currency statement ──────────────────────────────────────────

  const handleOpenCurrencyStatement = useCallback(
    (token) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      if (isDesktopPanel) {
        setActiveAction(null);
        setShowAdjustmentModal(false);
        setShowActivationModal(false);
        setShowActivationRequestModal(false);
        setShowGlobalStatement(false);
      }
      setSelectedStatementToken(token);
      setShowCurrencyStatement(true);
    },
    [
      closeInlineQr,
      isDesktopPanel,
      setActiveAction,
      setSelectedStatementToken,
      setShowActivationModal,
      setShowActivationRequestModal,
      setShowAdjustmentModal,
      setShowCurrencyStatement,
      setShowGlobalStatement,
      setWalletInfoOpen,
    ],
  );

  // ─── Open info panel ──────────────────────────────────────────────────

  const handleOpenInfo = useCallback(() => {
    closeInlineQr();
    if (isDesktopPanel) {
      setActiveAction(null);
      setShowAdjustmentModal(false);
      setShowActivationModal(false);
      setShowActivationRequestModal(false);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
      setShowGlobalStatement(false);
    }
    setWalletInfoOpen(true);
  }, [
    closeInlineQr,
    isDesktopPanel,
    setActiveAction,
    setSelectedStatementToken,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowAdjustmentModal,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setWalletInfoOpen,
  ]);

  // ─── Open global statement ────────────────────────────────────────────

  const handleOpenGlobalStatement = useCallback(() => {
    closeInlineQr();
    setWalletInfoOpen(false);
    if (isDesktopPanel) {
      setActiveAction(null);
      setShowAdjustmentModal(false);
      setShowActivationModal(false);
      setShowActivationRequestModal(false);
      setShowCurrencyStatement(false);
      setSelectedStatementToken(null);
      setShowGlobalStatement(false);
      return;
    }
    setShowGlobalStatement(true);
  }, [
    closeInlineQr,
    isDesktopPanel,
    setActiveAction,
    setSelectedStatementToken,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowAdjustmentModal,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setWalletInfoOpen,
  ]);

  // ─── Copy wallet address ──────────────────────────────────────────────

  const handleCopyAddress = useCallback(async () => {
    if (!wallet || typeof navigator === "undefined") return;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(wallet);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = wallet;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      flashWalletHeaderToast("Adresse copiée", 1600);
    } catch (e) {
      console.error("Copy error:", e);
      flashWalletHeaderToast("Copie impossible", 2000);
    }
  }, [wallet, flashWalletHeaderToast]);

  // ─── Refresh wallet ───────────────────────────────────────────────────

  const handleRefreshWallet = useCallback(async () => {
    if (isConnecting || isRefreshing) return;
    const startedAt = Date.now();
    setIsRefreshing(true);
    try {
      const tasks = [];
      if (typeof refreshBalance === "function") {
        tasks.push(Promise.resolve(refreshBalance()));
      }
      if (typeof window !== "undefined" && backendWalletAddress) {
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:refresh", {
            detail: { address: backendWalletAddress },
          }),
        );
      }
      if (tasks.length > 0) await Promise.allSettled(tasks);
    } finally {
      const minDurationMs = 700;
      const elapsed = Date.now() - startedAt;
      const remaining = minDurationMs - elapsed;
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
      if (remaining > 0) {
        refreshTimerRef.current = setTimeout(() => {
          setIsRefreshing(false);
          refreshTimerRef.current = null;
        }, remaining);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [backendWalletAddress, isConnecting, isRefreshing, refreshBalance, setIsRefreshing]);

  // ─── Refresh timer cleanup ────────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current);
        refreshTimerRef.current = null;
      }
    };
  }, []);

  // ─── Event: open-convert ──────────────────────────────────────────────

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = async (event) => {
      closeInlineQr();
      setWalletInfoOpen(false);
      const detail = event?.detail || {};
      const action = String(detail.action || "").toLowerCase();
      const base = String(detail.base || "")
        .trim()
        .toUpperCase();
      const quote = String(detail.quote || "")
        .trim()
        .toUpperCase();
      if (!base || !quote) return;

      const desiredBase = action === "buy" ? quote : base;
      const desiredQuote = action === "buy" ? base : quote;

      setConvertBaseCurrency(desiredBase);
      setConvertQuoteCurrency(
        desiredQuote === desiredBase ? "RLUSD" : desiredQuote,
      );
      setConvertAmount("");
      setSwapDefaultView("convert");
      setSwapLockedView(null);
      setActiveAction("swap");
    };

    window.addEventListener("xcannes:wallet:open-convert", handler);
    return () =>
      window.removeEventListener("xcannes:wallet:open-convert", handler);
  }, [
    closeInlineQr,
    setActiveAction,
    setConvertAmount,
    setConvertBaseCurrency,
    setConvertQuoteCurrency,
    setSwapDefaultView,
    setSwapLockedView,
    setWalletInfoOpen,
  ]);

  return {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
    handleOpenCurrencyStatement,
    handleOpenInfo,
    handleOpenGlobalStatement,
    handleCopyAddress,
    handleRefreshWallet,
  };
}
