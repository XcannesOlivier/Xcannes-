"use client";

import { useEffect, useMemo, useState } from "react";
import useIsDesktop from "../hooks/useIsDesktop";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { computeSpreadQuote, isFxConversion } from "@/utils/walletSpread";
import { useModalTransition } from "@/hooks/useModalTransition";
import {
  formatAmountWithSymbol,
  getCurrencyFlag,
  getDisplayCurrencyCode,
} from "../walletDashboardConfig";
import { CRYPTO_ICONS } from "@/utils/marketConstants";

export default function WalletDashboardSwapModal({
  open,
  onClose,
  renderWalletMeta,
  isPreviewMode,
  noticeVariant = "preview",
  dashboardVariant = "default",
  isConnected,
  isWalletActivated,
  onConnectWallet,
  hasOnChainRlusd,
  onActivateCurrencyLine,
  currencyLinesLoading,
  currencyLines,
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
  resetSwapForm,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const isDesktop = useIsDesktop();

  // Résout l'icône (drapeau) pour un code devise, y compris les devises
  // pas encore présentes dans le wallet (absentes de selectIconByCurrency).
  const getIconForCode = (code) => {
    if (selectIconByCurrency?.[code]) return selectIconByCurrency[code];
    const display = getDisplayCurrencyCode(code);
    if (CRYPTO_ICONS?.[display]) return { src: CRYPTO_ICONS[display], alt: display };
    return getCurrencyFlag(display);
  };

  // USD est une devise convertible comme les autres — ne pas le filtrer.
  // Seul RLUSD est masqué (infrastructure invisible).
  const swapCurrencyOptionsSanitized = useMemo(() => {
    const base = (swapCurrencyOptions || []).filter(
      (code) =>
        String(code || "")
          .trim()
          .toUpperCase() !== "RLUSD",
    );
    // Inclure la quote sélectionnée même si elle n'est pas encore dans le wallet
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

  const canMutateLines =
    isPreviewMode ||
    (isConnected && isWalletActivated === true && hasOnChainRlusd);

  const existingCurrencyLinesSet = useMemo(() => {
    const set = new Set();
    (currencyLines || []).forEach((line) => {
      const code = String(line?.currencyCode || "").toUpperCase();
      if (code) set.add(code);
    });
    return set;
  }, [currencyLines]);
  const showDesktopWalletConvertNote =
    inline &&
    isDesktop &&
    noticeVariant !== "demo" &&
    dashboardVariant === "full";
  const useDesktopWalletConvertLayout = showDesktopWalletConvertNote;
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

  // Seules les conversions impliquant XRP sont hors-scope ici (pas de swap DEX).
  // RLUSD est traité comme devise de base (peg 1:1 avec USD) pour les conversions "allocation".
  const isXrplCore = (code) => code === "XRP";
  const sameCurrencySelected = Boolean(
    baseCode && quoteCode && baseCode === quoteCode,
  );

  const conversionRoute = useMemo(() => {
    if (!baseCode || !quoteCode || baseCode === quoteCode) {
      return { type: "none" };
    }

    if (isXrplCore(baseCode) || isXrplCore(quoteCode)) {
      return {
        type: "unsupported",
        error: t(
          "ui_xrpl_conversion_temporarily_unavailable_1f8b72d3aa",
          "XRP/USD conversion is temporarily unavailable.",
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
    if (!open) {
      resetSwapForm?.();
    }
  }, [open, resetSwapForm]);

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
    "relative w-full wallet-modal-panel wallet-convert-modal border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-full md:h-auto md:max-w-lg md:max-h-[96vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
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
            className="flex-1 min-h-0 flex flex-col overscroll-contain p-4 md:p-5 space-y-5 overflow-y-auto"
            style={{ WebkitOverflowScrolling: "touch" }}
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
                    <span className="inline-flex items-center text-white/70 text-lg md:text-xl font-semibold px-2 py-0.5 leading-none">
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
              className="wallet-tab-unfold-in flex-1 min-h-0 flex flex-col"
            >
              <div
                className="flex-1 min-h-0 flex flex-col justify-between gap-5"
              >
                <div
                  className={
                    useDesktopWalletConvertLayout
                      ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col gap-6"
                      : inline
                        ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(18px,2.8vh,36px)]"
                        : "space-y-[clamp(16px,2.5vh,28px)]"
                  }
                >
                  <div
                    className={
                      useDesktopWalletConvertLayout
                        ? "space-y-7"
                        : inline
                          ? "space-y-6"
                          : "space-y-[clamp(14px,2.2vh,24px)]"
                    }
                  >
                    <div>
                      <label className="block text-[17px] md:text-lg text-white/60 mb-1">
                        {t("ui_base_6d4184e1ef", "Base")}
                      </label>
                      <ModalSelect
                        value={convertBaseCurrency}
                        onChange={setConvertBaseCurrency}
                        options={(swapCurrencyOptionsSanitized || []).map(
                          (code) => {
                            const labelLeft =
                              selectLabelByCurrency?.[code] || code;
                            const labelRight =
                              selectLabelRightByCurrency?.[code] || null;
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
                          },
                        )}
                        useNativeSelect={false}
                        showMobileOptionRight={true}
                        buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-xl text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                        menuClassName={
                          noticeVariant === "demo"
                            ? "bg-[#0b0f10]"
                            : "bg-elevated"
                        }
                        selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-xl text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                      />
                    </div>

                    <div>
                      <label className="block text-[17px] md:text-lg text-white/60 mb-1">
                        {t("ui_quote_e3761255be", "Quote")}
                      </label>
                      <ModalSelect
                        value={convertQuoteCurrency}
                        onChange={setConvertQuoteCurrency}
                        options={(swapCurrencyOptionsSanitized || []).map(
                          (code) => {
                            const labelLeft =
                              selectLabelByCurrency?.[code] || code;
                            const labelRight =
                              selectLabelRightByCurrency?.[code] || null;
                            return {
                              value: code,
                              icon: getIconForCode(code),
                              label: labelLeft,
                              labelLeft,
                              labelRight,
                              labelMobile:
                                selectLabelMobileByCurrency?.[code] ||
                                labelLeft,
                            };
                          },
                        )}
                        useNativeSelect={false}
                        showMobileOptionRight={true}
                        buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-xl text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                        menuClassName={
                          noticeVariant === "demo"
                            ? "bg-[#0b0f10]"
                            : "bg-elevated"
                        }
                        selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-xl text-white outline-none focus:border-xcannes-green/80 appearance-none cursor-pointer"
                      />
                    </div>

                    {!existingCurrencyLinesSet.has(quoteCode) && quoteCode && quoteCode !== "USD" ? (
                      <div className="rounded-md border border-emerald-400/20 bg-emerald-400/5 px-3 py-2 text-[15px] text-emerald-200/80">
                        {t(
                          "ui_new_currency_line_auto_activate_a1b2c3",
                          "New currency — the {{currency}} line will be created automatically.",
                        ).replace("{{currency}}", quoteCode)}
                      </div>
                    ) : null}

                    <div>
                      <label className="block text-[15px] text-white/40 mb-1">
                        {t("ui_other_currency_d8e1f2a3b4", "Other currency")}
                      </label>
                      <WalletCurrencySelector
                        value=""
                        onChange={(code) => {
                          if (code) setConvertQuoteCurrency(code);
                        }}
                        placeholder={t(
                          "ui_search_all_currencies_c5d6e7f8",
                          "Search all currencies...",
                        )}
                        excludeCodes={["USD", "RLUSD", "XRP"]}
                        showQuickAdd={true}
                      />
                    </div>

                    <div>
                      <label className="block text-[17px] md:text-lg text-white/60 mb-1">
                        {t("ui_amount_52a20b2992", "Amount")}
                      </label>
                      <TokenAmountInput
                        value={convertAmount}
                        onChange={setConvertAmount}
                        placeholder="0.0000"
                        token={
                          selectLabelByCurrency?.[convertBaseCurrency] ||
                          convertBaseCurrency ||
                          "USD"
                        }
                        tokenClassName="text-white"
                        containerClassName="focus-within:!border-xcannes-green/80"
                      />
                    </div>
                  </div>

                  <div className={inline ? "space-y-2" : "space-y-2"}>
                    {sameCurrencySelected ? (
                      <div className="rounded-md border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[17px] text-amber-100/90">
                        {t(
                          "ui_convert_same_asset_warning_6f13d5c9c2",
                          "Veuillez choisir 2 actifs différents.",
                        )}
                      </div>
                    ) : null}
                    <div className="rounded-lg border border-subtle bg-black/30 px-3 py-2 space-y-1">
                      <div className="uppercase tracking-[0.16em] text-[15px] text-white/50">
                        {t(
                          "ui_estimated_receive_0c5a3b7e9a",
                          "Estimated receive",
                        )}
                      </div>
                      <div className="text-xl text-white/90">
                        {formatAmountWithSymbolLocal(
                          previewAmount,
                          convertQuoteCurrency || "",
                          {
                            minimumFractionDigits: 0,
                            maximumFractionDigits: 6,
                          },
                        )}
                      </div>
                      {previewMeta?.route === "allocation" &&
                      previewMeta?.isFx &&
                      previewMeta?.spreadFeeRlusd > 0 ? (
                        <div className="text-[16px] text-white/45">
                          {t("ui_spread_fee_6c2a8d5e1b", "Conversion fee (1%)")}
                          :{" "}
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
                    </div>

                    {previewState.status === "loading" ? (
                      <div className="text-[17px] text-white/50">
                        {t(
                          "ui_loading_market_data_1d5d6ed3c4",
                          "Refreshing market data...",
                        )}
                      </div>
                    ) : null}

                    {previewState.status === "error" ? (
                      <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-[17px] text-red-200">
                        {previewState.error}
                      </div>
                    ) : null}

                    {convertPreview ? (
                      <p className="text-[17px] text-white/60">
                        {convertPreview}
                      </p>
                    ) : null}
                  </div>
                </div>

                <div
                  className={
                    inline
                      ? "mt-auto space-y-2 pt-2 border-t border-white/10"
                      : "mt-auto pt-4"
                  }
                >
                  {!isConnected && !isPreviewMode ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectWallet?.();
                      }}
                      className={`w-full mt-1 text-xl py-2.5 ${greenActionBtnBase}`}
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
                        className={`hidden md:block w-full mt-1 text-xl py-2.5 ${greenActionBtnBase}`}
                        disabled={convertButtonDisabled}
                      >
                        {convertButtonLabel}
                      </button>
                    </>
                  )}
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
