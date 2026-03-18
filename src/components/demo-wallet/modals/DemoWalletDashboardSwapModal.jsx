"use client";

import { useEffect, useMemo, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import {
  DEMO_CURRENCY_LINE_ORDER,
  formatAmountWithSymbol,
  getCurrencyFlag,
  getDisplayCurrencyCode,
} from "../demoWalletDashboardConfig";
import { CRYPTO_ICONS } from "../utils/demoMarketConstants";
import { computeSpreadQuote, isFxConversion } from "../utils/demoWalletSpread";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./demoWalletModalTokens";

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

  const suggestedCurrencies = useMemo(() => {
    const base = Array.isArray(DEMO_CURRENCY_LINE_ORDER)
      ? DEMO_CURRENCY_LINE_ORDER
      : [];
    return base.filter((code) => {
      const upper = String(code || "").toUpperCase();
      return upper && upper !== "USD" && upper !== "RLUSD";
    });
  }, []);

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
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl",
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
          }}
        >
          <div
            className="flex-1 min-h-0 flex flex-col p-4 md:p-5 space-y-4"
          >
            <div className="flex items-start justify-between gap-3 mb-1 pr-6">
              <div className="flex min-w-0 flex-col gap-1.5">
                <div>
                  {renderWalletMeta?.(
                    "pr-8 wallet-meta--plus-4 wallet-meta--desktop-gap",
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                }}
                className="wallet-modal-close md:absolute md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
              >
                ✕
              </button>
            </div>
            <div
              className={
                inline
                  ? "wallet-tab-unfold-in flex-1 min-h-0 flex flex-col"
                  : "wallet-tab-unfold-in"
              }
            >
              <div className="flex flex-col gap-4">
                {/* ── SECTION 1: Currency selection ───────────────────────── */}
                <div className="space-y-3">
                  <div>
                    <div className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                      {t("ui_from_label_short", "De")}
                    </div>
                    <ModalSelect
                      value={convertBaseCurrency}
                      onChange={setConvertBaseCurrency}
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
                      showMobileOptionRight={true}
                      iconClassName="text-3xl leading-none"
                      buttonClassName="bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150"
                      menuClassName={
                        noticeVariant === "demo"
                          ? "bg-xcannes-surface-demo"
                          : "bg-elevated"
                      }
                      selectClassName="xcannes-select w-full bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150"
                    />
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const prevBase = convertBaseCurrency;
                        const prevQuote = convertQuoteCurrency;
                        if (!prevBase || !prevQuote) return;
                        setConvertBaseCurrency(prevQuote);
                        setConvertQuoteCurrency(prevBase);
                      }}
                      className="h-10 w-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset hover:bg-white/10 hover:ring-white/20 transition-colors duration-150 flex items-center justify-center text-white/70"
                      aria-label={t("ui_swap_currencies", "Inverser")}
                      title={t("ui_swap_currencies", "Inverser")}
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={2}
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M7 10h10M7 10l3-3M7 10l3 3M17 14H7m10 0l-3-3m3 3l-3 3"
                        />
                      </svg>
                    </button>
                  </div>

                  <div>
                    <div className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                      {t("ui_to_label_short", "Vers")}
                    </div>
                    <ModalSelect
                      value={convertQuoteCurrency}
                      onChange={setConvertQuoteCurrency}
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
                      showMobileOptionRight={true}
                      iconClassName="text-3xl leading-none"
                      buttonClassName="bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150"
                      menuClassName={
                        noticeVariant === "demo"
                          ? "bg-xcannes-surface-demo"
                          : "bg-elevated"
                      }
                      selectClassName="xcannes-select w-full bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150"
                    />
                  </div>

                  <div className="pt-1">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-white/35 mb-2">
                      {t("ui_other_currency_d8e1f2a3b4", "Autre devise")}
                    </div>
                    <WalletCurrencySelector
                      value=""
                      onChange={(code) => {
                        if (code) setConvertQuoteCurrency(code);
                      }}
                      placeholder={t(
                        "ui_search_all_currencies_c5d6e7f8",
                        "Search all currencies...",
                      )}
                      quickOptions={suggestedCurrencies}
                      excludeCodes={["USD", "RLUSD", "XRP"]}
                      showQuickAdd={true}
                      buttonClassName="w-full bg-white/3 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-base text-white/80 flex items-center justify-between gap-2 hover:ring-white/20 transition-colors duration-150"
                    />
                  </div>
                </div>

                {/* ── SECTION 2: Amount input ─────────────────────────────── */}
                <div className="space-y-2">
                  <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                    {t("ui_amount_52a20b2992", "Montant")}
                  </div>
                  <TokenAmountInput
                    value={convertAmount}
                    onChange={setConvertAmount}
                    placeholder="0.0000"
                    token={
                      selectLabelByCurrency?.[convertBaseCurrency] ||
                      convertBaseCurrency ||
                      "USD"
                    }
                    tokenClassName="text-white text-base"
                    containerClassName="rounded-xl px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset focus-within:ring-2 focus-within:ring-xcannes-green/60 transition-colors duration-150"
                  />
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
                    <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] space-y-3">
                    <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                      {t("ui_summary_title_d4e5f6a7b8", "Résumé")}
                    </div>
                    <div className="text-sm text-white/70">
                      {t("ui_you_receive", "Vous recevez")}
                    </div>
                    {Number.isFinite(previewAmount) &&
                    previewAmount > 0 &&
                    Number.isFinite(amountValue) &&
                    amountValue > 0 &&
                    baseCode &&
                    quoteCode ? (
                      <>
                        <div className="text-2xl font-semibold text-white">
                          {formatAmountWithSymbolLocal(previewAmount, quoteCode, {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 6,
                          })}
                        </div>
                        {previewMeta?.route === "allocation" &&
                        previewMeta?.isFx &&
                        previewMeta?.spreadFeeRlusd > 0 ? (
                          <div className="text-sm text-white/60 pt-2 mt-2 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
                            {t("statement_conversion_fee_label", "Frais")}
                            {" : "}
                            {formatAmountWithSymbol(
                              locale,
                              previewMeta.spreadFeeRlusd,
                              "USD",
                              {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              },
                            )}
                          </div>
                        ) : null}
                        {Number.isFinite(Number(unitRate)) && unitRate > 0 ? (
                          <div className="text-xs text-white/50">
                            {`1 ${getDisplayCurrencyCode(baseCode)} = ${Number(
                              unitRate,
                            ).toLocaleString(locale, {
                              minimumFractionDigits: 0,
                              maximumFractionDigits: 6,
                            })} ${getDisplayCurrencyCode(quoteCode)}`}
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <div className="text-base text-white/40">—</div>
                    )}
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
                  <SwipeConfirmButton
                    label={convertButtonLabel}
                    onConfirm={handleConvertAction}
                    disabled={convertButtonDisabled}
                    variant="green"
                    className="md:hidden"
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleConvertAction();
                    }}
                    className={`hidden md:block w-full text-xl py-3 ${greenActionBtnBase}`}
                    disabled={convertButtonDisabled}
                  >
                    {convertButtonLabel}
                  </button>
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
