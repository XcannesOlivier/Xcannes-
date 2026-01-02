"use client";

import { useEffect, useMemo, useState } from "react";
import MoonPayKYCModal from "./MoonPayKYCModal";
import CurrencyStatement from "./CurrencyStatement";
import GlobalStatement from "./GlobalStatement";
import { apiUrl } from "../../lib/runtimeConfig";

export default function WalletDashboardOverlays({
  kycModalOpen,
  setKycModalOpen,
  walletAddress,
  handleKycComplete,
  showGlobalStatement,
  setShowGlobalStatement,
  showCurrencyStatement,
  setShowCurrencyStatement,
  selectedStatementToken,
  setSelectedStatementToken,
  tokens,
  effectiveWallet,
  isFullPageView,
  statementVariant,
  usdRates,
}) {
  const [globalMovements, setGlobalMovements] = useState([]);
  const [globalMovementsLoading, setGlobalMovementsLoading] = useState(false);
  const [globalMovementsError, setGlobalMovementsError] = useState(null);
  const [globalCursor, setGlobalCursor] = useState(null);
  const [globalHasMore, setGlobalHasMore] = useState(false);
  const [globalLoadingMore, setGlobalLoadingMore] = useState(false);

  const [currencyTransactions, setCurrencyTransactions] = useState([]);
  const [currencyStatementBalance, setCurrencyStatementBalance] = useState(null);
  const [currencyStatementLoading, setCurrencyStatementLoading] = useState(false);
  const [currencyStatementError, setCurrencyStatementError] = useState(null);
  const [currencyCursor, setCurrencyCursor] = useState(null);
  const [currencyHasMore, setCurrencyHasMore] = useState(false);
  const [currencyBalanceAfterCursor, setCurrencyBalanceAfterCursor] = useState(null);
  const [currencyLoadingMore, setCurrencyLoadingMore] = useState(false);

  const [onChainPayments, setOnChainPayments] = useState([]);
  const [onChainPaymentsLoading, setOnChainPaymentsLoading] = useState(false);
  const [onChainPaymentsError, setOnChainPaymentsError] = useState(null);
  const [onChainPaymentsCursor, setOnChainPaymentsCursor] = useState(null);
  const [onChainPaymentsHasMore, setOnChainPaymentsHasMore] = useState(false);
  const [onChainPaymentsLoadingMore, setOnChainPaymentsLoadingMore] = useState(false);

  const selectedCurrencyCode = useMemo(() => {
    return String(selectedStatementToken?.currency || "").toUpperCase() || null;
  }, [selectedStatementToken]);

  const isOnChainPaymentsSupported = useMemo(() => {
    return selectedCurrencyCode === "XRP" || selectedCurrencyCode === "RLUSD" || selectedCurrencyCode === "XCS";
  }, [selectedCurrencyCode]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!showGlobalStatement || !effectiveWallet) return;

      setGlobalMovementsLoading(true);
      setGlobalMovementsError(null);
      try {
        const res = await fetch(
          apiUrl(
            `/wallet/statement?address=${encodeURIComponent(effectiveWallet)}&limit=50`
          )
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load statement");

        if (!cancelled) {
          setGlobalMovements(Array.isArray(data.movements) ? data.movements : []);
          setGlobalHasMore(Boolean(data.hasMore));
          setGlobalCursor(data.cursorNext || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[WalletDashboardOverlays] global statement error:", err);
          setGlobalMovementsError(err.message || "Unknown error");
          setGlobalMovements([]);
          setGlobalHasMore(false);
          setGlobalCursor(null);
        }
      } finally {
        if (!cancelled) setGlobalMovementsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveWallet, showGlobalStatement]);

  const loadMoreGlobalMovements = async () => {
    if (!effectiveWallet || !globalHasMore || !globalCursor || globalLoadingMore) return;
    setGlobalLoadingMore(true);
    try {
      const res = await fetch(
        apiUrl(
          `/wallet/statement?address=${encodeURIComponent(
            effectiveWallet
          )}&limit=50&cursor=${encodeURIComponent(globalCursor)}`
        )
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load statement");
      const next = Array.isArray(data.movements) ? data.movements : [];
      setGlobalMovements((prev) => [...prev, ...next]);
      setGlobalHasMore(Boolean(data.hasMore));
      setGlobalCursor(data.cursorNext || null);
    } catch (err) {
      console.error("[WalletDashboardOverlays] load more global movements error:", err);
      setGlobalMovementsError(err.message || "Unknown error");
    } finally {
      setGlobalLoadingMore(false);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!showCurrencyStatement || !effectiveWallet || !selectedCurrencyCode) return;
      if (isOnChainPaymentsSupported) {
        setCurrencyStatementLoading(false);
        setCurrencyStatementError(null);
        setCurrencyTransactions([]);
        setCurrencyStatementBalance(null);
        setCurrencyHasMore(false);
        setCurrencyCursor(null);
        setCurrencyBalanceAfterCursor(null);
        return;
      }

      setCurrencyStatementLoading(true);
      setCurrencyStatementError(null);
      try {
        const res = await fetch(
          apiUrl(
            `/wallet/statement?address=${encodeURIComponent(
              effectiveWallet
            )}&currencyCode=${encodeURIComponent(selectedCurrencyCode)}&limit=200`
          )
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load statement");

        if (!cancelled) {
          setCurrencyTransactions(Array.isArray(data.transactions) ? data.transactions : []);
          setCurrencyStatementBalance(
            data.hasCurrencyLine ? Number(data.currentAllocatedRlusd || 0) : null
          );
          setCurrencyHasMore(Boolean(data.hasMore));
          setCurrencyCursor(data.cursorNext || null);
          setCurrencyBalanceAfterCursor(
            data.balanceAfterRlusdNext != null ? Number(data.balanceAfterRlusdNext) : null
          );
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[WalletDashboardOverlays] currency statement error:", err);
          setCurrencyStatementError(err.message || "Unknown error");
          setCurrencyTransactions([]);
          setCurrencyStatementBalance(null);
          setCurrencyHasMore(false);
          setCurrencyCursor(null);
          setCurrencyBalanceAfterCursor(null);
        }
      } finally {
        if (!cancelled) setCurrencyStatementLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveWallet, isOnChainPaymentsSupported, selectedCurrencyCode, showCurrencyStatement]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!showCurrencyStatement || !effectiveWallet || !selectedCurrencyCode) return;
      if (!isOnChainPaymentsSupported) {
        setOnChainPayments([]);
        setOnChainPaymentsError(null);
        setOnChainPaymentsCursor(null);
        setOnChainPaymentsHasMore(false);
        setOnChainPaymentsLoading(false);
        return;
      }

      setOnChainPaymentsLoading(true);
      setOnChainPaymentsError(null);
      try {
        const res = await fetch(
          apiUrl(
            `/wallet/xrpl/payments?address=${encodeURIComponent(
              effectiveWallet
            )}&currencyCode=${encodeURIComponent(selectedCurrencyCode)}&limit=100`
          )
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load XRPL payments");

        if (!cancelled) {
          setOnChainPayments(Array.isArray(data.payments) ? data.payments : []);
          setOnChainPaymentsHasMore(Boolean(data.hasMore));
          setOnChainPaymentsCursor(data.cursorNext || null);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("[WalletDashboardOverlays] on-chain payments error:", err);
          setOnChainPaymentsError(err.message || "Unknown error");
          setOnChainPayments([]);
          setOnChainPaymentsHasMore(false);
          setOnChainPaymentsCursor(null);
        }
      } finally {
        if (!cancelled) setOnChainPaymentsLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [effectiveWallet, isOnChainPaymentsSupported, selectedCurrencyCode, showCurrencyStatement]);

  const loadMoreOnChainPayments = async () => {
    if (
      !effectiveWallet ||
      !selectedCurrencyCode ||
      !isOnChainPaymentsSupported ||
      !onChainPaymentsHasMore ||
      !onChainPaymentsCursor ||
      onChainPaymentsLoadingMore
    )
      return;

    setOnChainPaymentsLoadingMore(true);
    try {
      const res = await fetch(
        apiUrl(
          `/wallet/xrpl/payments?address=${encodeURIComponent(
            effectiveWallet
          )}&currencyCode=${encodeURIComponent(
            selectedCurrencyCode
          )}&limit=100&cursor=${encodeURIComponent(onChainPaymentsCursor)}`
        )
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load XRPL payments");

      const next = Array.isArray(data.payments) ? data.payments : [];
      setOnChainPayments((prev) => [...prev, ...next]);
      setOnChainPaymentsHasMore(Boolean(data.hasMore));
      setOnChainPaymentsCursor(data.cursorNext || null);
    } catch (err) {
      console.error("[WalletDashboardOverlays] load more on-chain payments error:", err);
      setOnChainPaymentsError(err.message || "Unknown error");
    } finally {
      setOnChainPaymentsLoadingMore(false);
    }
  };

  const loadMoreCurrencyTransactions = async () => {
    if (
      !effectiveWallet ||
      !selectedCurrencyCode ||
      isOnChainPaymentsSupported ||
      !currencyHasMore ||
      !currencyCursor ||
      currencyLoadingMore
    )
      return;

    setCurrencyLoadingMore(true);
    try {
      const balanceAfterPart =
        currencyBalanceAfterCursor == null
          ? ""
          : `&balanceAfterRlusd=${encodeURIComponent(currencyBalanceAfterCursor)}`;
      const res = await fetch(
        apiUrl(
          `/wallet/statement?address=${encodeURIComponent(
            effectiveWallet
          )}&currencyCode=${encodeURIComponent(
            selectedCurrencyCode
          )}&limit=200&cursor=${encodeURIComponent(currencyCursor)}${balanceAfterPart}`
        )
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load statement");

      const nextTx = Array.isArray(data.transactions) ? data.transactions : [];
      setCurrencyTransactions((prev) => [...prev, ...nextTx]);
      setCurrencyHasMore(Boolean(data.hasMore));
      setCurrencyCursor(data.cursorNext || null);
      setCurrencyBalanceAfterCursor(
        data.balanceAfterRlusdNext != null ? Number(data.balanceAfterRlusdNext) : null
      );
    } catch (err) {
      console.error("[WalletDashboardOverlays] load more currency statement error:", err);
      setCurrencyStatementError(err.message || "Unknown error");
    } finally {
      setCurrencyLoadingMore(false);
    }
  };

  const mergedCurrencyTransactions = useMemo(() => {
    if (!isOnChainPaymentsSupported) return currencyTransactions;

    const currentOnChainBalance = Number.parseFloat(selectedStatementToken?.value || 0);
    let running = Number.isFinite(currentOnChainBalance) ? currentOnChainBalance : 0;

    return (onChainPayments || []).map((p) => {
      const direction = String(p?.direction || "").toLowerCase();
      const isDebit = direction === "send";
      const amount = Number.parseFloat(p?.value || 0);
      const safeAmount = Number.isFinite(amount) ? amount : 0;

      const tx = {
        date: p?.createdAt || null,
        description: isDebit
          ? `Payment to ${String(p?.counterparty || "").slice(0, 10)}...`
          : `Payment from ${String(p?.counterparty || "").slice(0, 10)}...`,
        category: isDebit ? "send" : "receive",
        type: isDebit ? "debit" : "credit",
        amount: safeAmount,
        counterparty: p?.counterparty || null,
        runningBalance: running,
      };

      running = isDebit ? running + safeAmount : running - safeAmount;
      return tx;
    });
  }, [currencyTransactions, isOnChainPaymentsSupported, onChainPayments, selectedStatementToken?.value]);

  const mergedHasMore = isOnChainPaymentsSupported ? onChainPaymentsHasMore : currencyHasMore;
  const mergedLoadingMore = isOnChainPaymentsSupported ? onChainPaymentsLoadingMore : currencyLoadingMore;
  const mergedOnLoadMore = isOnChainPaymentsSupported ? loadMoreOnChainPayments : loadMoreCurrencyTransactions;
  const mergedStatementError = isOnChainPaymentsSupported ? onChainPaymentsError : currencyStatementError;
  const mergedStatementLoading = isOnChainPaymentsSupported ? onChainPaymentsLoading : currencyStatementLoading;

  return (
    <>
      <MoonPayKYCModal
        isOpen={kycModalOpen}
        onClose={() => setKycModalOpen(false)}
        walletAddress={walletAddress}
        onKycComplete={handleKycComplete}
      />

      {showGlobalStatement && (
        <GlobalStatement
          tokens={tokens}
          walletAddress={effectiveWallet}
          period="December 2025"
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          movements={globalMovements}
          movementsLoading={globalMovementsLoading}
          movementsError={globalMovementsError}
          movementsHasMore={globalHasMore}
          movementsLoadingMore={globalLoadingMore}
          onLoadMoreMovements={loadMoreGlobalMovements}
          onClose={() => setShowGlobalStatement(false)}
          onViewCurrency={(token) => {
            setSelectedStatementToken(token);
            setShowGlobalStatement(false);
            setShowCurrencyStatement(true);
          }}
        />
      )}

      {showCurrencyStatement && selectedStatementToken && (
        <CurrencyStatement
          currency={selectedStatementToken.currency}
          balance={
            isOnChainPaymentsSupported
              ? parseFloat(selectedStatementToken.value || 0)
              : currencyStatementBalance == null
              ? parseFloat(selectedStatementToken.value || 0)
              : currencyStatementBalance
          }
          issuer={selectedStatementToken.issuer}
          walletAddress={effectiveWallet}
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          transactions={mergedCurrencyTransactions}
          hasMore={mergedHasMore}
          loadingMore={mergedLoadingMore}
          onLoadMore={mergedOnLoadMore}
          period="December 2025"
          onClose={() => {
            setShowCurrencyStatement(false);
            setSelectedStatementToken(null);
          }}
        />
      )}

      {mergedStatementLoading && showCurrencyStatement && (
        <div className="fixed inset-0 z-[10300] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-lg bg-black/70 border border-white/10 px-3 py-2 text-xs text-white/70">
            Loading statement…
          </div>
        </div>
      )}

      {mergedStatementError && showCurrencyStatement && (
        <div className="fixed inset-0 z-[10300] flex items-center justify-center pointer-events-none">
          <div className="pointer-events-auto rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-300">
            {mergedStatementError}
          </div>
        </div>
      )}
    </>
  );
}
