"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "next-i18next";
import DemoCurrencyStatement from "../statements/DemoCurrencyStatement";
import DemoGlobalStatement from "../statements/DemoGlobalStatement";
import { useModalTransition } from "@/hooks/useModalTransition";

export default function DemoWalletDashboardStatementModals({
  augmentedTokens,
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
  inlineGlobalStatement: inlineGlobalStatementProp = false,
  inlineGlobalStatementClassName = "",
  inlineStatementVariant,
  inlineCurrencyStatement: inlineCurrencyStatementProp = false,
  inlineCurrencyStatementClassName = "",
  toast,
  // Legacy / backward-compat props
  inline = false,
  isFullPageView,
  statementVariant,
}) {
  const { t } = useTranslation("common");

  // Inline mode is driven by the caller (inlineGlobalStatement/inlineCurrencyStatement)
  // `inline` is kept for backward compat but no longer controls statement inline mode
  const inlineGlobalStatement = inlineGlobalStatementProp;
  const inlineCurrencyStatement = inlineCurrencyStatementProp;

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
            variant={inlineStatementVariant || "inline-desktop"}
            inline
            usdRates={usdRates}
            preferredCurrency={preferredCurrency}
            rlusdPerUnitRates={rlusdPerUnitRates}
            totalBalanceOverride={statementTotalBalanceUsd}
            movements={previewMovements}
            movementsLoading={false}
            movementsError={null}
            movementsHasMore={false}
            movementsLoadingMore={false}
            onLoadMoreMovements={null}
            highlightTransactionId={highlightTransactionId}
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
          <DemoCurrencyStatement
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
            transactions={previewTransactions}
            statementMonths={null}
            hasMore={false}
            loadingMore={false}
            onLoadMore={null}
            loading={false}
            error={null}
            period="December 2025"
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
          variant="full"
          usdRates={usdRates}
          preferredCurrency={preferredCurrency}
          rlusdPerUnitRates={rlusdPerUnitRates}
          totalBalanceOverride={statementTotalBalanceUsd}
          movements={previewMovements}
          movementsLoading={false}
          movementsError={null}
          movementsHasMore={false}
          movementsLoadingMore={false}
          onLoadMoreMovements={null}
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
        <DemoCurrencyStatement
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
          isPreviewMode={isPreviewMode}
          isWalletActivated={isWalletActivated}
          hasRlusdTrustline={hasRlusdTrustline}
          noticeVariant={noticeVariant}
          noticeContextLabel={noticeContextLabel}
          walletId={walletId}
          variant="full"
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
            maybeReturnToSettingsDropdown();
          }}
          toast={toast}
        />
      ) : null}
    </>
  );
}
