"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import WalletDashboardCurrencyLinesPanel from "../components/WalletDashboardCurrencyLinesPanel";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { apiUrl } from "@/lib/runtimeConfig";
import XummQRModal from "@/components/xumm/XummQRModal";
import { computeSpreadQuote, isFxConversion } from "@/utils/walletSpread";

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
  walletAddress,
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
  activationFeeRlusd,
  simulateDexInDemo = false,
  inline = false
}) {
  const { t } = useTranslation("common");
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const blueActionBtnBase =
    "rounded-lg border border-[#06B6D4]/40 bg-[#06B6D4]/80 text-black font-semibold transition-all duration-200 hover:bg-[#06B6D4] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const blueActionBtnMuted =
    "rounded-lg border border-[#06B6D4]/30 bg-[#06B6D4]/10 text-[#06B6D4]/70 font-semibold transition-all duration-200 hover:bg-[#06B6D4]/20 hover:text-[#06B6D4] hover:scale-105 active:scale-95";
  const blueTabInactive =
    "rounded-lg border border-[#06B6D4]/40 bg-transparent text-white/60 font-semibold transition-all duration-200 hover:border-[#06B6D4]/60 hover:text-white/80";
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

  const suggestedCurrencies = useMemo(
    () => ["EUR", "USD", "GBP", "CHF", "CAD", "AED", "SAR", "XOF", "XAF", "JPY"],
    []
  );

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
  const activationFeeLabel = useMemo(() => {
    const value = Number(activationFeeRlusd);
    const safe = Number.isFinite(value) && value > 0 ? value : 1;
    return safe.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }, [activationFeeRlusd]);
  const previewRequestId = useRef(0);
  const [previewState, setPreviewState] = useState({ status: "idle", error: null });
  const [previewAmount, setPreviewAmount] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);
  const [dexModalData, setDexModalData] = useState(null);
  const [dexSubmitting, setDexSubmitting] = useState(false);
  const [dexConfirming, setDexConfirming] = useState(false);
  const [dexError, setDexError] = useState(null);

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

  const isXrplCore = (code) => code === "XRP" || code === "XCS";
  const sameCurrencySelected = Boolean(baseCode && quoteCode && baseCode === quoteCode);

  const conversionRoute = useMemo(() => {
    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return { type: "none" };
    }

    const dexEligible =
      (isXrplCore(baseCode) && quoteCode === "RLUSD") ||
      (baseCode === "RLUSD" && isXrplCore(quoteCode));

    if (dexEligible) {
      const xrplBase = isXrplCore(baseCode) ? baseCode : quoteCode;
      const side = baseCode === "RLUSD" ? "buy" : "sell";
      const amountType = baseCode === "RLUSD" ? "quote" : "base";
      const outputCurrency = baseCode === "RLUSD" ? quoteCode : "RLUSD";
      return {
        type: "dex",
        dex: {
          pair: `${xrplBase}/RLUSD`,
          side,
          amountType,
          outputCurrency,
        },
      };
    }

    if (isXrplCore(baseCode) || isXrplCore(quoteCode)) {
      return {
        type: "unsupported",
        error: t(
          "ui_xrpl_bridge_required_1a2b3c4d5e",
          "XRPL assets require RLUSD as an intermediary."
        ),
      };
    }

    return { type: "allocation" };
  }, [baseCode, quoteCode, t]);

  const demoDexFallback = simulateDexInDemo && conversionRoute.type === "dex";
  const effectiveRouteType = demoDexFallback ? "allocation" : conversionRoute.type;

  const formatAmount = (value, digits = 6) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    return num.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: digits,
    });
  };

  const requestJson = async (path, { method = "GET", body } = {}) => {
    const res = await fetch(apiUrl(path), {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : null,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || data.message || "Request failed");
    }
    return data;
  };

  useEffect(() => {
    if (!open) return;
    setDexError(null);
    setPreviewState({ status: "idle", error: null });
    setPreviewAmount(null);
    setPreviewMeta(null);

    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return;
    }

    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      return;
    }

    if (effectiveRouteType === "unsupported") {
      setPreviewState({ status: "error", error: conversionRoute.error });
      return;
    }

    if (effectiveRouteType === "allocation") {
      const rlusdPerBase = baseCode === "RLUSD"
        ? 1
        : Number(rlusdPerUnitRates?.[baseCode]);
      const rlusdPerQuote = quoteCode === "RLUSD"
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
      return;
    }

    if (effectiveRouteType === "dex") {
      const requestId = ++previewRequestId.current;
      setPreviewState({ status: "loading", error: null });

      const timeoutId = setTimeout(async () => {
        try {
          const data = await requestJson("/dex/orders/preview", {
            method: "POST",
            body: {
              pair: conversionRoute.dex.pair,
              side: conversionRoute.dex.side,
              amountType: conversionRoute.dex.amountType,
              baseAmount: conversionRoute.dex.amountType === "base" ? amountValue : undefined,
              quoteAmount: conversionRoute.dex.amountType === "quote" ? amountValue : undefined,
              slippageBps: 100,
            },
          });
          if (previewRequestId.current !== requestId) return;
          if (!data?.liquidityOk) {
            setPreviewState({
              status: "error",
              error: t(
                "ui_no_liquidity_order_8b7a2d9f1c",
                "No liquidity available for this amount."
              ),
            });
            return;
          }
          const outputAmount =
            conversionRoute.dex.amountType === "quote"
              ? data.baseAmount
              : data.quoteAmount;
          setPreviewState({ status: "done", error: null });
          setPreviewAmount(outputAmount);
          setPreviewMeta({
            route: "dex",
            worstPrice: data.worstPrice,
            avgPrice: data.avgPrice,
          });
        } catch (error) {
          if (previewRequestId.current !== requestId) return;
          setPreviewState({
            status: "error",
            error: error?.message || "Preview unavailable",
          });
        }
      }, 250);

      return () => clearTimeout(timeoutId);
    }
  }, [
    amountValue,
    baseCode,
    conversionRoute,
    effectiveRouteType,
    open,
    quoteCode,
    rlusdPerUnitRates,
    t,
  ]);

  const handleDexSubmit = async () => {
    if (conversionRoute.type !== "dex") return;
    if (!Number.isFinite(amountValue) || amountValue <= 0) {
      setDexError(
        t("ui_invalid_amount_45a9c0c3df", "Enter a valid amount.")
      );
      return;
    }
    if (!walletAddress || !effectiveIsConnected) {
      setDexError(
        t("ui_wallet_required_trade_18f7e1d2a9", "Connect your wallet to trade.")
      );
      return;
    }

    setDexSubmitting(true);
    setDexError(null);
    try {
      const data = await requestJson("/dex/orders", {
        method: "POST",
        body: {
          address: walletAddress,
          pair: conversionRoute.dex.pair,
          side: conversionRoute.dex.side,
          amountType: conversionRoute.dex.amountType,
          baseAmount: conversionRoute.dex.amountType === "base" ? amountValue : undefined,
          quoteAmount: conversionRoute.dex.amountType === "quote" ? amountValue : undefined,
          slippageBps: 100,
          returnUrl: window.location.href,
        },
      });
      setDexModalData({
        orderId: data.orderId,
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
      });
      setConvertAmount("");
    } catch (error) {
      setDexError(error?.message || "Failed to create order");
    } finally {
      setDexSubmitting(false);
    }
  };

  const handleDexConfirm = async () => {
    if (!dexModalData?.orderId || !dexModalData?.uuid) return;
    setDexConfirming(true);
    try {
      await requestJson("/dex/orders/confirm", {
        method: "POST",
        body: {
          orderId: dexModalData.orderId,
          uuid: dexModalData.uuid,
        },
      });
    } catch (error) {
      setDexError(error?.message || "Failed to confirm order");
    } finally {
      setDexConfirming(false);
      setDexModalData(null);
    }
  };

  const isDexRoute = effectiveRouteType === "dex";
  const convertButtonDisabled = isDexRoute
    ? dexSubmitting ||
      dexConfirming ||
      previewState.status !== "done" ||
      !effectiveIsConnected ||
      sameCurrencySelected
    : convertProcessing ||
      !convertBaseCurrency ||
      !convertQuoteCurrency ||
      !convertAmount ||
      sameCurrencySelected ||
      effectiveRouteType !== "allocation";
  const convertButtonLabel = isDexRoute
    ? dexSubmitting
      ? t("ui_preparing_67f5f84ff4", "Preparing...")
      : t("ui_convert_8408e969ec", "Convert")
    : convertProcessing
      ? t("ui_converting_71c2b9a4e5", "Converting...")
      : isPreviewMode
        ? t("ui_convert_8408e969ec", "Convert")
        : t("ui_convert_allocation_6b2c1a9d5e", "Convert allocation");
  const handleConvertAction = () => {
    if (isDexRoute) {
      handleDexSubmit();
      return;
    }
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

  if (!open) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel border border-white/10 overflow-hidden flex flex-col min-h-0 pointer-events-auto",
    inline ? "h-full max-h-none rounded-xl" : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" && walletId === "B" ? "bg-[#0b1017]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
  ].join(" ");

  const content =
  <>
      {/* Backdrop */}
      {!inline ? (
        <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose} />
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
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                {view === "lines"
                  ? t("ui_manage_currency_lines_4d1a1c9f9e", "Manage currency lines")
                  : t("ui_convert_assets_cfc8bae6b0", "Convert assets")}
              </h3>
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-xcannes-green text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
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
                    "RLUSD not activated. Authorize RLUSD on your wallet."
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
                    view === "convert" ? blueActionBtnMuted : blueTabInactive
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
                    view === "lines" ? blueActionBtnMuted : blueTabInactive
                  }`}
                >
                  {t("ui_currency_lines_267fc2eff3", "Currency lines")}
                </button>
              </div>
            ) : null}

          {view === "convert" ?
        <div className={`space-y-3 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}>
              <div className={useDesktopWalletConvertLayout
                ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-4"
                : inline
                ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(12px,2.2vh,26px)]"
                : "space-y-3"}>
              <div className={useDesktopWalletConvertLayout ? "space-y-4" : inline ? "space-y-3" : ""}>
              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_base_6d4184e1ef", "Base")}

            </label>
                <ModalSelect
              value={convertBaseCurrency}
              onChange={setConvertBaseCurrency}
              options={(swapCurrencyOptions || [])
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
              buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#06B6D4]/80 appearance-none cursor-pointer"
              menuClassName="bg-elevated"
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#06B6D4]/80 appearance-none cursor-pointer"
            />
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_quote_e3761255be", "Quote")}

            </label>
                <ModalSelect
              value={convertQuoteCurrency}
              onChange={setConvertQuoteCurrency}
              options={(swapCurrencyOptions || [])
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
              buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#06B6D4]/80 appearance-none cursor-pointer"
              menuClassName="bg-elevated"
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-[#06B6D4]/80 appearance-none cursor-pointer"
            />
              </div>

              <div>
                <label className="block text-[11px] md:text-xs text-white/60 mb-1">{t("ui_amount_52a20b2992", "Amount")}

            </label>
              <TokenAmountInput
              value={convertAmount}
              onChange={setConvertAmount}
              placeholder="0.0000"
              token={convertBaseCurrency || "XRP"}
              tokenClassName="text-white"
              containerClassName="focus-within:!border-[#06B6D4]/80" />
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
                  <div className="text-sm text-primary">
                    {formatAmount(previewAmount, 6)} {convertQuoteCurrency || "-"}
                  </div>
                  {previewMeta?.route === "dex" ? (
                    <div className="text-[10px] text-white/45">
                      {"IOC"}
                      {" · "}
                      {t("ui_slippage_1pct_0fdafce1d0", "Slippage")} 1%
                    </div>
                  ) : null}
                  {previewMeta?.route === "allocation" &&
                  previewMeta?.isFx &&
                  previewMeta?.spreadFeeRlusd > 0 ? (
                      <div className="text-[10px] text-white/45">
                        {t("ui_spread_fee_6c2a8d5e1b", "Spread")}:{" "}
                        {previewMeta.spreadPercent.toFixed(2)}% (≈{" "}
                        {formatAmount(previewMeta.spreadFeeRlusd, 6)}{" "}
                        {"RLUSD"}
                        {")"}
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

                {dexError ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[11px] text-red-200">
                    {dexError}
                  </div>
                ) : null}

                {isDexRoute && isPreviewMode ? (
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-[11px] text-amber-200">
                    {t(
                      "ui_wallet_required_trade_18f7e1d2a9",
                      "Connect your wallet to trade."
                    )}
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
                    className={`w-full mt-1 text-sm py-2.5 ${blueActionBtnBase}`}
                  >
                    {t("wallet_connect_cta", "Connect wallet")}
                  </button>
                ) : (
                  <>
                    <SwipeConfirmButton
                      label={convertButtonLabel}
                      onConfirm={handleConvertAction}
                      disabled={convertButtonDisabled}
                      variant="cyan"
                      className="mt-1 md:hidden"
                    />
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertAction();
                      }}
                      className={`hidden md:block w-full mt-1 text-sm py-2.5 ${blueActionBtnBase}`}
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

                {!isPreviewMode &&
            <div className="text-[10px] text-white/45">{t("ui_tip_use_the_b06aa04f1f", "Tip: use the")}
              <span className="font-mono">{t("ui_currency_lines_267fc2eff3", "Currency lines")}</span>{" "}{t("ui_tab_to_add_activate_new_line_1965097add", "tab to add/activate new lines.")}

            </div>
            }
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
              t("ui_trustlines_required_currency_lines_f4", "RLUSD trustline is required to create currency lines.")}
                </p>
            }

                <div className="mt-2 grid grid-cols-1 gap-2">
                  <WalletCurrencySelector
                value={activateCurrencyCode}
                onChange={setActivateCurrencyCode}
                placeholder={t("ui_select_a_currency_to_activat_776d6af637", "Select a currency to activate...")}
                quickOptions={suggestedCurrencies}
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
                variant="cyan"
                className="md:hidden" />
                  <button
                type="button"
                disabled={activateLineDisabled}
                onClick={(e) => {
                  e.stopPropagation();
                  handleActivateLine();
                }}
                className={`hidden md:block w-full px-3 py-2 text-xs ${blueActionBtnBase}`}>{t("ui_activate_currency_line_32843c5eeb", "Activate currency line")}


              </button>
                </div>
                <p className="mt-2 text-[10px] text-white/45">
                  {t("ui_activation_fee_xcs_company_wallet_f4", {
                    defaultValue:
                      "Activation fee: {{amount}} RLUSD.",
                    amount: activationFeeLabel,
                  })}
                </p>
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
      <XummQRModal
        isOpen={Boolean(dexModalData?.uuid)}
        onClose={() => setDexModalData(null)}
        uuid={dexModalData?.uuid}
        qrUrl={dexModalData?.qrUrl}
        deepLink={dexModalData?.deepLink}
        type="sign"
        onSuccess={handleDexConfirm}
        zIndexClassName="z-[11000]"
        inline={inline}
      />
    </>;


  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
