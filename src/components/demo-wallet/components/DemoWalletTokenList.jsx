/**
 * DemoWalletTokenList — scrollable token/currency row list + global statement link.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { getDisplayCurrencyCode } from "../demoWalletDashboardConfig";
import { formatUnitsWithSymbol } from "../utils/demoWalletHelpers";

export default function DemoWalletTokenList({
  locale,
  tokens,
  augmentedTokens,
  renderDemoTokenIcon,
  getDemoCurrencyLabel,
  setSelectedStatementToken,
  setShowGlobalStatement,
  setShowCurrencyStatement,
}) {
  const { t } = useTranslation("common");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 p-3 flex flex-col">
        <div className="flex items-center justify-end gap-2 mb-2">
          <button
            type="button"
            onClick={() => setShowGlobalStatement(true)}
            className="text-sm md:text-xs text-white/80 hover:text-white transition-colors"
            title={t("demo_tt_statement", "Voir le relevé global.")}
          >
            {t(
              "ui_consult_global_statement_3b89f4a7a2",
              "Consulter votre Relevé global",
            )}
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1 space-y-1.5">
          {tokens.map((row) => {
            const upperCode = String(row.code || "").toUpperCase();
            if (upperCode === "RLUSD") return null;
            const displayCode = getDisplayCurrencyCode(upperCode);
            const hasCryptoIcon = Boolean(CRYPTO_ICONS?.[displayCode]);
            const isFlagIcon = !hasCryptoIcon;
            const iconSizeClass = isFlagIcon
                ? "w-10 h-10 text-[18px] sm:w-11 sm:h-11 sm:text-[20px]"
                : "w-9 h-9 text-[16px] sm:w-9 sm:h-9 sm:text-[16px]";
            const iconRadiusClass = "";
            return (
              <div key={row.code} className="w-full">
                <button
                  type="button"
                  onClick={() => {
                    const statementCode =
                      upperCode === "USD" ? "RLUSD" : upperCode;
                    const token = augmentedTokens.find(
                      (tok) =>
                        String(tok?.currency || "").toUpperCase() ===
                        statementCode,
                    ) || {
                      currency: statementCode,
                      value: row.units,
                      isDerivedUsd: upperCode === "USD",
                    };
                    if (upperCode === "USD" && token) {
                      token.isDerivedUsd = true;
                    }
                    setSelectedStatementToken(token);
                    setShowGlobalStatement(false);
                    setShowCurrencyStatement(true);
                  }}
                  className="w-full text-left"
                  title={t("demo_open_statement", "Ouvrir le relevé")}
                >
                  <div
                    className={[
                      "flex items-center justify-between rounded-md px-3 py-2 transition-colors",
                      "bg-black/20 hover:bg-black/15",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`${iconSizeClass} ${iconRadiusClass} flex items-center justify-center font-semibold text-primary overflow-hidden`}
                      >
                        {renderDemoTokenIcon(row.code)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-[15px] md:text-[16px] text-white/90 font-semibold truncate">
                            {getDemoCurrencyLabel(row.code)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-[14px] md:text-[15px] text-primary">
                      <div className="font-mono">
                        {formatUnitsWithSymbol(locale, row.units, displayCode)}
                      </div>
                    </div>
                  </div>
                </button>
              </div>
            );
          })}

          {tokens.length === 0 ? (
            <div className="text-sm text-white/60">
              {t("demo_no_lines", "Aucune ligne pour le moment.")}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
