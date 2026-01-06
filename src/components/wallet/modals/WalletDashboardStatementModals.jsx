"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import CurrencyStatement from "../statements/CurrencyStatement";
import GlobalStatement from "../statements/GlobalStatement";

export default function WalletDashboardStatementModals({
  augmentedTokens,
  backendWalletAddress,
  effectiveWallet,
  isFullPageView,
  statementVariant,
  currencyLines,
  usdRates,
  showGlobalStatement,
  setShowGlobalStatement,
  showCurrencyStatement,
  setShowCurrencyStatement,
  selectedStatementToken,
  setSelectedStatementToken,
}) {
  const hasRlusdTrustline = (augmentedTokens || []).some((t) => {
    const code = String(t?.currency || "").toUpperCase();
    return code === "RLUSD" && !t?.isMissingTrustline;
  });

  const hasXcsTrustline = (augmentedTokens || []).some((t) => {
    const code = String(t?.currency || "").toUpperCase();
    return code === "XCS" && !t?.isMissingTrustline;
  });

  const xcannesCurrencyLinesCount = Array.isArray(currencyLines)
    ? currencyLines.length
    : 0;

  const canFetchStatements = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      typeof backendWalletAddress === "string" &&
      backendWalletAddress.startsWith("r") &&
      backendWalletAddress.length >= 25
    );
  }, [backendWalletAddress]);

  const [globalMovements, setGlobalMovements] = useState([]);
  const [globalCursorNext, setGlobalCursorNext] = useState(null);
  const [globalHasMore, setGlobalHasMore] = useState(false);
  const [globalLoading, setGlobalLoading] = useState(false);
  const [globalLoadingMore, setGlobalLoadingMore] = useState(false);
  const [globalError, setGlobalError] = useState(null);

  const [currencyTransactions, setCurrencyTransactions] = useState([]);
  const [currencyCursorNext, setCurrencyCursorNext] = useState(null);
  const [currencyBalanceAfterNext, setCurrencyBalanceAfterNext] = useState(null);
  const [currencyHasMore, setCurrencyHasMore] = useState(false);
  const [currencyLoadingMore, setCurrencyLoadingMore] = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState(null);

  const fetchStatement = useCallback(async (params) => {
    const url = new URL(apiUrl("/wallet/statement"));
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value == null || value === "") return;
      url.searchParams.set(key, String(value));
    });
    const res = await fetch(url.toString());
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data?.error || `Statement request failed (${res.status})`);
    }
    return data;
  }, []);

  const loadGlobalFirstPage = useCallback(async () => {
    if (!canFetchStatements) return;
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const data = await fetchStatement({
        address: backendWalletAddress,
        limit: 100,
      });
      setGlobalMovements(Array.isArray(data?.movements) ? data.movements : []);
      setGlobalHasMore(Boolean(data?.hasMore));
      setGlobalCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/statement] global load error:", err);
      setGlobalError(err?.message || "Failed to load statement");
      setGlobalMovements([]);
      setGlobalHasMore(false);
      setGlobalCursorNext(null);
    } finally {
      setGlobalLoading(false);
    }
  }, [backendWalletAddress, canFetchStatements, fetchStatement]);

  const loadGlobalMore = useCallback(async () => {
    if (!canFetchStatements || !globalHasMore || !globalCursorNext) return;
    if (globalLoadingMore) return;
    setGlobalLoadingMore(true);
    setGlobalError(null);
    try {
      const data = await fetchStatement({
        address: backendWalletAddress,
        limit: 100,
        cursor: globalCursorNext,
      });
      const more = Array.isArray(data?.movements) ? data.movements : [];
      setGlobalMovements((prev) => [...(prev || []), ...more]);
      setGlobalHasMore(Boolean(data?.hasMore));
      setGlobalCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/statement] global load more error:", err);
      setGlobalError(err?.message || "Failed to load more movements");
    } finally {
      setGlobalLoadingMore(false);
    }
  }, [
    backendWalletAddress,
    canFetchStatements,
    fetchStatement,
    globalCursorNext,
    globalHasMore,
    globalLoadingMore,
  ]);

  const loadCurrencyFirstPage = useCallback(
    async (currencyCode) => {
      if (!canFetchStatements) return;
      const code = String(currencyCode || "").trim().toUpperCase();
      if (!code) return;

      setCurrencyLoading(true);
      setCurrencyError(null);
      setCurrencyTransactions([]);
      setCurrencyHasMore(false);
      setCurrencyCursorNext(null);
      setCurrencyBalanceAfterNext(null);

      try {
        const data = await fetchStatement({
          address: backendWalletAddress,
          currencyCode: code,
          limit: 100,
        });
        setCurrencyTransactions(
          Array.isArray(data?.transactions) ? data.transactions : []
        );
        setCurrencyHasMore(Boolean(data?.hasMore));
        setCurrencyCursorNext(data?.cursorNext || null);
        setCurrencyBalanceAfterNext(data?.balanceAfterRlusdNext ?? null);
      } catch (err) {
        console.error("[wallet/statement] currency load error:", err);
        setCurrencyError(err?.message || "Failed to load statement");
        setCurrencyTransactions([]);
        setCurrencyHasMore(false);
        setCurrencyCursorNext(null);
        setCurrencyBalanceAfterNext(null);
      } finally {
        setCurrencyLoading(false);
      }
    },
    [backendWalletAddress, canFetchStatements, fetchStatement]
  );

  const loadCurrencyMore = useCallback(
    async (currencyCode) => {
      if (!canFetchStatements || currencyLoadingMore) return;
      const code = String(currencyCode || "").trim().toUpperCase();
      if (!code || !currencyHasMore || !currencyCursorNext) return;

      setCurrencyLoadingMore(true);
      setCurrencyError(null);
      try {
        const data = await fetchStatement({
          address: backendWalletAddress,
          currencyCode: code,
          limit: 100,
          cursor: currencyCursorNext,
          balanceAfterRlusd: currencyBalanceAfterNext,
        });
        const more = Array.isArray(data?.transactions) ? data.transactions : [];
        setCurrencyTransactions((prev) => [...(prev || []), ...more]);
        setCurrencyHasMore(Boolean(data?.hasMore));
        setCurrencyCursorNext(data?.cursorNext || null);
        setCurrencyBalanceAfterNext(data?.balanceAfterRlusdNext ?? null);
      } catch (err) {
        console.error("[wallet/statement] currency load more error:", err);
        setCurrencyError(err?.message || "Failed to load more transactions");
      } finally {
        setCurrencyLoadingMore(false);
      }
    },
    [
      backendWalletAddress,
      canFetchStatements,
      currencyBalanceAfterNext,
      currencyCursorNext,
      currencyHasMore,
      currencyLoadingMore,
      fetchStatement,
    ]
  );

  useEffect(() => {
    if (!showGlobalStatement) return;
    loadGlobalFirstPage();
  }, [loadGlobalFirstPage, showGlobalStatement]);

  useEffect(() => {
    if (!showCurrencyStatement || !selectedStatementToken) return;
    loadCurrencyFirstPage(selectedStatementToken.currency);
  }, [loadCurrencyFirstPage, selectedStatementToken, showCurrencyStatement]);

  const previewTransactions = useMemo(() => {
    if (canFetchStatements) return null;
    const token = selectedStatementToken;
    if (!token) return null;
    const runningBalance = Number.parseFloat(token.value || 0) || 0;
    return [
      {
        date: "2025-12-28",
        description: "Receive from rPa...",
        category: "receive",
        type: "credit",
        amount: "250.00",
        counterparty: "rPaFcPEbMBqSBZfY6h4oJE3dqKyb6c4oB1",
        runningBalance,
      },
      {
        date: "2025-12-27",
        description: "Send to rMx...",
        category: "send",
        type: "debit",
        amount: "50.00",
        counterparty: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
        runningBalance: runningBalance - 250,
      },
      {
        date: "2025-12-26",
        description: "Exchange USD→EUR",
        category: "exchange",
        type: "credit",
        amount: "100.00",
        counterparty: "XCANNES DEX",
        runningBalance: runningBalance - 200,
      },
      {
        date: "2025-12-25",
        description: "Buy via MoonPay",
        category: "buy",
        type: "credit",
        amount: "200.00",
        counterparty: "MoonPay",
        runningBalance: runningBalance - 300,
      },
    ];
  }, [canFetchStatements, selectedStatementToken]);

  return (
    <>
      {showGlobalStatement ? (
        <GlobalStatement
          tokens={augmentedTokens}
          walletAddress={effectiveWallet}
          period="December 2025"
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          movements={canFetchStatements ? globalMovements : []}
          movementsLoading={canFetchStatements ? globalLoading : false}
          movementsError={canFetchStatements ? globalError : null}
          movementsHasMore={canFetchStatements ? globalHasMore : false}
          movementsLoadingMore={canFetchStatements ? globalLoadingMore : false}
          onLoadMoreMovements={canFetchStatements ? loadGlobalMore : null}
          onClose={() => setShowGlobalStatement(false)}
          onViewCurrency={(token) => {
            setSelectedStatementToken(token);
            setShowGlobalStatement(false);
            setShowCurrencyStatement(true);
          }}
        />
      ) : null}

      {showCurrencyStatement && selectedStatementToken ? (
        <CurrencyStatement
          currency={selectedStatementToken.currency}
          balance={parseFloat(selectedStatementToken.value || 0)}
          issuer={selectedStatementToken.issuer}
          walletAddress={effectiveWallet}
          backendWalletAddress={backendWalletAddress}
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          hasRlusdTrustline={hasRlusdTrustline}
          hasXcsTrustline={hasXcsTrustline}
          xcannesCurrencyLinesCount={xcannesCurrencyLinesCount}
          transactions={
            canFetchStatements
              ? currencyTransactions
              : previewTransactions || []
          }
          hasMore={canFetchStatements ? currencyHasMore : false}
          loadingMore={canFetchStatements ? currencyLoadingMore : false}
          onLoadMore={
            canFetchStatements
              ? () => loadCurrencyMore(selectedStatementToken.currency)
              : null
          }
          loading={canFetchStatements ? currencyLoading : false}
          error={canFetchStatements ? currencyError : null}
          period="December 2025"
          onClose={() => {
            setShowCurrencyStatement(false);
            setSelectedStatementToken(null);
          }}
        />
      ) : null}
    </>
  );
}
