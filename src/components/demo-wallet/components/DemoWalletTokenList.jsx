/**
 * DemoWalletTokenList — scrollable token/currency row list + global statement link.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { getDisplayCurrencyCode } from "../demoWalletDashboardConfig";

export default function DemoWalletTokenList({
  locale,
  tokens,
  augmentedTokens,
  renderDemoTokenIcon,
  getDemoCurrencyLabel,
  recentActivity,
  setSelectedStatementToken,
  setShowGlobalStatement,
  setShowCurrencyStatement,
}) {
  const { t } = useTranslation("common");

  const renderRecentIcon = (kind) => {
    if (kind === "send") {
      return (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 17L17 7" />
          <path d="M7 7h10v10" />
        </svg>
      );
    }
    if (kind === "receive") {
      return (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M7 7l10 10" />
          <path d="M17 7v10H7" />
        </svg>
      );
    }
    if (kind === "convert") {
      return (
        <svg
          className="w-[18px] h-[18px]"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="17 1 21 5 17 9" />
          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
          <polyline points="7 23 3 19 7 15" />
          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
        </svg>
      );
    }
    return null;
  };

  const recentToneClass =
    recentActivity?.icon === "receive"
      ? "text-emerald-400"
      : recentActivity?.icon === "send"
        ? "text-red-400"
        : "text-emerald-400";

  const headerTitle = (
    <div className="w-full flex flex-col gap-y-0">
      {recentActivity ? (
        <div
          title={
            recentActivity?.date || recentActivity?.time
              ? `${recentActivity?.date || ""} ${recentActivity?.time || ""} — ${
                  recentActivity?.bannerLabel || ""
                }`
              : recentActivity?.bannerLabel || ""
          }
          className="w-full"
        >
          <div
            className="mx-0 mb-[18px] px-4 py-[9px] rounded-[16px] transition-colors"
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.02)",
            }}
          >
            <div className="flex flex-col justify-center gap-[2px] min-h-[52px]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <div
                    className={[
                      "shrink-0 flex items-center justify-center opacity-70",
                      recentToneClass,
                    ].join(" ")}
                    aria-hidden
                  >
                    {renderRecentIcon(recentActivity.icon)}
                  </div>
                  <span className="text-[13px] text-white/55 truncate">
                    {recentActivity.bannerLabel ||
                      t("ui_recent_activity_banner", "Activité récente")}
                  </span>
                </div>
                {recentActivity?.date ? (
                  <span className="shrink-0 text-[12px] text-white/35 whitespace-nowrap">
                    {recentActivity.date}
                  </span>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="text-[15px] text-white/85 truncate">
                  {recentActivity.icon === "convert" && recentActivity.message ? (
                    <>{recentActivity.message}</>
                  ) : recentActivity.amount ? (
                    <span
                      className={
                        recentActivity.isOutgoing ? "text-red-400" : "text-emerald-400"
                      }
                    >
                      {recentActivity.isOutgoing ? "− " : "+ "}
                      {recentActivity.amount}
                    </span>
                  ) : (
                    recentActivity.message ||
                    t(
                      "ui_consult_global_statement_3b89f4a7a2",
                      "Dernières transactions",
                    )
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {recentActivity?.time ? (
                    <span className="text-[12px] text-white/35 whitespace-nowrap">
                      {recentActivity.time}
                    </span>
                  ) : null}
                  <span className="text-[14px] leading-none text-white/35">›</span>
                </div>
              </div>
              </div>
            </div>
        </div>
      ) : null}
    </div>
  );

  const listClassName =
    "flex-1 min-h-0 px-3 pt-[2px] pb-[50px] overflow-y-auto overscroll-contain rounded-2xl bg-transparent";

  const rowSurfaceClass = [
    "bg-elevated",
    "border border-white/[0.03]",
    "bg-white/[0.035]",
    "bg-[linear-gradient(to_bottom,rgba(255,255,255,0.04),rgba(255,255,255,0)_85%)]",
    "hover:bg-none hover:border-white/[0.05]",
    "transition-colors duration-150",
  ].join(" ");

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="flex-1 min-h-0 flex flex-col">
        <div
          className="flex items-center gap-2 mb-2 px-3 pt-2 bg-[linear-gradient(to_bottom,transparent_0%,#060809_calc(100%-8px),#060809_100%)] justify-between"
          aria-live="polite"
        >
          <div className="w-full">{headerTitle}</div>
        </div>

        <div className={listClassName}>
          <div className="space-y-[2px]">
            {tokens.map((row) => {
            const upperCode = String(row.code || "").toUpperCase();
            if (upperCode === "RLUSD") return null;
            const displayCode = getDisplayCurrencyCode(upperCode);
            const hasCryptoIcon = Boolean(CRYPTO_ICONS?.[displayCode]);
            const isFlagIcon = !hasCryptoIcon;
            const iconSizeClass = isFlagIcon
                ? "w-[28px] h-[28px] text-xl leading-none opacity-60"
                : "w-[28px] h-[28px] text-xl leading-none opacity-60";
            const iconRadiusClass = "";
            const rawUnits = Number(row.units);
            const formattedUnits =
              Number.isFinite(rawUnits)
                ? new Intl.NumberFormat(locale || "en", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(rawUnits)
                : "0.00";
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
                      `flex items-center gap-3 rounded-[14px] px-3.5 py-2 transition-colors cursor-pointer ${rowSurfaceClass}`,
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div
                        className={`${iconSizeClass} ${iconRadiusClass} flex items-center justify-center font-semibold text-primary overflow-hidden`}
                      >
                        {renderDemoTokenIcon(row.code)}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 min-w-0">
                          <span className="text-lg text-white/55 truncate leading-tight">
                            {(() => {
                              const label = String(getDemoCurrencyLabel(row.code) || "").trim();
                              return label.length > 15 ? `${label.slice(0, 15)}…` : label;
                            })()}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right text-lg text-white/65 shrink-0 leading-tight">
                      <div className="font-mono flex items-center gap-1.5">
                        {formattedUnits}{" "}
                        <span className="text-xs font-normal text-white/45">
                          {displayCode}
                        </span>
                        <svg
                          className="w-2.5 h-2.5 shrink-0 text-white/18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                        >
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
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
    </div>
  );
}
