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
    const shouldClose = delta > 160 || velocity > 1.0;

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
    "relative w-full wallet-modal-panel wallet-convert-modal border-white/10 md:border overflow-hidden flex flex-col min-h-0 pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
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
            ref={overlayListRef}
            className={panelClass}
            onClick={(e) => {
              if (!inline) e.stopPropagation();
            }}
            onPointerDown={(event) => {
              maybeStartOverlayDrag(event, "list");
            }}
          >
            <div className="flex-1 min-h-0 flex flex-col p-4 md:p-5 space-y-4">
              <div
                className="flex items-start justify-between gap-3 mb-1 pr-6"
                onPointerDown={(event) => {
                  maybeStartOverlayDrag(event, "fixed");
                }}
              >
                <div className="flex min-w-0 flex-col gap-1.5">
                  {!inline ? (
                    <div className="md:hidden flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
                      <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                    </div>
                  ) : null}
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
              </div>
            <div className="wallet-tab-unfold-in">
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
	                          ? "bg-xcannes-surface-demo border-white/15 ring-1 ring-white/10"
	                          : "bg-elevated border-white/15 ring-1 ring-white/10"
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
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M7 10h10M7 10l3-3M7 10l3 3M17 14H7m10 0l-3-3m3 3l-3 3" />
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
	                          ? "bg-xcannes-surface-demo border-white/15 ring-1 ring-white/10"
	                          : "bg-elevated border-white/15 ring-1 ring-white/10"
	                      }
	                      selectClassName="xcannes-select w-full bg-white/5 ring-1 ring-white/10 ring-inset rounded-xl px-3.5 py-3 text-xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer transition-colors duration-150"
	                    />
	                  </div>

                  {!existingCurrencyLinesSet.has(quoteCode) && quoteCode && quoteCode !== "USD" ? (
                    <div className="rounded-lg ring-1 ring-xcannes-green/25 ring-inset bg-xcannes-green/10 px-3 py-2 text-xs text-xcannes-green/90">
                      {t(
                        "ui_new_currency_line_auto_activate_a1b2c3",
                        "New currency — the {{currency}} line will be created automatically.",
                      ).replace("{{currency}}", quoteCode)}
                    </div>
                  ) : null}

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
                      excludeCodes={["USD", "RLUSD", "XRP"]}
                      showQuickAdd={false}
                      fullscreen={true}
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
                              maximumFractionDigits: 2,
                            })}
                          </div>
                          {previewMeta?.route === "allocation" &&
                          previewMeta?.isFx &&
                          previewMeta?.spreadFeeRlusd > 0 ? (
                            <div className="text-sm text-white/60 pt-2 mt-2 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
                              {t("statement_conversion_fee_label", "Frais")}
                              {" : "}
                              {formatAmountWithSymbol(locale, previewMeta.spreadFeeRlusd, "USD", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                          ) : null}
                          {Number.isFinite(Number(previewMeta?.unitRate)) &&
                          previewMeta?.unitRate > 0 ? (
                            <div className="text-xs text-white/50">
                              {`1 ${getDisplayCurrencyCode(baseCode)} = ${Number(
                                previewMeta.unitRate,
                              ).toLocaleString(locale, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
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
                      <p className="text-xs text-white/60">
                        {convertPreview}
                      </p>
                    ) : null}
                  </div>

                <div className="pt-3 mt-1 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
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
                    <>
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
                        className={`hidden md:block w-full text-xl py-4 ${greenActionBtnBase}`}
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
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
