"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useIsDesktop from "../hooks/useIsDesktop";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import WalletCurrencySelector from "@/components/ui/WalletCurrencySelector";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { computeSpreadQuote, isFxConversion } from "@/utils/walletSpread";
import { useModalTransition } from "@/hooks/useModalTransition";
import { greenActionBtnBase } from "./walletModalTokens";
import {
  formatAmountWithSymbol,
  getCurrencyFlag,
  getDisplayCurrencyCode,
} from "../walletDashboardConfig";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";

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
  currencyLinesSummary,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  resetSwapForm,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const isDesktop = useIsDesktop();
  const modalPanelRef = useRef(null);

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

  // ── Insufficient balance detection ──────────────────────────
  const insufficientBalance = useMemo(() => {
    if (!baseCode || !Number.isFinite(amountValue) || amountValue <= 0) return null;

    const isPeggedToUsd = (code) => code === "RLUSD" || code === "USD";
    const rlusdPerBase = isPeggedToUsd(baseCode)
      ? 1
      : Number(rlusdPerUnitRates?.[baseCode]);
    if (!Number.isFinite(rlusdPerBase) || rlusdPerBase <= 0) return null;

    const grossRlusd = amountValue * rlusdPerBase;
    const epsilon = 1e-9;

    if (baseCode === "RLUSD") {
      const unallocated = Number(currencyLinesSummary?.unallocatedRlusd);
      if (Number.isFinite(unallocated) && unallocated + epsilon < grossRlusd) {
        return { availableRlusd: unallocated, availableUnits: unallocated, currency: baseCode };
      }
      return null;
    }

    const baseLine = (currencyLines || []).find(
      (l) => String(l?.currencyCode || "").toUpperCase() === baseCode,
    );
    const availableRlusd = Number(baseLine?.allocatedRlusd ?? 0);
    if (Number.isFinite(availableRlusd) && availableRlusd + epsilon < grossRlusd) {
      const availableUnits = rlusdPerBase > 0 ? availableRlusd / rlusdPerBase : 0;
      return { availableRlusd, availableUnits, currency: baseCode };
    }
    return null;
  }, [amountValue, baseCode, currencyLines, currencyLinesSummary, rlusdPerUnitRates]);

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
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      ...options,
    });
  };

  const inlineUnitRate = useMemo(() => {
    if (!baseCode || !quoteCode || baseCode === quoteCode) return null;
    if (conversionRoute.type !== "allocation") return null;

    const isPeggedToUsd = (code) => code === "RLUSD" || code === "USD";
    const rlusdPerBase = isPeggedToUsd(baseCode)
      ? 1
      : Number(rlusdPerUnitRates?.[baseCode]);
    const rlusdPerQuote = isPeggedToUsd(quoteCode)
      ? 1
      : Number(rlusdPerUnitRates?.[quoteCode]);

    if (!Number.isFinite(rlusdPerBase) || rlusdPerBase <= 0) return null;
    if (!Number.isFinite(rlusdPerQuote) || rlusdPerQuote <= 0) return null;

    const unitRateGross = rlusdPerBase / rlusdPerQuote;
    const spread = computeSpreadQuote({
      base: baseCode,
      quote: quoteCode,
      amountRlusd: rlusdPerBase,
    });
    const unitRateNet = isFxConversion(baseCode, quoteCode)
      ? unitRateGross * (1 - Number(spread?.spreadFraction || 0))
      : unitRateGross;

    return Number.isFinite(unitRateNet) && unitRateNet > 0 ? unitRateNet : null;
  }, [baseCode, conversionRoute.type, quoteCode, rlusdPerUnitRates]);

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

      // Unit rate: how many quote units per 1 base unit (after spread)
      const unitRateGross = rlusdPerBase / rlusdPerQuote;
      const unitRateNet = isFxConversion(baseCode, quoteCode)
        ? unitRateGross * (1 - Number(spread?.spreadFraction || 0))
        : unitRateGross;

      setPreviewState({ status: "done", error: null });
      setPreviewAmount(quoteUnits);
      setPreviewMeta({
        route: "allocation",
        spreadFeeRlusd: spreadFee,
        spreadPercent: Number(spread?.spreadFraction || 0) * 100,
        isFx: isFxConversion(baseCode, quoteCode),
        unitRate: unitRateNet,
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
    conversionRoute.type !== "allocation" ||
    !!insufficientBalance;
  const convertButtonLabel = convertProcessing
    ? t("ui_converting_71c2b9a4e5", "Conversion…")
    : t("ui_convert_cta_fr", "Convertir");
  const handleConvertAction = () => {
    handleDemoConvert();
  };
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const [baseDropdownOpen, setBaseDropdownOpen] = useState(false);
  const [quoteDropdownOpen, setQuoteDropdownOpen] = useState(false);
  const [swapRotating, setSwapRotating] = useState(false);
  const overlayRef = useRef(null);
  const overlayListRef = useRef(null);
  const overlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    const resetMeta = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };

    if (open) {
      closeRequestedRef.current = false;
      setOverlayDragging(false);
      setOverlayTranslateY(0);
      overlayDragMetaRef.current = resetMeta;
      return;
    }

    try {
      const listEl = overlayListRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setOverlayDragging(false);
    if (!closeRequestedRef.current) setOverlayTranslateY(0);
    overlayDragMetaRef.current = resetMeta;
  }, [open]);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = overlayListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartOverlayDrag = (event, source) => {
    if (inline) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;
    if (event.target?.closest?.("[data-modal-select-dropdown]")) return false;

    if (source === "list") {
      const listEl = overlayListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    overlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleOverlayPointerMove = (event) => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        overlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = overlayListRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setOverlayTranslateY(delta);
  };

  const handleOverlayPointerEnd = (event) => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, height * 0.28));
    const shouldClose =
      delta > closeDistance ||
      (delta > closeDistance * 0.6 && velocity > 1.25);

    overlayDragMetaRef.current.pending = false;
    overlayDragMetaRef.current.dragging = false;
    setOverlayDragging(false);
    releaseOverlayScrollLock();

    if (shouldClose) {
      if (!closeRequestedRef.current) {
        closeRequestedRef.current = true;
        const height = typeof window !== "undefined" ? window.innerHeight : 9999;
        setOverlayTranslateY(Math.max(delta, height));
        window.setTimeout(() => {
          onClose?.();
        }, 180);
      }
      return;
    }

    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-convert-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
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

  const backdropAnimClass = closeRequestedRef.current
    ? ""
    : isClosing
      ? "wallet-modal-backdrop-out"
      : "wallet-modal-backdrop-in";

  const content = (
    <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${backdropAnimClass}`}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? {
                  opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)),
                }
              : undefined
          }
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? "w-full h-full flex" : "pointer-events-auto w-full"}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            transition: overlayDragging
              ? "none"
              : "transform 220ms cubic-bezier(0.2,0,0,1)",
            opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
            willChange: overlayTranslateY ? "transform" : undefined,
          }}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerEnd}
          onPointerCancel={handleOverlayPointerEnd}
        >
          <div
            ref={(node) => {
              overlayListRef.current = node;
              modalPanelRef.current = node;
            }}
            className={panelClass}
            onClick={(e) => {
              if (!inline) e.stopPropagation();
            }}
            onPointerDown={(event) => {
              maybeStartOverlayDrag(event, "list");
            }}
          >
            <div className="flex-1 min-h-0 flex flex-col p-4 md:p-5 space-y-4">
              {!inline ? (
                <div
                  className="md:hidden flex justify-center -mt-1 pt-1 pb-2"
                  aria-hidden
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "fixed");
                  }}
                >
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
              ) : null}
              <div
                className="flex items-start justify-between gap-3 mb-1"
                onPointerDown={(event) => {
                  maybeStartOverlayDrag(event, "fixed");
                }}
              >
                <div className="flex min-w-0 flex-col gap-1.5 w-full relative z-[65]">
                  <div className="flex flex-wrap items-center gap-2">
                    {noticeVariant === "demo" ? (
                      <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                        {t("demo_notice_title", "Mode démo")}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            <div className="wallet-tab-unfold-in">
              <div className="flex flex-col gap-4">
                {/* ── Title / subtitle ── */}
                <div className="text-center relative z-[65]">
                  <h3 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight">
                    {t("ui_convert_title_main", "Convertissez vos devises")}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/80 max-w-[34ch] mx-auto leading-relaxed">
                    {t("ui_convert_subtitle_main", "Convertissez instantanément entre vos devises.")}
                  </p>
                  <div className="mt-2 flex justify-center relative z-[120]">
                    {renderWalletMeta?.({
                      variant: "pill",
                      className: "w-full flex justify-center wallet-meta--plus-4 wallet-meta--desktop-gap relative z-[120]",
                      prefix: t("moonpay_from_account", "Depuis le compte"),
                      labelWrap: false,
                      pillClassName: `bg-elevated px-5 py-1 gap-4 ${baseDropdownOpen || quoteDropdownOpen
                        ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_10px_rgba(255,255,255,0.16)]"
                        : "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]"}`,
                      prefixClassName:
                        "!text-white/45 text-[12px] md:text-[13px] font-normal tracking-wide mr-4",
                      labelClassName:
                        "!text-white/90 text-[14px] md:text-[15px] font-semibold",
                      dotClassName: "!h-2.5 !w-2.5 ring-xcannes-green/20 self-center",
                    })}
                  </div>
                </div>
                {/* ── SECTION 1: Currency selection ───────────────────────── */}
                <div className="space-y-3">
                  <div className="relative z-[65]">
                    <div className="flex items-center justify-between mb-2 relative z-[41]">
                      <div className="text-[13px] tracking-normal font-medium text-white/55">
                        {t("ui_convert_from_label", "Vous envoyez")}
                      </div>
                    </div>
		                    <ModalSelect
		                      value={convertBaseCurrency}
		                      onChange={setConvertBaseCurrency}
		                      onOpenChange={setBaseDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const shortCode = selectLabelByCurrency?.[code] || code;
                        const fullName = getCurrencyDescription(code) || shortCode;
                        const labelLeftText = fullName.length > 15 ? fullName.slice(0, 15) + '…' : fullName;
                        const labelLeft = <span className="md:text-[1.12em]">{labelLeftText}</span>;
                        const labelRightRaw = selectLabelRightByCurrency?.[code] || null;
                        const isSelected = String(code) === String(convertBaseCurrency || "");
                        const labelRight =
                          !baseDropdownOpen && isSelected
                            ? (
                              <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-50 shrink-0">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                                <span>{t("ui_balances_short_label_aa12", "Soldes")}</span>
                              </span>
                            )
                            : labelRightRaw;
                        return {
                          value: code,
                          icon: getIconForCode(code),
                          label: labelLeftText,
                          labelLeft,
                          labelRight,
                          labelMobile:
                            selectLabelMobileByCurrency?.[code] || shortCode,
                        };
                      })}
		                      useNativeSelect={false}
		                      hideSelected
		                      showMobileOptionRight={true}
		                      iconClassName="text-3xl leading-none"
                          optionClassName="py-2.5 md:py-3 !text-xl md:!text-2xl"
                          menuHeader={t("ui_your_balances_header", "Vos soldes")}
                          backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[45]"
                          buttonClassName="bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.07] ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl text-white outline-none focus:outline-none cursor-pointer transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
                          openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
		                      menuClassName={
		                        noticeVariant === "demo"
                              ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset max-h-[450px]"
                              : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset max-h-[450px]"
		                      }
                          selectClassName="xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-1.5 md:py-2 text-xl md:text-2xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
		                    />
		                  </div>

		                  {/* ── Rate line + swap button + Amount input ── */}
		                  <div className={`relative z-[65] transition-all duration-200 ${baseDropdownOpen ? 'opacity-0 max-h-0 overflow-hidden !my-0' : 'opacity-100'}`}>
		                    {/* Rate line */}
                        <div className="flex items-center gap-3 px-2 pb-2 text-white/45">
		                      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-white/20" />
                          <span className="relative -top-px text-[11px] md:text-[12px] tracking-[0.02em] whitespace-nowrap leading-none">
		                        {Number.isFinite(inlineUnitRate)
		                          ? `1 ${getDisplayCurrencyCode(baseCode || "USD")} = ${Number(
		                              inlineUnitRate,
		                            ).toLocaleString(locale, {
		                              minimumFractionDigits: 2,
		                              maximumFractionDigits: 2,
		                            })} ${getDisplayCurrencyCode(quoteCode || "EUR")}`
		                          : "1 USD = 0.84 EUR"}
		                      </span>
		                      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-white/20" />
		                    </div>
		                    {/* Swap button centered above the amount block */}
                        <div className="relative flex justify-center -mt-0.5 -mb-4 z-10">
		                      <button
		                        type="button"
		                        onClick={() => {
		                          setSwapRotating(true);
		                          setTimeout(() => setSwapRotating(false), 420);
		                          const prev = convertBaseCurrency;
		                          setConvertBaseCurrency(convertQuoteCurrency);
		                          setConvertQuoteCurrency(prev);
		                        }}
                            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 active:scale-90 hover:brightness-125 ${swapRotating ? 'scale-90' : ''}`}
                            style={{
                              background: 'linear-gradient(160deg, #1c2428 0%, #0c1012 100%)',
                              boxShadow: '0 0 0 1px rgba(255,255,255,0.09), 0 6px 18px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.11), inset 0 -6px 12px rgba(0,0,0,0.35)',
                            }}
		                        aria-label="Inverser les devises"
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
		                            transform: swapRotating ? 'rotate(180deg)' : 'rotate(0deg)',
		                            transition: 'transform 380ms cubic-bezier(0.34,1.56,0.64,1)',
		                          }}
		                        >
		                          <polyline points="17 1 21 5 17 9" />
		                          <path d="M3 11V9a4 4 0 0 1 4-4h14" />
		                          <polyline points="7 23 3 19 7 15" />
		                          <path d="M21 13v2a4 4 0 0 1-4 4H3" />
		                        </svg>
		                      </button>
		                    </div>
		                    {/* Amount input */}
		                    <TokenAmountInput
		                      value={convertAmount}
		                      onChange={setConvertAmount}
		                      placeholder="0.00"
		                      token={
		                        selectLabelByCurrency?.[convertBaseCurrency] ||
		                        convertBaseCurrency ||
		                        "USD"
		                      }
		                      tokenClassName="text-white/70 drop-shadow-sm text-2xl md:text-3xl font-semibold"
                          containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-amount-shimmer [&_input]:!text-4xl [&_input]:md:!text-5xl [&_input]:font-bold [&_input]:placeholder:text-white/35"
		                    />
		                  </div>

                  <div className={quoteDropdownOpen ? "relative z-[65]" : "relative"}>
                    <div className={`flex items-center justify-between mb-2 relative ${quoteDropdownOpen ? "z-[65]" : "z-[41]"}`}>
                      <div className="text-[13px] tracking-normal font-medium text-white/55">
                        {t("ui_convert_to_label", "Vous recevez")}
                      </div>
                    </div>
		                    <ModalSelect
		                      value={convertQuoteCurrency}
		                      onChange={setConvertQuoteCurrency}
                      onOpenChange={setQuoteDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const shortCode = selectLabelByCurrency?.[code] || code;
                        const fullName = getCurrencyDescription(code) || shortCode;
                        const labelLeftText = fullName.length > 15 ? fullName.slice(0, 15) + '…' : fullName;
                        const labelLeft = <span className="md:text-[1.12em]">{labelLeftText}</span>;
                        const labelRightRaw = selectLabelRightByCurrency?.[code] || null;
                        const isSelected = String(code) === String(convertQuoteCurrency || "");
                        const labelRight =
                          !quoteDropdownOpen && isSelected
                            ? (
                              <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
                                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-50 shrink-0">
                                  <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.5"/>
                                  <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                                </svg>
                                <span>{t("ui_balances_short_label_aa12", "Soldes")}</span>
                              </span>
                            )
                            : labelRightRaw;
                        const isNewLine = !existingCurrencyLinesSet.has(code) && code && code !== "USD";
                        const labelWithHint = isNewLine ? (
                          <>{labelLeft} <span className="text-[11px] text-white/35 font-normal">{t("ui_new_currency_line_auto_activate_a1b2c3", "the {{currency}} line will be created automatically.").replace("{{currency}}", code)}</span></>
                        ) : labelLeft;
                        return {
                          value: code,
                          icon: getIconForCode(code),
                          label: labelLeftText,
                          labelLeft: labelWithHint,
                          labelRight,
                          labelMobile:
                            selectLabelMobileByCurrency?.[code] || shortCode,
                        };
                      })}
		                      useNativeSelect={false}
		                      hideSelected
		                      showMobileOptionRight={true}
		                      iconClassName="text-3xl leading-none"
                          backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[45]"
                          buttonClassName="bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.07] ring-inset rounded-[14px] px-3.5 py-2 text-xl md:text-2xl text-white outline-none focus:outline-none cursor-pointer transition-all duration-150 shadow-[0_2px_8px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.06)]"
                          openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                          optionClassName="py-2.5 md:py-3 !text-xl md:!text-2xl"
                          menuHeader={t("ui_your_balances_header", "Vos soldes")}
		                      menuClassName={
		                        noticeVariant === "demo"
                              ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset max-h-[250px]"
                              : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset max-h-[250px]"
		                      }
                          menuFooter={(
                            <WalletCurrencySelector
                              value=""
                              onChange={(code) => {
                                if (code) setConvertQuoteCurrency(code);
                              }}
                              triggerVariant="text"
                              triggerLabel={t(
                                "ui_choose_new_currency_plus_account",
                                "+ Ajouter une devise au compte",
                              )}
                              buttonClassName="w-full inline-flex items-center justify-center text-[12.5px] md:text-[13px] leading-tight text-white/50 font-normal rounded-[8px] px-3 py-1.5 hover:text-white/75 transition-colors"
                              fullscreenPortalTarget={inline ? modalPanelRef.current : null}
                              placeholder={t(
                                "ui_search_all_currencies_c5d6e7f8",
                                "Search all currencies...",
                              )}
                              excludeCodes={["USD", "RLUSD", "XRP"]}
                              showQuickAdd={false}
                              fullscreen={true}
                            />
                          )}
                          selectClassName="xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-2 text-xl md:text-2xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
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
                    {insufficientBalance && !sameCurrencySelected ? (
                      <div className="rounded-lg ring-1 ring-white ring-inset bg-transparent px-3 py-2 text-xs text-white">
                        {t(
                          "ui_insufficient_balance_convert_a3b4c5d6",
                          "Solde insuffisant. Disponible : {{amount}} {{currency}}",
                        )
                          .replace("{{amount}}", insufficientBalance.availableUnits.toLocaleString(locale, { maximumFractionDigits: 2 }))
                          .replace("{{currency}}", getDisplayCurrencyCode(insufficientBalance.currency))}
                      </div>
                    ) : null}
                    {/* ── SECTION 3: Summary ─────────────────────────────── */}
                    <div className="rounded-[16px] overflow-hidden">
                      {/* Rows: Frais + Taux — note technique discrète */}
                      <div className="flex flex-col gap-0.5 px-6 pt-2 pb-2">
                        <span className="text-[11px] md:text-[12.5px] text-white/40 font-normal tabular-nums">
                          {t("statement_conversion_fee_label", "Frais")} —{" "}
                          {formatAmountWithSymbol(locale, Number(previewMeta?.spreadFeeRlusd || 0), "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                        <span className="text-[11px] md:text-[12.5px] text-white/40 font-normal tabular-nums">
                          {t("ui_exchange_rate_label", "Taux")} —{" "}
                          {Number.isFinite(Number(previewMeta?.unitRate)) && previewMeta?.unitRate > 0 && baseCode && quoteCode
                            ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(previewMeta.unitRate).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${getDisplayCurrencyCode(quoteCode)}`
                            : Number.isFinite(inlineUnitRate) && baseCode && quoteCode
                              ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(inlineUnitRate).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${getDisplayCurrencyCode(quoteCode)}`
                              : "1 USD = 0.84 EUR"}
                        </span>
                      </div>
                      <div className="px-3 mt-3 mb-0">
                        <div className="h-px bg-white/45 rounded-full" />
                      </div>
                      {/* Row: Total reçu */}
                      <div
                        className="flex items-center justify-between px-4 pt-4 pb-4 mt-0.5 mx-1 mb-1 rounded-[12px]"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[15px] md:text-[16px] text-white/45 font-normal tracking-[0.02em]">{t("ui_total_received_label", "Total reçu")}</span>
                        </div>
                        <span className="text-3xl md:text-4xl text-white font-bold tracking-tight">
                          {quoteCode
                            ? formatAmountWithSymbolLocal(
                                Number.isFinite(previewAmount) && previewAmount > 0 ? previewAmount : 0,
                                quoteCode,
                                { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                              )
                            : "—"}
                        </span>
                      </div>
                    </div>

                    {previewState.status === "error" ? (
                      <div className="rounded-lg ring-1 ring-red-500/30 ring-inset bg-red-500/10 px-3 py-2 text-xs text-red-200">
                        {previewState.error}
                      </div>
                    ) : null}
                  </div>

                <div className="pt-1 md:pt-3 mt-0 md:mt-1">
                  {!isConnected && !isPreviewMode ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectWallet?.();
                      }}
                      className={`w-full text-sm py-3 ${greenActionBtnBase}`}
                    >
                      {t("wallet_connect_cta", "Connect wallet")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertAction();
                      }}
                      disabled={convertButtonDisabled}
                      className={[
                        "w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                        convertButtonDisabled
                          ? "cursor-not-allowed"
                          : "hover:scale-[1.01] hover:brightness-110 active:scale-[0.98] active:brightness-95",
                      ].join(" ")}
                      style={convertButtonDisabled
                        ? {
                            background: 'linear-gradient(180deg, rgba(34,154,86,0.42) 0%, rgba(14,103,58,0.42) 100%)',
                            boxShadow: '0 0 0 1px rgba(255,255,255,0.06) inset',
                            color: 'rgba(255,255,255,0.40)',
                            letterSpacing: '0.01em',
                          }
                        : {
                            background: 'linear-gradient(180deg, #2da861 0%, #0d6b3a 100%)',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.07) inset, inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -10px 18px rgba(0,0,0,0.22), 0 0 18px rgba(34,180,90,0.18)',
                          }
                      }
                    >
                      {convertProcessing
                        ? convertButtonLabel
                        : `${t("ui_convert_cta_fr", "Convertir")}${Number.isFinite(amountValue) && amountValue > 0 && baseCode ? ` ${Number(amountValue).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${getDisplayCurrencyCode(baseCode)}` : ""}`
                      }
                    </button>
                  )}
                </div>
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
