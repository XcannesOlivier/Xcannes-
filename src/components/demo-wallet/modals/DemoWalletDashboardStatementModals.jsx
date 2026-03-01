"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import DemoCurrencyStatement from "../statements/DemoCurrencyStatement";
import DemoGlobalStatement from "../statements/DemoGlobalStatement";
import { useModalTransition } from "@/utils/useModalTransition";

export default function DemoWalletDashboardStatementModals({
  augmentedTokens,
  backendWalletAddress,
  wallet,
  walletDisplayLabel = "",
  isPreviewMode = false,
  isWalletActivated = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  previewGlobalMovements,
  previewCurrencyTransactions,
  isFullPageView,
  statementVariant,
  usdRates,
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
}) {
  const { t } = useTranslation("common");
  const hasRlusdTrustline = (augmentedTokens || []).some((t) => {
    const code = String(t?.currency || "").toUpperCase();
    return code === "RLUSD" && !t?.isMissingTrustline;
  });

  const rlusdBalance = useMemo(() => {
    const token = (augmentedTokens || []).find(
      (entry) => String(entry?.currency || "").toUpperCase() === "RLUSD",
    );
    const value = Number.parseFloat(token?.value ?? token?.balance ?? 0);
    return Number.isFinite(value) ? value : 0;
  }, [augmentedTokens]);

  // Demo wallet: statements come from local preview data (no on-chain fetch)
  const previewMovements = previewGlobalMovements || [];
  const previewTransactions = previewCurrencyTransactions || [];

  const [closingCurrencyToken, setClosingCurrencyToken] = useState(null);
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
          <DemoGlobalStatement
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
            isFullPage={isFullPageView}
            variant={inlineStatementVariant || "inline-desktop"}
            inline
            usdRates={usdRates}
            totalBalanceOverride={statementTotalBalanceUsd}
            movements={previewMovements}
            movementsLoading={false}
            movementsError={null}
            movementsHasMore={false}
            movementsLoadingMore={false}
            onLoadMoreMovements={null}
            onClose={() => {}}
            onViewCurrency={(token) => {
              setSelectedStatementToken(token);
              setShowCurrencyStatement(true);
            }}
          />
        </div>
      ) : null}

      {inlineCurrencyStatement && selectedStatementToken ? (
        <div className={inlineCurrencyStatementClassName}>
          <DemoCurrencyStatement
            currency={selectedStatementToken.currency}
            balance={
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
            isFullPage={isFullPageView}
            variant={inlineStatementVariant || "inline-desktop"}
            inline
            usdRates={usdRates}
            rlusdBalance={rlusdBalance}
            transactions={previewTransactions}
            statementMonths={null}
            hasMore={false}
            loadingMore={false}
            onLoadMore={null}
            loading={false}
            error={null}
            highlightTransactionId={highlightTransactionId}
            onClose={() => setShowCurrencyStatement(false)}
          />
        </div>
      ) : null}

      {globalModalTransition.shouldRender && !inlineGlobalStatement ? (
        <DemoGlobalStatement
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
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          totalBalanceOverride={statementTotalBalanceUsd}
          movements={previewMovements}
          movementsLoading={false}
          movementsError={null}
          movementsHasMore={false}
          movementsLoadingMore={false}
          onLoadMoreMovements={null}
          isClosing={globalModalTransition.isClosing}
          onClose={() => setShowGlobalStatement(false)}
          onViewCurrency={(token) => {
            setSelectedStatementToken(token);
            setShowGlobalStatement(false);
            setShowCurrencyStatement(true);
          }}
        />
      ) : null}

      {currencyModalTransition.shouldRender &&
      effectiveCurrencyToken &&
      !inlineCurrencyStatement ? (
        <DemoCurrencyStatement
          currency={effectiveCurrencyToken.currency}
          balance={
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
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          rlusdBalance={rlusdBalance}
          transactions={previewTransactions}
          statementMonths={null}
          hasMore={false}
          loadingMore={false}
          onLoadMore={null}
          loading={false}
          error={null}
          period="December 2025"
          highlightTransactionId={highlightTransactionId}
          isClosing={currencyModalTransition.isClosing}
          onClose={() => {
            setShowCurrencyStatement(false);
            setSelectedStatementToken(null);
          }}
        />
      ) : null}
    </>
  );
}
