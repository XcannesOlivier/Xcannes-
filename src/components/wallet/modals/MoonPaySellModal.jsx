import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowDownIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import xcannesApi from "@/lib/xcannesApi";
import { getCurrencyFlag, formatAmountWithSymbol } from "../walletDashboardConfig";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { isIOSDevice } from "@/utils/deviceDetect";


const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";
const MOONPAY_ACTIVE_STORAGE_KEY = "xcannes_moonpay_active";
const MOONPAY_SELL_RESUME_KEY = "xcannes_moonpay_resume_sell_v1";
const MOONPAY_AUTOOPEN_TAB_KEY = "xcannes_moonpay_autoopen_tab";
const MOONPAY_SELL_FLOW_KEY = "xcannes_moonpay_sell_flow_v1";
const MOONPAY_SELL_SOURCE_KEY = "xcannes_moonpay_sell_source_v1";
const MOONPAY_WALLET_ADDRESS_KEY = "xcannes_moonpay_wallet_address_v1";
const MOONPAY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;

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

const notifyPwaMoonpayActive = (active, tab = "sell") => {
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

const truncateMiddle = (value, head = 6, tail = 5) => {
  const str = String(value ?? "");
  if (!str) return "";
  if (str.length <= head + tail + 1) return str;
  return `${str.slice(0, head)}…${str.slice(-tail)}`;
};

const normalizeFiatCurrencyCode = (value) => {
  const upper = String(value || "").trim().toUpperCase();
  if (!upper) return "";
  if (upper === "XRP" || upper === "RLUSD") return "";
  return upper;
};

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
  selectLabelMobileByCurrency,
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
  const accentText80 =
    accentVariant === "fireOrange"
      ? "text-[#ff6a00]/80"
      : "text-xcannes-violet/80";
  const accentRing25Bg =
    accentVariant === "fireOrange"
      ? "ring-[#ff6a00]/25 bg-[#ff6a00]"
      : "ring-xcannes-violet/25 bg-xcannes-violet";
  const accentRing60 =
    accentVariant === "fireOrange"
      ? "focus:ring-[#ff6a00]/60"
      : "focus:ring-xcannes-violet/60";
  const accentBg10 =
    accentVariant === "fireOrange"
      ? "bg-[#ff6a00]/10 text-white"
      : "bg-xcannes-violet/10 text-white";
  const accentCheck =
    accentVariant === "fireOrange" ? "text-[#ff6a00]" : "text-xcannes-violet";
  const accentGlowShadow =
    accentVariant === "fireOrange"
      ? "0_0_8px_rgba(255,106,0,0.22)"
      : "0_0_8px_rgba(160,80,255,0.18)";

  const modalPanelRef = useRef(null);
  const contentRootRef = useRef(null);

  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
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

  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  // Keep MoonPay flow "active" to prevent wallet-level auto-lock disconnects
  // while user interacts with MoonPay (KYC/Apple flows).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = Boolean(isOpen && step === "iframe" && iframeUrl);
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, "1");
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, "sell");
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
      notifyPwaMoonpayActive(active, "sell");
    } catch {
      // Ignore
    }
  }, [iframeUrl, isOpen, step, walletAddress]);

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
  const [walletAddressExpanded, setWalletAddressExpanded] = useState(false);
  const [walletAddressCopied, setWalletAddressCopied] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(() => {
    if (typeof window === "undefined") return false;
    return Boolean(window.matchMedia?.("(min-width: 768px)")?.matches);
  });
  const [cryptoDropdownOpen, setCryptoDropdownOpen] = useState(false);
  const [cryptoSearch, setCryptoSearch] = useState("");
  const cryptoDropdownOverlayRef = useRef(null);
  const cryptoDropdownListRef = useRef(null);
  const cryptoDropdownTriggerRef = useRef(null);
  const cryptoDropdownDesktopPopupRef = useRef(null);
  const [cryptoOverlayDragging, setCryptoOverlayDragging] = useState(false);
  const [cryptoOverlayTranslateY, setCryptoOverlayTranslateY] = useState(0);
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
            currency: String(currency || "").toUpperCase(),
            amount: String(amount || ""),
            quoteCurrency: String(quoteCurrency || "").toUpperCase(),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, currency, quoteCurrency, walletAddress]);

  const getOrCreateFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_SELL_FLOW_KEY);
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
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
        window.sessionStorage?.setItem(
          MOONPAY_SELL_FLOW_KEY,
          JSON.stringify({ v: 1, kind: "sell", ts: Date.now(), id }),
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
        window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
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
        const raw = window.sessionStorage?.getItem(MOONPAY_SELL_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== "sell") return null;
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
        window.sessionStorage?.removeItem(MOONPAY_SELL_RESUME_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

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
              String(data?.sourceCurrencyCode || "").trim().toUpperCase() || null,
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
              String(data?.baseCurrencyCode || "").trim().toUpperCase() || null,
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
  ]);

  // If the user closes the Cash modal while the MoonPay widget is open,
  // don't keep the resume cache around.
  useEffect(() => {
    return () => {
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
  ]);

  const supportedCurrencies = useMemo(() => {
    const seen = new Set();
    const orderedTokens = [
      ...(availableTokens || []).filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code === "XRP" || code === "RLUSD";
      }),
      ...(availableTokens || []).filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code !== "XRP" && code !== "RLUSD";
      }),
    ];

	    return orderedTokens
	      .map((token) => {
	        const currencyRaw = token?.currency;
	        const currency = String(currencyRaw || "").toUpperCase();
	        // Do not offer XRP in the sell flow selector.
	        if (currency === "XRP") return null;
	        if (!currency || seen.has(currency)) return null;
	        seen.add(currency);

        const labelLeft =
          selectLabelByCurrency?.[currencyRaw] ||
          selectLabelByCurrency?.[currency] ||
          getCurrencyDescription(currency) ||
          currency;
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
    selectLabelMobileByCurrency,
    locale,
    t,
  ]);

  const selectedSellCurrency = useMemo(() => {
    const code = String(currency || "").toUpperCase();
    return supportedCurrencies.find((c) => String(c?.code || "").toUpperCase() === code) || null;
  }, [currency, supportedCurrencies]);

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
        <Image
          src={icon.src}
          alt={icon.alt || ""}
          width={22}
          height={22}
          className="w-5 h-5 object-contain"
        />
      );
    }
    return null;
  };

  const filteredSellCurrencies = useMemo(() => {
    const needle = String(cryptoSearch || "").trim().toLowerCase();
    if (!needle) return supportedCurrencies;
    return supportedCurrencies.filter((c) => {
      const code = String(c?.code || "").toLowerCase();
      const label = String(c?.label || c?.labelLeft || "").toLowerCase();
      const right = String(c?.amountLabel || c?.labelRight || "").toLowerCase();
      return `${code} ${label} ${right}`.includes(needle);
    });
  }, [cryptoSearch, supportedCurrencies]);

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

  const releaseCryptoOverlayScrollLock = () => {
    const meta = cryptoOverlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = cryptoDropdownListRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartCryptoOverlayDrag = (event, source) => {
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = cryptoDropdownListRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    cryptoOverlayDragMetaRef.current = {
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

  const handleCryptoOverlayPointerMove = (event) => {
    const meta = cryptoOverlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        cryptoDropdownOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = cryptoDropdownListRef.current;
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
      setCryptoOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setCryptoOverlayTranslateY(delta);
  };

  const handleCryptoOverlayPointerEnd = (event) => {
    const meta = cryptoOverlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const shouldClose = delta > 160 || velocity > 1.0;

    cryptoOverlayDragMetaRef.current.pending = false;
    cryptoOverlayDragMetaRef.current.dragging = false;
    setCryptoOverlayDragging(false);
    releaseCryptoOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      setCryptoOverlayTranslateY(Math.max(delta, height));
      window.setTimeout(() => {
        setCryptoDropdownOpen(false);
        setCryptoSearch("");
      }, 180);
      return;
    }

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
    const current = String(currency || "").toUpperCase();
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

    const nextCurrency = String(resume.currency || "").toUpperCase();
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
    quoteCurrency,
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
      generateSellUrl();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, isOpen]);

  const selectedToken = useMemo(() => {
    const current = String(currency || "").toUpperCase();
    if (!current) return null;
    return (
      (availableTokens || []).find(
        (token) => String(token?.currency || "").toUpperCase() === current,
      ) || null
    );
  }, [availableTokens, currency]);

  const amountValue = Number.parseFloat(amount || "");
  const currencyUpper = String(currency || "").toUpperCase();
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : Number.NaN;
  const allocatedRlusdBalance = Number.parseFloat(
    selectedToken?.allocatedRlusd ?? Number.NaN,
  );
  const availableBalance = (() => {
    const directBalance = Number.parseFloat(selectedToken?.value ?? 0);
    if (!isCurrencyLine) return directBalance;
    if (
      Number.isFinite(allocatedRlusdBalance) &&
      allocatedRlusdBalance > 0 &&
      Number.isFinite(rlusdRate) &&
      rlusdRate > 0
    ) {
      return allocatedRlusdBalance / rlusdRate;
    }
    return directBalance;
  })();
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const conversionMissing =
    isCurrencyLine &&
    hasValidAmount &&
    (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    isCurrencyLine && hasValidAmount && !conversionMissing
      ? amountValue * rlusdRate
      : null;
  const balanceLabel = Number.isFinite(availableBalance)
    ? formatAmountWithSymbol(locale, availableBalance, currencyUpper || "XRP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
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
  const summaryRlusdLabel = Number.isFinite(sourceAmountRlusd)
    ? formatAmountWithSymbol(locale, sourceAmountRlusd, "RLUSD", {
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

  const formatAmountWithCode = (value, code, options = {}) => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "-";
    const upper = String(code || "").toUpperCase();
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

  const resolveRlusdRateForFiat = (code) => {
    const upper = String(code || "").trim().toUpperCase();
    if (!upper) return Number.NaN;
    if (upper === "USD" || upper === "RLUSD") return 1;
    const rate = Number(rlusdPerUnitRates?.[upper]);
    return Number.isFinite(rate) && rate > 0 ? rate : Number.NaN;
  };

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
  }, [isCurrencyLine, quoteCurrency, rlusdPerUnitRates, rlusdRate, sourceAmountRlusd, t]);

  const [moonpayFeeEstimates, setMoonpayFeeEstimates] = useState(null);
  const [moonpayFeeEstimateError, setMoonpayFeeEstimateError] = useState(null);
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
    rlusdRate,
    sourceAmountRlusd,
    t,
    wizardStep,
  ]);

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

      let effectiveBaseCurrencyCode = String(baseCurrencyCode || "").toUpperCase();
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
    t,
  ]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, quoteCurrency]);

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
	      : wizardStep === 2
	        ? hasValidAmount && amountForCtaLabel
	          ? t("ui_send_to_bank_action_with_amount", {
	              defaultValue: "Envoyer {{amount}} {{currency}} vers la banque",
	              amount: amountForCtaLabel,
	              currency:
	                selectedSellCurrency?.labelLeft ||
	                selectedSellCurrency?.label ||
	                String(currency || "").toUpperCase(),
	            })
	          : t("ui_send_to_bank_action", "Envoyer vers la banque")
	        : t("ui_next_step", "Étape suivante");
  const continueDisabled =
    wizardStep === 1
      ? loading || !hasValidAmount || !selectedToken || conversionMissing
      : loading ||
        !hasValidAmount ||
        !selectedToken ||
        conversionMissing;

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
      setReviewTimestamp(new Date());
      setWizardStep(2);
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
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">
          <div className="relative flex items-center">
            {wizardStep === 2 ? (
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="hidden md:inline-flex md:absolute md:left-0 md:-top-2 items-center gap-2 text-white/70 hover:text-white transition-colors"
                aria-label={t("back", "Back")}
              >
                <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
                <span className="text-sm">{t("ui_back", "Retour")}</span>
              </button>
            ) : null}
            <div className="ml-auto" />
          </div>

          {/* From wallet display */}
					          <div
					            className={[
					              "rounded-t-[14px] rounded-b-none px-4 py-4 ring-1 ring-white/10 ring-inset bg-[#101415]",
                        wizardStep === 1 ? "" : "hidden",
					              `shadow-[0_4px_12px_rgba(0,0,0,0.4),${accentGlowShadow},inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]`,
					            ].join(" ")}
					          >
				            <p className="block text-[16px] md:text-base font-orbitron font-bold text-white mb-3">
                      <span className="text-[20px] tracking-[0.14em] uppercase">
                        {resolvedSelectCryptoTitleOverride ||
                          t(
                            "moonpay_sell_withdraw_title_prefix",
                            "Envoyer vers la banque",
                          )}
                      </span>
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
                  <div className="mt-0.5 flex items-start gap-2">
			            <button
                    type="button"
                    onClick={() => setWalletAddressExpanded((prev) => !prev)}
                    aria-expanded={walletAddressExpanded}
                    title={walletAddress}
			              className={[
			                "min-w-0 flex-1 text-left font-mono md:tracking-[0.06em] transition-colors",
                      walletAddressExpanded
                        ? "text-[14px] md:text-[15px] break-all"
                        : "text-[14px] md:text-[15px] whitespace-nowrap",
			                "text-white/70 hover:text-white",
			              ].join(" ")}
			            >
			              {walletAddressExpanded ? walletAddress : truncateMiddle(walletAddress)}
					            </button>
                  <button
                    type="button"
                    onClick={handleCopyWalletAddress}
                    className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
                    aria-label={t("ui_copy_address", "Copier")}
                  >
                    {walletAddressCopied ? t("ui_copied", "Copié") : t("ui_copy", "Copier")}
                  </button>
                  </div>
					          </div>

		          {/* Currency selector */}
		          <div className={wizardStep === 1 ? "" : "hidden"}>
			            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
			              {t(
			                "moonpay_sell_send_currency_label",
			                "Devise à envoyer",
		              )}
		            </label>
					            <div className="relative">
				            <button
				              type="button"
				              ref={cryptoDropdownTriggerRef}
				              onClick={
			                wizardStep === 1
			                  ? () => setCryptoDropdownOpen((prev) => !prev)
			                  : undefined
			              }
				              aria-disabled={wizardStep !== 1}
				              className={[
				                "w-full flex items-center justify-between gap-2 bg-[#101415] ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 transition-all duration-150",
				                accentRing60,
				                "shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
				                wizardStep === 1
				                  ? "cursor-pointer hover:ring-white/25"
				                  : "cursor-default opacity-95",
				              ].join(" ")}
			            >
			              <span className="flex items-center gap-3 min-w-0 flex-1">
			                <span className="shrink-0">
			                  {renderSelectIcon(selectedSellCurrency?.icon)}
			                </span>
			                <span className="truncate font-semibold">
			                  {selectedSellCurrency?.labelLeft ||
			                    selectedSellCurrency?.label ||
			                    currency}
			                </span>
			              </span>
			              <span className="flex items-center gap-2 shrink-0">
			                {selectedSellCurrency?.amountLabel ? (
			                  <span className="text-white/70 font-mono tabular-nums text-sm">
			                    <span className="text-white/45 mr-2">
			                      {t("ui_balance_short", "Solde :")}
			                    </span>
			                    {selectedSellCurrency.amountLabel}
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

			            {cryptoDropdownOpen && isDesktopViewport
			              ? (() => {
			                  const portalTarget = embedded
			                    ? embeddedOverlayRootRef?.current || contentRootRef.current
			                    : modalPanelRef.current;
			                  if (!portalTarget) return null;
			                  return createPortal(
			                    <div
			                      ref={cryptoDropdownDesktopPopupRef}
			                      role="dialog"
			                      aria-modal="true"
			                      className="absolute inset-0 z-[10040]"
			                      onClick={(e) => e.stopPropagation()}
			                    >
			                      <div
			                        className="absolute inset-0 bg-black/70"
			                        onClick={() => {
			                          setCryptoDropdownOpen(false);
			                          setCryptoSearch("");
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
			                            <div className="text-white font-semibold text-base leading-tight truncate underline underline-offset-4 decoration-white/35">
			                              {resolvedSelectCryptoTitleOverride ||
			                                t(
			                                  "moonpay_sell_withdraw_title_prefix",
			                                  "Envoyer vers la banque",
			                                )}
			                            </div>
			                            <div className="mt-0.5 text-[11px] text-white/55 truncate">
			                              {t("ui_search", "Rechercher…")}
			                            </div>
			                          </div>
			                          <button
			                            type="button"
			                            onClick={() => {
			                              setCryptoDropdownOpen(false);
			                              setCryptoSearch("");
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
			                              value={cryptoSearch}
			                              onChange={(e) => setCryptoSearch(e.target.value)}
			                              placeholder={t("ui_search", "Rechercher…")}
			                              className={[
			                                "w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 transition-all duration-150",
			                                accentRing60,
			                              ].join(" ")}
			                            />
			                          </div>
			                        </div>

			                        <div
			                          ref={cryptoDropdownListRef}
			                          className="flex-1 min-h-0 overflow-y-auto"
			                        >
			                          {filteredSellCurrencies.length ? (
			                            filteredSellCurrencies.map((opt) => {
			                              const active =
			                                String(opt?.code || "").toUpperCase() ===
			                                String(currency || "").toUpperCase();
			                              return (
			                                <button
			                                  key={String(opt.code)}
			                                  type="button"
			                                  onClick={() => {
			                                    setCurrency(String(opt.code || "").toUpperCase());
			                                    setCryptoDropdownOpen(false);
			                                    setCryptoSearch("");
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

		            {cryptoDropdownOpen && !isDesktopViewport
		              ? createPortal(
	                  <div className="fixed inset-0 z-[10020]">
	                    <div
	                      className="absolute inset-0 bg-black/80 md:backdrop-blur-sm"
	                      onClick={() => {
                        setCryptoDropdownOpen(false);
                        setCryptoSearch("");
                      }}
                      style={{
                        opacity: Math.max(
                          0,
                          Math.min(1, 1 - cryptoOverlayTranslateY / 420),
                        ),
                      }}
                    />
                    <div
                      ref={cryptoDropdownOverlayRef}
                      role="dialog"
                      aria-modal="true"
                      className={[
                        noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
                        "absolute inset-0 flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]",
                        "sm:inset-6 sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl",
                        "will-change-transform",
                      ].join(" ")}
                      style={{
                        transform: `translateY(${Math.max(0, cryptoOverlayTranslateY)}px)`,
                        transition: cryptoOverlayDragging
                          ? "none"
                          : "transform 220ms cubic-bezier(0.2,0,0,1)",
                      }}
                      onPointerMove={handleCryptoOverlayPointerMove}
                      onPointerUp={handleCryptoOverlayPointerEnd}
                      onPointerCancel={handleCryptoOverlayPointerEnd}
                    >
                      <div
                        className="border-b border-white/10"
                        onPointerDown={(event) => {
                          maybeStartCryptoOverlayDrag(event, "fixed");
                        }}
                      >
                        <div className="sm:hidden flex justify-center pt-3 pb-1">
                          <div className="w-16 h-5 flex items-center justify-center" aria-hidden>
                            <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                          </div>
                        </div>

                        <div className="flex items-center justify-between gap-3 px-4 py-4">
                          <div className="min-w-0">
		                            <div className="text-white font-semibold text-base leading-tight truncate underline underline-offset-4 decoration-white/35">
				                              {resolvedSelectCryptoTitleOverride ||
				                                t(
				                                  "moonpay_sell_withdraw_title_prefix",
				                                  "Envoyer vers la banque",
				                                )}
			                            </div>
                            <div className="mt-0.5 text-[11px] text-white/55 truncate">
                              {t("ui_search", "Rechercher…")}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setCryptoDropdownOpen(false);
                              setCryptoSearch("");
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
	                              value={cryptoSearch}
	                              onChange={(e) => setCryptoSearch(e.target.value)}
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
                        ref={cryptoDropdownListRef}
                        className="flex-1 min-h-0 overflow-y-auto"
                        onPointerDown={(event) => {
                          maybeStartCryptoOverlayDrag(event, "list");
                        }}
                      >
                        {filteredSellCurrencies.length ? (
                          filteredSellCurrencies.map((opt) => {
                            const active =
                              String(opt?.code || "").toUpperCase() ===
                              String(currency || "").toUpperCase();
                            return (
                              <button
                                key={String(opt.code)}
                                type="button"
                                onClick={() => {
                                  setCurrency(String(opt.code || "").toUpperCase());
                                  setCryptoDropdownOpen(false);
                                  setCryptoSearch("");
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
	          {/* Amount input (étape 1/2) */}
	            <div className={wizardStep === 1 ? "" : "hidden"}>
		              <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
		                {t("moonpay_amount_to_sell", "Montant")}
		              </label>
	              <div className="relative">
		                <input
		                  type="text"
		                  value={amount}
		                  onChange={
                        wizardStep === 1 ? (e) => setAmount(e.target.value) : undefined
                      }
		                  placeholder={t("ui_enter_amount_placeholder", "Entrez un montant")}
		                  inputMode="decimal"
                      readOnly={wizardStep !== 1}
			                  className={[
	                        "w-full px-4 py-4 bg-[#101415] ring-1 ring-white/15 ring-inset rounded-xl text-white pr-16 transition-all duration-150",
	                        "shadow-[0_4px_12px_rgba(0,0,0,0.4)]",
	                        wizardStep === 1
	                          ? ["focus:outline-none focus:ring-2", accentRing60].join(" ")
	                          : "cursor-default opacity-95",
	                      ].join(" ")}
			                />

	                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm font-semibold">
	                  {currency}
	                </span>
	              </div>
	              {isCurrencyLine && hasValidAmount && conversionMissing ? (
	                <p className="mt-2 text-[11px] text-red-300">
	                  {t(
	                    "ui_rate_unavailable_base_5c1a9b7d2e",
	                    "Rate unavailable for base currency.",
	                  )}
	                </p>
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
	                ) : isBankSellFlow ? (
	                  <div className="px-1">
	                    <p className="text-[15px] md:text-sm leading-snug text-white/85 whitespace-pre-line">
	                      {highlightPhrases(
	                        t(
	                          "moonpay_sell_bank_partner_notice",
	                          "Le retrait sera effectué via un partenaire sécurisé (virement bancaire, carte ou PayPal selon votre pays).",
	                        ),
	                        ["virement bancaire, carte ou PayPal"],
	                      )}
	                    </p>
	                    <p className="mt-1 text-[11px] md:text-xs text-white/45">
	                      {t(
	                        "moonpay_sell_partner_location_note",
	                        "Le partenaire proposé dépend de votre localisation.",
	                      )}
	                    </p>
	                  </div>
	                ) : null}
	              </>
	            ) : null}

		          {wizardStep === 2 ? (
		            <>
                  <div
                    className={[
                      "rounded-[18px] px-4 py-5 md:px-5 md:py-6 ring-1 ring-white/10 ring-inset bg-[#101415]",
                      "shadow-[0_4px_12px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]",
                    ].join(" ")}
                  >
                    <div className="mb-4 text-[14px] md:text-[16px] font-semibold tracking-[0.08em] text-white/80">
                      🏦 {t("ui_send_to_bank_action", "ENVOYER VERS LA BANQUE")}
                    </div>
                    <div className="text-white text-[36px] md:text-[42px] font-semibold tracking-tight leading-none">
                      {summaryAmountLabel}
                    </div>
                    {/* Internal XCANNES accounting is backed by RLUSD — keep it out of this summary UI. */}

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
                      <div className="flex items-start gap-2">
                        <button
                          type="button"
                          onClick={() => setWalletAddressExpanded((prev) => !prev)}
                          aria-expanded={walletAddressExpanded}
                          title={walletAddress}
                          className={[
                            "min-w-0 flex-1 text-left font-mono transition-colors",
                            walletAddressExpanded
                              ? "text-[15px] md:text-[17px] break-all"
                              : "text-[15px] md:text-[17px] whitespace-nowrap",
                            "text-white/70 hover:text-white",
                          ].join(" ")}
                        >
                          {walletAddressExpanded ? walletAddress : truncateMiddle(walletAddress)}
                        </button>
                        <button
                          type="button"
                          onClick={handleCopyWalletAddress}
                          className="shrink-0 rounded-md px-2 py-1 text-[11px] md:text-xs font-semibold ring-1 ring-white/10 bg-elevated text-white/70 hover:text-white hover:ring-white/20 transition-colors"
                          aria-label={t("ui_copy_address", "Copier")}
                        >
                          {walletAddressCopied ? t("ui_copied", "Copié") : t("ui_copy", "Copier")}
                        </button>
                      </div>
                    </div>

                    <div className="mt-5 space-y-2 text-[16px] md:text-[18px]">
                      <div className="flex items-center justify-between gap-4 text-white/75">
                        <span>{t("ui_summary_estimated_fees", "Frais estimés")}</span>
                      </div>
                      {(moonpayFeeEstimates || fallbackMoonpayFeeEstimates) ? (
                        <div className="space-y-1 text-[13px] md:text-sm text-white/70">
                          {(moonpayFeeEstimates || fallbackMoonpayFeeEstimates).map((item) => (
                            <div
                              key={item.key}
                              className="flex items-center justify-between gap-3"
                            >
                              <span className="truncate">{item.label}</span>
                              <span className="shrink-0 text-white/85 font-medium text-right">
                                {formatAmountWithCode(item.amount, currencyUpper, {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}
                              </span>
                            </div>
                          ))}
                          <div className="pt-1 text-[11px] md:text-xs text-white/45">
                            {t(
                              "moonpay_fee_estimate_note",
                              "Estimations indicatives — les frais exacts dépendent de la méthode choisie dans MoonPay.",
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3">
			              <p className="text-[13px] md:text-sm text-white/80 font-semibold">
		                {isOtherBlockchainsDestination
		                  ? t(
		                      "ui_how_conversion_works_1f46b6f3ad",
		                      "Comment fonctionne la conversion ?",
		                    )
		                  : t(
		                      "ui_how_bank_send_works",
		                      "Comment ça fonctionne ?",
		                    )}
		              </p>
			              <ol className="mt-3 space-y-1 text-[13px] md:text-sm text-white/70 list-decimal list-inside">
		                <li>
		                  {isOtherBlockchainsDestination
		                    ? t(
		                        "ui_conversion_step_1_account_debit_4b0b1e5cde",
		                        "Débit du montant depuis votre compte",
		                      )
		                    : t(
		                        "ui_debit_step_1_account_debit",
		                        "Débit du montant sur votre compte .",
		                      )}
		                </li>
		                <li>
		                  {isOtherBlockchainsDestination
		                    ? t(
		                        "ui_conversion_step_2_partner_conversion_0e540ff0a4",
		                        "Conversion automatique via notre partenaire",
		                      )
		                    : t(
		                        "ui_debit_step_2_partner_conversion_sale",
		                        "Conversion automatique",
		                      )}
		                </li>
		                <li>
		                  {isOtherBlockchainsDestination
		                    ? t(
		                        "ui_conversion_step_3_add_to_external_wallet_76c21b8c05",
		                        "Ajout vers votre wallet extérieur",
		                      )
		                    : t(
		                        "ui_debit_step_3_bank_transfer",
		                        "Virement vers votre compte bancaire",
		                      )}
		                </li>
		              </ol>
				              <p
				                className={[
				                  "mt-3 text-[12px] md:text-sm font-semibold",
				                  accentText90,
				                ].join(" ")}
				              >
			                {t(
			                  "ui_debit_all_automatic_validate_only",
			                  "✔ Tout est automatique — vous validez simplement",
			                )}
			              </p>
                    {!isOtherBlockchainsDestination ? (
                      <p className="mt-1 text-[11px] md:text-xs text-white/45">
                        {t(
                          "moonpay_sell_partner_location_note",
                          "Le partenaire proposé dépend de votre localisation.",
                        )}
                      </p>
                    ) : null}
                  </div>
		            </>
		          ) : null}

	          {demoMode ? (
	            <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
	              {t(
                "moonpay_info_sell_demo_6d1a9c2b7e",
                "Mode démo : la vente est simulée (pas de virement bancaire).",
              )}
            </div>
          ) : null}

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
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
              "md:hidden w-full h-16 rounded-xl text-white font-semibold transition-all duration-150",
              continueDisabled
                ? "opacity-45 cursor-not-allowed"
                : "hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,0.45) 0%, rgba(232,95,0,0.45) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,0.45) 0%, rgba(91,33,182,0.45) 100%)' }
              : { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,1) 0%, rgba(232,95,0,1) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,1) 0%, rgba(91,33,182,1) 100%)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueLabel}
          </button>
          <button
            type="button"
            onClick={handleContinue}
            disabled={continueDisabled}
            className={[
              "hidden md:flex items-center justify-center w-full h-16 rounded-xl text-white text-xl font-semibold transition-all duration-150",
              continueDisabled
                ? "opacity-45 cursor-not-allowed"
                : "hover:scale-[1.01] active:scale-[0.98]",
            ].join(" ")}
            style={continueDisabled
              ? { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,0.45) 0%, rgba(232,95,0,0.45) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,0.45) 0%, rgba(91,33,182,0.45) 100%)' }
              : { background: isSendToWalletFlow
                  ? 'linear-gradient(180deg, rgba(255,106,0,1) 0%, rgba(232,95,0,1) 100%)'
                  : 'linear-gradient(180deg, rgba(124,58,237,1) 0%, rgba(91,33,182,1) 100%)',
                boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
            }
          >
            {continueLabel}
          </button>
		          <div className="mt-2 flex items-center justify-center gap-2 text-[11px] md:text-xs text-white/60">
		            <span>
		              {isSendToWalletFlow
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
		              {isSendToWalletFlow ? (
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
            className="w-full h-full rounded-lg"
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
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
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
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
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
	            } z-20 wallet-modal-close text-white/70 hover:text-white transition-colors text-xl bg-transparent rounded-full w-10 h-10 flex items-center justify-center`}
	          >
	            ✕
	          </button>

	          {/* Content */}
	          {renderContent()}
	        </div>
	      </div>
    </>
  );
};

export default MoonPaySellModal;
