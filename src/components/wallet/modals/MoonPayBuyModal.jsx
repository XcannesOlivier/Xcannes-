import { useMemo, useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  XCircleIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { useModalTransition } from "@/hooks/useModalTransition";
import { isIOSDevice } from "@/utils/deviceDetect";
import xcannesApi from "@/lib/xcannesApi";
import { apiUrl } from "@/lib/runtimeConfig";
import {
  greenActionBtnBase,
  simpleSwapBlueActionBtnBase,
} from "./walletModalTokens";
import { getCurrencyFlag, formatAmountWithSymbol } from "../walletDashboardConfig";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";
const MOONPAY_ACTIVE_STORAGE_KEY = "xcannes_moonpay_active";
const MOONPAY_BUY_RESUME_KEY = "xcannes_moonpay_resume_buy_v1";
const MOONPAY_AUTOOPEN_TAB_KEY = "xcannes_moonpay_autoopen_tab";
const MOONPAY_BUY_FLOW_KEY = "xcannes_moonpay_buy_flow_v1";
const MOONPAY_WALLET_ADDRESS_KEY = "xcannes_moonpay_wallet_address_v1";
const MOONPAY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const MOONPAY_TAG_XRP = Number.parseInt(
  process.env.NEXT_PUBLIC_MOONPAY_TAG_XRP || "589",
  10,
);
const MOONPAY_TAG_RLUSD = Number.parseInt(
  process.env.NEXT_PUBLIC_MOONPAY_TAG_RLUSD || "590",
  10,
);

const resolveMoonpayTag = (currencyCode) => {
  const code = String(currencyCode || "")
    .trim()
    .toUpperCase();
  if (code === "XRP")
    return Number.isFinite(MOONPAY_TAG_XRP) ? MOONPAY_TAG_XRP : null;
  if (code === "RLUSD")
    return Number.isFinite(MOONPAY_TAG_RLUSD) ? MOONPAY_TAG_RLUSD : null;
  return null;
};

// Cryptos supportées par MoonPay
const MOONPAY_SUPPORTED_CURRENCIES = [
  { code: "RLUSD", icon: CRYPTO_ICONS.RLUSD },
  { code: "XRP", icon: CRYPTO_ICONS.XRP },
];

const isTrustedMoonPayOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "moonpay.com" || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch (_) {
    return false;
  }
};

const notifyPwaMoonpayActive = (active, tab = "buy") => {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    const isPwaEmbedded =
      params.get("embedded") === "pwa" || Boolean(window.__XCANNES_PWA_EMBEDDED__);
    if (!isPwaEmbedded) return;
    if (!window.parent || window.parent === window) return;
    window.parent.postMessage(
      { type: "MOONPAY_ACTIVE", active: Boolean(active), tab },
      "*",
    );
  } catch {
    // ignore
  }
};

const normalizeFiatCurrencyCode = (value) => {
  const upper = String(value || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "XRP" || upper === "RLUSD") return "";
  return upper;
};

const normalizeMovementKind = (value) => String(value || "").trim().toUpperCase();

