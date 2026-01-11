"use client";

import { useEffect, useMemo, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import WalletDashboardCurrencyLinesPanel from "../components/WalletDashboardCurrencyLinesPanel";
import WalletDashboardCurrencyLineEditor from "../components/WalletDashboardCurrencyLineEditor";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";
import { createPortal } from "react-dom";import { useTranslation } from "next-i18next";

export default function WalletDashboardSwapModal({
  open,
  onClose,
  renderWalletMeta,
  isPreviewMode,
  noticeVariant = "preview",
  noticeContextLabel = "",
  effectiveIsConnected,
  hasOnChainRlusd,
  hasOnChainXcs,
  onInstallTrustline,
  onActivateCurrencyLine,
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
  convertProcessing
}) {const { t } = useTranslation("common");
  const [view, setView] = useState("convert"); // 'convert' | 'lines'
  const [activateCurrencyCode, setActivateCurrencyCode] = useState("");
  useEffect(() => {
    if (open) setView("convert");
  }, [open]);

  const existingCurrencyLinesSet = useMemo(() => {
    const set = new Set();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [currencyLines]);

  const suggestedCurrencies = useMemo(
    () => ["EUR", "USD", "GBP", "CHF", "CAD", "AED", "SAR", "XOF", "XAF", "JPY"],
    []
  );

  const canMutateLines = isPreviewMode || !!effectiveIsConnected;

  if (!open) return null;

  const content =
  <>
      {/* Backdrop */}
      <div
      className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
      onClick={onClose} />

      {/* Modale */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
        className="relative w-full max-w-md bg-gray-900 border border-white/10 rounded-2xl p-4 md:p-5 space-y-3 md:space-y-4 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto"
        style={{ WebkitOverflowScrolling: "touch" }}
        onClick={(e) => e.stopPropagation()}>

          <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <h3 className="text-lg md:text-xl font-orbitron font-bold text-white mb-1 pr-6">{t("ui_convert_assets_cfc8bae6b0", "Convert assets")}

        </h3>
	          <p className="text-xs md:text-sm text-white/60">{t("ui_conversion_interne_des_alloc_1470ceb745", "Conversion interne des allocations RLUSD (pool RLUSD ↔ devises).")}

        </p>
	          {renderWalletMeta?.("mb-2")}
	          <WalletNotConnectedNotice
          show={isPreviewMode}
          variant={noticeVariant}
          contextLabel={noticeContextLabel} />


	          <div className="grid grid-cols-2 gap-2">
	            <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setView("convert");
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            view === "convert" ?
            "bg-xcannes-green text-black" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_convert_8408e969ec", "Convert")}


          </button>
            <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setView("lines");
            }}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
            view === "lines" ?
            "bg-xcannes-green text-black" :
            "bg-white/5 text-white/60 hover:bg-white/10"}`
            }>{t("ui_currency_lines_267fc2eff3", "Currency lines")}


          </button>
          </div>

          {!isPreviewMode && (!hasOnChainRlusd || !hasOnChainXcs) &&
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
              <div className="text-[12px] font-semibold text-amber-200">{t("ui_trustlines_required_d39ef28613", "Trustlines requises")}

          </div>
              <p className="mt-1 text-[11px] text-amber-200/80">{t("ui_to_fully_use_wallet_5439f003e6", "Pour utiliser pleinement le wallet, installez les trustlines XRPL pour")}

            <span className="font-mono">{t("ui_rlusd_03b00d11bf", "RLUSD")}</span>{t("ui_and_620aeaa4b1", "et")}{" "}
                <span className="font-mono">{t("ui_xcs_f295b34180", "XCS")}</span>.
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {!hasOnChainRlusd &&
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInstallTrustline?.("RLUSD");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] text-amber-100 transition-colors active:scale-95">{t("ui_install_trustline_rlusd_35e926ab5c", "Installer trustline RLUSD")}


            </button>
            }
                {!hasOnChainXcs &&
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onInstallTrustline?.("XCS");
              }}
              className="px-2.5 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-[11px] text-amber-100 transition-colors active:scale-95">{t("ui_install_trustline_xcs_5a6044d70e", "Installer trustline XCS")}


            </button>
            }
              </div>
            </div>
        }

          {view === "convert" ?
        <div className="space-y-3">
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_base_6d4184e1ef", "Base")}

            </label>
                <select
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
              value={convertBaseCurrency}
              onChange={(e) => setConvertBaseCurrency(e.target.value)}
              onClick={(e) => e.stopPropagation()}>

                  {(swapCurrencyOptions || []).
              filter((code) => code !== convertQuoteCurrency).
              map((code) =>
              <option key={code} value={code}>
                        {code}
                      </option>
              )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_quote_e3761255be", "Quote")}

            </label>
                <select
              className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
              value={convertQuoteCurrency}
              onChange={(e) => setConvertQuoteCurrency(e.target.value)}
              onClick={(e) => e.stopPropagation()}>

                  {(swapCurrencyOptions || []).
              filter((code) => code !== convertBaseCurrency).
              map((code) =>
              <option key={code} value={code}>
                        {code}
                      </option>
              )}
                </select>
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_amount_52a20b2992", "Amount")}

            </label>
                <TokenAmountInput
              value={convertAmount}
              onChange={setConvertAmount}
              placeholder="0.0000"
              token={convertBaseCurrency || "XRP"} />

                {convertPreview &&
            <p className="mt-1 text-[11px] text-white/60">
                    {convertPreview}
                  </p>
            }
              </div>

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
            !isPreviewMode && !effectiveIsConnected
            }>

                {convertProcessing ?
            "Converting..." :
            isPreviewMode ?
            "Convert (demo, no real tx)" :
            "Convert allocation"}
              </button>

              {!isPreviewMode &&
          <div className="text-[10px] text-white/45">{t("ui_tip_use_the_b06aa04f1f", "Tip: use the")}
            <span className="font-mono">{t("ui_currency_lines_267fc2eff3", "Currency lines")}</span>{" "}{t("ui_tab_to_add_activate_new_line_1965097add", "tab to add/activate new lines.")}

          </div>
          }
            </div> :

        <div className="space-y-3">
              <p className="text-xs text-white/60">{t("ui_choose_currencies_to_activate_41eea71853", "Choisissez les devises que vous souhaitez activer. Une ligne peut exister avec")}

            <span className="font-mono">{t("ui_0_rlusd_14d1aaec1c", "0 RLUSD")}</span>.
              </p>

              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] font-semibold text-white/80">{t("ui_available_currencies_267b159a9a", "Available currencies")}

            </div>
                {!canMutateLines &&
            <p className="mt-1 text-[10px] text-white/45">{t("ui_connect_your_wallet_to_activ_ec68e6f427", "Connect your wallet to activate currency lines.")}

            </p>
            }
                {isPreviewMode &&
            <p className="mt-1 text-[10px] text-white/45">{t("ui_demo_mode_activations_are_si_2dad62366e", "Demo mode: activations are simulated (no on-chain tx).")}

            </p>
            }
                <div className="mt-2 grid grid-cols-1 gap-2">
                  <WalletCurrencySelector
                value={activateCurrencyCode}
                onChange={setActivateCurrencyCode}
                placeholder={t("ui_select_a_currency_to_activat_776d6af637", "Select a currency to activate...")} />

                  <button
                type="button"
                disabled={
                !canMutateLines ||
                currencyLinesLoading ||
                !activateCurrencyCode ||
                existingCurrencyLinesSet.has(
                  String(activateCurrencyCode || "").toUpperCase()
                )
                }
                onClick={(e) => {
                  e.stopPropagation();
                  const upper = String(activateCurrencyCode || "").toUpperCase();
                  onActivateCurrencyLine?.(upper);
                  setActivateCurrencyCode("");
                }}
                className="w-full px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-white/70 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95">{t("ui_activate_currency_line_32843c5eeb", "Activate currency line")}


              </button>
                </div>
                <div className="mt-3 text-[11px] font-semibold text-white/80">{t("ui_quick_add_e62e925d4f", "Quick add")}

            </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedCurrencies.map((code) => {
                const upper = String(code || "").toUpperCase();
                const disabled =
                !canMutateLines ||
                currencyLinesLoading ||
                existingCurrencyLinesSet.has(upper);
                return (
                  <button
                    key={upper}
                    type="button"
                    disabled={disabled}
                    onClick={(e) => {
                      e.stopPropagation();
                      onActivateCurrencyLine?.(upper);
                    }}
                    className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    title={
                    existingCurrencyLinesSet.has(upper) ?
                    "Already active" :
                    canMutateLines ?
                    "Activate currency line" :
                    "Connect wallet to activate"
                    }>

                        {upper}
                      </button>);

              })}
                </div>
                <p className="mt-2 text-[10px] text-white/45">{t("ui_activate_une_ligne_implique_u_b625857cd9", "Activer une ligne implique un verrouillage de")}
              {" "}
                  <span className="font-mono">{t("ui_0_20_xcs_37887114e0", "0.20 XCS")}</span>{t("ui_via_escrow_340f6d0b2b", "(via escrow).")}
            </p>
              </div>

              <WalletDashboardCurrencyLinesPanel
            currencyLinesLoading={currencyLinesLoading}
            currencyLinesError={currencyLinesError}
            currencyLinesSummary={currencyLinesSummary}
            currencyLines={currencyLines}
            onRefresh={refreshCurrencyLines}
            onDelete={handleRemoveCurrencyLine} />


              <WalletDashboardCurrencyLineEditor
            currencyLinesLoading={currencyLinesLoading}
            currencyLineCode={currencyLineCode}
            setCurrencyLineCode={setCurrencyLineCode}
            currencyLineAllocatedRlusd={currencyLineAllocatedRlusd}
            setCurrencyLineAllocatedRlusd={setCurrencyLineAllocatedRlusd}
            onSave={handleUpsertCurrencyLine} />

            </div>
        }
        </div>
      </div>
    </>;


  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}