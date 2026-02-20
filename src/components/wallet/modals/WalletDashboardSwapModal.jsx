"use client";

import { useEffect, useMemo, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import WalletDashboardCurrencyLinesPanel from "../components/WalletDashboardCurrencyLinesPanel";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { computeSpreadQuote, isFxConversion } from "@/utils/walletSpread";
import { useModalTransition } from "@/utils/useModalTransition";
import {
  formatAmountWithSymbol,
  getDisplayCurrencyCode,
  WALLET_CURRENCY_LINE_ORDER
} from "../walletDashboardConfig";

export default function WalletDashboardSwapModal({
  open,
  onClose,
  renderWalletMeta,
  isPreviewMode,
  defaultView = "convert",
  lockedView = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  dashboardVariant = "default",
  effectiveIsConnected,
  isWalletActivated,
  hasRlusdTrustline = null,
  onConnectWallet,
  hasOnChainRlusd,
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
  convertProcessing,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  inline = false
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const greenActionBtnMuted =
    "rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 text-white/85 font-semibold transition-all duration-200 hover:bg-[#22C55E]/20 hover:text-white/95 hover:scale-105 active:scale-95";
  const greenTabInactive =
    "rounded-lg border border-[#22C55E]/40 bg-transparent text-white/60 font-semibold transition-all duration-200 hover:border-[#22C55E]/60 hover:text-white/80";
  const [view, setView] = useState("convert"); // 'convert' | 'lines'
  const [activateCurrencyCode, setActivateCurrencyCode] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    if (!open) return;
    const nextView = lockedView || defaultView || "convert";
    setView(nextView);
  }, [defaultView, lockedView, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const existingCurrencyLinesSet = useMemo(() => {
    const set = new Set();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [currencyLines]);

  const suggestedCurrencies = useMemo(() => {
    const base = Array.isArray(WALLET_CURRENCY_LINE_ORDER)
      ? WALLET_CURRENCY_LINE_ORDER
      : [];
    return base.filter((code) => {
      const upper = String(code || "").toUpperCase();
      return upper && upper !== "USD" && upper !== "RLUSD" && upper !== "XRP";
    });
  }, []);

  const swapCurrencyOptionsSanitized = useMemo(() => {
    return (swapCurrencyOptions || []).filter(
      (code) => String(code || "").trim().toUpperCase() !== "USD"
    );
  }, [swapCurrencyOptions]);

  const canMutateLines =
    isPreviewMode ||
    (effectiveIsConnected &&
      isWalletActivated === true &&
      hasOnChainRlusd);
  const showDesktopWalletConvertNote =
    inline &&
    isDesktop &&
    noticeVariant !== "demo" &&
    dashboardVariant === "full" &&
    view === "convert";
  const useDesktopWalletConvertLayout = showDesktopWalletConvertNote;
  const lockLinesScrollToList =
    inline &&
    isDesktop &&
    noticeVariant !== "demo" &&
    dashboardVariant === "full" &&
    view === "lines";
  const [previewState, setPreviewState] = useState({ status: "idle", error: null });
  const [previewAmount, setPreviewAmount] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);

  const baseCode = useMemo(
    () => String(convertBaseCurrency || "").trim().toUpperCase(),
    [convertBaseCurrency]
  );
  const quoteCode = useMemo(
    () => String(convertQuoteCurrency || "").trim().toUpperCase(),
    [convertQuoteCurrency]
  );
  const amountValue = useMemo(
    () => Number.parseFloat(convertAmount || ""),
    [convertAmount]
  );

  // Seules les conversions impliquant XRP sont hors-scope ici (pas de swap DEX).
  // RLUSD est traité comme devise de base (peg 1:1 avec USD) pour les conversions "allocation".
  const isXrplCore = (code) => code === "XRP";
  const sameCurrencySelected = Boolean(baseCode && quoteCode && baseCode === quoteCode);

  const conversionRoute = useMemo(() => {
    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return { type: "none" };
    }

    if (isXrplCore(baseCode) || isXrplCore(quoteCode)) {
      return {
        type: "unsupported",
        error: t(
          "ui_xrpl_conversion_temporarily_unavailable_1f8b72d3aa",
          "XRP/RLUSD conversion is temporarily unavailable."
        ),
      };
    }

    return { type: "allocation" };
  }, [baseCode, quoteCode, t]);

  const formatAmountWithSymbolLocal = (value, currency, options = {}) => {
    const display = getDisplayCurrencyCode(currency);
    return formatAmountWithSymbol(locale, value, display, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 6,
      ...options,
    });
  };


  useEffect(() => {
    if (!open) return;
    setPreviewState({ status: "idle", error: null });
    setPreviewAmount(null);
    setPreviewMeta(null);

    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return;
    }

    if (conversionRoute.type === "unsupported") {
      setPreviewState({ status: "error", error: conversionRoute.error });
      return;
    }

    if (conversionRoute.type === "allocation") {
      const isPeggedToUsd = (code) => code === "RLUSD" || code === "USD";
      const rlusdPerBase = isPeggedToUsd(baseCode)
        ? 1
        : Number(rlusdPerUnitRates?.[baseCode]);
      const rlusdPerQuote = isPeggedToUsd(quoteCode)
        ? 1
        : Number(rlusdPerUnitRates?.[quoteCode]);

      if (!Number.isFinite(rlusdPerBase) || rlusdPerBase <= 0) {
        setPreviewState({
          status: "error",
          error: t(
            "ui_rate_unavailable_base_5c1a9b7d2e",
            "Rate unavailable for base currency."
          ),
        });
        return;
      }
      if (!Number.isFinite(rlusdPerQuote) || rlusdPerQuote <= 0) {
        setPreviewState({
          status: "error",
          error: t(
            "ui_rate_unavailable_quote_8b2c1a9d5e",
            "Rate unavailable for quote currency."
          ),
        });
        return;
      }

      const grossRlusd = amountValue * rlusdPerBase;
      const spread = computeSpreadQuote({
        base: baseCode,
        quote: quoteCode,
        amountRlusd: grossRlusd,
      });
      const spreadFee = Number(spread?.spreadFeeRlusd || 0);
      const netRlusd = Math.max(0, grossRlusd - spreadFee);
      const quoteUnits =
        quoteCode === "RLUSD" ? netRlusd : netRlusd / rlusdPerQuote;

      setPreviewState({ status: "done", error: null });
      setPreviewAmount(quoteUnits);
      setPreviewMeta({
        route: "allocation",
        spreadFeeRlusd: spreadFee,
        spreadPercent: Number(spread?.spreadFraction || 0) * 100,
        isFx: isFxConversion(baseCode, quoteCode),
      });
      return undefined;
    }
    return undefined;
  }, [
    amountValue,
    baseCode,
    conversionRoute,
    open,
    quoteCode,
    rlusdPerUnitRates,
    t,
  ]);

  const convertButtonDisabled =
    convertProcessing ||
    !convertBaseCurrency ||
    !convertQuoteCurrency ||
    !convertAmount ||
    sameCurrencySelected ||
    conversionRoute.type !== "allocation";
  const convertButtonLabel = convertProcessing
    ? t("ui_converting_71c2b9a4e5", "Converting...")
    : isPreviewMode
      ? t("ui_convert_8408e969ec", "Convert")
      : t("ui_convert_allocation_6b2c1a9d5e", "Convert allocation");
  const handleConvertAction = () => {
    handleDemoConvert();
  };
  const activeCurrencyUpper = String(activateCurrencyCode || "").toUpperCase();
  const isLineAlreadyActive =
    Boolean(activeCurrencyUpper) && existingCurrencyLinesSet.has(activeCurrencyUpper);
  const activateLineDisabled =
    !canMutateLines ||
    currencyLinesLoading ||
    !activateCurrencyCode ||
    existingCurrencyLinesSet.has(
      String(activateCurrencyCode || "").toUpperCase()
    );
  const handleActivateLine = async () => {
    const upper = String(activateCurrencyCode || "").toUpperCase();
    let didActivate = false;
    try {
      const result = await onActivateCurrencyLine?.(upper);
      didActivate = Boolean(result);
    } catch (error) {
      console.error("[wallet/swap] activate currency line failed:", error);
    } finally {
      setActivateCurrencyCode("");
    }
    if (didActivate) {
      onClose?.();
    }
  };
  const handleDeleteLine = async (code) => {
    let didDelete = false;
    try {
      const result = await handleRemoveCurrencyLine?.(code);
      didDelete = Boolean(result);
    } catch (error) {
      console.error("[wallet/swap] delete currency line failed:", error);
    }
    if (didDelete) {
      onClose?.();
    }
  };

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal border border-white/10 overflow-hidden flex flex-col min-h-0 pointer-events-auto",
    inline ? "h-full max-h-none rounded-xl" : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline ? (isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in") : "",
  ].join(" ");

  const content =
  <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
        className={panelClass}
        onClick={(e) => {
          if (!inline) e.stopPropagation();
        }}>

          <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <div
          className={`flex-1 min-h-0 flex flex-col overscroll-contain p-4 md:p-5 space-y-3 md:space-y-4 ${
            lockLinesScrollToList ? "overflow-hidden" : "overflow-y-auto"
          }`}
          style={{ WebkitOverflowScrolling: "touch" }}>
            <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                  {t("demo_notice_title", "Mode démo")}
                </span>
              ) : null}
              {showNotConnectedNotice ? (
                <span className="inline-flex items-center text-xcannes-yellow text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                  {t("wallet_not_connected_title", "Wallet not connected")}
                </span>
              ) : null}
              {showNotActivatedNotice ? (
                <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                  {t(
                    "wallet_not_activated_title",
                    "Wallet not activated: a minimum reserve of 1 XRP is required."
                  )}
                </span>
              ) : null}
              {showRlusdNotActivatedNotice ? (
                <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                  {t(
                    "wallet_rlusd_not_activated_title",
                    "USD not activated. Authorize USD on your wallet."
                  )}
                </span>
              ) : null}
            </div>
	            {renderWalletMeta?.("mb-2")}


            {!lockedView ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("convert");
                  }}
                  className={`px-3 py-2 text-xs md:text-sm ${
                    view === "convert" ? greenActionBtnMuted : greenTabInactive
                  }`}
                >
                  {t("ui_convert_8408e969ec", "Convert")}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setView("lines");
                  }}
                  className={`px-3 py-2 text-xs md:text-sm ${
                    view === "lines" ? greenActionBtnMuted : greenTabInactive
                  }`}
                >
                  {t("ui_currency_lines_267fc2eff3", "Currency lines")}
                </button>
              </div>
            ) : null}

          <div
            key={view}
            className={inline ? "wallet-tab-unfold-in flex-1 min-h-0 flex flex-col" : "wallet-tab-unfold-in"}
          >
	            {view === "convert" ?
		        <div className={`space-y-5 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}>
		              <div className={useDesktopWalletConvertLayout
		                ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-6"
		                : inline
		                ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(18px,2.8vh,36px)]"
		                : "space-y-5"}>
		              <div className={useDesktopWalletConvertLayout ? "space-y-7" : inline ? "space-y-6" : ""}>
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_base_6d4184e1ef", "Base")}

            </label>
	                <ModalSelect
	              value={convertBaseCurrency}
	              onChange={setConvertBaseCurrency}
	              options={(swapCurrencyOptionsSanitized || [])
	                .map((code) => {
	                  const labelLeft = selectLabelByCurrency?.[code] || code;
	                  const labelRight = selectLabelRightByCurrency?.[code] || null;
	                  return {
                    value: code,
                    icon: selectIconByCurrency?.[code] || null,
                    label: labelLeft,
                    labelLeft,
                    labelRight,
                    labelMobile:
                      selectLabelMobileByCurrency?.[code] ||
                      labelLeft,
                  };
                })}
              useNativeSelect={false}
              showMobileOptionRight={true}
              buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
              menuClassName={noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"}
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
            />
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_quote_e3761255be", "Quote")}

            </label>
	                <ModalSelect
	              value={convertQuoteCurrency}
	              onChange={setConvertQuoteCurrency}
	              options={(swapCurrencyOptionsSanitized || [])
	                .map((code) => {
	                  const labelLeft = selectLabelByCurrency?.[code] || code;
	                  const labelRight = selectLabelRightByCurrency?.[code] || null;
	                  return {
                    value: code,
                    icon: selectIconByCurrency?.[code] || null,
                    label: labelLeft,
                    labelLeft,
                    labelRight,
                    labelMobile:
                      selectLabelMobileByCurrency?.[code] ||
                      labelLeft,
                  };
                })}
              useNativeSelect={false}
              showMobileOptionRight={true}
              buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
              menuClassName={noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"}
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
            />
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_amount_52a20b2992", "Amount")}

            </label>
              <TokenAmountInput
              value={convertAmount}
              onChange={setConvertAmount}
              placeholder="0.0000"
              token={
                selectLabelByCurrency?.[convertBaseCurrency] ||
                convertBaseCurrency ||
                "RLUSD"
              }
              tokenClassName="text-white"
              containerClassName="focus-within:!border-xcannes-green/80" />
              </div>
              </div>

              <div className={inline ? "space-y-2" : "space-y-2"}>
                {sameCurrencySelected ? (
                  <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/90">
                    {t("ui_convert_same_asset_warning_6f13d5c9c2", "Veuillez choisir 2 actifs différents.")}
                  </div>
                ) : null}
                <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
                  <div className="uppercase tracking-[0.16em] text-[9px] text-white/50">
                    {t("ui_estimated_receive_0c5a3b7e9a", "Estimated receive")}
                  </div>
                  <div className="text-sm text-white/90">
                    {formatAmountWithSymbolLocal(
                      previewAmount,
                      convertQuoteCurrency || "",
                      { minimumFractionDigits: 0, maximumFractionDigits: 6 }
                    )}
                  </div>
                  {previewMeta?.route === "allocation" &&
                  previewMeta?.isFx &&
                  previewMeta?.spreadFeeRlusd > 0 ? (
                      <div className="text-[10px] text-white/45">
                        {t("ui_spread_fee_6c2a8d5e1b", "Conversion fee (1%)")}:{" "}
                        {formatAmountWithSymbol(locale, previewMeta.spreadFeeRlusd, "USD", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </div>
                  ) : null}
                </div>

                {previewState.status === "loading" ? (
                  <div className="text-[11px] text-white/50">
                    {t("ui_loading_market_data_1d5d6ed3c4", "Refreshing market data...")}
                  </div>
                ) : null}

                {previewState.status === "error" ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {previewState.error}
                  </div>
                ) : null}

                {convertPreview ? (
                  <p className="text-[11px] text-white/60">
                    {convertPreview}
                  </p>
                ) : null}
              </div>
              </div>

              <div className={inline ? "mt-auto space-y-2 pt-2 border-t border-white/10" : ""}>
                {!effectiveIsConnected && !isPreviewMode ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onConnectWallet?.();
                    }}
                    className={`w-full mt-1 text-sm py-2.5 ${greenActionBtnBase}`}
                  >
                    {t("wallet_connect_cta", "Connect wallet")}
                  </button>
                ) : (
                  <>
                    <SwipeConfirmButton
                      label={convertButtonLabel}
                      onConfirm={handleConvertAction}
                      disabled={convertButtonDisabled}
                      variant="green"
                      className="mt-1 md:hidden"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertAction();
                      }}
                      className={`hidden md:block w-full mt-1 text-sm py-2.5 ${greenActionBtnBase}`}
                      disabled={convertButtonDisabled}
                    >
                      {convertButtonLabel}
                    </button>
                  </>
                )}

                {showDesktopWalletConvertNote ? (
                  <div className="text-[11px] text-white/55 leading-relaxed">
                    La conversion est disponible pour les devises actives.
                    Activez simplement la devise de votre choix pour effectuer une conversion.
                  </div>
                ) : null}

                
              </div>
            </div> :

        <div className={`space-y-3 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}>
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] font-semibold text-white/80">{t("ui_available_currencies_267b159a9a", "Available currencies")}

            </div>
                {!canMutateLines &&
            <p className="mt-1 text-[10px] text-white/45">
                  {!effectiveIsConnected ?
              t("ui_connect_your_wallet_to_activ_ec68e6f427", "Connect your wallet to activate currency lines.") :
              isWalletActivated === false ?
              t("ui_wallet_activation_required_f4", "Wallet must be activated to create currency lines.") :
	              t("ui_trustlines_required_currency_lines_f4", "USD trustline is required to create currency lines.")}
                </p>
            }

                <div className="mt-2 grid grid-cols-1 gap-2">
	                  <WalletCurrencySelector
	                value={activateCurrencyCode}
	                onChange={setActivateCurrencyCode}
	                placeholder={t("ui_select_a_currency_to_activat_776d6af637", "Select a currency to activate...")}
	                quickOptions={suggestedCurrencies}
	                excludeCodes={["USD"]}
	                showQuickAdd={false} />

                  {isLineAlreadyActive ? (
                    <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/90">
                      {t(
                        "ui_currency_line_already_active_5df2d3b1a8",
                        "Ligne de compte déjà active"
                      )}
                    </div>
                  ) : null}

                  <SwipeConfirmButton
                label={t("ui_activate_currency_line_32843c5eeb", "Activate currency line")}
                onConfirm={handleActivateLine}
                disabled={activateLineDisabled}
                variant="green"
                className="md:hidden" />
                  <button
                type="button"
                disabled={activateLineDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivateLine();
                }}
                className={`hidden md:block w-full px-3 py-2 text-xs ${greenActionBtnBase}`}>{t("ui_activate_currency_line_32843c5eeb", "Activate currency line")}


              </button>
                </div>
              </div>

              <WalletDashboardCurrencyLinesPanel
            currencyLinesLoading={currencyLinesLoading}
            currencyLinesError={currencyLinesError}
            currencyLinesSummary={currencyLinesSummary}
            currencyLines={currencyLines}
            selectIconByCurrency={selectIconByCurrency}
            onRefresh={refreshCurrencyLines}
            onDelete={handleDeleteLine}
            inline={inline}
            className={inline ? "flex-1 min-h-0" : ""} />


            </div>
        }
          </div>
          </div>
          {view === "lines" ? (
            <div className="border-t border-white/10 px-4 md:px-5 py-2 text-[10px] text-white/45">
              {t(
                "ui_currency_lines_footer_tip_f4",
                "Besoin d'une nouvelle devise ? Activez une ligne en quelques secondes."
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>;


  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
