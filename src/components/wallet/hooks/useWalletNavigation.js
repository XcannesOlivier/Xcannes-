import { useCallback, useEffect, useRef } from "react";
import { MOONPAY_UI_ENABLED, TOPPER_UI_ENABLED } from "@/utils/featureFlags";

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
 *   xcannes:wallet:open-convert, refresh timer cleanup
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
  setDesktopSettingsPage,
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
  // optional: reset action forms (desktop-only requirement)
  resetSendForm,
  resetReceiveForm,
  resetSwapForm,
  resetCashForm,
}) {
  const refreshTimerRef = useRef(null);
  const cashEnabled = MOONPAY_UI_ENABLED || TOPPER_UI_ENABLED;
  const DESKTOP_INLINE_RETURN_STATE = "__XCANNES_DESKTOP_INLINE_RETURN_STATE__";
  const SETTINGS_RETURN_FLAG = "__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__";

  const clearDesktopInlineReturnState = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      window[DESKTOP_INLINE_RETURN_STATE] = null;
      window[SETTINGS_RETURN_FLAG] = false;
    } catch {
      // ignore
    }
  }, [DESKTOP_INLINE_RETURN_STATE]);

  const stashDesktopInlineReturnState = useCallback(() => {
    try {
      if (typeof window === "undefined") return;
      if (!isDesktopPanel) return;
      if (!window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__) return;
      if (window[DESKTOP_INLINE_RETURN_STATE]) return;

      window[DESKTOP_INLINE_RETURN_STATE] = {
        activeAction: activeAction || null,
      };
    } catch {
      // ignore
    }
  }, [DESKTOP_INLINE_RETURN_STATE, activeAction, isDesktopPanel]);

  // Desktop inline: restore the underlying right-panel view after closing a
  // settings subpage / statement opened from the settings dropdown.
  useEffect(() => {
    if (typeof window === "undefined") return;

    const handler = () => {
      try {
        if (!isDesktopPanel) return;
        const state = window[DESKTOP_INLINE_RETURN_STATE];
        if (state?.activeAction) {
          setActiveAction(state.activeAction);
        }
        window[DESKTOP_INLINE_RETURN_STATE] = null;
      } catch {
        // ignore
      }
    };

    window.addEventListener("xcannes:wallet:restore-inline-view", handler);
    return () =>
      window.removeEventListener("xcannes:wallet:restore-inline-view", handler);
  }, [DESKTOP_INLINE_RETURN_STATE, isDesktopPanel, setActiveAction]);

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
      // Desktop requirement: every click on a main wallet action should reset
      // the corresponding first view and dismiss any other open inline views.
      if (isDesktopPanel) {
        clearDesktopInlineReturnState();
        setShowActivationModal(false);
        setShowActivationRequestModal(false);
        setShowGlobalStatement(false);
        setShowCurrencyStatement(false);
        setSelectedStatementToken(null);

        if (nextAction === "send" || nextAction === "sendChoice") {
          resetSendForm?.();
        }
        if (nextAction === "receive") {
          resetReceiveForm?.();
        }
        if (nextAction === "swap") {
          resetSwapForm?.();
        }
        if (nextAction === "cash" || nextAction === "cashChoice") {
          resetCashForm?.();
        }
      }

      closeInlineQr();
      setWalletInfoOpen(false);
      setDesktopSettingsPage?.(null);
      // Label requirement disabled — will be re-enabled later.
      // if (isConnected && isWalletLabelRequired) {
      //   flashWalletHeaderToast("Nom du wallet requis.", 2000);
      // }
      if (nextAction === "swap") {
        setSwapDefaultView("convert");
        setSwapLockedView(null);
      }
      if (nextAction === "cash" || nextAction === "cashChoice") {
        if (!cashEnabled) {
          toast.info(
            t("ui_funds_disabled", {
              defaultValue: "Onramp/offramp est temporairement désactivé.",
            }),
          );
          return;
        }
        setCashBuyPrefill(null);
      }
      setActiveAction(nextAction);
    },
    [
      cashEnabled,
      clearDesktopInlineReturnState,
      closeInlineQr,
      isDesktopPanel,
      setActiveAction,
      setWalletInfoOpen,
      setDesktopSettingsPage,
      setSwapDefaultView,
      setSwapLockedView,
      setCashBuyPrefill,
      setSelectedStatementToken,
      setShowActivationModal,
      setShowActivationRequestModal,
      setShowCurrencyStatement,
      setShowGlobalStatement,
      resetSendForm,
      resetReceiveForm,
      resetSwapForm,
      resetCashForm,
      t,
      toast,
    ],
  );

  // ─── Open currency statement ──────────────────────────────────────────

  const handleOpenCurrencyStatement = useCallback(
    (token) => {
      stashDesktopInlineReturnState();
      closeInlineQr();
      setWalletInfoOpen(false);
      setDesktopSettingsPage?.(null);
      if (isDesktopPanel) {
        setActiveAction(null);
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
      stashDesktopInlineReturnState,
      setActiveAction,
      setSelectedStatementToken,
      setShowActivationModal,
      setShowActivationRequestModal,
      setShowCurrencyStatement,
      setShowGlobalStatement,
      setDesktopSettingsPage,
      setWalletInfoOpen,
    ],
  );

  // ─── Open info panel ──────────────────────────────────────────────────

  const handleOpenInfo = useCallback(() => {
    stashDesktopInlineReturnState();
    closeInlineQr();
    setDesktopSettingsPage?.(null);
    if (isDesktopPanel) {
      setActiveAction(null);
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
    stashDesktopInlineReturnState,
    setActiveAction,
    setSelectedStatementToken,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setDesktopSettingsPage,
    setWalletInfoOpen,
  ]);

  // ─── Open global statement ────────────────────────────────────────────

  const handleOpenGlobalStatement = useCallback(() => {
    stashDesktopInlineReturnState();
    closeInlineQr();
    setWalletInfoOpen(false);
    setDesktopSettingsPage?.(null);
    if (isDesktopPanel) {
      setActiveAction(null);
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
    stashDesktopInlineReturnState,
    setActiveAction,
    setSelectedStatementToken,
    setShowActivationModal,
    setShowActivationRequestModal,
    setShowCurrencyStatement,
    setShowGlobalStatement,
    setDesktopSettingsPage,
    setWalletInfoOpen,
  ]);

  // ─── Desktop settings pages (inline panel) ───────────────────────────

  const handleOpenDesktopSettingsPage = useCallback(
    (page) => {
      stashDesktopInlineReturnState();
      closeInlineQr();
      setWalletInfoOpen(false);
      if (isDesktopPanel) {
        setActiveAction(null);
        setShowActivationModal(false);
        setShowActivationRequestModal(false);
        setShowCurrencyStatement(false);
        setSelectedStatementToken(null);
        setShowGlobalStatement(false);
      }
      setDesktopSettingsPage?.(page);
    },
    [
      closeInlineQr,
      isDesktopPanel,
      stashDesktopInlineReturnState,
      setActiveAction,
      setDesktopSettingsPage,
      setSelectedStatementToken,
      setShowActivationModal,
      setShowActivationRequestModal,
      setShowCurrencyStatement,
      setShowGlobalStatement,
      setWalletInfoOpen,
    ],
  );

  const handleOpenSecurity = useCallback(
    () => handleOpenDesktopSettingsPage("security"),
    [handleOpenDesktopSettingsPage],
  );

  const handleOpenHelp = useCallback(
    () => handleOpenDesktopSettingsPage("help"),
    [handleOpenDesktopSettingsPage],
  );

  const handleOpenTerms = useCallback(
    () => handleOpenDesktopSettingsPage("terms"),
    [handleOpenDesktopSettingsPage],
  );

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
      setDesktopSettingsPage?.(null);
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
    setDesktopSettingsPage,
    setWalletInfoOpen,
  ]);

  return {
    handleActivateCurrencyLine,
    handleUpsertCurrencyLine,
    handleAction,
    handleOpenCurrencyStatement,
    handleOpenInfo,
    handleOpenSecurity,
    handleOpenHelp,
    handleOpenTerms,
    handleOpenGlobalStatement,
    handleCopyAddress,
    handleRefreshWallet,
  };
}
