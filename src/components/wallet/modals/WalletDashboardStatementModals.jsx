"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  getCachedStatement,
  setCachedStatement,
} from "@/lib/walletStatementCache";
import CurrencyStatement from "../statements/CurrencyStatement";
import GlobalStatement from "../statements/GlobalStatement";
import { useModalTransition } from "@/hooks/useModalTransition";

export default function WalletDashboardStatementModals({
  augmentedTokens,
  backendWalletAddress,
  wallet,
  walletDisplayLabel = "",
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline: hasRlusdTrustlineOverride = null,
  rlusdBalance: rlusdBalanceOverride = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  previewGlobalMovements,
  previewCurrencyTransactions,
  usdRates,
  preferredCurrency,
  rlusdPerUnitRates,
  highlightTransactionId,
  showGlobalStatement,
  setShowGlobalStatement,
  showCurrencyStatement,
  setShowCurrencyStatement,
  selectedStatementToken,
  setSelectedStatementToken,
  statementBalance = null,
  statementTotalBalanceUsd = null,
  globalStatementTokens = null,
  inlineGlobalStatement = false,
  inlineGlobalStatementClassName = "",
  inlineStatementVariant,
  inlineCurrencyStatement = false,
  inlineCurrencyStatementClassName = "",
  toast,
}) {
  const { t } = useTranslation("common");
  const maybeReturnToSettingsDropdown = useCallback(() => {
    try {
      if (
        typeof window !== "undefined" &&
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__
      ) {
        window.__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__ = false;
        window.dispatchEvent(
          new CustomEvent("xcannes:wallet:restore-inline-view"),
        );
        window.dispatchEvent(new CustomEvent("xcannes:wallet-settings-open"));
      }
    } catch {
      // ignore
    }
  }, []);
  const hasRlusdTrustline = useMemo(() => {
    if (hasRlusdTrustlineOverride === true) return true;
    if (hasRlusdTrustlineOverride === false) return false;
    return (augmentedTokens || []).some((tok) => {
      const code = String(tok?.currency || "").toUpperCase();
      return code === "RLUSD" && !tok?.isMissingTrustline;
    });
  }, [augmentedTokens, hasRlusdTrustlineOverride]);

  const rlusdBalance = useMemo(() => {
    const overrideNum = Number(rlusdBalanceOverride);
    if (Number.isFinite(overrideNum) && overrideNum >= 0) return overrideNum;
    const token = (augmentedTokens || []).find(
      (entry) => String(entry?.currency || "").toUpperCase() === "RLUSD",
    );
    const value = Number.parseFloat(token?.value ?? token?.balance ?? 0);
    return Number.isFinite(value) ? value : 0;
  }, [augmentedTokens, rlusdBalanceOverride]);

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
  const [currencyStatementMonths, setCurrencyStatementMonths] = useState([]);
  const [currencyCursorNext, setCurrencyCursorNext] = useState(null);
  const [currencyBalanceAfterNext, setCurrencyBalanceAfterNext] =
    useState(null);
  const [currencyHasMore, setCurrencyHasMore] = useState(false);
  const [currencyLoadingMore, setCurrencyLoadingMore] = useState(false);
  const [currencyLoading, setCurrencyLoading] = useState(false);
  const [currencyError, setCurrencyError] = useState(null);
  const [closingCurrencyToken, setClosingCurrencyToken] = useState(null);

  const fetchStatement = useCallback(
    async (params) => {
      const url = new URL(apiUrl("/wallet/statement"));
      Object.entries(params || {}).forEach(([key, value]) => {
        if (value == null || value === "") return;
        url.searchParams.set(key, String(value));
      });
      url.searchParams.set("source", "onchain");
      const cacheKey = url.toString();
      const cached = getCachedStatement(cacheKey);
      if (cached) return cached;
      const res = await fetch(url.toString());
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          data?.error ||
            t("ui_statement_request_failed_4c2b1a7d9e", {
              defaultValue: "Statement request failed ({{status}}).",
              status: res.status,
            }),
        );
      }
      setCachedStatement(cacheKey, data);
      return data;
    },
    [t],
  );

  const loadGlobalFirstPage = useCallback(async () => {
    if (!canFetchStatements) return;
    setGlobalLoading(true);
    setGlobalError(null);
    try {
      const data = await fetchStatement({
        address: backendWalletAddress,
        // Fetch more than we display so GlobalStatement can filter out
        // internal/system movements and still show the last 20 user txs.
        limit: 60,
      });
      setGlobalMovements(Array.isArray(data?.movements) ? data.movements : []);
      setGlobalHasMore(Boolean(data?.hasMore));
      setGlobalCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/statement] global load error:", err);
      setGlobalError(
        err?.message ||
          t("ui_statement_load_failed_9b1c7a2d5e", "Failed to load statement."),
      );
      setGlobalMovements([]);
      setGlobalHasMore(false);
      setGlobalCursorNext(null);
    } finally {
      setGlobalLoading(false);
    }
  }, [backendWalletAddress, canFetchStatements, fetchStatement, t]);

  const loadGlobalMore = useCallback(async () => {
    if (!canFetchStatements || !globalHasMore || !globalCursorNext) return;
    if (globalLoadingMore) return;
    setGlobalLoadingMore(true);
    setGlobalError(null);
    try {
      const data = await fetchStatement({
        address: backendWalletAddress,
        limit: 60,
        cursor: globalCursorNext,
      });
      const more = Array.isArray(data?.movements) ? data.movements : [];
      setGlobalMovements((prev) => [...(prev || []), ...more]);
      setGlobalHasMore(Boolean(data?.hasMore));
      setGlobalCursorNext(data?.cursorNext || null);
    } catch (err) {
      console.error("[wallet/statement] global load more error:", err);
      setGlobalError(
        err?.message ||
          t(
            "ui_statement_load_more_movements_failed_2a7c1b9d5e",
            "Failed to load more movements.",
          ),
      );
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
    t,
  ]);

  const loadCurrencyFirstPage = useCallback(
    async (currencyCode) => {
      if (!canFetchStatements) return;
      const code = String(currencyCode || "")
        .trim()
        .toUpperCase();
      if (!code) return;

      setCurrencyLoading(true);
      setCurrencyError(null);
      setCurrencyTransactions([]);
      setCurrencyStatementMonths([]);
      setCurrencyHasMore(false);
      setCurrencyCursorNext(null);
      setCurrencyBalanceAfterNext(null);

      try {
        const allTransactions = [];
        let allStatementMonths = [];
        let nextCursor = null;
        let nextBalanceAfterRlusd = null;
        let hasMore = false;
        let pageCount = 0;

        do {
          const data = await fetchStatement({
            address: backendWalletAddress,
            currencyCode: code,
            limit: 100,
            ...(nextCursor
              ? {
                  cursor: nextCursor,
                  balanceAfterRlusd: nextBalanceAfterRlusd,
                }
              : {}),
          });

          const pageTransactions = Array.isArray(data?.transactions)
            ? data.transactions
            : [];
          allTransactions.push(...pageTransactions);

          if (
            allStatementMonths.length === 0 &&
            Array.isArray(data?.statementMonths)
          ) {
            allStatementMonths = data.statementMonths;
          }

          hasMore = Boolean(data?.hasMore);
          nextCursor = data?.cursorNext || null;
          nextBalanceAfterRlusd = data?.balanceAfterRlusdNext ?? null;
          pageCount += 1;
        } while (hasMore && nextCursor && pageCount < 20);

        setCurrencyTransactions(allTransactions);
        setCurrencyStatementMonths(allStatementMonths);
        setCurrencyHasMore(false);
        setCurrencyCursorNext(null);
        setCurrencyBalanceAfterNext(null);
      } catch (err) {
        console.error("[wallet/statement] currency load error:", err);
        setCurrencyError(
          err?.message ||
            t(
              "ui_statement_load_failed_9b1c7a2d5e",
              "Failed to load statement.",
            ),
        );
        setCurrencyTransactions([]);
        setCurrencyStatementMonths([]);
        setCurrencyHasMore(false);
        setCurrencyCursorNext(null);
        setCurrencyBalanceAfterNext(null);
      } finally {
        setCurrencyLoading(false);
      }
    },
    [backendWalletAddress, canFetchStatements, fetchStatement, t],
  );

  const loadCurrencyMore = useCallback(
    async (currencyCode) => {
      if (!canFetchStatements || currencyLoadingMore) return;
      const code = String(currencyCode || "")
        .trim()
        .toUpperCase();
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
        if (
          Array.isArray(data?.statementMonths) &&
          data.statementMonths.length > 0 &&
          (!currencyStatementMonths || currencyStatementMonths.length === 0)
        ) {
          setCurrencyStatementMonths(data.statementMonths);
        }
        setCurrencyHasMore(Boolean(data?.hasMore));
        setCurrencyCursorNext(data?.cursorNext || null);
        setCurrencyBalanceAfterNext(data?.balanceAfterRlusdNext ?? null);
      } catch (err) {
        console.error("[wallet/statement] currency load more error:", err);
        setCurrencyError(
          err?.message ||
            t(
              "ui_statement_load_more_transactions_failed_1c7b2a9d5e",
              "Failed to load more transactions.",
            ),
        );
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
      currencyStatementMonths,
      fetchStatement,
      t,
    ],
  );

  const shouldLoadGlobal = showGlobalStatement || inlineGlobalStatement;
  const shouldLoadCurrency = showCurrencyStatement || inlineCurrencyStatement;

  useEffect(() => {
    if (!shouldLoadGlobal) return;
    loadGlobalFirstPage();
  }, [loadGlobalFirstPage, shouldLoadGlobal]);

  useEffect(() => {
    if (!shouldLoadCurrency || !selectedStatementToken) return;
    loadCurrencyFirstPage(selectedStatementToken.currency);
  }, [loadCurrencyFirstPage, selectedStatementToken, shouldLoadCurrency]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!canFetchStatements || !backendWalletAddress) return;

    const handleWalletRefresh = (event) => {
      const address = event?.detail?.address;
      if (!address || address !== backendWalletAddress) return;
      if (shouldLoadGlobal) {
        loadGlobalFirstPage();
      }
      if (shouldLoadCurrency && selectedStatementToken) {
        loadCurrencyFirstPage(selectedStatementToken.currency);
      }
    };

    window.addEventListener("xcannes:wallet:refresh", handleWalletRefresh);
    return () =>
      window.removeEventListener("xcannes:wallet:refresh", handleWalletRefresh);
  }, [
    backendWalletAddress,
    canFetchStatements,
    loadCurrencyFirstPage,
    loadGlobalFirstPage,
    selectedStatementToken,
    shouldLoadCurrency,
    shouldLoadGlobal,
  ]);

  const previewMovements = canFetchStatements
    ? null
    : previewGlobalMovements || [];
  const previewTransactions = canFetchStatements
    ? null
    : previewCurrencyTransactions || [];
  const effectiveCurrencyToken = selectedStatementToken || closingCurrencyToken;
  const currencyModalOpen = Boolean(
    showCurrencyStatement && selectedStatementToken,
  );
  const globalModalTransition = useModalTransition(showGlobalStatement, {
    enabled: !inlineGlobalStatement,
  });
  const currencyModalTransition = useModalTransition(currencyModalOpen, {
    enabled: !inlineCurrencyStatement,
  });

  useEffect(() => {
    if (selectedStatementToken) {
      setClosingCurrencyToken(selectedStatementToken);
    }
  }, [selectedStatementToken]);

  useEffect(() => {
    if (!currencyModalTransition.shouldRender) {
      setClosingCurrencyToken(null);
    }
  }, [currencyModalTransition.shouldRender]);

  return (
    <>
      {inlineGlobalStatement ? (
        <div className={inlineGlobalStatementClassName}>
          <GlobalStatement
            tokens={globalStatementTokens || augmentedTokens}
            walletAddress={wallet}
            walletLabelOverride={walletDisplayLabel}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            noticeVariant={noticeVariant}
            noticeContextLabel={noticeContextLabel}
            walletId={walletId}
            period="December 2025"
            variant={inlineStatementVariant || "inline-desktop"}
            inline
            usdRates={usdRates}
            preferredCurrency={preferredCurrency}
            rlusdPerUnitRates={rlusdPerUnitRates}
            totalBalanceOverride={statementTotalBalanceUsd}
            movements={canFetchStatements ? globalMovements : previewMovements}
            movementsLoading={canFetchStatements ? globalLoading : false}
            movementsError={canFetchStatements ? globalError : null}
            movementsHasMore={canFetchStatements ? globalHasMore : false}
            movementsLoadingMore={
              canFetchStatements ? globalLoadingMore : false
            }
            onLoadMoreMovements={canFetchStatements ? loadGlobalMore : null}
            onClose={() => {}}
            onViewCurrency={(token) => {
              setSelectedStatementToken(token);
              setShowCurrencyStatement(true);
            }}
            toast={toast}
          />
        </div>
      ) : null}

      {inlineCurrencyStatement && selectedStatementToken ? (
        <div className={inlineCurrencyStatementClassName}>
          <CurrencyStatement
            currency={selectedStatementToken.currency}
            balance={
              statementBalance !== null &&
              statementBalance !== undefined &&
              statementBalance !== "" &&
              Number.isFinite(Number(statementBalance))
                ? Number(statementBalance)
                : parseFloat(selectedStatementToken.value || 0)
            }
            issuer={selectedStatementToken.issuer}
            walletAddress={wallet}
            walletLabelOverride={walletDisplayLabel}
            backendWalletAddress={backendWalletAddress}
            isPreviewMode={isPreviewMode}
            isWalletActivated={isWalletActivated}
            hasRlusdTrustline={hasRlusdTrustline}
            noticeVariant={noticeVariant}
            noticeContextLabel={noticeContextLabel}
            walletId={walletId}
            variant={inlineStatementVariant || "inline-desktop"}
            inline
            usdRates={usdRates}
            rlusdBalance={rlusdBalance}
            transactions={
              canFetchStatements
                ? currencyTransactions
                : previewTransactions || []
            }
            statementMonths={
              canFetchStatements ? currencyStatementMonths : null
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
            highlightTransactionId={highlightTransactionId}
            onClose={() => {
              setShowCurrencyStatement(false);
              setSelectedStatementToken(null);
              maybeReturnToSettingsDropdown();
            }}
            toast={toast}
          />
        </div>
      ) : null}

      {globalModalTransition.shouldRender && !inlineGlobalStatement ? (
        <GlobalStatement
          tokens={globalStatementTokens || augmentedTokens}
          walletAddress={wallet}
          walletLabelOverride={walletDisplayLabel}
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
          noticeVariant={noticeVariant}
          noticeContextLabel={noticeContextLabel}
          walletId={walletId}
          period="December 2025"
          variant="full"
          usdRates={usdRates}
          preferredCurrency={preferredCurrency}
          rlusdPerUnitRates={rlusdPerUnitRates}
          totalBalanceOverride={statementTotalBalanceUsd}
          movements={canFetchStatements ? globalMovements : previewMovements}
          movementsLoading={canFetchStatements ? globalLoading : false}
          movementsError={canFetchStatements ? globalError : null}
          movementsHasMore={canFetchStatements ? globalHasMore : false}
          movementsLoadingMore={canFetchStatements ? globalLoadingMore : false}
          onLoadMoreMovements={canFetchStatements ? loadGlobalMore : null}
          highlightTransactionId={highlightTransactionId}
          isClosing={globalModalTransition.isClosing}
          onClose={() => {
            setShowGlobalStatement(false);
            maybeReturnToSettingsDropdown();
          }}
          onViewCurrency={(token) => {
            setSelectedStatementToken(token);
            setShowGlobalStatement(false);
            setShowCurrencyStatement(true);
          }}
          toast={toast}
        />
      ) : null}

      {currencyModalTransition.shouldRender &&
      effectiveCurrencyToken &&
      !inlineCurrencyStatement ? (
        <CurrencyStatement
          currency={effectiveCurrencyToken.currency}
          balance={
            statementBalance !== null &&
            statementBalance !== undefined &&
            statementBalance !== "" &&
            Number.isFinite(Number(statementBalance))
              ? Number(statementBalance)
              : parseFloat(effectiveCurrencyToken.value || 0)
          }
          issuer={effectiveCurrencyToken.issuer}
          walletAddress={wallet}
          walletLabelOverride={walletDisplayLabel}
          backendWalletAddress={backendWalletAddress}
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
          noticeVariant={noticeVariant}
          noticeContextLabel={noticeContextLabel}
          walletId={walletId}
          variant="full"
          usdRates={usdRates}
          rlusdBalance={rlusdBalance}
          transactions={
            canFetchStatements
              ? currencyTransactions
              : previewTransactions || []
          }
          statementMonths={canFetchStatements ? currencyStatementMonths : null}
          hasMore={canFetchStatements ? currencyHasMore : false}
          loadingMore={canFetchStatements ? currencyLoadingMore : false}
          onLoadMore={
            canFetchStatements
              ? () => loadCurrencyMore(effectiveCurrencyToken.currency)
              : null
          }
          loading={canFetchStatements ? currencyLoading : false}
          error={canFetchStatements ? currencyError : null}
          period="December 2025"
          highlightTransactionId={highlightTransactionId}
          isClosing={currencyModalTransition.isClosing}
          onClose={() => {
            setShowCurrencyStatement(false);
            setSelectedStatementToken(null);
            maybeReturnToSettingsDropdown();
          }}
          toast={toast}
        />
      ) : null}
    </>
  );
}
