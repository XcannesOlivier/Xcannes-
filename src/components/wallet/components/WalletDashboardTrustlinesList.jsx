"use client";import { useTranslation } from "next-i18next";

export default function WalletDashboardTrustlinesList({
  walletLinesLoading,
  walletLinesError,
  walletLines,
  onEdit
}) {const { t } = useTranslation("common");
  return (
    <div className="flex-1 min-h-0 overflow-y-auto pr-1">
      {walletLinesLoading &&
      <p className="text-[11px] text-white/50">{t("ui_loading_trustlines_b02f5c6b6c", "Loading trustlines…")}</p>
      }
      {walletLinesError &&
      <p className="text-[11px] text-red-400">{String(walletLinesError)}</p>
      }
      {!walletLinesLoading &&
      !walletLinesError &&
      (walletLines || []).length === 0 &&
      <p className="text-[11px] text-white/50">{t("ui_no_wallet_lines_yet_use_the__394682b12c", "No wallet lines yet. Use the form above to add one.")}

      </p>
      }

      {(walletLines || []).map((line) =>
      <button
        key={line.currencyCode}
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onEdit?.(line.currencyCode);
        }}
        className="w-full text-left mb-2 active:scale-98">

          <div className="flex items-center justify-between bg-black/40 border border-white/10 rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-white/10 flex items-center justify-center text-sm font-semibold text-white">
                {line.currencyCode}
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-semibold text-white">
                  {line.currencyCode}
                </span>
	                <span className="text-[11px] text-white/50">
	                  {t("wallet_locked_xcs_label", "Locked XCS:")}{" "}
	                  {Number(line.lockedXcs || 0).toLocaleString("en-US", {
	                  maximumFractionDigits: 4
	                })}
	                </span>
              </div>
            </div>
          </div>
        </button>
      )}
    </div>);

}