const resolveIncomingXrpAmount = (movement) => {
  const displayAmount = Number(movement?.displayAmount);
  if (Number.isFinite(displayAmount) && displayAmount > 0) return displayAmount;
  const amountXrp = Number(movement?.amountXrp);
  if (Number.isFinite(amountXrp) && amountXrp > 0) return amountXrp;
  const amount = Number(movement?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const amountRlusd = Number(movement?.amountRlusd);
  const fxRate = Number(movement?.fxRate);
  if (Number.isFinite(amountRlusd) && amountRlusd > 0 && Number.isFinite(fxRate) && fxRate > 0) {
    return amountRlusd / fxRate;
  }
  return Number.NaN;
};

/**
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPayBuyModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  signTransaction = null,
  preferredFiatCurrency = "",
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
  selectLabelMobileByCurrency,
  prefill = null,
  embeddedOverlayRootRef = null,
}) => {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const resolvedTitleOverride = String(prefill?.titleOverride || "").trim();
  const useSimpleSwapPartner =
    String(prefill?.partnerOverride || "").trim().toLowerCase() === "simpleswap";
  const accentVariant = useSimpleSwapPartner ? "simpleswapBlue" : "green";
  const accentText90 =
    accentVariant === "simpleswapBlue"
      ? "text-[#0870f8]/90"
      : "text-xcannes-green/90";
  const accentText80 =
    accentVariant === "simpleswapBlue"
      ? "text-[#0870f8]/80"
      : "text-xcannes-green/80";
  const accentRing25Bg =
    accentVariant === "simpleswapBlue"
      ? "ring-[#0870f8]/25 bg-[#0870f8]"
      : "ring-xcannes-green/25 bg-xcannes-green";
  const accentRing60 =
    accentVariant === "simpleswapBlue"
      ? "focus:ring-[#0870f8]/60"
      : "focus:ring-xcannes-green/60";
  const accentBg10 =
    accentVariant === "simpleswapBlue"
      ? "bg-[#0870f8]/10 text-white"
      : "bg-xcannes-green/10 text-white";
  const accentCheck =
    accentVariant === "simpleswapBlue"
      ? "text-[#0870f8]"
      : "text-xcannes-green";
  const accentGlowShadow =
    accentVariant === "simpleswapBlue"
      ? "0_0_8px_rgba(8,112,248,0.22)"
      : "0_0_8px_rgba(0,255,150,0.15)";
  const modalPanelRef = useRef(null);
  const contentRootRef = useRef(null);
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'awaiting_xrp' | 'swap_ready' | 'swapping' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
  const moonpayActiveRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const isEmbeddedPwa =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "pwa";
  const isIOS = isIOSDevice();
  const showIOSKycFallback = isEmbeddedPwa && isIOS;
  const moonpayIframeAllow = isIOS
    ? "camera *; microphone *; clipboard-write"
    : "camera https://moonpay.com https://buy.moonpay.com https://buy-sandbox.moonpay.com https://sell.moonpay.com https://sell-sandbox.moonpay.com https://wallet.moonpay.com https://*.moonpay.com; clipboard-write";
  const latestStepRef = useRef(step);
  const latestIframeUrlRef = useRef(iframeUrl);
  const [pendingSwapTargetCurrency, setPendingSwapTargetCurrency] = useState("");
  const [pendingSwapDetectedXrp, setPendingSwapDetectedXrp] = useState(null);
  const [pendingSwapTxHash, setPendingSwapTxHash] = useState("");
  const [awaitingXrpSince, setAwaitingXrpSince] = useState(null);
  const [preparedInboundSwap, setPreparedInboundSwap] = useState(null);
  const pendingSwapPollSeenRef = useRef("");

  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  // Mark MoonPay iframe flow as active so wallet-level auto-lock does not
  // disconnect while the user completes KYC/Apple flows (events inside iframe
  // don't bubble to the parent window).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = Boolean(isOpen && step === "iframe" && iframeUrl);
    if (active === moonpayActiveRef.current) return;
    moonpayActiveRef.current = active;
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, "1");
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, "buy");
        window.__XCANNES_MOONPAY_ACTIVE__ = true;
        try {
          window.localStorage?.setItem(
            MOONPAY_WALLET_ADDRESS_KEY,
            JSON.stringify({ v: 1, ts: Date.now(), address: String(walletAddress || "") }),
          );
        } catch {
          // ignore
        }
      } else {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
      }
      window.dispatchEvent(
        new CustomEvent("xcannes:moonpay-active", { detail: { active } }),
      );
      notifyPwaMoonpayActive(active, "buy");
    } catch {
      // Ignore storage errors
    }
  }, [iframeUrl, isOpen, step, walletAddress]);

  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [targetAssetAmount, setTargetAssetAmount] = useState("");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("fiat");
  const [fiatCurrency, setFiatCurrency] = useState(() => {
    return (
      normalizeFiatCurrencyCode(prefill?.fiatCurrency) ||
      normalizeFiatCurrencyCode(preferredFiatCurrency) ||
      "USD"
    );
  });
  const normalizedPreferredFiatCurrency = useMemo(() => {
    return normalizeFiatCurrencyCode(preferredFiatCurrency);
  }, [preferredFiatCurrency]);

  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(min-width: 768px)")?.matches);
  });
  const [assetDropdownOpen, setAssetDropdownOpen] = useState(false);
  const [assetSearch, setAssetSearch] = useState("");
  const assetDropdownOverlayRef = useRef(null);
  const assetDropdownListRef = useRef(null);
  const assetDropdownTriggerRef = useRef(null);
  const assetDropdownDesktopPopupRef = useRef(null);
  const [assetOverlayDragging, setAssetOverlayDragging] = useState(false);
  const [assetOverlayTranslateY, setAssetOverlayTranslateY] = useState(0);
  const assetOverlayDragMetaRef = useRef({
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
  const [wizardStep, setWizardStep] = useState(1); // 1/3 = asset, 2/3 = fiat+amount, 3/3 = MoonPay iframe
  const [reviewTimestamp, setReviewTimestamp] = useState(null);

  const PRODUCT_MIN_USD = 5;

  // Étape 2 = résumé : on verrouille le sélecteur pour éviter les edits involontaires.
  useEffect(() => {
    if (wizardStep === 1) return;
    setAssetDropdownOpen(false);
    setAssetSearch("");
  }, [wizardStep]);

  const supportedCurrencies = useMemo(() => {
    const fallbackTokens = MOONPAY_SUPPORTED_CURRENCIES.map((curr) => ({
      currency: curr.code,
      value: 0,
    }));
    const sourceTokens =
      Array.isArray(availableTokens) && availableTokens.length ? availableTokens : fallbackTokens;

    const seen = new Set();
    const orderedTokens = [
      ...sourceTokens.filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code === "XRP" || code === "RLUSD";
      }),
      ...sourceTokens.filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code !== "XRP" && code !== "RLUSD";
      }),
    ];

    return orderedTokens
      .map((token) => {
        const currencyRaw = token?.currency;
        const currencyCode = String(currencyRaw || "").toUpperCase();
        // Do not offer XRP in the buy flow selector.
        if (currencyCode === "XRP") return null;
        if (!currencyCode || seen.has(currencyCode)) return null;
        seen.add(currencyCode);

        const labelLeft =
          selectLabelByCurrency?.[currencyRaw] ||
          selectLabelByCurrency?.[currencyCode] ||
          getCurrencyDescription(currencyCode) ||
          currencyCode;
        const amountValue = Number(token?.value || 0);
        const fallbackAmountLabel = Number.isFinite(amountValue)
          ? formatAmountWithSymbol(locale, amountValue, currencyCode, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, currencyCode, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const amountLabelFromProps =
          selectLabelRightByCurrency?.[currencyRaw] ||
          selectLabelRightByCurrency?.[currencyCode] ||
          "";
        const amountLabel =
          typeof amountLabelFromProps === "string" && amountLabelFromProps.trim()
            ? amountLabelFromProps
            : fallbackAmountLabel;
        const labelRight = amountLabel;
        const labelMobile =
          selectLabelMobileByCurrency?.[currencyRaw] ||
          selectLabelMobileByCurrency?.[currencyCode] ||
          labelLeft;
        const moonpayIcon =
          MOONPAY_SUPPORTED_CURRENCIES.find(
            (curr) => String(curr?.code || "").toUpperCase() === currencyCode,
          )?.icon || null;
        return {
          code: currencyCode,
          label: labelLeft,
          labelLeft,
          labelRight,
          amountLabel,
          labelMobile,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currencyCode] ||
            moonpayIcon ||
            getCurrencyFlag(currencyCode),
        };
      })
      .filter(Boolean);
  }, [
    availableTokens,
    locale,
    selectIconByCurrency,
    selectLabelByCurrency,
    selectLabelMobileByCurrency,
    selectLabelRightByCurrency,
  ]);

  const selectedAssetCurrency = useMemo(() => {
    const code = String(currency || "").toUpperCase();
    return supportedCurrencies.find((c) => String(c?.code || "").toUpperCase() === code) || null;
  }, [currency, supportedCurrencies]);

  const selectedToken = useMemo(() => {
    const current = String(currency || "").toUpperCase();
    if (!current) return null;
    return (
      (availableTokens || []).find(
        (token) => String(token?.currency || "").toUpperCase() === current,
      ) || null
    );
  }, [availableTokens, currency]);

  const targetAmountValue = Number.parseFloat(targetAssetAmount || "");
  const currencyUpper = String(currency || "").toUpperCase();
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : 1;
  const hasValidTargetAmount = Number.isFinite(targetAmountValue) && targetAmountValue > 0;
  const conversionMissing =
    isCurrencyLine &&
    hasValidTargetAmount &&
    (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    hasValidTargetAmount && !conversionMissing
      ? isCurrencyLine
        ? targetAmountValue * rlusdRate
        : targetAmountValue
      : null;
  const rlusdEquivalentLabel =
    Number.isFinite(Number(rlusdEquivalent)) && Number(rlusdEquivalent) > 0
      ? formatAmountWithSymbol(locale, Number(rlusdEquivalent), "RLUSD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;
  const estimatedFeeAmount = useMemo(() => {
    if (!hasValidTargetAmount || !Number.isFinite(Number(rlusdEquivalent))) return null;
    const diff = Number(targetAmountValue) - Number(rlusdEquivalent);
    if (!Number.isFinite(diff) || diff <= 0) return null;
    return diff;
  }, [hasValidTargetAmount, rlusdEquivalent, targetAmountValue]);
  const estimatedFeeLabel =
    Number.isFinite(Number(estimatedFeeAmount)) && Number(estimatedFeeAmount) > 0
      ? formatAmountWithSymbol(locale, Number(estimatedFeeAmount), currencyUpper, {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;
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
  const estimatedProviderLabel = useSimpleSwapPartner ? "SimpleSwap" : "MoonPay / Topper";

  const renderSelectIcon = (icon) => {
    if (!icon) return null;
    if (typeof icon === "string" || typeof icon === "number") {
      return (
        <span className="text-base leading-none" aria-hidden="true">
          {icon}
        </span>
      );
    }
    if (icon?.src) {
      return (
        <Image src={icon.src} alt={icon.alt || ""} width={22} height={22} className="w-5 h-5 object-contain" />
      );
    }
    return null;
  };

  const filteredAssetCurrencies = useMemo(() => {
    const needle = String(assetSearch || "").trim().toLowerCase();
    if (!needle) return supportedCurrencies;
    return supportedCurrencies.filter((c) => {
      const code = String(c?.code || "").toLowerCase();
      const label = String(c?.label || c?.labelLeft || "").toLowerCase();
      const right = String(c?.amountLabel || c?.labelRight || "").toLowerCase();
      return `${code} ${label} ${right}`.includes(needle);
    });
  }, [assetSearch, supportedCurrencies]);

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
    if (!assetDropdownOpen) return;
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined" && !isDesktopViewport) document.body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setAssetDropdownOpen(false);
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
  }, [assetDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (!assetDropdownOpen) return;
    if (!isDesktopViewport) return;
    const handler = (event) => {
      const popupEl = assetDropdownDesktopPopupRef.current;
      const triggerEl = assetDropdownTriggerRef.current;
      if (popupEl && popupEl.contains(event.target)) return;
      if (triggerEl && triggerEl.contains(event.target)) return;
      setAssetDropdownOpen(false);
      setAssetSearch("");
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [assetDropdownOpen, isDesktopViewport]);

  useEffect(() => {
    if (assetDropdownOpen) return;
    try {
      const listEl = assetDropdownListRef.current;
      const meta = assetOverlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setAssetOverlayDragging(false);
    setAssetOverlayTranslateY(0);
    assetOverlayDragMetaRef.current = {
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
  }, [assetDropdownOpen]);

  const releaseAssetOverlayScrollLock = () => {
    const meta = assetOverlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = assetDropdownListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartAssetOverlayDrag = (event, source) => {
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = assetDropdownListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    assetOverlayDragMetaRef.current = {
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

  const handleAssetOverlayPointerMove = (event) => {
    const meta = assetOverlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        assetDropdownOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = assetDropdownListRef.current;
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
      setAssetOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setAssetOverlayTranslateY(delta);
  };

  const handleAssetOverlayPointerEnd = (event) => {
    const meta = assetOverlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration;
    const shouldClose = delta > 160 || velocity > 1.0;

    assetOverlayDragMetaRef.current.pending = false;
    assetOverlayDragMetaRef.current.dragging = false;
    setAssetOverlayDragging(false);
    releaseAssetOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      setAssetOverlayTranslateY(Math.max(delta, height));
      window.setTimeout(() => {
        setAssetDropdownOpen(false);
        setAssetSearch("");
      }, 180);
      return;
    }

    setAssetOverlayTranslateY(0);
    assetOverlayDragMetaRef.current = {
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

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    setCurrency((prev) => {
      const current = String(prev || "").toUpperCase();
      if (supportedCurrencies.some((curr) => curr.code === current)) {
        return current;
      }
      return supportedCurrencies[0].code;
    });
  }, [isOpen, supportedCurrencies]);

  const saveResumeState = useMemo(() => {
    return (extra = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.setItem(
          MOONPAY_BUY_RESUME_KEY,
          JSON.stringify({
            v: 1,
            kind: "buy",
            ts: Date.now(),
            walletAddress: String(walletAddress || ""),
            currency: String(currency || "").toUpperCase(),
            targetCurrencyCode: String(currency || "").toUpperCase(),
            targetAssetAmount: String(targetAssetAmount || ""),
            amountType: amountType === "crypto" ? "crypto" : "fiat",
            amount: String(amount || ""),
            fiatCurrency: String(fiatCurrency || "").toUpperCase(),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, amountType, currency, fiatCurrency, targetAssetAmount, walletAddress]);

  const getOrCreateFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_BUY_FLOW_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ageMs = Date.now() - Number(parsed?.ts || 0);
          if (
            parsed?.v === 1 &&
            typeof parsed?.id === "string" &&
            parsed.id &&
            Number.isFinite(ageMs) &&
            ageMs >= 0 &&
            ageMs <= MOONPAY_FLOW_MAX_AGE_MS
          ) {
            return parsed.id;
          }
        }
      } catch {
        // ignore
      }

      try {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random()}`;
        window.sessionStorage?.setItem(
          MOONPAY_BUY_FLOW_KEY,
          JSON.stringify({ v: 1, kind: "buy", ts: Date.now(), id }),
        );
        return id;
      } catch {
        return null;
      }
    };
  }, []);

  const clearFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_BUY_FLOW_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const clearMoonpayWalletAddress = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.removeItem(MOONPAY_WALLET_ADDRESS_KEY);
      } catch {
        // ignore
      }
    };
  }, []);

  const readResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_BUY_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== "buy") return null;
        return parsed;
      } catch {
        return null;
      }
    };
  }, []);

  const clearResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_BUY_RESUME_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const clearAutoOpen = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_AUTOOPEN_TAB_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const deactivateMoonpayActive = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
        window.dispatchEvent(
          new CustomEvent("xcannes:moonpay-active", { detail: { active: false } }),
        );
      } catch {
        // Ignore
      }
    };
  }, []);

	  const handleUserClose = useMemo(() => {
	    return () => {
	      clearResumeState();
	      clearAutoOpen();
	      clearFlowId();
	      clearMoonpayWalletAddress();
	      deactivateMoonpayActive();
	      setIframeUrl(null);
	      setError(null);
	      setStep("form");
	      setWizardStep(1);
	      setReviewTimestamp(null);
	      setTargetAssetAmount("");
        setPendingSwapTargetCurrency("");
        setPendingSwapDetectedXrp(null);
        setPendingSwapTxHash("");
        setAwaitingXrpSince(null);
        setPreparedInboundSwap(null);
	      onClose?.();
	    };
	  }, [
	    clearAutoOpen,
	    clearFlowId,
	    clearMoonpayWalletAddress,
	    clearResumeState,
	    deactivateMoonpayActive,
	    onClose,
	  ]);

	  useEffect(() => {
	    return () => {
	      deactivateMoonpayActive();
	      notifyPwaMoonpayActive(false, "buy");
	    };
	  }, [deactivateMoonpayActive]);

  const handleWidgetClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep("form");
      setWizardStep(1);
      setReviewTimestamp(null);
      setTargetAssetAmount("");
      setPendingSwapTargetCurrency("");
      setPendingSwapDetectedXrp(null);
      setPendingSwapTxHash("");
      setAwaitingXrpSince(null);
      setPreparedInboundSwap(null);
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    deactivateMoonpayActive,
  ]);

  // If the user closes the Cash modal while the MoonPay widget is open,
  // don't keep the resume cache around.
  useEffect(() => {
    return () => {
      if (latestStepRef.current !== "iframe" || !latestIframeUrlRef.current) return;
      clearResumeState();
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
    deactivateMoonpayActive,
  ]);

  const prefillSignature = useMemo(() => {
    if (!prefill) return "";
    return JSON.stringify({
      currency: prefill.currency || "",
      amount: prefill.amount ?? "",
      amountType: prefill.amountType || "",
      fiatCurrency: prefill.fiatCurrency || "",
    });
  }, [prefill]);
  const prefillFiatCurrency = useMemo(() => {
    return normalizeFiatCurrencyCode(prefill?.fiatCurrency);
  }, [prefill]);
  const lastPrefillRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      lastPrefillRef.current = null;
      setReviewTimestamp(null);
      return;
    }
    setWizardStep(1);
    setReviewTimestamp(null);
    if (!prefill || !prefillSignature) return;
    if (lastPrefillRef.current === prefillSignature) return;
    lastPrefillRef.current = prefillSignature;
    if (prefill.currency) {
      setCurrency(String(prefill.currency).toUpperCase());
    }
    if (prefill.amount != null) {
      setAmount(String(prefill.amount));
    }
    if (prefill.amountType) {
      const nextType = prefill.amountType === "crypto" ? "crypto" : "fiat";
      setAmountType(nextType);
    }
    if (prefill.fiatCurrency) {
      const nextFiat = normalizeFiatCurrencyCode(prefill.fiatCurrency);
      if (nextFiat) setFiatCurrency(nextFiat);
    }
  }, [isOpen, prefill, prefillSignature]);

  // Base currency (fiat) defaults to the wallet's on-chain defaultCurrency memo.
  // The user can still change it inside MoonPay if needed.
  useEffect(() => {
    if (!isOpen) return;
    if (prefillFiatCurrency) return;
    if (!normalizedPreferredFiatCurrency) return;
    setFiatCurrency(normalizedPreferredFiatCurrency);
  }, [isOpen, normalizedPreferredFiatCurrency, prefillFiatCurrency]);

  // Resume flow after iOS background / reconnect:
  // restore the last inputs and auto-generate the widget URL so the user
  // lands directly back on the MoonPay iframe.
  useEffect(() => {
    if (!isOpen) return;
    if (!walletAddress) return;
    if (demoMode) return;
    if (step !== "form" || iframeUrl) return;
    if (!fiatCurrency) return;

    const resume = readResumeState();
    if (!resume) return;
    if (String(resume.walletAddress || "") !== String(walletAddress || "")) return;
    const ageMs = Date.now() - Number(resume.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_RESUME_MAX_AGE_MS) return;

    // Prefer restoring the last widget URL (keeps the same MoonPay session),
    // and only regenerate if missing.
    if (resume.lastIframeUrl) {
      setIframeUrl(String(resume.lastIframeUrl));
      setStep("iframe");
      return;
    }

    if (resume.awaitingXrpSwap) {
      const restoredPreparedSwap =
        resume.preparedInboundSwap && typeof resume.preparedInboundSwap === "object"
          ? resume.preparedInboundSwap
          : null;
      setPendingSwapTargetCurrency(
        String(resume.targetCurrencyCode || resume.currency || "").trim().toUpperCase(),
      );
      setPendingSwapDetectedXrp(
        Number.isFinite(Number(resume.detectedXrpAmount)) &&
          Number(resume.detectedXrpAmount) > 0
          ? Number(resume.detectedXrpAmount)
          : null,
      );
      setPendingSwapTxHash(String(resume.detectedXrpTxHash || "").trim());
      setAwaitingXrpSince(
        Number.isFinite(Number(resume.awaitingXrpSince))
          ? Number(resume.awaitingXrpSince)
          : Number.isFinite(Number(resume.ts))
            ? Number(resume.ts)
            : Date.now(),
      );
      setPreparedInboundSwap(restoredPreparedSwap);
      setStep(
        Number.isFinite(Number(resume.detectedXrpAmount)) &&
          Number(resume.detectedXrpAmount) > 0 &&
          restoredPreparedSwap?.txjson
          ? "swap_ready"
          : "awaiting_xrp",
      );
      return;
    }

    const nextCurrency = String(resume.currency || "").toUpperCase();
    if (nextCurrency) setCurrency(nextCurrency);
    if (resume.targetAssetAmount != null) setTargetAssetAmount(String(resume.targetAssetAmount));
    if (resume.amountType) setAmountType(resume.amountType === "crypto" ? "crypto" : "fiat");
    if (resume.amount != null) setAmount(String(resume.amount));
    if (resume.fiatCurrency) setFiatCurrency(String(resume.fiatCurrency).toUpperCase());

    pendingAutoStartRef.current = true;
  }, [
    demoMode,
    fiatCurrency,
    iframeUrl,
    isOpen,
    readResumeState,
    step,
    walletAddress,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!pendingAutoStartRef.current) return;
    if (demoMode) return;
    pendingAutoStartRef.current = false;

    const id = window.setTimeout(() => {
      generateBuyUrl();
    }, 0);
    return () => window.clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, isOpen]);

  const minFiatAmount = useMemo(() => {
    if (fiatCurrency === "USD") {
      return PRODUCT_MIN_USD;
    }
    return null;
  }, [PRODUCT_MIN_USD, fiatCurrency]);

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    const currencyUpper = String(currency || "RLUSD").trim().toUpperCase();
    const moonpayCurrencyCode = "XRP";

    if (!amount || parseFloat(amount) <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    if (
      amountType === "fiat" &&
      minFiatAmount !== null &&
      parseFloat(amount) < minFiatAmount
    ) {
      setError(
        t("moonpay_error_minimum_fiat", {
          defaultValue: "Minimum amount is {{amount}} {{currency}}.",
          amount: minFiatAmount,
          currency: fiatCurrency,
        }),
      );
      return;
    }

    // Persist inputs so we can resume after iOS Apple flows / reconnect.
    const flowId = getOrCreateFlowId();
    saveResumeState({
      flowId,
      moonpayCurrencyCode,
      targetCurrencyCode: currencyUpper,
      targetAssetAmount: String(targetAssetAmount || ""),
    });

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(moonpayCurrencyCode || "RLUSD").toUpperCase(),
            baseCurrencyCode: String(fiatCurrency || "USD").toUpperCase(),
            amountType,
            amount: parseFloat(amount),
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

      const walletAddressTag = resolveMoonpayTag(moonpayCurrencyCode);
      const options = {
        ...(walletAddressTag != null ? { walletAddressTag } : null),
        ...(flowId ? { xcannesFlowId: flowId } : null),
      };
      const response = await fetch("/api/moonpay/generate-buy-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          currencyCode: moonpayCurrencyCode,
          baseCurrencyCode: fiatCurrency,
          baseCurrencyAmount:
            amountType === "fiat" ? parseFloat(amount) : undefined,
          quoteCurrencyAmount:
            amountType === "crypto" ? parseFloat(amount) : undefined,
          options: Object.keys(options || {}).length ? options : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_buy_url_4d2c9a1f7b",
              "Failed to generate buy URL.",
            ),
        );
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        saveResumeState({ lastIframeUrl: data.url });
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
      console.error("Error generating buy URL:", err);
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
      // Vérifier l'origine (MoonPay sandbox ou production)
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;

      if (DEBUG_LOGS) {
        console.log("MoonPay message received:", event.data);
      }

      // Transaction complétée
      if (type === "transaction_completed" || status === "completed") {
        const targetCurrency = String(currency || "RLUSD").trim().toUpperCase();
        clearAutoOpen();
        clearFlowId();
        clearMoonpayWalletAddress();
        deactivateMoonpayActive();
        setIframeUrl(null);
        setPendingSwapTargetCurrency(targetCurrency);
        setPendingSwapDetectedXrp(null);
        setPendingSwapTxHash("");
        setPreparedInboundSwap(null);
        setAwaitingXrpSince(Date.now());
        saveResumeState({
          awaitingXrpSwap: true,
          awaitingXrpSince: Date.now(),
          targetCurrencyCode: targetCurrency,
          targetAssetAmount: String(targetAssetAmount || ""),
          lastIframeUrl: "",
        });
        setStep("awaiting_xrp");
      }

      // Transaction échouée
      if (type === "transaction_failed" || status === "failed") {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again.",
          ),
        );
        setStep("error");
      }

      // Utilisateur a fermé le widget
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
	    currency,
	    deactivateMoonpayActive,
	    handleWidgetClose,
	    isOpen,
	    onClose,
      saveResumeState,
      targetAssetAmount,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (step !== "awaiting_xrp") return;
    if (!walletAddress) return;

    let cancelled = false;

    const pollIncomingXrp = async () => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams();
        params.set("address", String(walletAddress || ""));
        params.set("limit", "10");
        params.set("source", "onchain");
        const response = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await response.json().catch(() => ({}));
        if (!response.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const incomingXrp = movements.find((movement) => {
          const kind = normalizeMovementKind(movement?.kind);
          if (kind !== "PAYMENT_IN" && kind !== "XRPL_PAYMENT_IN") return false;
          const currencyCode = String(
            movement?.toCurrencyCode || movement?.fromCurrencyCode || movement?.displayCurrency || "",
          )
            .trim()
            .toUpperCase();
          if (currencyCode !== "XRP") return false;
          const movementId = String(movement?.movementId || movement?._id || movement?.txHash || "").trim();
          if (movementId && movementId === pendingSwapPollSeenRef.current) return false;
          const createdAtMs = movement?.createdAt ? new Date(movement.createdAt).getTime() : Number.NaN;
          if (
            Number.isFinite(awaitingXrpSince) &&
            Number.isFinite(createdAtMs) &&
            createdAtMs < awaitingXrpSince
          ) {
            return false;
          }
          return Number.isFinite(resolveIncomingXrpAmount(movement));
        });

        if (!incomingXrp) return;

        const movementId = String(
          incomingXrp?.movementId || incomingXrp?._id || incomingXrp?.txHash || "",
        ).trim();
        pendingSwapPollSeenRef.current = movementId;
        const detectedAmount = resolveIncomingXrpAmount(incomingXrp);
        if (!Number.isFinite(detectedAmount) || detectedAmount <= 0) return;

        const preparedSwap = await xcannesApi.prepareRlusdXrpSwap({
          address: walletAddress,
          direction: "XRP_TO_RLUSD",
          amountXrp: detectedAmount,
        });
        if (cancelled) return;

        setPendingSwapDetectedXrp(detectedAmount);
        setPendingSwapTxHash(String(incomingXrp?.txHash || "").trim());
        setPreparedInboundSwap(preparedSwap);
        saveResumeState({
          awaitingXrpSwap: true,
          awaitingXrpSince:
            Number.isFinite(awaitingXrpSince) && awaitingXrpSince > 0
              ? awaitingXrpSince
              : Date.now(),
          detectedXrpAmount: detectedAmount,
          detectedXrpTxHash: String(incomingXrp?.txHash || "").trim(),
          targetCurrencyCode: pendingSwapTargetCurrency || currency,
          targetAssetAmount: String(targetAssetAmount || ""),
          preparedInboundSwap: preparedSwap,
        });
        setStep("swap_ready");
      } catch (pollError) {
        if (DEBUG_LOGS) {
          console.warn("[MoonPayBuyModal] XRP receipt poll failed:", pollError?.message || pollError);
        }
      }
    };

    pollIncomingXrp();
    const intervalId = window.setInterval(pollIncomingXrp, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    awaitingXrpSince,
    currency,
    isOpen,
    pendingSwapTargetCurrency,
    saveResumeState,
    step,
    targetAssetAmount,
    walletAddress,
  ]);

  const handleConvertReceivedXrpToRlusd = async () => {
    if (!signTransaction || !preparedInboundSwap?.txjson) {
      setError(
        t(
          "moonpay_error_prepare_swap_buy_missing_signer",
          "Wallet signature is required to convert the received XRP.",
        ),
      );
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setStep("swapping");
      const result = await signTransaction(preparedInboundSwap.txjson, {
        action: "wallet:swap",
        progressDetails: {
          amountLabel: `${Number(pendingSwapDetectedXrp || 0).toLocaleString("en-US", {
            maximumFractionDigits: 6,
          })} XRP → RLUSD`,
          beneficiaryLabel: walletLabel || "XCANNES",
          beneficiaryAddress: walletAddress,
        },
      });
      if (!result?.signed) {
        setError(
          t(
            "moonpay_error_prepare_swap_buy_cancelled",
            "XRPL swap was cancelled or expired.",
          ),
        );
        setStep("swap_ready");
        return;
      }

      const targetCurrency = String(pendingSwapTargetCurrency || currency || "RLUSD")
        .trim()
        .toUpperCase();
      clearResumeState();
      setStep("success");
      setTimeout(() => {
        onClose?.();
        if (targetCurrency && targetCurrency !== "RLUSD" && typeof window !== "undefined") {
          window.setTimeout(() => {
            try {
              window.dispatchEvent(
                new CustomEvent("xcannes:wallet:open-convert", {
                  detail: { action: "sell", base: "RLUSD", quote: targetCurrency },
                }),
              );
            } catch {
              // ignore
            }
          }, 50);
        }
      }, 1800);
    } catch (swapError) {
      setError(
        swapError?.message ||
          t(
            "moonpay_error_prepare_swap_buy_failed",
            "Failed to convert the received XRP into RLUSD.",
          ),
      );
      setStep("swap_ready");
    } finally {
      setLoading(false);
    }
  };

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, fiatCurrency]);

  useEffect(() => {
    setTargetAssetAmount("");
  }, [currency]);

  useEffect(() => {
    if (!isOpen) return;
    if (wizardStep !== 2) return;
    if (!hasValidTargetAmount) return;
    if (conversionMissing) return;
    if (!Number.isFinite(Number(rlusdEquivalent)) || Number(rlusdEquivalent) <= 0) return;

    const next = Number(Number(rlusdEquivalent).toFixed(6));
    if (!Number.isFinite(next) || next <= 0) return;

    setAmountType("crypto");
    setAmount(String(next));
  }, [conversionMissing, hasValidTargetAmount, isOpen, rlusdEquivalent, wizardStep]);

	  const continueLabel = loading
	    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
	    : demoMode
	      ? t("moonpay_action_simulate_buy_5a1c9d7b3e", "Simulate buy")
	      : wizardStep === 2
	        ? t("moonpay_action_continue_buy_8d2a1c6b9f", "Continuer")
	        : t("ui_next_step", "Étape suivante");
  const continueDisabled =
    wizardStep === 1
      ? loading || !hasValidTargetAmount || conversionMissing
      : loading ||
        !hasValidTargetAmount ||
        conversionMissing ||
        !Number.isFinite(Number(amount || "")) ||
        Number(amount || 0) <= 0;

  const handleContinue = () => {
    if (wizardStep === 1) {
      if (useSimpleSwapPartner && typeof onProceedToUsdSwapOut === "function") {
        const resolved = Number(rlusdEquivalent);
        const prefill =
          Number.isFinite(resolved) && resolved > 0
            ? String(Number(resolved.toFixed(6)))
            : String(targetAssetAmount || "").trim();
        onProceedToUsdSwapOut(prefill, {
          direction: "stable_to_rlusd",
          accentVariant: "simpleSwapBlue",
        });
        return;
      }
      setReviewTimestamp(new Date());
      setWizardStep(2);
      return;
    }
    generateBuyUrl();
  };

  const highlightPaymentMethods = (text) => {
    const input = String(text || "");
    if (!input) return text;
    const methods = ["carte bancaire", "Apple Pay", "Google Pay", "virement"];
    const parts = input.split(
      new RegExp(`(${methods.map((m) => m.replace(/[.*+?^${}()|[\\]\\\\]/g, "\\$&")).join("|")})`, "g"),
    );
    return parts.map((part, idx) =>
      methods.includes(part) ? (
        <span key={idx} className={[accentText90, "font-semibold"].join(" ")}>
          {part}
        </span>
      ) : (
        <span key={idx}>{part}</span>
      ),
    );
  };

  const PaymentLogo = ({
    src,
    alt,
    fallback,
    containerClassName = "bg-white/5",
    widthClassName = "w-auto",
  }) => {
    const [failed, setFailed] = useState(false);

    if (failed) {
      return (
        <span
          className={[
            "inline-flex items-center justify-center h-[22px] md:h-6 rounded-md px-2 bg-white/5 ring-1 ring-white/10 text-[9px] md:text-[10px] font-semibold text-white/75 leading-none",
            widthClassName,
          ].join(" ")}
        >
          {fallback}
        </span>
      );
    }

    return (
      <span
        className={[
          "inline-flex items-center justify-center h-[22px] md:h-6 rounded-md px-2 ring-1 ring-white/10 leading-none",
          containerClassName,
          widthClassName,
        ].join(" ")}
      >
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          className="h-full w-auto object-contain"
          onError={() => setFailed(true)}
        />
      </span>
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
    <div ref={contentRootRef} className={embedded ? "relative" : "relative p-4 md:p-5"}>
      <style jsx global>{`
        .xcannes-no-number-spin::-webkit-outer-spin-button,
        .xcannes-no-number-spin::-webkit-inner-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        .xcannes-no-number-spin {
          -moz-appearance: textfield;
          appearance: textfield;
        }
      `}</style>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">
	          <div className="relative flex items-center">
	            {wizardStep === 2 ? (
	              <button
                  type="button"
                  onClick={() => {
                    setReviewTimestamp(null);
                    setWizardStep(1);
                  }}
                  className="hidden md:inline-flex md:absolute md:left-0 md:-top-2 items-center gap-2 text-white/70 hover:text-white transition-colors"
                  aria-label={t("back", "Back")}
                >
                  <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
                  <span className="text-sm">{t("ui_back", "Retour")}</span>
                </button>
              ) : null}
		            <div className="ml-auto text-[13px] tracking-[0.22em] uppercase text-white/55">
		              {wizardStep === 1 ? "1/3" : "2/3"}
		            </div>
	          </div>

		          {/* Wallet + Title (merged) */}
              {wizardStep === 1 ? (
			          <div
			            className={[
			              "rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03]",
			              `shadow-[0_4px_12px_rgba(0,0,0,0.4),${accentGlowShadow},inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]`,
			            ].join(" ")}
			          >
		            <p className="block text-[16px] md:text-base font-orbitron font-bold text-white mb-3">
				              {wizardStep === 1 ? (
				                <>
				                  <span className="text-[20px] tracking-[0.14em]">
					                    {resolvedTitleOverride ||
					                      t("ui_funds_add_title", "AUGMENTER VOS SOLDES")}
				                  </span>
				                </>
				              ) : (
			                <>
			                  <span className="text-[20px] tracking-[0.14em]">
			                    {t(
			                      "moonpay_buy_asset_details_prefix",
			                      "Détails de la transaction",
			                    )}
			                  </span>
			                </>
			              )}
			            </p>
			            {String(walletLabel || "").trim() ? (
			              <div className="flex items-center gap-2 mb-1">
			                <span
			                  className={[
			                    "h-3 w-3 rounded-full ring-4 shrink-0 animate-pulse",
			                    accentRing25Bg,
			                  ].join(" ")}
			                  aria-hidden
			                />
		                <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
		                  {walletLabel}
		                </p>
		              </div>
		            ) : null}
				            <p
				              className={[
				                "text-[13px] md:text-sm font-mono break-all md:tracking-[0.06em]",
				                accentText80,
				              ].join(" ")}
				            >
				              {walletAddress}
			            </p>
		          </div>
              ) : null}

		          {/* Currency selector */}
		          {wizardStep === 1 ? (
		          <div>
			            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
			              {t("moonpay_buy_receive_currency_label", "Devise souhaitée")}
			            </label>
				            <div className="relative">
				            <button
					              type="button"
					              ref={assetDropdownTriggerRef}
			              onClick={
			                wizardStep === 1
			                  ? () => setAssetDropdownOpen((prev) => !prev)
			                  : undefined
			              }
			              aria-disabled={wizardStep !== 1}
				              className={[
				                "w-full flex items-center justify-between gap-2 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 transition-all duration-150",
				                accentRing60,
				                `shadow-[0_4px_12px_rgba(0,0,0,0.4),${accentGlowShadow}]`,
				                wizardStep === 1
				                  ? "cursor-pointer hover:ring-white/25"
				                  : "cursor-default opacity-95",
				              ].join(" ")}
			            >
			              <span className="flex items-center gap-3 min-w-0 flex-1">
			                <span className="shrink-0">
			                  {renderSelectIcon(selectedAssetCurrency?.icon)}
			                </span>
			                <span className="truncate font-semibold">
			                  {selectedAssetCurrency?.labelLeft ||
			                    selectedAssetCurrency?.label ||
			                    String(currency || "").toUpperCase()}
			                </span>
			              </span>
			              <span className="flex items-center gap-2 shrink-0">
			                {selectedAssetCurrency?.amountLabel ? (
			                  <span className="text-white/70 font-mono tabular-nums text-sm">
			                    <span className="text-white/45 mr-2">
			                      {t("ui_balance_short", "Solde :")}
			                    </span>
			                    {selectedAssetCurrency.amountLabel}
			                  </span>
			                ) : null}
			                {wizardStep === 1 ? (
			                  <svg
			                    className="w-3 h-3 text-white/70"
			                    fill="none"
			                    stroke="currentColor"
			                    viewBox="0 0 24 24"
			                    aria-hidden
			                  >
			                    <path
			                      strokeLinecap="round"
			                      strokeLinejoin="round"
			                      strokeWidth={2}
			                      d="M19 9l-7 7-7-7"
			                    />
			                  </svg>
			                ) : null}
			              </span>
			            </button>

			            {assetDropdownOpen && isDesktopViewport
			              ? (() => {
			                  const portalTarget = embedded
			                    ? embeddedOverlayRootRef?.current || contentRootRef.current
			                    : modalPanelRef.current;
			                  if (!portalTarget) return null;
			                  return createPortal(
			                    <div
			                      ref={assetDropdownDesktopPopupRef}
			                      role="dialog"
			                      aria-modal="true"
			                      className="absolute inset-0 z-[10040]"
			                      onClick={(e) => e.stopPropagation()}
			                    >
			                      <div
			                        className="absolute inset-0 bg-black/70"
			                        onClick={() => {
			                          setAssetDropdownOpen(false);
			                          setAssetSearch("");
			                        }}
			                      />
			                      <div
			                        className={[
			                          noticeVariant === "demo"
			                            ? "bg-xcannes-surface-demo"
			                            : "bg-elevated",
			                          "absolute inset-0 flex flex-col min-h-0 overflow-hidden",
			                        ].join(" ")}
			                      >
			                        <div className="flex items-start justify-between gap-3 px-4 py-4 border-b border-white/10">
			                          <div className="min-w-0">
			                            <div className="text-white font-semibold text-base leading-tight truncate">
			                              {t("moonpay_buy_select_asset", "Augmenter vos soldes")}
			                            </div>
			                            <div className="mt-0.5 text-[11px] text-white/55 truncate">
			                              {t("ui_search", "Rechercher…")}
			                            </div>
			                          </div>
			                          <button
			                            type="button"
			                            onClick={() => {
			                              setAssetDropdownOpen(false);
			                              setAssetSearch("");
			                            }}
			                            className="text-white/70 hover:text-white transition-colors text-xl leading-none"
			                            aria-label={t("ui_close", "Fermer")}
			                          >
			                            ✕
			                          </button>
			                        </div>

			                        <div className="px-4 py-4 border-b border-white/10">
			                          <div className="relative">
			                            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
			                              <svg
			                                viewBox="0 0 20 20"
			                                fill="currentColor"
			                                className="w-4 h-4"
			                                aria-hidden
			                              >
			                                <path
			                                  fillRule="evenodd"
			                                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
			                                  clipRule="evenodd"
			                                />
			                              </svg>
			                            </div>
			                            <input
			                              value={assetSearch}
			                              onChange={(e) => setAssetSearch(e.target.value)}
			                              placeholder={t("ui_search", "Rechercher…")}
			                              className={[
			                                "w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 transition-all duration-150",
			                                accentRing60,
			                              ].join(" ")}
			                            />
			                          </div>
			                        </div>

			                        <div ref={assetDropdownListRef} className="flex-1 min-h-0 overflow-y-auto">
			                          {filteredAssetCurrencies.length ? (
			                            filteredAssetCurrencies.map((opt) => {
			                              const active =
			                                String(opt?.code || "").toUpperCase() ===
			                                String(currency || "").toUpperCase();
			                              return (
			                                <button
			                                  key={String(opt.code)}
			                                  type="button"
			                                  onClick={() => {
			                                    setCurrency(String(opt.code || "").toUpperCase());
			                                    setAssetDropdownOpen(false);
			                                    setAssetSearch("");
			                                  }}
			                                  className={[
			                                    "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
			                                    active
			                                      ? accentBg10
			                                      : "hover:bg-white/[0.04] text-white/80",
			                                  ].join(" ")}
			                                >
			                                  <span className="shrink-0">
			                                    {renderSelectIcon(opt.icon)}
			                                  </span>
			                                  <div className="min-w-0 flex-1">
			                                    <div className="text-sm font-semibold truncate">
			                                      {opt.labelLeft || opt.label || opt.code}
			                                    </div>
			                                  </div>
			                                  <div className="flex items-center gap-2 shrink-0">
			                                    {opt.amountLabel ? (
			                                      <span className="text-sm font-mono tabular-nums text-white/70">
			                                        {opt.amountLabel}
			                                      </span>
			                                    ) : null}
			                                    {active ? (
			                                      <span
			                                        className={[
			                                          "font-semibold text-xs",
			                                          accentCheck,
			                                        ].join(" ")}
			                                      >
			                                        ✓
			                                      </span>
			                                    ) : null}
			                                  </div>
			                                </button>
			                              );
			                            })
			                          ) : (
			                            <div className="px-4 py-6 text-sm text-white/60">
			                              {t("ui_no_results", "Aucun résultat.")}
			                            </div>
			                          )}
			                        </div>

			                        <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
			                          {t("ui_search_results", "Sélectionnez un actif.")}
			                        </div>
			                      </div>
			                    </div>,
			                    portalTarget,
			                  );
			                })()
			              : null}

			            {assetDropdownOpen && !isDesktopViewport
			              ? createPortal(
			                  <div className="fixed inset-0 z-[10020]">
			                    <div
			                      className="absolute inset-0 bg-black/80 md:backdrop-blur-sm"
			                      onClick={() => {
			                        setAssetDropdownOpen(false);
			                        setAssetSearch("");
			                      }}
			                      style={{
			                        opacity: Math.max(
			                          0,
			                          Math.min(1, 1 - assetOverlayTranslateY / 420),
			                        ),
			                      }}
			                    />
			                    <div
			                      ref={assetDropdownOverlayRef}
			                      role="dialog"
			                      aria-modal="true"
			                      className={[
			                        noticeVariant === "demo"
			                          ? "bg-xcannes-surface-demo"
			                          : "bg-elevated",
			                        "absolute inset-0 flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]",
			                        "sm:inset-6 sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl",
			                        "will-change-transform",
			                      ].join(" ")}
			                      style={{
			                        transform: `translateY(${Math.max(0, assetOverlayTranslateY)}px)`,
			                        transition: assetOverlayDragging
			                          ? "none"
			                          : "transform 220ms cubic-bezier(0.2,0,0,1)",
			                      }}
			                      onPointerMove={handleAssetOverlayPointerMove}
			                      onPointerUp={handleAssetOverlayPointerEnd}
			                      onPointerCancel={handleAssetOverlayPointerEnd}
			                    >
			                      <div
			                        className="border-b border-white/10"
			                        onPointerDown={(event) => {
			                          maybeStartAssetOverlayDrag(event, "fixed");
			                        }}
			                      >
			                        <div className="sm:hidden flex justify-center pt-3 pb-1">
			                          <div className="w-16 h-5 flex items-center justify-center" aria-hidden>
			                            <span className="block w-12 h-1.5 rounded-full bg-white/20" />
			                          </div>
			                        </div>

			                        <div className="flex items-center justify-between gap-3 px-4 py-4">
			                          <div className="min-w-0">
			                            <div className="text-white font-semibold text-base leading-tight truncate">
			                              {t(
			                                "moonpay_buy_select_asset",
				                                "Augmenter vos soldes",
				                              )}
			                            </div>
			                            <div className="mt-0.5 text-[11px] text-white/55 truncate">
			                              {t("ui_search", "Rechercher…")}
			                            </div>
			                          </div>
			                          <button
			                            type="button"
			                            onClick={() => {
			                              setAssetDropdownOpen(false);
			                              setAssetSearch("");
			                            }}
			                            className="hidden sm:inline-flex text-white/70 hover:text-white transition-colors text-xl"
			                            aria-label={t("ui_close", "Fermer")}
			                          >
			                            ✕
			                          </button>
			                        </div>

			                        <div className="px-4 pb-4">
			                          <div className="relative">
			                            <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-white/45">
			                              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4" aria-hidden>
			                                <path
			                                  fillRule="evenodd"
			                                  d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.391 4.273l2.168 2.168a1 1 0 0 1-1.414 1.414l-2.168-2.168A7 7 0 0 1 2 9Z"
			                                  clipRule="evenodd"
			                                />
			                              </svg>
			                            </div>
			                            <input
			                              value={assetSearch}
			                              onChange={(e) => setAssetSearch(e.target.value)}
			                              placeholder={t("ui_search", "Rechercher…")}
			                              className={[
			                                "w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 transition-all duration-150",
			                                accentRing60,
			                              ].join(" ")}
			                            />
			                          </div>
			                        </div>
			                      </div>

			                      <div
			                        ref={assetDropdownListRef}
			                        className="flex-1 min-h-0 overflow-y-auto"
			                        onPointerDown={(event) => {
			                          maybeStartAssetOverlayDrag(event, "list");
			                        }}
			                      >
			                        {filteredAssetCurrencies.length ? (
			                          filteredAssetCurrencies.map((opt) => {
			                            const active =
			                              String(opt?.code || "").toUpperCase() ===
			                              String(currency || "").toUpperCase();
			                            return (
			                              <button
			                                key={String(opt.code)}
			                                type="button"
			                                onClick={() => {
			                                  setCurrency(String(opt.code || "").toUpperCase());
			                                  setAssetDropdownOpen(false);
			                                  setAssetSearch("");
			                                }}
			                                className={[
			                                  "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0",
			                                  active
			                                    ? accentBg10
			                                    : "hover:bg-white/[0.04] text-white/80",
			                                ].join(" ")}
			                              >
			                                <span className="shrink-0">
			                                  {renderSelectIcon(opt.icon)}
			                                </span>
			                                <div className="min-w-0 flex-1">
			                                  <div className="text-sm font-semibold truncate">
			                                    {opt.labelLeft || opt.label || opt.code}
			                                  </div>
			                                </div>
			                                <div className="flex items-center gap-2 shrink-0">
			                                  {opt.amountLabel ? (
			                                    <span className="text-sm font-mono tabular-nums text-white/70">
			                                      {opt.amountLabel}
			                                    </span>
			                                  ) : null}
			                                  {active ? (
			                                    <span
			                                      className={[
			                                        "font-semibold text-xs",
			                                        accentCheck,
			                                      ].join(" ")}
			                                    >
			                                      ✓
			                                    </span>
			                                  ) : null}
			                                </div>
			                              </button>
			                            );
			                          })
			                        ) : (
			                          <div className="px-4 py-6 text-sm text-white/60">
			                            {t("ui_no_results", "Aucun résultat.")}
			                          </div>
			                        )}
			                      </div>

			                      <div className="px-3 py-2 text-[11px] text-white/55 bg-white/[0.02] border-t border-white/5">
			                        {t("ui_search_results", "Sélectionnez un actif.")}
			                      </div>
			                    </div>
			                  </div>,
			                  document.body,
			                )
			              : null}
			          </div>
			          </div>
                ) : null}

                {wizardStep === 1 ? (
                  <div>
	                    <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
	                      {t("moonpay_buy_selected_asset_amount", "Montant")}
	                    </label>
	                    <div className="relative">
	                      <input
	                        type="number"
	                        value={targetAssetAmount}
	                        onChange={
                            wizardStep === 1
                              ? (e) => setTargetAssetAmount(e.target.value)
                              : undefined
                          }
	                        placeholder={t("ui_enter_amount_placeholder", "Entrez un montant")}
	                        step="0.0001"
	                        min="0"
	                        inputMode="decimal"
                          readOnly={wizardStep !== 1}
	                        className={[
	                        "xcannes-no-number-spin w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white pr-16 transition-all duration-150",
	                        `shadow-[0_4px_12px_rgba(0,0,0,0.4),${accentGlowShadow}]`,
	                        wizardStep === 1
	                          ? ["focus:outline-none focus:ring-2", accentRing60].join(" ")
	                          : "cursor-default opacity-95",
	                      ].join(" ")}
	                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm font-semibold">
                        {String(currency || "").toUpperCase()}
                      </span>
                    </div>
                  </div>
                ) : null}

				          <div className="px-1 py-2 text-[15px] md:text-sm leading-snug text-white/85">
		                    {wizardStep === 2 ? (
		                      <>
                            <div
                              className={[
                                "rounded-[18px] px-4 py-5 md:px-5 md:py-6 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] via-white/[0.03] to-black/[0.35]",
                                `shadow-[0_4px_12px_rgba(0,0,0,0.4),${accentGlowShadow},inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]`,
                              ].join(" ")}
                            >
                              <div className="mb-4 text-[14px] md:text-[16px] font-semibold tracking-[0.08em] text-white/80">
                                💳 {resolvedTitleOverride || t("ui_funds_add_title", "AUGMENTER VOS SOLDES")}
                              </div>
                              <div className="text-white text-[36px] md:text-[42px] font-semibold tracking-tight leading-none">
                                {hasValidTargetAmount
                                  ? formatAmountWithSymbol(locale, targetAmountValue, currencyUpper, {
                                      minimumFractionDigits: 0,
                                      maximumFractionDigits: 2,
                                    })
                                  : `— ${currencyUpper}`}
                              </div>
                              <div className="mt-3 text-white/80 text-[21px] md:text-[24px] font-medium leading-snug">
                                {rlusdEquivalentLabel
                                  ? `≈ ${rlusdEquivalentLabel}`
                                  : t("ui_amount_unavailable", "Montant estimé indisponible")}
                              </div>

                              {reviewTimestampLabel ? (
                                <div className="mt-5 text-[15px] md:text-[16px] text-white/55">
                                  {reviewTimestampLabel}
                                </div>
                              ) : null}

                              <div className="my-5 h-px bg-white/10" aria-hidden />

                              <div className="space-y-2">
                                <div className="flex items-center gap-2 text-white">
                                  <span
                                    className={[
                                      "h-2.5 w-2.5 rounded-full ring-4 shrink-0 animate-pulse",
                                      accentRing25Bg,
                                    ].join(" ")}
                                    aria-hidden
                                  />
                                  <span className="font-semibold text-[18px] md:text-[20px] truncate">
                                    {walletLabel || "XCANNES"}
                                  </span>
                                </div>
                                <div className={`text-[15px] md:text-[17px] font-mono break-all ${accentText80}`}>
                                  {walletAddress}
                                </div>
                              </div>

                              <div className="mt-5 space-y-2 text-[16px] md:text-[18px]">
                                <div className="flex items-center justify-between gap-4 text-white/75">
                                  <span>{t("ui_summary_estimated_fees", "Frais estimés")}</span>
                                  <span className="text-white font-medium text-right">
                                    {estimatedFeeLabel ||
                                      t("ui_partner_calculates_fees", "Calculés par le partenaire")}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="mt-3 space-y-1.5 text-[13px] md:text-[15px] leading-snug">
                              <div className="font-semibold text-white">
                                {t("ui_buy_summary_how_it_works_title", "Comment ça marche ?")}
                              </div>
                              <div className="text-white/70">
                                {t(
                                  "ui_buy_summary_how_it_works_step_1",
                                  "1. Paiement sécurisé (carte, Apple Pay…)",
                                )}
                              </div>
                              <div className="text-white/70">
                                {t(
                                  "ui_buy_summary_how_it_works_step_2",
                                  "2. Achat de l'actif système XRPL (XRP)",
                                )}
                              </div>
                              <div className="text-white/70">
                                {t(
                                  "ui_buy_summary_how_it_works_step_3",
                                  "3. Conversion et crédit sur votre compte",
                                )}
                              </div>
                              <div className={`pt-1 font-semibold ${accentText80}`}>
                                {t(
                                  "ui_buy_summary_how_it_works_success",
                                  "✓ Tout est automatique — vous validez simplement",
                                )}
                              </div>
                            </div>
                            {!useSimpleSwapPartner ? (
                              <p className="mt-1 text-[11px] md:text-xs text-white/45">
                                {t(
                                  "moonpay_buy_partner_location_note",
                                  "Le partenaire proposé dépend de votre localisation.",
                                )}
                              </p>
                            ) : null}
	                      </>
		                    ) : (
		                      demoMode ? (
		                        highlightPaymentMethods(
		                          t(
	                            "moonpay_info_buy_demo_1b7d2c9a5e",
	                            "Mode démo : pas de redirection MoonPay. L’achat est simulé.",
	                          ),
	                        )
		                      ) : (
		                        <>
		                          <p className="whitespace-pre-line">
		                            {useSimpleSwapPartner
		                              ? t(
		                                  "ui_simpleswap_choose_conversion_stablecoin_and_network_0c0b2b64d1",
		                                  "Vous choisirez le stablecoin de conversion (USDC, USDT…)\net le réseau sur la page suivante (SimpleSwap)",
		                                )
		                              : highlightPaymentMethods(
		                                  t(
		                                    "moonpay_info_buy_live_3c8a1d6b2f",
		                                    "Vous serez redirigé vers un partenaire sécurisé pour finaliser le paiement.\nMoyens acceptés : carte bancaire, Apple Pay, Google Pay, virement.",
		                                  ),
		                                )}
		                          </p>
		                          {!useSimpleSwapPartner ? (
		                            <div className="mt-1 text-[11px] md:text-xs text-white/45">
		                              {t(
		                                "moonpay_buy_partner_location_note",
		                                "Le partenaire proposé dépend de votre localisation.",
		                              )}
		                            </div>
		                          ) : null}
		                        </>
		                      )
		                    )}
					          </div>

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

	          {/* Continue button */}
	          <SwipeConfirmButton
	            label={continueLabel}
	            onConfirm={handleContinue}
	            disabled={continueDisabled}
	            variant={useSimpleSwapPartner ? "simpleSwapBlue" : "xcannesGreen"}
	            className="md:hidden"
	          />
	          <button
	            type="button"
	            onClick={handleContinue}
	            disabled={continueDisabled}
	            className={`hidden md:block w-full text-xl py-4 ${
	              useSimpleSwapPartner ? simpleSwapBlueActionBtnBase : greenActionBtnBase
	            }`}
	          >
	            {continueLabel}
	          </button>
			          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] md:text-xs text-white/60">
		            <span>
		              {useSimpleSwapPartner
		                ? t(
		                    "ui_simpleswap_secure_partner_note_f1d7a9c2b3",
		                    "Conversion sécurisé via",
		                  )
		                : t(
		                    "moonpay_buy_secure_partner_note",
		                    "Paiement sécurisé via",
		                  )}
		            </span>
			            <span
			              className="inline-flex items-center gap-1.5"
			              aria-label={t(
			                "moonpay_buy_payment_methods",
			                "Partenaires et moyens de paiement",
			              )}
			            >
			              {useSimpleSwapPartner ? (
			                <PaymentLogo
			                  src="/assets/payment-logos/simpleswap.jpeg"
			                  alt="SimpleSwap"
			                  fallback="SimpleSwap"
			                  containerClassName="bg-white/90"
			                  widthClassName="w-[140px]"
			                />
			              ) : (
			                <>
			                  <PaymentLogo
			                    src="/assets/payment-logos/moonpay.png"
			                    alt="MoonPay"
			                    fallback="MoonPay"
			                    containerClassName="bg-white/90"
			                    widthClassName="w-[110px]"
			                  />
			                  <PaymentLogo
			                    src="/assets/payment-logos/topper.svg"
			                    alt="Topper"
			                    fallback="Topper"
			                    containerClassName="bg-black/40"
			                    widthClassName="w-[110px]"
			                  />
			                </>
			              )}
			            </span>
			          </div>
		        </div>
		      )}

	      {/* Loading */}
	      {step === "loading" && (
	        <div className="flex flex-col items-center justify-center py-12">
	          <div
	            className={[
	              "animate-spin rounded-full h-12 w-12 border-b-2 mb-4",
	              useSimpleSwapPartner ? "border-[#0870f8]" : "border-xcannes-green",
	            ].join(" ")}
	          />
	          <p className="text-white/80">
	            {t("moonpay_loading_widget", "Loading MoonPay widget...")}
	          </p>
	        </div>
	      )}

        {step === "awaiting_xrp" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div
              className={[
                "animate-pulse rounded-full h-12 w-12 mb-4 ring-4",
                useSimpleSwapPartner ? "ring-[#0870f8]/25 bg-[#0870f8]" : "ring-xcannes-green/25 bg-xcannes-green",
              ].join(" ")}
            />
            <h4 className="text-xl font-bold text-white mb-2">
              {t("moonpay_buy_waiting_xrp_title", "En attente du XRP")}
            </h4>
            <p className="text-white/60 text-center mb-4 max-w-md">
              {t(
                "moonpay_buy_waiting_xrp_body",
                "MoonPay est terminé. Dès que le XRP arrive sur votre wallet XCANNES, nous préparons la conversion XRPL vers RLUSD.",
              )}
            </p>
            <button
              type="button"
              onClick={handleWidgetClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            >
              {t("close", "Close")}
            </button>
          </div>
        )}

        {step === "swap_ready" && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <CheckCircleIcon
              className={[
                "w-16 h-16 mb-4",
                useSimpleSwapPartner ? "text-[#0870f8]" : "text-xcannes-green",
              ].join(" ")}
            />
            <h4 className="text-xl font-bold text-white mb-2">
              {t("moonpay_buy_swap_ready_title", "XRP reçu")}
            </h4>
            <p className="text-white/60 text-center mb-2 max-w-md">
              {t(
                "moonpay_buy_swap_ready_body",
                "Le XRP a été détecté sur votre wallet. Vous pouvez maintenant signer la conversion XRPL vers RLUSD.",
              )}
            </p>
            {Number.isFinite(Number(pendingSwapDetectedXrp)) && Number(pendingSwapDetectedXrp) > 0 ? (
              <div className="mb-5 rounded-lg bg-white/5 ring-1 ring-white/10 px-4 py-3 text-white/85">
                {Number(pendingSwapDetectedXrp).toLocaleString("en-US", {
                  maximumFractionDigits: 6,
                })} XRP
              </div>
            ) : null}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleConvertReceivedXrpToRlusd}
                className={`px-6 py-2 text-black font-semibold rounded-lg transition-colors ${
                  useSimpleSwapPartner
                    ? "bg-[#0870f8] hover:bg-[#0765df]"
                    : "bg-xcannes-green hover:bg-xcannes-green/90"
                }`}
              >
                {t("moonpay_buy_swap_ready_action", "Signer le swap XRP → RLUSD")}
              </button>
              <button
                type="button"
                onClick={handleWidgetClose}
                className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
              >
                {t("close", "Close")}
              </button>
            </div>
          </div>
        )}

        {step === "swapping" && (
          <div className="flex flex-col items-center justify-center py-12">
            <div
              className={[
                "animate-spin rounded-full h-12 w-12 border-b-2 mb-4",
                useSimpleSwapPartner ? "border-[#0870f8]" : "border-xcannes-green",
              ].join(" ")}
            />
            <p className="text-white/80">
              {t("moonpay_buy_swapping_label", "Préparation du swap XRPL…")}
            </p>
          </div>
        )}

	      {/* MoonPay iframe */}
	      {step === "iframe" && iframeUrl && (
	        <div className="relative">
	          <div className="flex justify-end pb-2">
	            <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
	              3/3
	            </div>
	          </div>
	          <div
	            className="relative"
	            style={{ height: "calc(100vh - 40px)", minHeight: "600px", maxHeight: "760px" }}
	          >
	          <iframe
	            src={iframeUrl}
	            className="w-full h-full rounded-lg"
	            allow={moonpayIframeAllow}
	            allowFullScreen
	            title={t("moonpay_widget_title_buy", "MoonPay Widget")}
	          />
	          </div>
	        </div>
	      )}

      {/* Success */}
	          {step === "success" && (
	        <div className="flex flex-col items-center justify-center py-12">
	          <CheckCircleIcon
	            className={[
	              "w-16 h-16 mb-4",
	              useSimpleSwapPartner ? "text-[#0870f8]" : "text-green-400",
	            ].join(" ")}
	          />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_buy_success_title", "Transaction Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_buy_success_body",
              "Your crypto will be sent to your wallet shortly.",
            )}
          </p>
	          <button
	            type="button"
	            onClick={onClose}
	            className={[
	              "px-6 py-2 text-black font-semibold rounded-lg transition-colors",
	              useSimpleSwapPartner
	                ? "bg-[#0870f8] hover:bg-[#0765df]"
	                : "bg-xcannes-green hover:bg-xcannes-green/90",
	            ].join(" ")}
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
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            >
              {t("try_again", "Try Again")}
            </button>
	            <button
	              type="button"
	              onClick={onClose}
	              className={[
	                "px-6 py-2 text-black font-semibold rounded-lg transition-colors",
	                useSimpleSwapPartner
	                  ? "bg-[#0870f8] hover:bg-[#0765df]"
	                  : "bg-xcannes-green hover:bg-xcannes-green/90",
	              ].join(" ")}
	            >
	              {t("close", "Close")}
	            </button>
	          </div>
	        </div>
	      )}
    </div>
  );

  // Mode embedded: retourner seulement le contenu
  if (embedded) {
    return renderContent();
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
        }`}
        onClick={step === "iframe" ? null : onClose}
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
	          {/* Header */}
		          <div className="flex items-center gap-3 p-4 md:p-5 border-b border-white/10">
		            {step !== "iframe" && (
		              <button
		                type="button"
		                onClick={() => {
		                  if (step === "form" && wizardStep > 1) {
		                    setWizardStep((prev) => Math.max(1, prev - 1));
		                    return;
		                  }
		                  handleUserClose();
		                }}
		                className="wallet-modal-close -ml-1 w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
		                aria-label={t("back", "Back")}
		              >
		                <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
		              </button>
	            )}
	            <div className="min-w-0 flex-1">
	              <div className="flex items-center gap-2 flex-wrap">
	                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
	                  {t(
	                    "ui_buy_crypto_with_fiat_f09c7b4228",
                    "Buy Crypto with Fiat",
                  )}
                </h3>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}

              </div>
	              <p className="text-xs text-white/60 mt-1">
	                {t(
	                  "ui_powered_by_moonpay_secure_ch_0bcfb2aeb5",
	                  "Powered by MoonPay • Secure checkout",
	                )}
	              </p>
	            </div>
	          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default MoonPayBuyModal;
