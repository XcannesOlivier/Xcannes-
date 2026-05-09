"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import {
  formatAmountWithSymbol,
  getCurrencyFlag,
  getDisplayCurrencyCode,
} from "../demoWalletDashboardConfig";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { computeSpreadQuote, isFxConversion } from "../utils/demoWalletSpread";
import { useModalTransition } from "@/hooks/useModalTransition";
import {
  modalSelectButtonCls,
  modalSelectListCls,
} from "./demoWalletModalTokens";

export default function DemoWalletDashboardSwapModal({
  open,
  onClose,
  renderWalletMeta,
  isPreviewMode,
  noticeVariant = "preview",
  swapCurrencyOptions,
  convertBaseCurrency,
  setConvertBaseCurrency,
  convertQuoteCurrency,
  setConvertQuoteCurrency,
  convertAmount,
  setConvertAmount,
  convertPreview,
  handleDemoConvert,
  convertProcessing,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const modalPanelRef = useRef(null);
  const [baseDropdownOpen, setBaseDropdownOpen] = useState(false);
  const [quoteDropdownOpen, setQuoteDropdownOpen] = useState(false);
  const [swapRotating, setSwapRotating] = useState(false);

  const getIconForCode = (code) => {
    if (selectIconByCurrency?.[code]) return selectIconByCurrency[code];
    const display = getDisplayCurrencyCode(code);
    if (CRYPTO_ICONS?.[display]) return { src: CRYPTO_ICONS[display], alt: display };
    return getCurrencyFlag(display);
  };

  const swapCurrencyOptionsSanitized = useMemo(() => {
    const base = (swapCurrencyOptions || []).filter(
      (code) =>
        String(code || "")
          .trim()
          .toUpperCase() !== "RLUSD",
    );
    // Include the currently-selected quote even if not yet in the wallet
    const quoteUpper = String(convertQuoteCurrency || "").trim().toUpperCase();
    if (
      quoteUpper &&
      quoteUpper !== "RLUSD" &&
      !base.some((c) => String(c).toUpperCase() === quoteUpper)
    ) {
      base.push(quoteUpper);
    }
    return base;
  }, [swapCurrencyOptions, convertQuoteCurrency]);

  const [previewState, setPreviewState] = useState({
    status: "idle",
    error: null,
  });
  const [previewAmount, setPreviewAmount] = useState(null);
  const [previewMeta, setPreviewMeta] = useState(null);

  const baseCode = useMemo(
    () =>
      String(convertBaseCurrency || "")
        .trim()
        .toUpperCase(),
    [convertBaseCurrency],
  );
  const quoteCode = useMemo(
    () =>
      String(convertQuoteCurrency || "")
        .trim()
        .toUpperCase(),
    [convertQuoteCurrency],
  );
  const amountValue = useMemo(
    () => Number.parseFloat(convertAmount || ""),
    [convertAmount],
  );

  // RLUSD est traité comme devise de base (peg 1:1 avec USD) pour les conversions "allocation".
  const sameCurrencySelected = Boolean(
    baseCode && quoteCode && baseCode === quoteCode,
  );

  const conversionRoute = useMemo(() => {
    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return { type: "none" };
    }

    return { type: "allocation" };
  }, [baseCode, quoteCode]);

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
            "Rate unavailable for base currency.",
          ),
        });
        return;
      }
      if (!Number.isFinite(rlusdPerQuote) || rlusdPerQuote <= 0) {
        setPreviewState({
          status: "error",
          error: t(
            "ui_rate_unavailable_quote_8b2c1a9d5e",
            "Rate unavailable for quote currency.",
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

  const unitRate = useMemo(() => {
    if (!baseCode || !quoteCode) return null;
    if (baseCode === quoteCode) return null;
    const isPeggedToUsd = (code) => code === "RLUSD" || code === "USD";
    const rlusdPerBase = isPeggedToUsd(baseCode)
      ? 1
      : Number(rlusdPerUnitRates?.[baseCode]);
    const rlusdPerQuote = isPeggedToUsd(quoteCode)
      ? 1
      : Number(rlusdPerUnitRates?.[quoteCode]);
    if (!Number.isFinite(rlusdPerBase) || rlusdPerBase <= 0) return null;
    if (!Number.isFinite(rlusdPerQuote) || rlusdPerQuote <= 0) return null;
    return rlusdPerBase / rlusdPerQuote;
  }, [baseCode, quoteCode, rlusdPerUnitRates]);

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
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal wallet-modal-no-top-highlight-mobile overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen rounded-none",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const content = (
    <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
          ref={modalPanelRef}
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <div
            className="flex-1 min-h-0 flex flex-col p-4 space-y-4"
          >
            {!inline ? (
              <div className="flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose?.();
              }}
              className="sr-only"
            >
              {t("ui_close", "Fermer")}
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              {noticeVariant === "demo" ? (
                <span className="inline-flex items-center text-white/80 text-sm font-semibold px-2 py-1 leading-none">
                  {t("demo_notice_title", "Mode démo")}
                </span>
              ) : null}
            </div>
            <div
              className={
                inline
                  ? "wallet-tab-unfold-in flex-1 min-h-0 flex flex-col"
                  : "wallet-tab-unfold-in"
              }
            >
              <div className="flex flex-col gap-4">
                <div className="text-center relative z-[70]">
                  <h3 className="text-[30px] font-bold text-white/95 tracking-tight">
                    {t("ui_convert_title_main", "Convertissez vos devises")}
                  </h3>
                  <p className="mt-2 text-[14px] text-white/80 max-w-[34ch] mx-auto leading-relaxed">
                    {t(
                      "ui_convert_subtitle_main",
                      "Choisissez les devises et le montant à convertir.",
                    )}
                  </p>
                  <div className="mt-2 flex justify-center">
                    <div
                      className={`rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-5 py-2 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)] ${
                        baseDropdownOpen || quoteDropdownOpen
                          ? "ring-white/20"
                          : ""
                      }`}
                    >
                      <div className="text-[11px] text-white/45 text-center">
                        {t("moonpay_from_account", "Compte source")}
                      </div>
                      <div className="mt-1 flex justify-center">
                        {renderWalletMeta?.("text-center [&_.font-mono]:hidden")}
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── SECTION 1: Currency selection ───────────────────────── */}
                <div className="space-y-3">
                  <div className={`relative ${quoteDropdownOpen ? "z-[70]" : "z-[65]"}`}>
                    <div className="flex items-center justify-between mb-2 relative z-[50]">
                      <div className="text-[13px] tracking-normal font-medium text-white/55">
                        {t("ui_convert_from_label", "Vous convertissez")}
                      </div>
                    </div>
                    <ModalSelect
                      value={convertBaseCurrency}
                      onChange={setConvertBaseCurrency}
                      onOpenChange={setBaseDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const labelLeft = selectLabelByCurrency?.[code] || code;
                        const labelRight = selectLabelRightByCurrency?.[code] || null;
                        return {
                          value: code,
                          icon: getIconForCode(code),
                          label: labelLeft,
                          labelLeft,
                          labelRight,
                          labelMobile:
                            selectLabelMobileByCurrency?.[code] || labelLeft,
                        };
                      })}
                      useNativeSelect={false}
                      hideSelected
                      showMobileOptionRight={true}
                      iconClassName="text-3xl leading-none"
                      optionIconClassName="text-2xl leading-none opacity-60"
                      optionClassName="py-2 !text-base !text-white/60"
                      menuHeader={t("ui_your_balances_header", "Vos soldes")}
                      backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[45]"
                      buttonClassName={modalSelectButtonCls}
                      openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                      menuClassName={
                        noticeVariant === "demo"
                          ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]"
                          : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]"
                      }
                      selectClassName={modalSelectListCls}
                    />
                  </div>

                  <div
                    className={`relative ${
                      quoteDropdownOpen ? "z-[70]" : "z-[65]"
                    } transition-all duration-200 ${
                      baseDropdownOpen
                        ? "opacity-0 max-h-0 overflow-hidden !my-0"
                        : "opacity-100"
                    }`}
                  >
                    <div className="flex items-center gap-3 px-2 pb-2 text-white/45">
                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
                      <span className="relative -top-px text-[11px] tracking-[0.02em] whitespace-nowrap leading-none">
                        {Number.isFinite(Number(unitRate)) && unitRate > 0 && baseCode && quoteCode
                          ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(
                              unitRate,
                            ).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 4,
                            })} ${getDisplayCurrencyCode(quoteCode)}`
                          : "—"}
                      </span>
                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
                    </div>

                    <div className="relative mb-6">
                      <TokenAmountInput
                        value={convertAmount}
                        onChange={setConvertAmount}
                        placeholder="0.00"
                        token={
                          selectLabelByCurrency?.[convertBaseCurrency] ||
                          convertBaseCurrency ||
                          "USD"
                        }
                        tokenClassName="text-white/70 drop-shadow-sm text-2xl font-semibold"
                        containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-amount-shimmer [&_input]:!text-4xl [&_input]:font-bold [&_input]:placeholder:text-white/35"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSwapRotating(true);
                          window.setTimeout(() => setSwapRotating(false), 420);
                          const prevBase = convertBaseCurrency;
                          const prevQuote = convertQuoteCurrency;
                          if (!prevBase || !prevQuote) return;
                          setConvertBaseCurrency(prevQuote);
                          setConvertQuoteCurrency(prevBase);
                        }}
                        className={`absolute left-1/2 bottom-0 translate-y-1/2 -translate-x-1/2 z-20 w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 hover:brightness-125 ${
                          swapRotating ? "scale-90" : ""
                        }`}
                        style={{
                          background:
                            "linear-gradient(160deg, #1a1f22 0%, #111518 100%)",
                          boxShadow:
                            "0 0 0 1px rgba(255,255,255,0.09), 0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -6px 12px rgba(0,0,0,0.35)",
                        }}
                        aria-label={t("ui_swap_currencies", "Inverser")}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="rgba(255,255,255,0.65)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          style={{
                            transform: swapRotating
                              ? "rotate(180deg)"
                              : "rotate(0deg)",
                            transition:
                              "transform 380ms cubic-bezier(0.34,1.56,0.64,1)",
                          }}
                          aria-hidden="true"
                        >
                          <polyline points="17 1 21 5 17 9" />
                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                          <polyline points="7 23 3 19 7 15" />
                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div className={quoteDropdownOpen ? "relative z-[65]" : "relative"}>
                    <div
                      className={`flex items-center justify-between mb-2 relative ${
                        quoteDropdownOpen ? "z-[65]" : "z-[41]"
                      }`}
                    >
                      <div className="text-[13px] tracking-normal font-medium text-white/55">
                        {t("ui_convert_to_label", "Vous recevez")}
                      </div>
                    </div>
                    <ModalSelect
                      value={convertQuoteCurrency}
                      onChange={setConvertQuoteCurrency}
                      onOpenChange={setQuoteDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const labelLeft = selectLabelByCurrency?.[code] || code;
                        const labelRight = selectLabelRightByCurrency?.[code] || null;
                        return {
                          value: code,
                          icon: getIconForCode(code),
                          label: labelLeft,
                          labelLeft,
                          labelRight,
                          labelMobile:
                            selectLabelMobileByCurrency?.[code] || labelLeft,
                        };
                      })}
                      useNativeSelect={false}
                      hideSelected
                      showMobileOptionRight={true}
                      iconClassName="text-3xl leading-none"
                      optionIconClassName="text-2xl leading-none opacity-60"
                      optionClassName="py-2 !text-base !text-white/60"
                      menuHeader={t("ui_your_balances_header", "Vos soldes")}
                      backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[45]"
                      buttonClassName={modalSelectButtonCls}
                      openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                      menuFooter={
                        <div className="px-3 pb-3 pt-2 border-t border-white/10">
                          <WalletCurrencySelector
                            value=""
                            onChange={(code) => {
                              if (code) setConvertQuoteCurrency(code);
                            }}
                            fullscreenPortalTarget={modalPanelRef.current}
                            placeholder={t(
                              "ui_search_all_currencies_c5d6e7f8",
                              "Search all currencies...",
                            )}
                            excludeCodes={["USD", "RLUSD", "XRP"]}
                            showQuickAdd={false}
                            fullscreen={true}
                            buttonClassName="w-full bg-white/3 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white/80 flex items-center justify-between gap-2 hover:ring-white/20 transition-colors duration-150"
                          />
                        </div>
                      }
                      menuClassName={
                        noticeVariant === "demo"
                          ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]"
                          : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]"
                      }
                      selectClassName={modalSelectListCls}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  {sameCurrencySelected ? (
                    <div className="rounded-lg ring-1 ring-amber-300/30 ring-inset bg-amber-300/10 px-3 py-2 text-xs text-amber-100/90">
                      {t(
                        "ui_convert_same_asset_warning_6f13d5c9c2",
                        "Veuillez choisir 2 actifs différents.",
                      )}
                    </div>
                  ) : null}

                  {/* ── SECTION 3: Summary ─────────────────────────────── */}
                  <div className="rounded-[16px] overflow-hidden">
                    <div className="flex flex-col gap-0.5 px-6 pt-2 pb-2">
                      <span className="text-[11px] text-white/40 font-normal tabular-nums">
                        {t("statement_conversion_fee_label", "Frais")} —{" "}
                        {formatAmountWithSymbol(
                          locale,
                          Number(previewMeta?.spreadFeeRlusd || 0),
                          "USD",
                          { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                        )}
                      </span>
                      <span className="text-[11px] text-white/40 font-normal tabular-nums">
                        {t("ui_exchange_rate_label", "Taux de change")} —{" "}
                        {Number.isFinite(Number(unitRate)) && unitRate > 0 && baseCode && quoteCode
                          ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(unitRate).toLocaleString(
                              locale,
                              { minimumFractionDigits: 2, maximumFractionDigits: 4 },
                            )} ${getDisplayCurrencyCode(quoteCode)}`
                          : "—"}
                      </span>
                    </div>
                    <div className="px-3 mt-3 mb-0">
                      <div className="h-px bg-white/45 rounded-full" />
                    </div>
                    <div className="flex items-center justify-between px-4 pt-4 pb-4 mt-0.5 mx-1 mb-1 rounded-[12px]">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-[15px] text-white/45 font-normal tracking-[0.02em]">
                          {t("ui_total_received_label", "Total reçu")}
                        </span>
                      </div>
                      <span className="text-3xl text-white font-bold tracking-tight">
                        {quoteCode
                          ? formatAmountWithSymbolLocal(
                              Number.isFinite(previewAmount) && previewAmount > 0
                                ? previewAmount
                                : 0,
                              quoteCode,
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                            )
                          : "—"}
                      </span>
                    </div>
                  </div>

                  {previewState.status === "loading" ? (
                    <div className="text-xs text-white/60">
                      {t(
                        "ui_loading_market_data_1d5d6ed3c4",
                        "Refreshing market data...",
                      )}
                    </div>
                  ) : null}

                  {previewState.status === "error" ? (
                    <div className="rounded-lg ring-1 ring-red-500/30 ring-inset bg-red-500/10 px-3 py-2 text-xs text-red-200">
                      {previewState.error}
                    </div>
                  ) : null}

                  {convertPreview ? (
                    <p className="text-xs text-white/60">{convertPreview}</p>
                  ) : null}
                </div>

                <div className="pt-3 mt-1 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConvertAction();
                    }}
                    disabled={convertButtonDisabled}
                    className={[
                      "w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                      convertButtonDisabled
                        ? "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
                        : "text-white hover:scale-[1.01] hover:brightness-110 active:scale-[0.98] active:brightness-95",
                    ].join(" ")}
                    style={
                      convertButtonDisabled
                        ? undefined
                        : {
                            background:
                              "linear-gradient(180deg, #2da861 0%, #0d6b3a 100%)",
                            boxShadow:
                              "0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07) inset, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 18px rgba(0,0,0,0.22), 0 0 18px rgba(34,180,90,0.18)",
                          }
                    }
                  >
                    {convertButtonDisabled && !convertProcessing ? (
                      <span className="inline-flex items-center gap-1.5 text-white/20">
                        <span className="text-xs">
                          {t(
                            "ui_swap_fill_cta",
                            "Choisissez les devises et le montant",
                          )}
                        </span>
                        <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                          <span
                            className="swap-dot"
                            style={{ animationDelay: "0s" }}
                          >
                            ·
                          </span>
                          <span
                            className="swap-dot"
                            style={{ animationDelay: "0.6s" }}
                          >
                            ·
                          </span>
                          <span
                            className="swap-dot"
                            style={{ animationDelay: "1.2s" }}
                          >
                            ·
                          </span>
                        </span>
                      </span>
                    ) : convertProcessing ? (
                      convertButtonLabel
                    ) : (
                      `${t("ui_convert_cta_fr", "Convertir")}${
                        Number.isFinite(amountValue) && amountValue > 0 && baseCode
                          ? ` ${Number(amountValue).toLocaleString(locale, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 2,
                            })} ${getDisplayCurrencyCode(baseCode)}`
                          : ""
                      }`
                    )}
                  </button>
                  <style>{`
                    @keyframes swapDotBlink {
                      0%, 100% { opacity: 0.18; }
                      50% { opacity: 0.7; }
                    }
                    .swap-dot {
                      animation: swapDotBlink 2.4s ease-in-out infinite;
                      font-size: 1.3em;
                      line-height: 1;
                    }
                  `}</style>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
