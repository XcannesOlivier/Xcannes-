"use client";

	import TokenAmountInput from "@/components/ui/TokenAmountInput";
	import WalletDashboardCurrencyLinesPanel from "../components/WalletDashboardCurrencyLinesPanel";
	import WalletDashboardCurrencyLineEditor from "../components/WalletDashboardCurrencyLineEditor";

export default function WalletDashboardSwapModal({
  open,
  onClose,
  renderWalletMeta,
  isPreviewMode,
  effectiveIsConnected,
  refreshCurrencyLines,
  currencyLinesLoading,
  currencyLinesError,
  currencyLinesSummary,
  currencyLines,
  handleRemoveCurrencyLine,
  swapCurrencyOptions,
  convertBaseCurrency,
  setConvertBaseCurrency,
  convertQuoteCurrency,
  setConvertQuoteCurrency,
  convertAmount,
  setConvertAmount,
  convertPreview,
  currencyLineCode,
  setCurrencyLineCode,
  currencyLineAllocatedRlusd,
  setCurrencyLineAllocatedRlusd,
  handleUpsertCurrencyLine,
  handleDemoConvert,
  convertProcessing,
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
          >
            ✕
          </button>
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">
            Convert assets
          </h3>
          <p className="text-xs md:text-sm text-white/60">
            Conversion interne des allocations RLUSD (pool RLUSD ↔ devises).
          </p>
          {renderWalletMeta?.("mb-2")}
          {!isPreviewMode && (
            <WalletDashboardCurrencyLinesPanel
              currencyLinesLoading={currencyLinesLoading}
              currencyLinesError={currencyLinesError}
              currencyLinesSummary={currencyLinesSummary}
              currencyLines={currencyLines}
              onRefresh={refreshCurrencyLines}
              onDelete={handleRemoveCurrencyLine}
            />
          )}
          <div className="space-y-3">
            <div>
              <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                Base
              </label>
              <select
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                value={convertBaseCurrency}
                onChange={(e) => setConvertBaseCurrency(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {(swapCurrencyOptions || [])
                  .filter((code) => code !== convertQuoteCurrency)
                  .map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                Quote
              </label>
              <select
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                value={convertQuoteCurrency}
                onChange={(e) => setConvertQuoteCurrency(e.target.value)}
                onClick={(e) => e.stopPropagation()}
              >
                {(swapCurrencyOptions || [])
                  .filter((code) => code !== convertBaseCurrency)
                  .map((code) => (
                    <option key={code} value={code}>
                      {code}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                Amount
              </label>
              <TokenAmountInput
                value={convertAmount}
                onChange={setConvertAmount}
                placeholder="0.0000"
                token={convertBaseCurrency || "XRP"}
              />
              {convertPreview && (
                <p className="mt-1 text-[11px] text-white/60">
                  {convertPreview}
                </p>
              )}
            </div>

            {!isPreviewMode && (
              <WalletDashboardCurrencyLineEditor
                currencyLinesLoading={currencyLinesLoading}
                currencyLineCode={currencyLineCode}
                setCurrencyLineCode={setCurrencyLineCode}
                currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
                setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
                onSave={handleUpsertCurrencyLine}
              />
            )}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDemoConvert();
              }}
              className="w-full mt-1 bg-xcannes-green/80 hover:bg-xcannes-green text-black font-semibold text-sm py-2.5 rounded-lg transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-white/10"
              disabled={
                convertProcessing ||
                !convertBaseCurrency ||
                !convertQuoteCurrency ||
                !convertAmount ||
                (!isPreviewMode && !effectiveIsConnected)
              }
            >
              {convertProcessing
                ? "Converting..."
                : isPreviewMode
                  ? "Convert (demo, no real tx)"
                  : "Convert allocation"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
