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
                  <div>
                    {renderWalletMeta?.({
                      variant: "pill",
                      className:
                        "w-full flex justify-center wallet-meta--plus-4 wallet-meta--desktop-gap",
                      prefix: t("moonpay_from_account", "Depuis le compte"),
                      labelWrap: false,
                      pillClassName:
                        "bg-elevated px-6 py-1.5 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)] gap-6",
                      prefixClassName:
                        "!text-white/70 text-[14px] md:text-[15px] font-medium tracking-wide mr-6",
                      labelClassName:
                        "!text-white/95 text-[14px] md:text-[15px] font-semibold",
                      dotClassName: "!h-3 !w-3 ring-xcannes-green/20 self-center",
                    })}
                  </div>
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
                <div className="text-center">
                  <h3 className="text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight">
                    {t("ui_convert_title_main", "Convertissez vos devises")}
                  </h3>
                  <p className="mt-2 text-[14px] md:text-[15px] text-white/60 max-w-[34ch] mx-auto leading-relaxed">
                    {t("ui_convert_subtitle_main", "Sélectionnez les devises, indiquez le montant, vérifiez le résumé.")}
                  </p>
                </div>
                {/* ── SECTION 1: Currency selection ───────────────────────── */}
                <div className="space-y-3">
                  <div className="relative z-[65]">
                    <div className="flex items-center justify-between mb-2 relative z-[41]">
                      <div className="text-[13px] tracking-[0.22em] text-white/45">
                        {t("ui_convert_from_label", "Vous envoyez")}
                      </div>
                    </div>
		                    <ModalSelect
		                      value={convertBaseCurrency}
		                      onChange={setConvertBaseCurrency}
		                      onOpenChange={setBaseDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const labelLeft = selectLabelByCurrency?.[code] || code;
                        const labelRightRaw = selectLabelRightByCurrency?.[code] || null;
                        const isSelected = String(code) === String(convertBaseCurrency || "");
                        const labelRight =
                          !baseDropdownOpen && isSelected
                            ? (
                              <span className="text-[10px] md:text-[11px] text-white/38 tracking-[0.01em]">
                                {t("ui_view_balances_hint_aa12", "Afficher les soldes")}
                              </span>
                            )
                            : labelRightRaw;
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
		                      backdropClassName="bg-black/80 backdrop-blur-[4px]"
                          buttonClassName="bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-2 text-xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                          openButtonClassName="!bg-white/10 !border !border-white/40 !border-b-0 !ring-1 !ring-white/40 !shadow-[inset_0_0_0_1px_rgba(255,255,255,0.20),0_8px_18px_rgba(0,0,0,0.45)]"
		                      menuClassName={
		                        noticeVariant === "demo"
                              ? "bg-xcannes-surface-demo !border-white/35 !ring-1 !ring-white/30 ring-inset max-h-[520px]"
                              : "bg-[#101415] !border-white/35 !ring-1 !ring-white/30 ring-inset max-h-[520px]"
		                      }
                          selectClassName="xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-2 text-xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
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
		                          const prev = convertBaseCurrency;
		                          setConvertBaseCurrency(convertQuoteCurrency);
		                          setConvertQuoteCurrency(prev);
		                        }}
                            className="w-9 h-9 rounded-full bg-[#111518] hover:bg-[#151b1f] active:scale-95 transition-all duration-150 flex items-center justify-center shadow-[0_8px_18px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.10),inset_0_-8px_14px_rgba(0,0,0,0.28)]"
		                        aria-label="Inverser les devises"
		                      >
		                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
		                          <path d="M6 2L6 14M6 14L3 11M6 14L9 11" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
		                          <path d="M12 16L12 4M12 4L9 7M12 4L15 7" stroke="white" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/>
		                        </svg>
		                      </button>
		                    </div>
		                    {/* Amount input */}
		                    <TokenAmountInput
		                      value={convertAmount}
		                      onChange={setConvertAmount}
		                      placeholder="0.0000"
		                      token={
		                        selectLabelByCurrency?.[convertBaseCurrency] ||
		                        convertBaseCurrency ||
		                        "USD"
		                      }
		                      tokenClassName="text-white drop-shadow-sm text-4xl md:text-5xl font-bold"
                          containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-colors duration-150 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] [&_input]:!text-4xl [&_input]:md:!text-5xl"
		                    />
		                  </div>

                  <div className="relative">
                    <div className="flex items-center justify-between mb-2 relative z-[41]">
                      <div className="text-[13px] tracking-[0.22em] text-white/45">
                        {t("ui_convert_to_label", "Vous recevez")}
                      </div>
                    </div>
		                    <ModalSelect
		                      value={convertQuoteCurrency}
		                      onChange={setConvertQuoteCurrency}
                      onOpenChange={setQuoteDropdownOpen}
                      options={(swapCurrencyOptionsSanitized || []).map((code) => {
                        const labelLeft = selectLabelByCurrency?.[code] || code;
                        const labelRightRaw = selectLabelRightByCurrency?.[code] || null;
                        const isSelected = String(code) === String(convertQuoteCurrency || "");
                        const labelRight =
                          !quoteDropdownOpen && isSelected
                            ? (
                              <span className="text-[10px] md:text-[11px] text-white/38 tracking-[0.01em]">
                                {t("ui_view_balances_hint_aa12", "Afficher les soldes")}
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
                          label: labelLeft,
                          labelLeft: labelWithHint,
                          labelRight,
                          labelMobile:
                            selectLabelMobileByCurrency?.[code] || labelLeft,
                        };
                      })}
		                      useNativeSelect={false}
		                      hideSelected
		                      showMobileOptionRight={true}
		                      iconClassName="text-3xl leading-none"
		                      backdropClassName="bg-black/80 backdrop-blur-[4px]"
                          buttonClassName="bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-2 text-xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
                          openButtonClassName="!bg-white/10 !border !border-white/40 !border-b-0 !ring-1 !ring-white/40 !shadow-[inset_0_0_0_1px_rgba(255,255,255,0.20),0_8px_18px_rgba(0,0,0,0.45)]"
                          optionClassName="py-2.5 md:py-3"
		                      menuClassName={
		                        noticeVariant === "demo"
                              ? "bg-xcannes-surface-demo !border-white/35 !ring-1 !ring-white/30 ring-inset max-h-[220px]"
                              : "bg-[#101415] !border-white/35 !ring-1 !ring-white/30 ring-inset max-h-[220px]"
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
                          selectClassName="xcannes-select w-full bg-[#101415] ring-1 ring-white/10 ring-inset rounded-[14px] px-3.5 py-2 text-xl text-white outline-none focus:outline-none cursor-pointer transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4)]"
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
                      {/* Row: Frais */}
                      <div className="flex items-center justify-between px-4 pt-2 pb-1">
                        <span className="text-sm text-white/55">{t("statement_conversion_fee_label", "Frais")}</span>
                        <span className="text-sm text-white/80 font-medium">
                          {formatAmountWithSymbol(locale, Number(previewMeta?.spreadFeeRlusd || 0), "USD", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                      {/* Row: Taux de change */}
                      <div className="flex items-center justify-between px-4 pt-1 pb-2">
                        <span className="text-sm text-white/55">{t("ui_exchange_rate_label", "Taux de change")}</span>
                        <span className="text-sm text-white/80 font-medium">
                          {Number.isFinite(Number(previewMeta?.unitRate)) && previewMeta?.unitRate > 0 && baseCode && quoteCode
                            ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(previewMeta.unitRate).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${getDisplayCurrencyCode(quoteCode)}`
                            : Number.isFinite(inlineUnitRate) && baseCode && quoteCode
                              ? `1 ${getDisplayCurrencyCode(baseCode)} = ${Number(inlineUnitRate).toLocaleString(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ${getDisplayCurrencyCode(quoteCode)}`
                              : "1 USD = 0.84 EUR"}
                        </span>
                      </div>
                      <div className="px-3 mt-5 mb-2">
                        <div className="h-[1.5px] bg-white/45 rounded-full" />
                      </div>
                      {/* Row: Total reçu */}
                      <div className="flex items-center justify-between px-4 pt-2 pb-2">
                        <span className="text-lg md:text-xl text-white">{t("ui_total_received_label", "Total reçu")}</span>
                        <span className="text-2xl md:text-3xl text-white font-bold">
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
                        "w-full h-14 rounded-[20px] text-white text-lg font-semibold transition-all duration-150",
                        convertButtonDisabled
                          ? "opacity-45 cursor-not-allowed"
                          : "hover:scale-[1.01] active:scale-[0.98]",
                      ].join(" ")}
                      style={convertButtonDisabled
                        ? { background: 'linear-gradient(180deg, rgba(34,154,86,0.45) 0%, rgba(14,103,58,0.45) 100%)' }
                        : { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
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
