"use client";

import Image from "next/image";
import { useMemo } from "react";
import { useTranslation } from "next-i18next";
import { getCurrencyFlag, getDisplayCurrencyCode, getTokenIcon, TOKEN_ICONS } from "../walletDashboardConfig";

export default function WalletDashboardCurrencyLinesPanel({
  currencyLinesLoading,
  currencyLinesError,
  currencyLines,
  selectIconByCurrency,
  onRefresh,
  inline = false,
  className = ""
}) {
  const { t } = useTranslation("common");
  const normalizedLines = useMemo(() => {
    return (currencyLines || []).map((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
      return { code, allocated, isDerived: Boolean(line?.isDerived) };
    }).filter(Boolean);
  }, [currencyLines]);
  const resolveFallbackIcon = (code) => {
    const upper = String(code || "").toUpperCase();
    const display = getDisplayCurrencyCode(upper);
    if (display !== upper) return getCurrencyFlag(display);
    if (TOKEN_ICONS?.[upper]) {
      return getTokenIcon(upper);
    }
    return getCurrencyFlag(upper);
  };
  const renderLineIcon = (code) => {
    const upper = String(code || "").toUpperCase();
    const icon = selectIconByCurrency?.[upper] || null;
    if (icon?.src) {
      return (
        <Image
          src={icon.src}
          alt={icon.alt || upper}
          width={28}
          height={28}
          className="w-7 h-7 object-contain"
        />
      );
    }
    if (typeof icon === "string" || typeof icon === "number") {
      return <span className="text-lg leading-none">{icon}</span>;
    }
    return <span className="text-lg leading-none">{resolveFallbackIcon(upper)}</span>;
  };
  const rootClassName = [
    "rounded-xl border border-white/10 bg-black/20 p-3 space-y-2",
    inline ? "flex flex-col min-h-0" : "",
    className
  ].filter(Boolean).join(" ");
  const listClassName = inline
    ? "flex-1 min-h-0 overflow-y-auto pr-1 space-y-2"
    : "max-h-44 overflow-y-auto pr-1 space-y-2";
  return (
    <div className={rootClassName}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[11px] font-semibold text-white/80">{t("ui_currency_lines_active_f4", "Active currency lines")}

        </div>
      </div>

      {currencyLinesError &&
      <div className="text-[11px] text-red-400">{currencyLinesError}</div>
      }

      <div className={inline ? "flex flex-col min-h-0 gap-2" : "space-y-2"}>
        {normalizedLines.length === 0 ?
        <div className="text-[11px] text-white/40">{t("ui_no_currency_lines_yet_9630af229d", "No currency lines yet.")}</div> :

        <div className={listClassName}>
	            {normalizedLines.map((line) => {
              const displayCode = getDisplayCurrencyCode(line.code);
	              return (
	                <div key={line.code}>
	                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full">
                        {renderLineIcon(line.code)}
                      </div>
	                      <div className="min-w-0">
	                        <div className="font-mono text-[11px] text-white/80">
	                          {displayCode}
	                        </div>
                        <div className="text-[10px] text-white/40">
                          {t("ui_currency_line_active_label_f4", "Active")}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>);

}
