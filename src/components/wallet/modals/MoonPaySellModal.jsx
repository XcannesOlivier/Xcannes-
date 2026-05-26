import { useCallback, useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowDownIcon,
  BanknotesIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import xcannesApi from "@/lib/xcannesApi";
import { getCurrencyFlag, formatAmountWithSymbol } from "../walletDashboardConfig";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { modalSelectButtonCls, modalSelectListCls } from "./walletModalTokens";
import ModalSelect from "@/components/ui/ModalSelect";
import { normalizeCurrencyCode } from "../utils/normalizeCurrencyCode";
import {
  DEBUG_LOGS,
  MOONPAY_ORIGIN_SUFFIX,
  MOONPAY_RESUME_MAX_AGE_MS,
  fmtAmountRight,
  isTrustedMoonPayOrigin,
  resolvePartnerName,
  notifyPwaMoonpayActive,
  normalizeFiatCurrencyCode,
  truncateMiddle,
} from "./walletModalShared";
import { useMoonpayBase } from "../hooks/useMoonpayBase";

// Sell-only constants
const MOONPAY_SELL_RESUME_KEY = "xcannes_moonpay_resume_sell_v1";
const MOONPAY_SELL_FLOW_KEY = "xcannes_moonpay_sell_flow_v1";
const MOONPAY_SELL_SOURCE_KEY = "xcannes_moonpay_sell_source_v1";

/**
 * MoonPaySellModal - Modal pour vendre des cryptos contre fiat
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL source
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPaySellModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  preferredFiatCurrency = "",
  selectCryptoTitleOverride = "",
  destinationMode = "",
  onProceedToUsdSwapOut,
  embedded = false,
  noticeVariant = "preview",
  demoMode = false,
  onDemoSubmit,
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  embeddedOverlayRootRef = null,
}) => {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const resolvedSelectCryptoTitleOverride = String(selectCryptoTitleOverride || "").trim();
  const resolvedDestinationMode = String(destinationMode || "").trim().toLowerCase();
  const isOtherBlockchainsDestination = resolvedDestinationMode === "other_blockchains";
  const isSendToWalletFlow = Boolean(
    isOtherBlockchainsDestination && resolvedSelectCryptoTitleOverride,
  );
  const isBankSellFlow = !isSendToWalletFlow;
  const accentVariant = isSendToWalletFlow ? "fireOrange" : "violet";
  const accentText90 =
    accentVariant === "fireOrange"
      ? "text-[#ff6a00]/90"
      : "text-xcannes-violet/90";
  const accentRing25Bg =
    accentVariant === "fireOrange"
      ? "ring-[#ff6a00]/25 bg-[#ff6a00]"
      : "ring-xcannes-violet/25 bg-xcannes-violet";
  const accentCheck =
    accentVariant === "fireOrange" ? "text-[#ff6a00]" : "text-xcannes-violet";
  const sheetAccentChipClass = "bg-transparent text-white/80";
	  const sheetAccentControlCardClass =
	    accentVariant === "fireOrange"
	      ? "bg-[#ff6a00]/10 ring-1 ring-[#ff6a00]/20 text-white/85"
	      : "bg-xcannes-violet/10 ring-1 ring-xcannes-violet/20 text-white/85";
	  const sheetAccentFlowIconText =
	    accentVariant === "fireOrange" ? "text-[#ffb487]" : "text-xcannes-violet/90";
  const sheetAccentFlowLineVia =
    accentVariant === "fireOrange" ? "bg-[#ff6a00]/30" : "bg-xcannes-violet/30";
  const sheetAccentFlowDotStrong =
    accentVariant === "fireOrange" ? "bg-[#ff6a00]/40" : "bg-xcannes-violet/40";
  const sheetAccentFlowDotSoft =
    accentVariant === "fireOrange" ? "bg-[#ff6a00]/30" : "bg-xcannes-violet/30";

  const modalPanelRef = useRef(null);
  const contentRootRef = useRef(null);

  const {
    iframeUrl, setIframeUrl,
    loading, setLoading,
    error, setError,
    step, setStep,
    displayError,
    moonpayIframeAllow,
    latestStepRef,
    latestIframeUrlRef,
    pendingAutoStartRef,
    getOrCreateFlowId,
    clearFlowId,
    clearMoonpayWalletAddress,
    readResumeState,
    clearResumeState,
    clearAutoOpen,
    deactivateMoonpayActive,
  } = useMoonpayBase({
    tab: "sell",
    resumeKey: MOONPAY_SELL_RESUME_KEY,
    flowKey: MOONPAY_SELL_FLOW_KEY,
    isOpen,
    walletAddress,
  });

  // Options de vente (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [amount, setAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState(() => {
    return normalizeFiatCurrencyCode(preferredFiatCurrency) || "USD";
  }); // Fiat code
  const normalizedPreferredFiatCurrency = useMemo(() => {
    return normalizeFiatCurrencyCode(preferredFiatCurrency);
  }, [preferredFiatCurrency]);
  const [wizardStep, setWizardStep] = useState(1); // 1/3 = asset+amount, 2/3 = receive in, 3/3 = MoonPay iframe
  const [reviewTimestamp, setReviewTimestamp] = useState(null);
  const [xrpPreviewAmount, setXrpPreviewAmount] = useState(null);
  const [opDetailsOpen, setOpDetailsOpen] = useState(false);
  const [techDetailsOpen, setTechDetailsOpen] = useState(false);
  const [sheetDragY, setSheetDragY] = useState(0);
  const sheetDragRef = useRef({ startY: 0, pointerId: null, dragging: false });

  useEffect(() => {
    if (!opDetailsOpen) setTechDetailsOpen(false);
  }, [opDetailsOpen]);

  const handleSheetPointerDown = (e) => {
    e.stopPropagation();
    if (e.pointerType === 'mouse') return;
    if (e.target?.closest?.('button,a,input,textarea')) return;
    sheetDragRef.current = { startY: e.clientY, pointerId: e.pointerId, dragging: false };
  };
  const handleSheetPointerMove = (e) => {
    e.stopPropagation();
    const meta = sheetDragRef.current;
    if (meta.pointerId !== e.pointerId) return;
    const delta = e.clientY - meta.startY;
    if (delta < 0) return;
    if (!meta.dragging && delta > 6) meta.dragging = true;
    if (meta.dragging) setSheetDragY(delta);
  };
  const handleSheetPointerUp = (e) => {
    const meta = sheetDragRef.current;
    if (meta.pointerId !== e.pointerId) return;
    const delta = e.clientY - meta.startY;
    sheetDragRef.current = { startY: 0, pointerId: null, dragging: false };
    if (delta > 80) {
      setSheetDragY(0);
      setOpDetailsOpen(false);
    } else {
      setSheetDragY(0);
    }
  };

  const [walletAddressExpanded, setWalletAddressExpanded] = useState(false);
  const [walletAddressCopied, setWalletAddressCopied] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(min-width: 768px)")?.matches);
  });
  const [cryptoDropdownOpen, setCryptoDropdownOpen] = useState(false);
  const [, setCryptoSearch] = useState("");
  const cryptoDropdownListRef = useRef(null);
  const cryptoDropdownTriggerRef = useRef(null);
  const cryptoDropdownDesktopPopupRef = useRef(null);
  const [, setCryptoOverlayDragging] = useState(false);
  const [, setCryptoOverlayTranslateY] = useState(0);
  const cryptoOverlayDragMetaRef = useRef({
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

  // Étape 2 = résumé : on verrouille le sélecteur pour éviter les edits involontaires.
  useEffect(() => {
    if (wizardStep === 1) return;
    setCryptoDropdownOpen(false);
    setCryptoSearch("");
  }, [wizardStep]);

  const saveResumeState = useMemo(() => {
    return (extra = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.setItem(
          MOONPAY_SELL_RESUME_KEY,
          JSON.stringify({
            v: 1,
            kind: "sell",
            ts: Date.now(),
            walletAddress: String(walletAddress || ""),
            currency: normalizeCurrencyCode(currency),
            amount: String(amount || ""),
            quoteCurrency: normalizeCurrencyCode(quoteCurrency),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, currency, quoteCurrency, walletAddress]);

  const saveSellSourceState = useMemo(() => {
    return (data = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.setItem(
          MOONPAY_SELL_SOURCE_KEY,
          JSON.stringify({
            v: 1,
            kind: "sell",
            ts: Date.now(),
            flowId: String(data?.flowId || "").trim() || null,
            walletAddress: String(walletAddress || "").trim() || null,
            sourceCurrencyCode:
              normalizeCurrencyCode(data?.sourceCurrencyCode) || null,
            sourceAmount:
              Number.isFinite(Number(data?.sourceAmount)) && Number(data?.sourceAmount) > 0
                ? Number(data.sourceAmount)
                : null,
            sourceAmountRlusd:
              Number.isFinite(Number(data?.sourceAmountRlusd)) &&
              Number(data?.sourceAmountRlusd) > 0
                ? Number(data.sourceAmountRlusd)
                : null,
            baseCurrencyCode:
              normalizeCurrencyCode(data?.baseCurrencyCode) || null,
            baseCurrencyAmount:
              Number.isFinite(Number(data?.baseCurrencyAmount)) &&
              Number(data?.baseCurrencyAmount) > 0
                ? Number(data.baseCurrencyAmount)
                : null,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [walletAddress]);

  const clearSellSourceState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.removeItem(MOONPAY_SELL_SOURCE_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const handleUserClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep("form");
      setWizardStep(1);
      setReviewTimestamp(null);
      setWalletAddressExpanded(false);
      setWalletAddressCopied(false);
      onClose?.();
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    onClose,
    setError,
    setIframeUrl,
    setStep,
  ]);

  useEffect(() => {
    return () => {
      deactivateMoonpayActive();
      notifyPwaMoonpayActive(false, "sell");
    };
  }, [deactivateMoonpayActive]);

  const handleWidgetClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep("form");
      setWizardStep(1);
      setReviewTimestamp(null);
      setWalletAddressExpanded(false);
      setWalletAddressCopied(false);
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    setError,
    setIframeUrl,
    setStep,
  ]);

  // If the user closes the Cash modal while the MoonPay widget is open,
  // don't keep the resume cache around.
  useEffect(() => {
    return () => {
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: read latest ref value at cleanup time
      if (latestStepRef.current !== "iframe" || !latestIframeUrlRef.current) return;
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    latestIframeUrlRef,
    latestStepRef,
  ]);

  const supportedCurrencies = useMemo(() => {
    const seen = new Set();
    const orderedTokens = [
      ...(availableTokens || []).filter((token) => {
        const code = normalizeCurrencyCode(token?.currency);
        return code === "XRP" || code === "RLUSD";
      }),
      ...(availableTokens || []).filter((token) => {
        const code = normalizeCurrencyCode(token?.currency);
        return code !== "XRP" && code !== "RLUSD";
      }),
    ];

	    return orderedTokens
	      .map((token) => {
	        const currencyRaw = token?.currency;
	        const currency = normalizeCurrencyCode(currencyRaw);
	        // Do not offer XRP in the sell flow selector.
	        if (currency === "XRP") return null;
	        if (!currency || seen.has(currency)) return null;
	        seen.add(currency);

        const _fullNameSell = getCurrencyDescription(currency) || selectLabelByCurrency?.[currencyRaw] || selectLabelByCurrency?.[currency] || currency;
        const labelLeft = _fullNameSell.length > 15 ? _fullNameSell.slice(0, 15) + '…' : _fullNameSell;
        const amountValue = Number(token?.value || 0);
        const fallbackAmountLabel = Number.isFinite(amountValue)
          ? formatAmountWithSymbol(locale, amountValue, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const amountLabelFromProps =
          selectLabelRightByCurrency?.[currencyRaw] ||
          selectLabelRightByCurrency?.[currency] ||
          "";
        const amountLabel =
          typeof amountLabelFromProps === "string" && amountLabelFromProps.trim()
            ? amountLabelFromProps
            : fallbackAmountLabel;
        const labelRight = amountLabel;
        const labelMobile = labelLeft;
        return {
          code: currency,
          label: labelLeft,
          labelLeft,
          labelRight,
          amountLabel,
          labelMobile,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currency] ||
            getCurrencyFlag(currency),
        };
      })
      .filter(Boolean);
	  }, [
	    availableTokens,
	    selectLabelByCurrency,
	    selectLabelRightByCurrency,
	    selectIconByCurrency,
	    locale,
	  ]);

  const selectedSellCurrency = useMemo(() => {
    const code = normalizeCurrencyCode(currency);
    return supportedCurrencies.find((c) => normalizeCurrencyCode(c?.code) === code) || null;
  }, [currency, supportedCurrencies]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia?.("(min-width: 768px)");
    if (!mediaQuery) return;
    const update = () => setIsDesktopViewport(Boolean(mediaQuery.matches));
    update();
    try {
      mediaQuery.addEventListener?.("change", update);
      return () => mediaQuery.removeEventListener?.("change", update);
    } catch {
      mediaQuery.addListener?.(update);
      return () => mediaQuery.removeListener?.(update);
    }
  }, []);

  useEffect(() => {
    if (!cryptoDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined" && !isDesktopViewport)
        document.body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setCryptoDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      try {
        if (typeof document !== "undefined") document.body.style.overflow = prevOverflow || "";
      } catch {
        // ignore
      }
    };
  }, [cryptoDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (!cryptoDropdownOpen) return;
    if (!isDesktopViewport) return;
    const handler = (event) => {
      const popupEl = cryptoDropdownDesktopPopupRef.current;
      const triggerEl = cryptoDropdownTriggerRef.current;
      if (popupEl && popupEl.contains(event.target)) return;
      if (triggerEl && triggerEl.contains(event.target)) return;
      setCryptoDropdownOpen(false);
      setCryptoSearch("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [cryptoDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (cryptoDropdownOpen) return;
    try {
      const listEl = cryptoDropdownListRef.current;
      const meta = cryptoOverlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setCryptoOverlayDragging(false);
    setCryptoOverlayTranslateY(0);
    cryptoOverlayDragMetaRef.current = {
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
  }, [cryptoDropdownOpen]);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    setCurrency((prev) => {
      const current = normalizeCurrencyCode(prev);
      if (supportedCurrencies.some((curr) => curr.code === current)) {
        return current;
      }
      return supportedCurrencies[0].code;
    });
  }, [isOpen, supportedCurrencies]);

  // Quote currency (fiat) defaults to the wallet's on-chain defaultCurrency memo.
  // The user can still change it inside MoonPay if needed.
  useEffect(() => {
    if (!isOpen) return;
    if (!normalizedPreferredFiatCurrency) return;
    if (step !== "form" || iframeUrl) return;
    if (quoteCurrency === normalizedPreferredFiatCurrency) return;
    setQuoteCurrency(normalizedPreferredFiatCurrency);
  }, [
    iframeUrl,
    isOpen,
    normalizedPreferredFiatCurrency,
    quoteCurrency,
    step,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    const current = normalizeCurrencyCode(currency);
    if (current === "XRP") {
      setCurrency(supportedCurrencies[0].code);
    }
  }, [currency, isOpen, supportedCurrencies]);

  // Resume sell flow after iOS background / reconnect.
  useEffect(() => {
    if (!isOpen) return;
    if (!walletAddress) return;
    if (demoMode) return;
    if (step !== "form" || iframeUrl) return;
    if (!quoteCurrency) return;

    const resume = readResumeState();
    if (!resume) return;
    if (String(resume.walletAddress || "") !== String(walletAddress || "")) return;
    const ageMs = Date.now() - Number(resume.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_RESUME_MAX_AGE_MS) return;

    if (resume.lastIframeUrl) {
      setIframeUrl(String(resume.lastIframeUrl));
      setStep("iframe");
      setWizardStep(3);
      return;
    }

    const nextCurrency = normalizeCurrencyCode(resume.currency);
    if (nextCurrency) setCurrency(nextCurrency);
    if (resume.amount != null) setAmount(String(resume.amount));
    if (resume.quoteCurrency) {
      const nextQuote = normalizeFiatCurrencyCode(resume.quoteCurrency);
      if (nextQuote) setQuoteCurrency(nextQuote);
    }

    pendingAutoStartRef.current = true;
  }, [
    demoMode,
    iframeUrl,
    isOpen,
    pendingAutoStartRef,
    quoteCurrency,
    readResumeState,
    setIframeUrl,
    setStep,
    step,
    walletAddress,
  ]);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- generateSellUrl n'est pas mémoïsé; pendingAutoStartRef/setIframeUrl/setStep sont stables
  useEffect(() => {
    if (!isOpen) return;
    if (!pendingAutoStartRef.current) return;
    if (demoMode) return;
    pendingAutoStartRef.current = false;
    const id = window.setTimeout(() => {
      generateSellUrl();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generateSellUrl n'est pas mémoïsé
  }, [demoMode, isOpen, pendingAutoStartRef]);

  const selectedToken = useMemo(() => {
    const current = normalizeCurrencyCode(currency);
    if (!current) return null;
    return (
      (availableTokens || []).find(
        (token) => normalizeCurrencyCode(token?.currency) === current,
      ) || null
    );
  }, [availableTokens, currency]);

  const amountValue = Number.parseFloat(amount || "");
  const currencyUpper = normalizeCurrencyCode(currency);
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const partnerName = useMemo(() => resolvePartnerName(iframeUrl), [iframeUrl]);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : Number.NaN;
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const conversionMissing =
    isCurrencyLine &&
    hasValidAmount &&
    (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    isCurrencyLine && hasValidAmount && !conversionMissing
      ? amountValue * rlusdRate
      : null;
  const baseCurrencyCode = isCurrencyLine ? "RLUSD" : currencyUpper;
  const baseCurrencyAmount = isCurrencyLine
    ? Number.isFinite(rlusdEquivalent)
      ? Number(rlusdEquivalent.toFixed(6))
      : Number.NaN
    : hasValidAmount
      ? amountValue
      : Number.NaN;
  const sourceAmountRlusd = isCurrencyLine
    ? Number.isFinite(rlusdEquivalent)
      ? Number(rlusdEquivalent.toFixed(6))
      : Number.NaN
    : currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? amountValue
      : Number.NaN;
  const summaryAmountLabel = hasValidAmount
    ? formatAmountWithSymbol(locale, amountValue, currencyUpper || "USD", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      })
    : `— ${currencyUpper || "USD"}`;
  const transferAmountLabel = useMemo(() => {
    if (!hasValidAmount || conversionMissing) return "-";
    const code = currencyUpper === "RLUSD" ? "USD" : currencyUpper;
    const amount = new Intl.NumberFormat(locale, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amountValue);
    return `${amount} ${code}`;
  }, [amountValue, conversionMissing, currencyUpper, hasValidAmount, locale]);
  const reviewTimestampLabel = useMemo(() => {
    if (!reviewTimestamp) return "";
    try {
      return new Intl.DateTimeFormat(locale, {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      }).format(reviewTimestamp);
    } catch {
      return "";
    }
  }, [locale, reviewTimestamp]);

  const formatAmountWithCode = (value, code, options = {}) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    const upper = normalizeCurrencyCode(code);
    const {
      minimumFractionDigits = 2,
      maximumFractionDigits = 2,
      ...rest
    } = options || {};
    const formatted = new Intl.NumberFormat(locale || "en", {
      minimumFractionDigits,
      maximumFractionDigits,
      ...rest,
    }).format(num);
    return upper ? `${formatted} ${upper}` : formatted;
  };

  const resolveRlusdRateForFiat = useCallback((code) => {
    const upper = normalizeCurrencyCode(code);
    if (!upper) return Number.NaN;
    if (upper === "USD" || upper === "RLUSD") return 1;
    const rate = Number(rlusdPerUnitRates?.[upper]);
    return Number.isFinite(rate) && rate > 0 ? rate : Number.NaN;
  }, [rlusdPerUnitRates]);

  const fallbackMoonpayFeeEstimates = useMemo(() => {
    // Show fee estimates in the selected currency line (wallet allocation).
    if (!isCurrencyLine) return null;
    const targetRlusdRate = Number(rlusdRate);
    if (!Number.isFinite(targetRlusdRate) || targetRlusdRate <= 0) return null;

    const amountRlusd = Number(sourceAmountRlusd);
    if (!Number.isFinite(amountRlusd) || amountRlusd <= 0) return null;

    const quoteFiat = String(quoteCurrency || "USD").trim().toUpperCase();
    const quoteFiatRlusdRate = resolveRlusdRateForFiat(quoteFiat);
    if (!Number.isFinite(quoteFiatRlusdRate) || quoteFiatRlusdRate <= 0) return null;

    const amountInQuoteFiat = amountRlusd / quoteFiatRlusdRate;
    if (!Number.isFinite(amountInQuoteFiat) || amountInQuoteFiat <= 0) return null;

    const presets = [
      {
        key: "moonpay_balance",
        label: t("moonpay_fee_method_balance", "MoonPay Balance"),
        rate: 0,
        min: 0,
        requiresFiat: "USD",
      },
      {
        key: "sepa",
        label: t("moonpay_fee_method_sepa", "SEPA Bank Transfer"),
        rate: 0.01,
        min: 3.99,
        requiresFiat: "EUR",
      },
      {
        key: "cards",
        label: t("moonpay_fee_method_cards", "Credit Cards"),
        rate: 0.045,
        min: 3.99,
        requiresFiat: null,
      },
    ];

    const items = presets
      .map((preset) => {
        if (preset.requiresFiat && preset.requiresFiat !== quoteFiat) return null;
        const feeQuoteFiat = Math.max(amountInQuoteFiat * preset.rate, preset.min);
        if (!Number.isFinite(feeQuoteFiat) || feeQuoteFiat < 0) return null;
        const feeRlusd = feeQuoteFiat * quoteFiatRlusdRate;
        const feeTarget = feeRlusd / targetRlusdRate;
        if (!Number.isFinite(feeTarget) || feeTarget < 0) return null;
        return { key: preset.key, label: preset.label, amount: feeTarget };
      })
      .filter(Boolean);

    return items.length ? items : null;
  }, [isCurrencyLine, quoteCurrency, resolveRlusdRateForFiat, rlusdRate, sourceAmountRlusd, t]);

  const [moonpayFeeEstimates, setMoonpayFeeEstimates] = useState(null);
  const [, setMoonpayFeeEstimateError] = useState(null);
  const normalizeFeeError = (value) => {
    if (!value) return null;
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.message || "MoonPay quote failed";
    try {
      const msg = value?.message || value?.error || value?.code;
      if (typeof msg === "string" && msg.trim()) return msg.trim();
      return JSON.stringify(value);
    } catch {
      return "MoonPay quote failed";
    }
  };

  useEffect(() => {
    let cancelled = false;
    if (!isOpen) return () => {};
    if (demoMode) return () => {};
    if (wizardStep !== 2) return () => {};
    if (!isCurrencyLine) return () => {};
    if (!hasValidAmount || conversionMissing) return () => {};

    const run = async () => {
      try {
        setMoonpayFeeEstimateError(null);

        const amountRlusd = Number(sourceAmountRlusd);
        if (!Number.isFinite(amountRlusd) || amountRlusd <= 0) return;

        const xrpQuote = await xcannesApi.getRlusdXrpQuote({
          direction: "RLUSD_TO_XRP",
          amountRlusd,
        });
        const quotedXrpAmount = Number(xrpQuote?.xrpAmount);
        if (!Number.isFinite(quotedXrpAmount) || quotedXrpAmount <= 0) return;

        const xrpAmountToSell = Number(quotedXrpAmount.toFixed(6));
        if (!Number.isFinite(xrpAmountToSell) || xrpAmountToSell <= 0) return;

        const quoteFiat = String(quoteCurrency || "USD").trim().toUpperCase();
        const quoteFiatRlusdRate = resolveRlusdRateForFiat(quoteFiat);
        if (!Number.isFinite(quoteFiatRlusdRate) || quoteFiatRlusdRate <= 0) return;

        const targetRlusdRate = Number(rlusdRate);
        if (!Number.isFinite(targetRlusdRate) || targetRlusdRate <= 0) return;

        const methods = [
          {
            key: "moonpay_balance",
            label: t("moonpay_fee_method_balance", "MoonPay Balance"),
            paymentMethod: "moonpay_balance",
            requiresFiat: "USD",
          },
          {
            key: "sepa",
            label: t("moonpay_fee_method_sepa", "SEPA Bank Transfer"),
            paymentMethod: "sepa_bank_transfer",
            requiresFiat: "EUR",
          },
          {
            key: "cards",
            label: t("moonpay_fee_method_cards", "Credit Cards"),
            paymentMethod: "credit_debit_card",
            requiresFiat: null,
          },
        ].filter((m) => !m.requiresFiat || m.requiresFiat === quoteFiat);

        const results = await Promise.all(
          methods.map(async (method) => {
            const res = await fetch("/api/moonpay/sell-quote", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                currencyCode: "xrp",
                quoteCurrencyCode: quoteFiat,
                baseCurrencyAmount: xrpAmountToSell,
                paymentMethod: method.paymentMethod,
                areFeesIncluded: true,
                extraFeePercentage: 0,
              }),
            });
            const data = await res.json();
            if (!res.ok) {
              throw new Error(data?.message || data?.error || "MoonPay quote failed");
            }
            const q = data?.quote || {};
            const feeAmount = Number(q?.feeAmount || 0);
            const extraFeeAmount = Number(q?.extraFeeAmount || 0);
            const networkFeeAmount = Number(q?.networkFeeAmount || 0);
            const totalFeeQuoteFiat = feeAmount + extraFeeAmount + networkFeeAmount;
            if (!Number.isFinite(totalFeeQuoteFiat) || totalFeeQuoteFiat < 0) return null;
            const feeRlusd = totalFeeQuoteFiat * quoteFiatRlusdRate;
            const feeTarget = feeRlusd / targetRlusdRate;
            if (!Number.isFinite(feeTarget) || feeTarget < 0) return null;
            return { key: method.key, label: method.label, amount: feeTarget };
          }),
        );

        const items = results.filter(Boolean);
        if (!cancelled) setMoonpayFeeEstimates(items.length ? items : null);
      } catch (error) {
        if (!cancelled) {
          setMoonpayFeeEstimateError(normalizeFeeError(error) || "MoonPay quote failed");
          setMoonpayFeeEstimates(null);
        }
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [
    conversionMissing,
    demoMode,
    hasValidAmount,
    isCurrencyLine,
    isOpen,
    quoteCurrency,
    resolveRlusdRateForFiat,
    rlusdRate,
    sourceAmountRlusd,
    t,
    wizardStep,
  ]);

  const effectiveRlusdForPreview = Number.isFinite(rlusdEquivalent) && rlusdEquivalent > 0
    ? rlusdEquivalent
    : !isCurrencyLine && hasValidAmount ? amountValue : null;

  // Aperçu XRP en temps réel (étape 1) — debounced 500 ms
  useEffect(() => {
    setXrpPreviewAmount(null);
    if (!isOpen || demoMode || wizardStep !== 1) return () => {};
    const rlusdAmt = Number(effectiveRlusdForPreview);
    if (!Number.isFinite(rlusdAmt) || rlusdAmt <= 0) return () => {};
    let cancelled = false;
    const id = window.setTimeout(async () => {
      try {
        const q = await xcannesApi.getRlusdXrpQuote({ direction: "RLUSD_TO_XRP", amountRlusd: rlusdAmt });
        const xrpAmt = Number(q?.xrpAmount);
        if (!cancelled && Number.isFinite(xrpAmt) && xrpAmt > 0) setXrpPreviewAmount(xrpAmt);
      } catch {
        // ignore — aperçu non bloquant
      }
    }, 500);
    return () => { cancelled = true; window.clearTimeout(id); };
  }, [demoMode, effectiveRlusdForPreview, isOpen, wizardStep]);

  // Générer l'URL MoonPay pour la vente
  const generateSellUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    if (!hasValidAmount) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }
    if (conversionMissing) {
      setError(
        t(
          "ui_rate_unavailable_base_5c1a9b7d2e",
          "Rate unavailable for base currency.",
        ),
      );
      return;
    }
    if (!Number.isFinite(baseCurrencyAmount) || baseCurrencyAmount <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    // Persist inputs so we can resume after iOS Apple flows / reconnect.
    const flowId = getOrCreateFlowId();
    saveResumeState({
      flowId,
      sourceCurrencyCode: currencyUpper,
      sourceAmount: amountValue,
      sourceAmountRlusd,
      baseCurrencyCode,
      baseCurrencyAmount,
    });
    saveSellSourceState({
      flowId,
      sourceCurrencyCode: currencyUpper,
      sourceAmount: amountValue,
      sourceAmountRlusd,
      baseCurrencyCode,
      baseCurrencyAmount,
    });

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(baseCurrencyCode || "RLUSD").toUpperCase(),
            quoteCurrencyCode: String(quoteCurrency || "USD").toUpperCase(),
            amount: baseCurrencyAmount,
          }),
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setIframeUrl(null);
        setStep("success");
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      setStep("loading");

      let effectiveBaseCurrencyCode = normalizeCurrencyCode(baseCurrencyCode);
      let effectiveBaseCurrencyAmount = baseCurrencyAmount;

      if (effectiveBaseCurrencyCode !== "XRP") {
        const preparedSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: walletAddress,
          direction: "RLUSD_TO_XRP",
          amountRlusd: sourceAmountRlusd,
        });
        const preparedXrpAmount = Number(preparedSwap?.quote?.xrpAmount);
        if (!Number.isFinite(preparedXrpAmount) || preparedXrpAmount <= 0) {
          throw new Error(
            t(
              "moonpay_error_prepare_swap_sell",
              "Unable to prepare the XRPL swap before MoonPay sell.",
            ),
          );
        }
        effectiveBaseCurrencyCode = "XRP";
        effectiveBaseCurrencyAmount = Number(preparedXrpAmount.toFixed(6));
      }

      const response = await fetch("/api/moonpay/generate-sell-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode: effectiveBaseCurrencyCode,
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount: effectiveBaseCurrencyAmount,
          options: flowId ? { xcannesFlowId: flowId } : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_sell_url_9b2c7a1d5e",
              "Failed to generate sell URL.",
            ),
        );
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        saveResumeState({ lastIframeUrl: data.url });
        setWizardStep(3);
        setStep("iframe");
      } else {
        throw new Error(
          t(
            "moonpay_error_invalid_response_6b2d8c1a9f",
            "Invalid response from server.",
          ),
        );
      }
    } catch (err) {
      console.error("Error generating sell URL:", err);
      setError(
        err.message ||
          t(
            "moonpay_error_load_widget_3c1a7d8b2e",
            "Failed to load MoonPay widget.",
          ),
      );
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;
      if (DEBUG_LOGS) {
        console.log("MoonPay sell message received:", event.data);
      }

      if (type === "transaction_completed" || status === "completed") {
        clearResumeState();
        clearSellSourceState();
        clearAutoOpen();
        clearFlowId();
        clearMoonpayWalletAddress();
        setStep("success");
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      if (type === "transaction_failed" || status === "failed") {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again.",
          ),
        );
        setStep("error");
      }

      if (type === "close" || type === "widget_closed") {
        handleWidgetClose();
      }
    };

    if (isOpen) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    handleWidgetClose,
    isOpen,
    onClose,
    setError,
    setStep,
    t,
  ]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, quoteCurrency, setError]);

  const amountForCtaLabel = useMemo(() => {
    const raw = String(amount || "").trim();
    if (!raw) return "";
    const num = Number(raw);
    if (!Number.isFinite(num)) return raw;
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(num);
  }, [amount, locale]);

  const continueLabel = loading
	    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
	    : demoMode
	      ? t("moonpay_action_simulate_sell_4d1a9c7b2e", "Simulate sell")
	      : t("ui_continue", "Continuer");
  const continueDisabled =
    loading || !hasValidAmount || !selectedToken || conversionMissing;

  const handleContinue = () => {
    if (wizardStep === 1) {
        if (
          isOtherBlockchainsDestination &&
          typeof onProceedToUsdSwapOut === "function"
        ) {
        const prefill = Number.isFinite(baseCurrencyAmount)
          ? String(baseCurrencyAmount)
          : hasValidAmount
            ? String(amountValue)
            : "";
        onProceedToUsdSwapOut(prefill, {
          direction: "rlusd_to_stable",
          accentVariant: "fireOrange",
        });
        return;
      }
      generateSellUrl();
      return;
    }
    generateSellUrl();
  };

  const handleCopyWalletAddress = async (event) => {
    event?.stopPropagation?.();
    try {
      const value = String(walletAddress || "").trim();
      if (!value) return;
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = value;
        textarea.style.position = "fixed";
        textarea.style.top = "-1000px";
        textarea.style.left = "-1000px";
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
      setWalletAddressCopied(true);
      window.setTimeout(() => setWalletAddressCopied(false), 1400);
    } catch {
      // ignore
    }
  };

  const highlightPhrases = (text, phrases) => {
    const input = String(text || "");
    const list = Array.isArray(phrases) ? phrases.filter(Boolean) : [];
    if (!input || list.length === 0) return text;
    const escapeRegExp = (str) =>
      String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const parts = input.split(
      new RegExp(`(${list.map(escapeRegExp).join("|")})`, "g"),
    );
	    return parts.map((part, idx) =>
	      list.includes(part) ? (
	        <span
	          key={idx}
	          className={[accentText90, "font-semibold"].join(" ")}
	        >
	          {part}
	        </span>
	      ) : (
	        <span key={idx}>{part}</span>
	      ),
    );
  };

  const shouldAnimate = !embedded;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (embedded) {
    if (!isOpen) return null;
  } else if (!shouldRender) {
    return null;
  }

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div ref={contentRootRef} className="relative min-h-full flex flex-col">
      <div className={embedded ? "flex-1" : "flex-1 p-4 md:p-5"}>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">

          {/* Title + Wallet pill */}
          {wizardStep === 1 ? (
		          <div className={`relative z-[66] px-4 ${hasValidAmount && !conversionMissing ? 'pt-[16px]' : 'pt-[40px]'} md:pt-[90px] pb-4 text-center`}>
            <h3 className="text-[30px] md:text-[34px] font-semibold text-white/95 tracking-tight mb-2">
              {resolvedSelectCryptoTitleOverride ||
                t("moonpay_sell_withdraw_title_prefix", "Transférer vers la banque")}
            </h3>
            {isBankSellFlow ? (
              <div className="mb-4 flex flex-col items-center">
	                <p className="mt-2 text-[14px] md:text-[15px] text-white/80 max-w-[40ch] mx-auto leading-relaxed text-center">
	                  {t(
	                    "moonpay_sell_bank_methods_full",
	                    "Recevez vos fonds par virement bancaire, carte ou PayPal selon votre pays.",
	                  )}
	                </p>
              </div>
            ) : null}
	            <div className="flex justify-center">
	              <div className={`inline-flex flex-col items-center gap-1 bg-transparent xcannes-fade-border-y px-4 py-2 rounded-[20px] shadow-none ${cryptoDropdownOpen ? 'ring-1 ring-white/20 ring-inset' : ''}`}>
                <span className="text-white/50 text-[11px] font-medium tracking-wide">
                  {t("moonpay_from_account", "Compte source")}
                </span>
                <div className="flex items-center gap-2">
                  <span
                    className={["h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse", accentRing25Bg].join(" ")}
                    aria-hidden
                  />
                  <span className="text-white/95 text-[17px] md:text-[18px] font-semibold">
                    {walletLabel || "XCANNES"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          ) : null}

		          {/* Currency selector */}
			          <div className={wizardStep === 1 ? "relative z-[66] mt-7" : "hidden"}>
		              <div className="text-[13px] tracking-normal font-medium text-white/55 mb-2">
		                {t("moonpay_sell_send_currency_label", "Devise à transférer")}
		              </div>
			              <ModalSelect
			                value={currency}
			                onChange={(val) => setCurrency(normalizeCurrencyCode(val))}
			                onOpenChange={setCryptoDropdownOpen}
			                portalTarget={embedded ? contentRootRef.current : modalPanelRef.current}
			                options={(supportedCurrencies || []).map((opt) => {
			                  const labelLeftText = opt.labelLeft || opt.label || opt.code;
			                  const isSelected = String(opt.code) === String(currency || "");
		                  const labelRight = !cryptoDropdownOpen && isSelected
		                    ? (
		                      <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
		                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-50 shrink-0">
		                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.5"/>
		                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
		                        </svg>
		                        <span>{t("ui_balances_short_label_aa12", "Solde disponible")}</span>
		                      </span>
		                    )
		                    : (opt.amountLabel
		                        ? fmtAmountRight(opt.amountLabel)
		                        : null);
		                  return {
		                    value: opt.code,
		                    icon: opt.icon,
		                    label: labelLeftText,
		                    labelLeft: <span className="md:text-[1.12em]">{labelLeftText}</span>,
		                    labelRight,
		                    labelMobile: opt.labelMobile || labelLeftText,
		                  };
		                })}
		                useNativeSelect={false}
		                hideSelected
		                showMobileOptionRight={true}
		                iconClassName="text-3xl leading-none"
		                optionIconClassName="text-2xl leading-none opacity-60"
		                optionClassName="py-2 md:py-2.5 !text-base md:!text-lg !text-white/60"
		                menuHeader={t("ui_your_balances_header", "Vos soldes")}
			                backdropClassName=""
		                buttonClassName={modalSelectButtonCls}
		                openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
		                menuClassName={noticeVariant === "demo" ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]" : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[450px]"}
		                selectClassName={modalSelectListCls}
		              />
		          </div>
	          {/* Amount input (étape 1/2) */}
	            <div className={wizardStep === 1 ? "mt-6" : "hidden"}>
		              <div className="text-[13px] tracking-normal font-medium text-white/55 mb-2">
		                {t("moonpay_amount_to_sell", "Montant")}
		              </div>
	              <div className="relative z-[2] bg-[#111518] rounded-[18px] p-0">
	              <div className={[
	                'relative flex items-center gap-3 px-5 pt-5 pb-5 rounded-[18px] bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset transition-all duration-200 overflow-hidden wallet-amount-shimmer',
	                'shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)]',
	                'focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)]',
	              ].join(' ')}>
		                <input
		                  type="text"
		                  value={amount}
		                  onChange={
                        wizardStep === 1 ? (e) => setAmount(e.target.value) : undefined
                      }
		                  placeholder={t("ui_enter_amount_placeholder_zero", "0.00")}
		                  inputMode="decimal"
                      readOnly={wizardStep !== 1}
			                  className={[
	                        "flex-1 min-w-0 bg-transparent text-white text-4xl md:text-5xl font-bold placeholder:text-white/35 focus:outline-none transition-all duration-150",
	                        wizardStep !== 1 ? "cursor-default opacity-95" : "",
	                      ].join(" ")}
			                />

	                <span className="shrink-0 text-white/70 drop-shadow-sm text-2xl md:text-3xl font-semibold">
	                  {currency}
	                </span>
	              </div>
	            </div>{/* /wrapper opaque */}
	              {isCurrencyLine && hasValidAmount && conversionMissing ? (
	                <p className="mt-2 text-[11px] text-red-300">
	                  {t(
	                    "ui_rate_unavailable_base_5c1a9b7d2e",
	                    "Rate unavailable for base currency.",
	                  )}
	                </p>
	              ) : null}

              {hasValidAmount && !conversionMissing ? (
                <div className="mt-4 flex flex-col gap-2 animate-fade-in">
                  <p className="text-[13px] text-white/45 leading-snug">
                    {t('ui_sell_summary_line', {
                      defaultValue: 'Vous transférez {{amount}} {{currency}} vers votre compte bancaire',
                      amount: new Intl.NumberFormat(locale, { minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(amountValue),
                      currency: normalizeCurrencyCode(currency),
                    })}
                  </p>
                  <button
                    type="button"
                    onClick={() => setOpDetailsOpen(true)}
                    className={['text-[13px] font-medium underline underline-offset-[3px] decoration-1 transition-opacity hover:opacity-75', accentText90].join(' ')}
                  >
                    {t('ui_op_details_link', "Détails de l'opération")}
                  </button>
                </div>
              ) : null}
		            </div>

		            {wizardStep === 1 ? (
		              <>
	                {/* Arrow down (hide for "other stablecoin" flow) */}
		                {!isOtherBlockchainsDestination && !isBankSellFlow ? (
		                  <div className="flex justify-center">
		                    <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center">
		                      <ArrowDownIcon
		                        className={[
		                          "w-5 h-5",
		                          accentCheck,
		                        ].join(" ")}
		                      />
		                    </div>
		                  </div>
		                ) : null}

	                {/* Destination display */}
	                {isOtherBlockchainsDestination ? (
	                  <p className="px-1 text-[13px] md:text-sm leading-snug text-white/55 whitespace-pre-line">
	                    {highlightPhrases(
	                      t(
	                        "ui_simpleswap_choose_stablecoin_and_network_65fbbf3a2a",
	                        "Vous choisirez le stablecoin de destination (USDC, USDT…)\net le réseau sur la page suivante (SimpleSwap)",
	                      ),
	                      ["(USDC, USDT…)", "SimpleSwap)"],
	                    )}
	                  </p>
	                ) : null}
		              </>
		            ) : null}

                {/* Spacer to match "Ajouter des fonds" CTA gap (20 + 16 + 20) */}
                {wizardStep === 1 && isBankSellFlow ? (
                  <div className="px-1 py-2" aria-hidden="true" />
                ) : null}

		          {demoMode ? (
		            <div className="rounded-[20px] ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
		              {t(
                "moonpay_info_sell_demo_6d1a9c2b7e",
                "Mode démo : la vente est simulée (pas de virement bancaire).",
              )}
            </div>
          ) : null}

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-[20px]">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

	          {/* Continue button */}
          <button
            type="button"
            onClick={handleContinue}
            disabled={continueDisabled}
            className={[
              "md:hidden mt-11 w-full h-[52px] md:h-[56px] flex items-center justify-center rounded-[14px] text-[22px] md:text-[24px] font-semibold transition-all duration-200 tracking-[-0.01em]",
              continueDisabled
                ? isSendToWalletFlow
                  ? "text-white/90 cursor-not-allowed ring-[0.5px] ring-orange-500/30 ring-inset"
                  : "text-white/90 cursor-not-allowed ring-[0.5px] ring-violet-500/30 ring-inset"
                : "text-white hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? isSendToWalletFlow
                ? { background: 'linear-gradient(180deg, rgba(255,106,0,0.34) 0%, rgba(232,95,0,0.34) 100%)', boxShadow: '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)' }
                : { background: 'linear-gradient(180deg, rgba(124,58,237,0.34) 0%, rgba(91,33,182,0.34) 100%)', boxShadow: '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)' }
              : { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,1) 0%, rgba(232,95,0,1) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,1) 0%, rgba(91,33,182,1) 100%)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueDisabled && !isSendToWalletFlow
              ? <span className="inline-flex items-center gap-1.5 text-white/85">
                  <span className="text-[14px] md:text-[16px]">{t('ui_sell_fill_cta', 'Choisissez la devise et le montant')}</span>
                  <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                    <span className="sell-dot" style={{ animationDelay: '0s' }}>·</span>
                    <span className="sell-dot" style={{ animationDelay: '0.6s' }}>·</span>
                    <span className="sell-dot" style={{ animationDelay: '1.2s' }}>·</span>
                  </span>
                </span>
              : continueLabel}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={continueDisabled}
            className={[
              "hidden md:flex mt-11 items-center justify-center w-full h-[52px] md:h-[56px] rounded-[14px] text-[22px] md:text-[24px] font-semibold transition-all duration-200 tracking-[-0.01em]",
              continueDisabled
                ? isSendToWalletFlow
                  ? "text-white/90 cursor-not-allowed ring-[0.5px] ring-orange-500/30 ring-inset"
                  : "text-white/90 cursor-not-allowed ring-[0.5px] ring-violet-500/30 ring-inset"
                : "text-white hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? isSendToWalletFlow
                ? { background: 'linear-gradient(180deg, rgba(255,106,0,0.34) 0%, rgba(232,95,0,0.34) 100%)', boxShadow: '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)' }
                : { background: 'linear-gradient(180deg, rgba(124,58,237,0.34) 0%, rgba(91,33,182,0.34) 100%)', boxShadow: '0 12px 24px rgba(0,0,0,0.44), 0 5px 12px rgba(0,0,0,0.24), inset 0 1px 0 rgba(255,255,255,0.12), inset 0 -10px 16px rgba(0,0,0,0.24)' }
              : { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,1) 0%, rgba(232,95,0,1) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,1) 0%, rgba(91,33,182,1) 100%)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueDisabled && !isSendToWalletFlow
              ? <span className="inline-flex items-center gap-1.5 text-white/85">
                  <span className="text-[14px] md:text-[16px]">{t('ui_sell_fill_cta', 'Choisissez la devise et le montant')}</span>
                  <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                    <span className="sell-dot" style={{ animationDelay: '0s' }}>·</span>
                    <span className="sell-dot" style={{ animationDelay: '0.6s' }}>·</span>
                    <span className="sell-dot" style={{ animationDelay: '1.2s' }}>·</span>
                  </span>
                </span>
              : continueLabel}
          </button>
          <style>{`
            @keyframes sellDotBlink {
              0%, 100% { opacity: 0.18; }
              50% { opacity: 0.7; }
            }
            .sell-dot {
              animation: sellDotBlink 2.4s ease-in-out infinite;
              font-size: 1.3em;
              line-height: 1;
            }
          `}</style>
	          {!demoMode && isBankSellFlow ? (
	            <div className="text-center text-[12px] md:text-[13px] text-white/50 mt-5 leading-relaxed">
	              <p>{t("moonpay_sell_bank_partner_notice_full", "Transfert sécurisé via MoonPay ou Topper.")}</p>
	              <p>{t('moonpay_sell_partner_location_note_cta', 'Conversion automatique si nécessaire.')}</p>
	            </div>
	          ) : null}
	        </div>
	      )}

      {/* Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-white/80">
            {t("moonpay_loading_widget", "Loading MoonPay widget...")}
          </p>
        </div>
      )}

      {/* MoonPay iframe */}
      {step === "iframe" && iframeUrl && (
        <div className="relative">
          <div
            className="relative"
            style={{ height: "calc(100vh - 40px)", minHeight: "600px", maxHeight: "760px" }}
          >
          <iframe
            src={iframeUrl}
            className="w-full h-full rounded-[20px]"
            allow={moonpayIframeAllow}
            allowFullScreen
            title={t("moonpay_widget_title_sell", "MoonPay Sell Widget")}
          />
          </div>
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_sell_success_title", "Sale Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_sell_success_body",
              "Your funds will be transferred to your bank account.",
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-[20px] transition-all"
          >
            {t("close", "Close")}
          </button>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex flex-col items-center justify-center py-12">
          <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_error_title", "Something went wrong")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {displayError ||
              t(
                "moonpay_error_try_again_later_6f2b1c9d8a",
                "Please try again later.",
              )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
                setIframeUrl(null);
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-[20px] transition-colors"
            >
              {t("try_again", "Try Again")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-[20px] transition-all"
            >
              {t("close", "Close")}
            </button>
          </div>
        </div>
      )}
      </div>
      {/* Bottom bar – desktop only (visual balance) */}
      <div className="hidden md:flex pointer-events-none justify-center pt-2 pb-2" aria-hidden>
        <span className="block w-[120px] h-[4px] rounded-full bg-white/30" />
      </div>
      {/* Bottom bar – mobile only */}
      <div
        className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
        aria-hidden
      >
        <span className="block w-36 h-1.5 rounded-full bg-white/80" />
      </div>
    </div>
  );

  // Mode embedded: retourner le contenu + le portal du bottom sheet
  if (embedded) {
    const sheetTarget = embeddedOverlayRootRef?.current || document.body;
    const sheetPos = embeddedOverlayRootRef?.current ? 'absolute' : 'fixed';
    const sheetZ = embeddedOverlayRootRef?.current ? 'z-[50]' : 'z-[10040]';
    return (
      <>
        {renderContent()}
        {opDetailsOpen && typeof document !== 'undefined' ? createPortal(
          <div className={`${sheetPos} inset-0 ${sheetZ} flex items-end`}>
            <div
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
              style={sheetDragY ? { opacity: Math.max(0, Math.min(1, 1 - sheetDragY / 420)), transition: 'opacity 200ms ease' } : undefined}
              onClick={() => setOpDetailsOpen(false)}
            />
            <div
              className="relative w-full max-h-full bg-elevated rounded-t-[22px] xcannes-sheet-fade-border-violet shadow-2xl"
              style={{
                transform: `translateY(${sheetDragY}px)`,
                opacity: sheetDragY ? Math.max(0, Math.min(1, 1 - sheetDragY / 420)) : undefined,
                transition: sheetDragY ? 'none' : 'transform 200ms ease, opacity 200ms ease',
                willChange: sheetDragY ? 'transform, opacity' : undefined,
              }}
              onPointerDown={handleSheetPointerDown}
              onPointerMove={handleSheetPointerMove}
              onPointerUp={handleSheetPointerUp}
              onPointerCancel={handleSheetPointerUp}
            >
              {/* Bottom indicator – mobile only */}
              <div
                className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
                aria-hidden
              >
                <span className="block w-36 h-1.5 rounded-full bg-white/80" />
              </div>
              <div className="px-6 pt-5 pb-8 max-h-[inherit] overflow-y-auto rounded-t-[22px]">
              <div className="flex justify-center mb-4 md:hidden">
                <span className="block w-12 h-1.5 rounded-full bg-white/15" aria-hidden />
              </div>

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="flex items-start gap-3 min-w-0">
	                  <span
	                    className={[
	                      "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
	                      sheetAccentChipClass,
	                    ].join(" ")}
	                    aria-hidden
	                  >
	                    <BanknotesIcon className="h-[40px] w-[40px]" style={{ strokeWidth: 0.5 }} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="text-white font-semibold text-lg leading-tight">
                      {t("ui_op_details_sell_header_title", "Retrait sécurisé")}
                    </h2>
                    <p className="mt-1 text-[13px] leading-snug text-white/55">
                      {t(
                        "ui_op_details_sell_header_subtitle",
                        "Recevez vos fonds sur votre compte bancaire",
                      )}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSheetDragY(0); setOpDetailsOpen(false); }}
                  className="hidden md:flex text-white/50 hover:text-white transition-colors text-xl leading-none p-1"
                  aria-label={t('ui_close', 'Fermer')}
                >
                  ✕
                </button>
              </div>

              {/* Summary */}
              <div className="mb-5 rounded-2xl bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset p-4 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
	                <div className="space-y-1.5">
	                  <p className="text-[13px] font-medium leading-snug text-white/85">
	                    {t(
	                      "ui_op_details_sell_bank_transfer_notice",
	                      "Vous transférez {{amount}} vers votre compte bancaire *",
	                      { amount: transferAmountLabel },
	                    )}
	                  </p>
	                  <p className="text-[11px] leading-snug text-white/45">
	                    {t(
	                      "ui_op_details_sell_bank_transfer_variation_note",
	                      "Le montant reçu peut varier selon le mode de transfert utilisé via MoonPay.",
	                    )}
	                  </p>
	                </div>
                <div className="mt-2.5 flex items-center justify-between gap-3">
                  <span className="text-[12px] text-white/55">
                    {t("ui_op_details_summary_processing", "Traitement")}
                  </span>
                  <span className="inline-flex items-center gap-2 text-white/80 font-medium text-[13px]">
                    <span className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-2.5 py-1">
                      {partnerName}
                    </span>
                  </span>
                </div>
	                <div className="mt-3">
	                  <span className="inline-flex rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-[11px] text-white/70">
	                    {t("ui_op_details_summary_auto_conversion", "Conversion automatique")}
	                  </span>
	                </div>
              </div>

              {/* Flow */}
              <div className="rounded-2xl bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset p-4 shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
	                <div
	                  className={[
	                    "mb-5 rounded-2xl px-4 py-3 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
	                    sheetAccentControlCardClass,
	                  ].join(" ")}
	                >
		                  <p className="leading-snug">
		                    {t("ui_op_flow_control_card", "Aucune opération n’est effectuée sans votre validation.")}
		                  </p>
		                </div>

			                <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 text-[14px] leading-snug text-white/80">
			                  <div className="flex h-10 items-center justify-center">
			                    <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="h-[40px] w-[40px]" aria-hidden="true"><path strokeWidth="1.25" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /><path strokeWidth="1" d="M9 12.75 11.25 15 15 9.75" /></svg>
			                      </span>
			                  </div>
			                  <div className="min-w-0 self-center">
			                      <div className="text-white/90 font-semibold">
			                        {t("ui_op_flow_sell_step1_title", "Vous confirmez le retrait")}
			                      </div>
				                      <div className="mt-1 text-white/55">
				                        {t(
				                          "ui_op_flow_sell_step1_conversion_subtitle",
				                          "Conversion automatique via les services de liquidité.",
				                        )}
			                      </div>
			                  </div>

			                  <div className="flex h-8 items-center justify-center">
			                    <div className={["relative h-full w-px", sheetAccentFlowLineVia].join(" ")}>
			                      <span className={["absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse", sheetAccentFlowDotStrong].join(" ")} />
			                    </div>
			                  </div>
			                  <div />

			                  <div className="flex h-10 items-center justify-center">
			                    <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                        <ShieldCheckIcon className="h-[40px] w-[40px]" style={{ strokeWidth: 1.25 }} />
			                      </span>
			                  </div>
			                  <div className="min-w-0 self-center">
			                      <div className="text-white/90 font-semibold">
			                        {t("ui_op_flow_step2_title", { defaultValue: "{{partner}} traite l’opération", partner: partnerName })}
			                      </div>
				                      <div className="mt-1 text-white/55">
				                        {t(
				                          "ui_op_flow_sell_step2_validation_subtitle",
				                          "Vous validez l’opération chez {{partner}}.",
				                          { partner: partnerName },
				                        )}
			                      </div>
			                  </div>

			                  <div className="flex h-8 items-center justify-center">
			                    <div className={["relative h-full w-px", sheetAccentFlowLineVia].join(" ")}>
			                      <span className={["absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse", sheetAccentFlowDotSoft].join(" ")} />
			                    </div>
			                  </div>
			                  <div />

			                  <div className="flex h-10 items-center justify-center">
			                    <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" className="h-[40px] w-[40px]" aria-hidden="true">
				                          <path d="M3 10h18" />
				                          <path d="M5 10V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
				                          <path d="M7 14h10" />
				                          <path d="M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
				                        </svg>
			                      </span>
			                  </div>
			                  <div className="min-w-0 self-center">
			                      <div className="text-white/90 font-semibold">
			                        {t("ui_op_flow_sell_step3_title", "Les fonds sont transférés vers votre banque")}
			                      </div>
			                      <div className="mt-1 text-white/55">
			                        {t("ui_op_flow_sell_step3_subtitle", "Virement vers votre compte bancaire une fois validé.")}
			                      </div>
			                  </div>
			                </div>

                {xrpPreviewAmount !== null ? (
                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={() => setTechDetailsOpen((v) => !v)}
                      className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-left"
                      aria-expanded={techDetailsOpen}
                    >
	                      <span className="text-[13px] font-semibold text-white/65">
		                      {t(
		                        "ui_op_details_network_tech_title",
		                        "Détails techniques du réseau (XRP)",
		                      )}
                      </span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={["h-4 w-4 text-white/45 transition-transform duration-200", techDetailsOpen ? "rotate-180" : ""].join(" ")} aria-hidden="true">
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </button>
                    <div
                      className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
                      style={{ maxHeight: techDetailsOpen ? "120px" : "0px", opacity: techDetailsOpen ? 1 : 0 }}
                    >
                      <p className="mt-2 px-1 text-[13px] leading-snug text-white/55">
                        {t("ui_op_details_sell_new_xrp_used", {
                          defaultValue: "≈ {{xrp}} XRP utilisés pendant le traitement de l’opération.",
                          xrp: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(xrpPreviewAmount),
                        })}
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
              </div>
              {/* Bottom bar – desktop only (visual balance) */}
              <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-2" aria-hidden>
                <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
              </div>
            </div>
          </div>,
          sheetTarget,
        ) : null}
      </>
    );
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
	      <div
	        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
	          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
	        }`}
	        onClick={step === "iframe" ? null : handleUserClose}
	      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
	        <div
	          ref={modalPanelRef}
	          className={`relative w-full wallet-modal-panel max-w-2xl border rounded-2xl overflow-hidden pointer-events-auto shadow-2xl ${
	            noticeVariant === "demo"
	              ? "bg-xcannes-surface-demo border-white/10"
	              : "bg-elevated border-subtle"
	          } ${isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
	          onClick={(e) => e.stopPropagation()}
	        >
	          <button
	            type="button"
	            onClick={handleUserClose}
	            className={`absolute ${
	              step === "iframe" ? "top-1 right-1 md:top-2 md:right-2" : "top-4 right-4"
	            } z-20 text-white/60 hover:text-white transition-colors bg-transparent rounded-full w-10 h-10 flex items-center justify-center hover:bg-white/5`}
	            aria-label={t('close', 'Fermer')}
	          >
	            <span aria-hidden className="text-xl leading-none">✕</span>
	          </button>

	          {/* Content */}
	          {renderContent()}
	        </div>
      </div>

      {/* Bottom sheet — Détails de l'opération */}
      {opDetailsOpen && typeof document !== 'undefined' && modalPanelRef.current ? createPortal(
        <div className="absolute inset-0 z-[50] flex items-end">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpDetailsOpen(false)}
          />
          <div className="relative w-full max-h-full bg-elevated rounded-t-[22px] xcannes-sheet-fade-border-violet shadow-2xl">
            {/* Bottom indicator – mobile only */}
            <div
              className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
              aria-hidden
            >
              <span className="block w-36 h-1.5 rounded-full bg-white/80" />
            </div>
            <div className="px-6 pt-5 pb-8 max-h-[inherit] overflow-y-auto rounded-t-[22px]">
            <div className="md:hidden flex justify-center mb-4">
              <span className="block w-12 h-1.5 rounded-full bg-white/15" aria-hidden />
            </div>
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-5">
              <div className="flex items-start gap-3 min-w-0">
	                <span
	                  className={[
	                    "inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl",
	                    sheetAccentChipClass,
	                  ].join(" ")}
	                  aria-hidden
	                >
	                  <BanknotesIcon className="h-[40px] w-[40px]" style={{ strokeWidth: 0.7 }} />
                </span>
                <div className="min-w-0">
                  <h2 className="text-white font-semibold text-lg leading-tight">
                    {t("ui_op_details_sell_header_title", "Retrait sécurisé")}
                  </h2>
                  <p className="mt-1 text-[13px] leading-snug text-white/55">
                    {t(
                      "ui_op_details_sell_header_subtitle",
                      "Recevez vos fonds sur votre compte bancaire",
                    )}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpDetailsOpen(false)}
                className="text-white/50 hover:text-white transition-colors text-xl leading-none p-1"
                aria-label={t('ui_close', 'Fermer')}
              >
                ✕
              </button>
            </div>

            {/* Summary */}
            <div className="mb-5 rounded-2xl bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset p-4 shadow-[0_14px_28px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.05)]">
	              <div className="space-y-1.5">
	                <p className="text-[13px] font-medium leading-snug text-white/85">
	                  {t(
	                    "ui_op_details_sell_bank_transfer_notice",
	                    "Vous transférez {{amount}} vers votre compte bancaire *",
	                    { amount: transferAmountLabel },
	                  )}
	                </p>
	                <p className="text-[11px] leading-snug text-white/45">
	                  {t(
	                    "ui_op_details_sell_bank_transfer_variation_note",
	                    "Le montant reçu peut varier selon le mode de transfert utilisé via MoonPay.",
	                  )}
	                </p>
	              </div>
              <div className="mt-2.5 flex items-center justify-between gap-3">
                <span className="text-[12px] text-white/55">
                  {t("ui_op_details_summary_processing", "Traitement")}
                </span>
                <span className="inline-flex items-center gap-2 text-white/80 font-medium text-[13px]">
                  <span className="inline-flex items-center rounded-full bg-white/5 ring-1 ring-white/10 px-2.5 py-1">
                    {partnerName}
                  </span>
                </span>
              </div>
            <div className="mt-3">
              <span className="inline-flex rounded-full bg-white/5 ring-1 ring-white/10 px-3 py-1 text-[11px] text-white/70">
                {t("ui_op_details_summary_auto_conversion", "Conversion automatique")}
              </span>
            </div>
            </div>

            {/* Flow */}
	            <div className="rounded-2xl bg-black/40 backdrop-blur-sm ring-1 ring-white/10 ring-inset p-4 shadow-[0_14px_28px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.05)]">
	              <div
	                className={[
	                  "mb-5 rounded-2xl px-4 py-3 text-[13px] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
	                  sheetAccentControlCardClass,
	                ].join(" ")}
	              >
		                <p className="leading-snug">
		                  {t("ui_op_flow_control_card", "Aucune opération n’est effectuée sans votre validation.")}
		                </p>
	              </div>

			              <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] gap-x-4 text-[14px] leading-snug text-white/80">
			                <div className="flex h-10 items-center justify-center">
			                  <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" className="h-[40px] w-[40px]" aria-hidden="true"><path strokeWidth="1.25" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /><path strokeWidth="1" d="M9 12.75 11.25 15 15 9.75" /></svg>
			                    </span>
			                </div>
			                <div className="min-w-0 self-center">
			                    <div className="text-white/90 font-semibold">
			                      {t("ui_op_flow_sell_step1_title", "Vous confirmez le retrait")}
			                    </div>
				                    <div className="mt-1 text-white/55">
				                      {t(
				                        "ui_op_flow_sell_step1_conversion_subtitle",
				                        "Conversion automatique via les services de liquidité.",
				                      )}
			                    </div>
			                </div>

			                <div className="flex h-8 items-center justify-center">
			                  <div className={["relative h-full w-px", sheetAccentFlowLineVia].join(" ")}>
			                    <span className={["absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse", sheetAccentFlowDotStrong].join(" ")} />
			                  </div>
			                </div>
			                <div />

			                <div className="flex h-10 items-center justify-center">
			                  <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                      <ShieldCheckIcon className="h-[40px] w-[40px]" style={{ strokeWidth: 1.25 }} />
			                    </span>
			                </div>
			                <div className="min-w-0 self-center">
			                    <div className="text-white/90 font-semibold">
			                      {t("ui_op_flow_step2_title", { defaultValue: "{{partner}} traite l’opération", partner: partnerName })}
			                    </div>
				                    <div className="mt-1 text-white/55">
				                      {t(
				                        "ui_op_flow_sell_step2_validation_subtitle",
				                        "Vous validez l’opération chez {{partner}}.",
				                        { partner: partnerName },
				                      )}
			                    </div>
			                </div>

			                <div className="flex h-8 items-center justify-center">
			                  <div className={["relative h-full w-px", sheetAccentFlowLineVia].join(" ")}>
			                    <span className={["absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full motion-safe:animate-pulse", sheetAccentFlowDotSoft].join(" ")} />
			                  </div>
			                </div>
			                <div />

			                <div className="flex h-10 items-center justify-center">
			                  <span className={["inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-transparent", sheetAccentFlowIconText].join(" ")}>
				                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round" className="h-[40px] w-[40px]" aria-hidden="true">
				                        <path d="M3 10h18" />
				                        <path d="M5 10V8a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v2" />
				                        <path d="M7 14h10" />
				                        <path d="M5 10v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8" />
				                      </svg>
			                    </span>
			                </div>
			                <div className="min-w-0 self-center">
			                    <div className="text-white/90 font-semibold">
			                      {t("ui_op_flow_sell_step3_title", "Les fonds sont transférés vers votre banque")}
			                    </div>
			                    <div className="mt-1 text-white/55">
			                      {t("ui_op_flow_sell_step3_subtitle", "Virement vers votre compte bancaire une fois validé.")}
			                    </div>
			                </div>
			              </div>

              {xrpPreviewAmount !== null ? (
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => setTechDetailsOpen((v) => !v)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl bg-white/5 ring-1 ring-white/10 px-4 py-3 text-left"
                    aria-expanded={techDetailsOpen}
                  >
	                    <span className="text-[13px] font-semibold text-white/65">
		                        {t(
		                          "ui_op_details_network_tech_title",
		                          "Détails techniques du réseau (XRP)",
		                        )}
                    </span>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={["h-4 w-4 text-white/45 transition-transform duration-200", techDetailsOpen ? "rotate-180" : ""].join(" ")} aria-hidden="true">
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                  <div
                    className="overflow-hidden transition-[max-height,opacity] duration-200 ease-out"
                    style={{ maxHeight: techDetailsOpen ? "120px" : "0px", opacity: techDetailsOpen ? 1 : 0 }}
                  >
                    <p className="mt-2 px-1 text-[13px] leading-snug text-white/55">
                      {t("ui_op_details_sell_new_xrp_used", {
                        defaultValue: "≈ {{xrp}} XRP utilisés pendant le traitement de l’opération.",
                        xrp: new Intl.NumberFormat(locale, { minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(xrpPreviewAmount),
                      })}
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
            </div>
            {/* Bottom bar – desktop only (visual balance) */}
            <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-2" aria-hidden>
              <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
            </div>
          </div>
        </div>,
        modalPanelRef.current,
      ) : null}
    </>
  );
};

export default MoonPaySellModal;
