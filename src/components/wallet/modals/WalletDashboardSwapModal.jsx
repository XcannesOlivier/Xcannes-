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
            <div className="wallet-tab-unfold-in flex flex-col h-full">
              <div className="flex flex-col flex-1 min-h-0">
                {/* ── HEADER: Permanent Title ── */}
                <div className="text-center mb-7 md:mb-8">
                  <div className="mb-3 md:mb-4">
                    <h3 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight bg-gradient-to-r from-white via-white to-white/80 bg-clip-text text-transparent">
                      {t("ui_convert_title_main", "Convertissez vos devises")}
                    </h3>
                  </div>
                  <p className="text-sm md:text-[15px] text-white/55 font-normal">
                    {t("ui_convert_subtitle_main", "Sélectionnez les devises, indiquez le montant")}
                  </p>
                </div>

                {/* ── MAIN CONVERSION SECTION ── */}
                <div className="flex-1 min-h-0 flex flex-col space-y-4 overflow-y-auto">
                  {/* ── FROM BLOCK ── */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-0.5">
                      <div className="text-sm font-bold text-white/80 uppercase tracking-[0.14em] letter-spacing-tighter">
                        {t("ui_convert_from_label", "Vous envoyez")}
                      </div>
                      <div className="text-xs text-white/45">
                        {t("ui_balance_label_solde", "Solde")}
                      </div>
                    </div>
                    <div className="relative z-[65]">

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
                        iconClassName="text-2xl leading-none"
                        backdropClassName="bg-black/80 backdrop-blur-[4px]"
                        buttonClassName="w-full bg-gradient-to-br from-white/8 to-white/5 hover:from-white/12 hover:to-white/8 ring-1 ring-white/15 ring-inset rounded-2xl px-4 py-3.5 text-lg md:text-base text-white outline-none focus:outline-none cursor-pointer transition-all duration-200 shadow-sm hover:ring-white/25 focus:ring-white/30"
                        menuClassName={
                          noticeVariant === "demo"
                            ? "bg-xcannes-surface-demo border-white/15 ring-1 ring-white/10 ring-inset max-h-[420px]"
                            : "bg-elevated border-white/15 ring-1 ring-white/10 ring-inset max-h-[420px]"
                        }
                        selectClassName="xcannes-select w-full bg-gradient-to-br from-white/8 to-white/5 ring-1 ring-white/15 ring-inset rounded-2xl px-4 py-3.5 text-lg md:text-base text-white outline-none focus:outline-none cursor-pointer transition-all duration-200 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* ── AMOUNT INPUT (prominent) ── */}
                  <div className={`relative z-[64] transition-all duration-300 ${baseDropdownOpen ? 'opacity-0 max-h-0 overflow-hidden' : 'opacity-100'}`}>
                    <div className="rounded-3xl bg-gradient-to-br from-white/8 to-white/5 ring-1 ring-white/15 ring-inset p-5 md:p-6 shadow-lg overflow-hidden">
                      <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                      <div className="space-y-1 mb-3">
                        <div className="text-xs uppercase tracking-[0.16em] text-white/50 font-semibold">
                          {t("ui_amount_52a20b2992", "Montant")}
                        </div>
                      </div>
                      <TokenAmountInput
                        value={convertAmount}
                        onChange={setConvertAmount}
                        placeholder="0.00"
                        token={
                          selectLabelByCurrency?.[convertBaseCurrency] ||
                          convertBaseCurrency ||
                          "USD"
                        }
                        tokenClassName="text-white drop-shadow-sm text-3xl md:text-4xl font-bold"
                        containerClassName="[&_input]:!bg-transparent [&_input]:!border-none [&_input]:!ring-0 [&_input]:!shadow-none [&_input]:!text-3xl [&_input]:md:!text-4xl [&_input]:!font-bold [&_input]:!placeholder-white/20"
                      />
                    </div>
                  </div>

                  {/* ── TO BLOCK ── */}
                  <div className="space-y-3 pt-2">
                    <div className="flex items-center justify-between px-0.5">
                      <div className="text-sm font-bold text-white/80 uppercase tracking-[0.14em]">
                        {t("ui_convert_to_label", "Vous recevez")}
                      </div>
                      <div className="text-xs text-white/45">
                        {t("ui_conversion_rate", "Taux")}
                      </div>
                    </div>

                    <div className="relative z-[65]">
                      <ModalSelect
                        value={convertQuoteCurrency}
                        onChange={setConvertQuoteCurrency}
                        options={(swapCurrencyOptionsSanitized || []).map((code) => {
                          const labelLeft = selectLabelByCurrency?.[code] || code;
                          const labelRight = selectLabelRightByCurrency?.[code] || null;
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
                        iconClassName="text-2xl leading-none"
                        backdropClassName="bg-black/80 backdrop-blur-[4px]"
                        buttonClassName="w-full bg-gradient-to-br from-white/8 to-white/5 hover:from-white/12 hover:to-white/8 ring-1 ring-white/15 ring-inset rounded-2xl px-4 py-3.5 text-lg md:text-base text-white outline-none focus:outline-none cursor-pointer transition-all duration-200 shadow-sm hover:ring-white/25 focus:ring-white/30"
                        menuClassName={
                          noticeVariant === "demo"
                            ? "bg-xcannes-surface-demo border-white/15 ring-1 ring-white/10 ring-inset max-h-[420px]"
                            : "bg-elevated border-white/15 ring-1 ring-white/10 ring-inset max-h-[420px]"
                        }
                        selectClassName="xcannes-select w-full bg-gradient-to-br from-white/8 to-white/5 ring-1 ring-white/15 ring-inset rounded-2xl px-4 py-3.5 text-lg md:text-base text-white outline-none focus:outline-none cursor-pointer transition-all duration-200 shadow-sm"
                      />
                    </div>
                  </div>

                  {/* ── ADD CURRENCY BUTTON ── */}
                  <div className="pt-2 px-1">
                    <WalletCurrencySelector
                      value=""
                      onChange={(code) => {
                        if (code) setConvertQuoteCurrency(code);
                      }}
                      triggerVariant="text"
                      triggerLabel={t(
                        "ui_choose_new_currency_plus",
                        "+ Ajouter une devise",
                      )}
                      buttonClassName="inline-flex items-center gap-2 text-sm md:text-[13px] font-semibold tracking-[0.12em] text-white/60 hover:text-white/90 transition-colors duration-200"
                      fullscreenPortalTarget={inline ? modalPanelRef.current : null}
                      placeholder={t(
                        "ui_search_all_currencies_c5d6e7f8",
                        "Search all currencies...",
                      )}
                      excludeCodes={["USD", "RLUSD", "XRP"]}
                      showQuickAdd={false}
                      fullscreen={true}
                    />
                  </div>

                  {/* ── PREVIEW / SUMMARY BLOCK ── */}
                  {Number.isFinite(amountValue) && amountValue > 0 && baseCode && quoteCode && baseCode !== quoteCode ? (
                    <div className="pt-3 space-y-3">
                      <div className="h-px bg-white/8" />
                      
                      {/* You receive section - PROMINENT */}
                      <div className="space-y-2">
                        <div className="text-xs font-semibold text-white/50 uppercase tracking-[0.12em]">
                          {t("ui_you_receive", "Vous recevrez")}
                        </div>
                        {Number.isFinite(previewAmount) && previewAmount > 0 ? (
                          <div className="space-y-1.5">
                            <div className="text-3xl md:text-4xl font-bold text-white">
                              {formatAmountWithSymbolLocal(previewAmount, quoteCode, {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </div>
                            {Number.isFinite(Number(previewMeta?.unitRate)) &&
                            previewMeta?.unitRate > 0 ? (
                              <div className="text-xs text-white/50 font-medium">
                                {`1 ${getDisplayCurrencyCode(baseCode)} = ${Number(
                                  previewMeta.unitRate,
                                ).toLocaleString(locale, {
                                  minimumFractionDigits: 4,
                                  maximumFractionDigits: 4,
                                })} ${getDisplayCurrencyCode(quoteCode)}`}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          <div className="text-lg text-white/30">—</div>
                        )}
                      </div>

                      {/* Fee section */}
                      {previewMeta?.route === "allocation" &&
                      previewMeta?.isFx &&
                      previewMeta?.spreadFeeRlusd > 0 ? (
                        <div className="rounded-2xl bg-gradient-to-br from-white/8 to-white/4 ring-1 ring-white/12 ring-inset px-4 py-3.5 space-y-2.5">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-white/70 font-semibold">
                              {t("statement_conversion_fee_label", "Frais de conversion")}
                            </span>
                            <span className="text-white/95 font-bold">
                              {formatAmountWithSymbol(locale, previewMeta.spreadFeeRlusd, "USD", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm opacity-75">
                            <span className="text-white/60 font-medium">
                              {t("ui_spread_percentage", "Taux de change")}
                            </span>
                            <span className="text-white/75 font-semibold">
                              {(previewMeta.spreadPercent).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* ── MESSAGES / ALERTS ── */}
                  <div className="space-y-2 pt-2">
                    {sameCurrencySelected ? (
                      <div className="rounded-xl ring-1 ring-amber-400/40 ring-inset bg-gradient-to-br from-amber-400/15 to-amber-400/5 px-4 py-3 text-xs text-amber-100/95 font-semibold flex items-start gap-3">
                        <span className="text-lg leading-none mt-0.5">⚠️</span>
                        <span>{t(
                          "ui_convert_same_asset_warning_6f13d5c9c2",
                          "Choisissez 2 devises différentes",
                        )}</span>
                      </div>
                    ) : null}
                    {insufficientBalance && !sameCurrencySelected ? (
                      <div className="rounded-xl ring-1 ring-red-400/40 ring-inset bg-gradient-to-br from-red-400/15 to-red-400/5 px-4 py-3 text-xs text-red-100/95 font-semibold flex items-start gap-3">
                        <span className="text-lg leading-none mt-0.5">❌</span>
                        <span>{t(
                          "ui_insufficient_balance_convert_a3b4c5d6",
                          "Solde insuffisant. Disponible : {{amount}} {{currency}}",
                        )
                          .replace("{{amount}}", insufficientBalance.availableUnits.toLocaleString(locale, { maximumFractionDigits: 2 }))
                          .replace("{{currency}}", getDisplayCurrencyCode(insufficientBalance.currency))}</span>
                      </div>
                    ) : null}

                    {previewState.status === "loading" ? (
                      <div className="text-xs text-white/60 font-medium flex items-center gap-2">
                        <span className="inline-block w-2 h-2 rounded-full bg-white/60 animate-pulse" />
                        {t(
                          "ui_loading_market_data_1d5d6ed3c4",
                          "Actualisation des données...",
                        )}
                      </div>
                    ) : null}

                    {previewState.status === "error" ? (
                      <div className="rounded-xl ring-1 ring-red-400/40 ring-inset bg-gradient-to-br from-red-400/15 to-red-400/5 px-4 py-3 text-xs text-red-100/95 font-semibold">
                        {previewState.error}
                      </div>
                    ) : null}

                    {convertPreview ? (
                      <p className="text-xs text-white/60 font-medium">
                        {convertPreview}
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* ── FOOTER: Action Buttons ── */}
              <div className="pt-4 md:pt-6 border-t border-white/8">
                <div className="space-y-3">
                  {!isConnected && !isPreviewMode ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onConnectWallet?.();
                      }}
                      className={`w-full text-sm md:text-base py-4 rounded-xl font-semibold transition-all duration-150 ${greenActionBtnBase}`}
                    >
                      {t("wallet_connect_cta", "Connexion du portefeuille")}
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleConvertAction();
                      }}
                      disabled={convertButtonDisabled}
                      className={`w-full py-4 rounded-2xl text-base md:text-lg font-bold transition-all duration-200 ${
                        convertButtonDisabled
                          ? "opacity-50 cursor-not-allowed bg-white/8 text-white/60 ring-1 ring-white/10"
                          : "bg-gradient-to-r from-xcannes-green via-xcannes-green to-xcannes-green/90 text-white hover:shadow-xl hover:shadow-xcannes-green/30 active:scale-95 ring-1 ring-xcannes-green/50"
                      }`}
                    >
                      {convertButtonLabel}
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
