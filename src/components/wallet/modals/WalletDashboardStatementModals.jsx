"use client";

import CurrencyStatement from "../statements/CurrencyStatement";
import GlobalStatement from "../statements/GlobalStatement";

export default function WalletDashboardStatementModals({
  augmentedTokens,
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
          isFullPage={isFullPageView}
          variant={statementVariant}
          usdRates={usdRates}
          hasRlusdTrustline={hasRlusdTrustline}
          hasXcsTrustline={hasXcsTrustline}
          xcannesCurrencyLinesCount={xcannesCurrencyLinesCount}
          transactions={[
            {
              date: "2025-12-28",
              description: "Receive from rPa...",
              category: "receive",
              type: "credit",
              amount: "250.00",
              counterparty: "rPaFcPEbMBqSBZfY6h4oJE3dqKyb6c4oB1",
              runningBalance: selectedStatementToken.value,
            },
            {
              date: "2025-12-27",
              description: "Send to rMx...",
              category: "send",
              type: "debit",
              amount: "50.00",
              counterparty: "rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 250,
            },
            {
              date: "2025-12-26",
              description: "Exchange USD→EUR",
              category: "exchange",
              type: "credit",
              amount: "100.00",
              counterparty: "XCANNES DEX",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 200,
            },
            {
              date: "2025-12-25",
              description: "Buy via MoonPay",
              category: "buy",
              type: "credit",
              amount: "200.00",
              counterparty: "MoonPay",
              runningBalance: parseFloat(selectedStatementToken.value || 0) - 300,
            },
          ]}
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
