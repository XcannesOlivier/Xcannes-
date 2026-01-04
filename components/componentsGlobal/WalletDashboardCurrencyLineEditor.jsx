"use client";

import TokenAmountInput from "./TokenAmountInput";
import WalletCurrencySelector from "./WalletCurrencySelector";

export default function WalletDashboardCurrencyLineEditor({
  currencyLinesLoading,
  currencyLineCode,
  setCurrencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineAllocatedRlusd,
  onSave,
}) {
  const disabled =
    currencyLinesLoading ||
    !currencyLineCode ||
    String(currencyLineCode || "").toUpperCase() === "RLUSD";

  return (
    <div className="rounded-xl border border-white/10 bg-black/20 p-3 space-y-2">
      <div className="text-[11px] font-semibold text-white/80">
        Add / set currency line
      </div>
      <WalletCurrencySelector
        value={currencyLineCode}
        onChange={setCurrencyLineCode}
        placeholder="Select currency..."
      />
      <TokenAmountInput
        value={currencyLineAllocatedRlusd}
        onChange={setCurrencyLineAllocatedRlusd}
        placeholder="Allocated (RLUSD)"
        token="RLUSD"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSave?.();
        }}
        className="w-full bg-white/5 hover:bg-white/10 text-white/80 font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed active:scale-95 border border-white/10"
        disabled={disabled}
      >
        Save line
      </button>
    </div>
  );
}

