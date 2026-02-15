"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { getCurrencyFlag, getTokenIcon, TOKEN_ICONS } from "../walletDashboardConfig";

export default function WalletDashboardCurrencyLinesPanel({
  currencyLinesLoading,
  currencyLinesError,
  currencyLines,
  selectIconByCurrency,
  onRefresh,
  onDelete,
  inline = false,
  className = ""
}) {
  const { t } = useTranslation("common");
  const neutralActionBtnMuted =
    "rounded-lg border border-white/20 bg-white/5 text-white/70 font-semibold transition-all duration-200 hover:bg-white/10 hover:text-white hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const redActionBtnMuted =
    "rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 text-[#F87171] font-semibold transition-all duration-200 hover:bg-[#EF4444]/20 hover:text-[#FCA5A5] hover:scale-105 active:scale-95";
  const redActionBtnSolid =
    "rounded-lg border border-[#EF4444]/40 bg-[#EF4444]/20 text-[#FEE2E2] font-semibold transition-all duration-200 hover:bg-[#EF4444]/30 hover:text-white active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed";
  const confirmCancelBtn =
    "rounded-lg border border-white/15 bg-white/5 text-white/70 font-semibold transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95";
  const [confirmingCode, setConfirmingCode] = useState(null);
  const confirmBubbleRef = useRef(null);
  const normalizedLines = useMemo(() => {
    return (currencyLines || []).map((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      const allocated = Number.parseFloat(line?.allocatedRlusd ?? 0) || 0;
      return { code, allocated };
    });
  }, [currencyLines]);
  useEffect(() => {
    if (!confirmingCode) return;
    if (normalizedLines.some((line) => line.code === confirmingCode)) return;
    setConfirmingCode(null);
  }, [confirmingCode, normalizedLines]);
  useEffect(() => {
    if (!confirmingCode) return;
    const bubble = confirmBubbleRef.current;
    if (!bubble) return;
    bubble.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [confirmingCode]);
  const resolveFallbackIcon = (code) => {
    const upper = String(code || "").toUpperCase();
    if (upper === "RLUSD" || TOKEN_ICONS?.[upper]) {
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
              const isConfirming = confirmingCode === line.code;
              const canDelete = Number(line.allocated || 0) <= 0;
              return (
                <div key={line.code} className="space-y-2">
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/30 px-2 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 flex items-center justify-center rounded-full">
                        {renderLineIcon(line.code)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-[11px] text-white/80">
                          {line.code}
                        </div>
                        <div className="text-[10px] text-white/40">
                          {t("ui_currency_line_active_label_f4", "Active")}
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setConfirmingCode((prev) =>
                          prev === line.code ? null : line.code
                        );
                      }}
                      className={`px-2 py-1 text-[10px] ${redActionBtnMuted}`}>

                      {t("delete", "Delete")}
                    </button>
                  </div>
                  {isConfirming ? (
                    <div
                      ref={confirmBubbleRef}
                      className="relative rounded-xl border border-[#EF4444]/25 bg-gradient-to-br from-[#EF4444]/15 via-black/40 to-black/60 px-3 py-2 text-[11px] text-red-100 shadow-lg shadow-black/30"
                    >
                      <div className="absolute -top-1 right-6 h-2 w-2 rotate-45 border-l border-t border-[#EF4444]/30 bg-[#EF4444]/15" />
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-semibold">
                            {t(
                              "ui_currency_line_delete_title_f4",
                              "Delete currency line"
                            )}
                          </div>
                          <div className="text-red-200/80">
                            {canDelete
                              ? t(
                                  "ui_currency_line_delete_confirm_f4",
                                  "Delete {{code}} ?",
                                  { code: line.code }
                                )
                              : t(
                                  "ui_currency_line_delete_zero_note_f4",
                                  "Balance must be 0 {{code}} to delete this line.",
                                  { code: line.code }
                                )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmingCode(null);
                          }}
                          className="text-red-200/70 hover:text-red-100 transition-colors text-lg w-7 h-7 flex items-center justify-center rounded-md hover:bg-red-500/10"
                          aria-label={t("close", "Close")}
                        >
                          ×
                        </button>
                      </div>
                      {canDelete ? (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onDelete?.(line.code);
                              setConfirmingCode(null);
                            }}
                            className={`px-3 py-1 ${redActionBtnSolid}`}
                          >
                            {t("delete", "Delete")}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmingCode(null);
                            }}
                            className={`px-3 py-1 ${confirmCancelBtn}`}
                          >
                            {t("cancel", "Cancel")}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        }
      </div>
    </div>);

}
