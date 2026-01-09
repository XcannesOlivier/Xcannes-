"use client";

import TokenAmountInput from "@/components/ui/TokenAmountInput";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";import { useTranslation } from "next-i18next";

export default function WalletDashboardCurrencyLineEditor({
  currencyLinesLoading,
  currencyLineCode,
  setCurrencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineAllocatedRlusd,
  onSave
}) {const { t } = useTranslation("common");
  const disabled =
  currencyLinesLoading ||
  !currencyLineCode ||
  String(currencyLineCode || "").toUpperCase() === "RLUSD";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="text-[11px] font-semibold text-white/80">{t("ui_add_set_currency_line_777a38797b", "Add / set currency line")}

      </div>
      <WalletCurrencySelector
        value={currencyLineCode}
        onChange={setCurrencyLineCode}
        placeholder={t("ui_select_currency_68f9a8a5be", "Select currency...")} />

      <TokenAmountInput
        value={currencyLineAllocatedRlusd}
        onChange={setCurrencyLineAllocatedRlusd}
        placeholder={t("ui_allocated_rlusd_4946b7a160", "Allocated (RLUSD)")}
        token="RLUSD" />

      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSave?.();
        }}
        className="w-full bg-white/5 hover:bg-white/10 text-white/80 font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 border border-white/10"
        disabled={disabled}>{t("ui_save_line_dd4ea383b8", "Save line")}


      </button>
    </div>);

}