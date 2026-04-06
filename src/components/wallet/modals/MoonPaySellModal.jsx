import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowDownIcon,
  BuildingLibraryIcon,
  ChevronLeftIcon,
} from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";
import { isIOSDevice } from "@/utils/deviceDetect";
import { greenActionBtnBase } from "./walletModalTokens";
import { useRlusdXrpQuote } from "@/components/wallet/hooks/useRlusdXrpQuote";

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
}) => {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";

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
  const [quoteCurrency, setQuoteCurrency] = useState("USD"); // Fiat code
  const [wizardStep, setWizardStep] = useState(1); // 1/3 = asset+amount, 2/3 = receive in, 3/3 = MoonPay iframe
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
  const [fiatCurrencies, setFiatCurrencies] = useState([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState(null);
  const resolveFiatErrorMessage = (data) => {
    if (!data) return "Failed to load fiat currencies";
    if (typeof data === "string") return data;
    if (typeof data?.error === "string") return data.error;
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    return "Failed to load fiat currencies";
  };

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
          currency;
        const balanceLabel = t("ui_balance_label_4db9aa0c31", "Balance").replace(
          /:\s*$/,
          "",
        );
        const amountValue = Number(token?.value || 0);
        const amountLabel = Number.isFinite(amountValue)
          ? formatAmountWithSymbol(locale, amountValue, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const fallbackRight = `${balanceLabel} = ${amountLabel}`;
        const labelRight =
          selectLabelRightByCurrency?.[currencyRaw] ||
          selectLabelRightByCurrency?.[currency] ||
          fallbackRight;
        const labelMobile =
          selectLabelMobileByCurrency?.[currencyRaw] ||
          selectLabelMobileByCurrency?.[currency] ||
          labelLeft;
        return {
          code: currency,
          label: labelLeft,
          labelLeft,
          labelRight,
          labelMobile,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currency] ||
            null,
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
      const right = String(c?.labelRight || "").toLowerCase();
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
    if (fiatLoading) return;
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
    if (resume.quoteCurrency) setQuoteCurrency(String(resume.quoteCurrency).toUpperCase());

    pendingAutoStartRef.current = true;
  }, [
    demoMode,
    fiatLoading,
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
  const rlusdEquivalentLabel =
    Number.isFinite(Number(rlusdEquivalent)) && Number(rlusdEquivalent) > 0
      ? formatAmountWithSymbol(locale, Number(rlusdEquivalent), "RLUSD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
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

  const rlusdAmountForXrpQuote =
    String(baseCurrencyCode || "").toUpperCase() === "RLUSD" &&
    Number.isFinite(baseCurrencyAmount) &&
    baseCurrencyAmount > 0
      ? baseCurrencyAmount
      : null;
  const rlusdAmountForXrpQuoteLabel =
    Number.isFinite(Number(rlusdAmountForXrpQuote)) && Number(rlusdAmountForXrpQuote) > 0
      ? formatAmountWithSymbol(locale, Number(rlusdAmountForXrpQuote), "RLUSD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 6,
        })
      : null;

  const xrplQuoteState = useRlusdXrpQuote({
    amountRlusd: rlusdAmountForXrpQuote,
    direction: "RLUSD_TO_XRP",
    enabled: Boolean(isOpen && wizardStep === 2 && rlusdAmountForXrpQuote),
    debounceMs: 250,
  });
  const xrpEquivalent = Number(xrplQuoteState?.data?.xrpAmount);
  const xrpEquivalentLabel =
    Number.isFinite(xrpEquivalent) && xrpEquivalent > 0
      ? formatAmountWithSymbol(locale, xrpEquivalent, "XRP", {
          minimumFractionDigits: 4,
          maximumFractionDigits: 6,
        })
      : null;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadFiatCurrencies = async () => {
      setFiatLoading(true);
      setFiatError(null);
      try {
        const response = await fetch("/api/moonpay/fiat-currencies");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(resolveFiatErrorMessage(data));
        }
        const list = data?.currencies || data?.data || data || [];
        const normalized = Array.isArray(list)
          ? list
              .map((fiat) => ({
                ...fiat,
                code: String(fiat?.code || "").toUpperCase(),
              }))
              .filter((fiat) => fiat.code)
          : [];

        if (!active) return;
        setFiatCurrencies(normalized);
        setQuoteCurrency((prev) => {
          if (normalized.some((fiat) => fiat.code === prev)) {
            return prev;
          }
          const usd = normalized.find((fiat) => fiat.code === "USD");
          return usd?.code || normalized[0]?.code || "USD";
        });
      } catch (error) {
        if (!active) return;
        setFiatError(error?.message || "Failed to load fiat currencies");
        setFiatCurrencies([]);
      } finally {
        if (active) setFiatLoading(false);
      }
    };

    loadFiatCurrencies();

    return () => {
      active = false;
    };
  }, [isOpen]);

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
      baseCurrencyCode,
      baseCurrencyAmount,
    });
    saveSellSourceState({
      flowId,
      sourceCurrencyCode: currencyUpper,
      sourceAmount: amountValue,
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

      const response = await fetch("/api/moonpay/generate-sell-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode, // Crypto à vendre
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount,
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

  const continueLabel = loading
    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
    : demoMode
      ? t("moonpay_action_simulate_sell_4d1a9c7b2e", "Simulate sell")
      : t("moonpay_action_continue_sell_2c8a1d6b4f", "Retirer");
  const continueDisabled =
    wizardStep === 1
      ? loading || !hasValidAmount || !selectedToken || conversionMissing
      : loading ||
        !hasValidAmount ||
        !selectedToken ||
        fiatCurrencies.length === 0 ||
        conversionMissing;
  const fiatPlaceholder = t("moonpay_fiat_currency_label", "Fiat currency");
  const fiatUnavailable = !fiatLoading && fiatCurrencies.length === 0;
  const showFiatError = fiatError && !fiatLoading;
  const fiatOptions = fiatCurrencies.map((fiat) => ({
    value: fiat.code,
    label: `${fiat.name || fiat.code} (${fiat.code})`,
  }));
  const fiatSelectValue = fiatCurrencies.length === 0 ? "" : quoteCurrency;

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
        <span key={idx} className="text-xcannes-green/90 font-semibold">
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
    <div ref={contentRootRef} className={embedded ? "relative" : "relative p-4 md:p-5"}>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">
          <div className="flex items-center justify-between">
            {wizardStep === 2 ? (
              <button
                type="button"
                onClick={() => setWizardStep(1)}
                className="inline-flex items-center gap-2 text-white/70 hover:text-white transition-colors"
                aria-label={t("back", "Back")}
              >
                <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
                <span className="text-sm">{t("ui_back", "Retour")}</span>
              </button>
            ) : (
              <div />
            )}
            <div className="text-[13px] tracking-[0.22em] uppercase text-white/55">
              {wizardStep === 1 ? "1/3" : "2/3"}
            </div>
          </div>

          {/* From wallet display */}
			          <div className="rounded-t-[14px] rounded-b-none px-4 py-4 ring-1 ring-white/10 ring-inset bg-white/[0.08] shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]">
		            <p className="block text-[16px] md:text-base font-orbitron font-bold text-white mb-3">
		              {t(
		                "moonpay_select_crypto_to_sell",
		                "Choisissez la devise que vous voulez débiter :",
		              )}
		            </p>
            {String(walletLabel || "").trim() ? (
              <div className="flex items-center gap-2 mb-1">
	                <span
	                  className="h-3 w-3 rounded-full ring-4 ring-xcannes-green/25 bg-xcannes-green shrink-0 animate-pulse"
	                  aria-hidden
	                />
                <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
                  {walletLabel}
                </p>
              </div>
            ) : null}
		            <p className="text-[13px] md:text-sm text-xcannes-green/80 font-mono font-semibold break-all">
		              {walletAddress}
		            </p>
		          </div>

	          {/* Currency selector */}
	          <div>
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
			                "w-full flex items-center justify-between gap-2 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]",
			                wizardStep === 1
			                  ? "cursor-pointer hover:ring-white/25"
			                  : "cursor-default opacity-95",
			              ].join(" ")}
			            >
			              <span className="flex items-center gap-2 min-w-0 flex-1">
			                {renderSelectIcon(selectedSellCurrency?.icon)}
			                <span className="truncate font-semibold">
			                  {selectedSellCurrency?.labelMobile ||
			                    selectedSellCurrency?.labelLeft ||
			                    selectedSellCurrency?.label ||
			                    currency}
			                </span>
			                {selectedSellCurrency?.labelRight ? (
			                  <span className="ml-auto text-white/60 tabular-nums">
			                    {selectedSellCurrency.labelRight}
			                  </span>
			                ) : null}
			              </span>
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
			            </button>

		            {cryptoDropdownOpen && isDesktopViewport
		              ? (() => {
		                  const portalTarget = embedded
		                    ? contentRootRef.current
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
				                              {t(
				                                "moonpay_select_crypto_to_sell",
				                                "Choisissez la devise que vous voulez débiter :",
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
		                              className="w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
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
		                                      ? "bg-xcannes-green/10 text-white"
		                                      : "hover:bg-white/[0.04] text-white/80",
		                                  ].join(" ")}
		                                >
		                                  {renderSelectIcon(opt.icon)}
		                                  <div className="min-w-0 flex-1">
		                                    <div className="text-sm font-semibold truncate">
		                                      {opt.labelLeft || opt.label || opt.code}
		                                    </div>
		                                    {opt.labelRight ? (
		                                      <div className="text-[11px] text-white/55 truncate tabular-nums">
		                                        {opt.labelRight}
		                                      </div>
		                                    ) : null}
		                                  </div>
		                                  {active ? (
		                                    <span className="text-xcannes-green font-semibold text-xs">
		                                      ✓
		                                    </span>
		                                  ) : null}
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
		                              {t(
		                                "moonpay_select_crypto_to_sell",
		                                "Choisissez la devise que vous voulez débiter :",
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
                              className="w-full pl-11 pr-4 py-3 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 transition-all duration-150"
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
                                    ? "bg-xcannes-green/10 text-white"
                                    : "hover:bg-white/[0.04] text-white/80",
                                ].join(" ")}
                              >
                                {renderSelectIcon(opt.icon)}
                                <div className="min-w-0 flex-1">
                                  <div className="text-sm font-semibold truncate">
                                    {opt.labelLeft || opt.label || opt.code}
                                  </div>
                                  {opt.labelRight ? (
                                    <div className="text-[11px] text-white/55 truncate tabular-nums">
                                      {opt.labelRight}
                                    </div>
                                  ) : null}
                                </div>
                                {active ? (
                                  <span className="text-xcannes-green font-semibold text-xs">
                                    ✓
                                  </span>
                                ) : null}
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

	          {/* Amount input (étape 1) */}
	          {wizardStep === 1 ? (
	            <div>
	              <label className="block text-white/70 mb-2">
	                {t("moonpay_amount_to_sell", "Montant")}
	              </label>
	              <div className="relative">
		                <input
		                  type="text"
		                  value={amount}
		                  onChange={(e) => setAmount(e.target.value)}
		                  placeholder="0.0000"
		                  inputMode="decimal"
		                  className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 pr-16 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
		                />

	                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white text-sm font-semibold">
	                  {currency}
	                </span>
	              </div>
	              {isCurrencyLine && hasValidAmount ? (
	                <p
	                  className={`mt-2 text-[11px] ${
	                    conversionMissing ? "text-red-300" : "text-white/60"
	                  }`}
                >
                  {conversionMissing
                    ? t(
                        "ui_rate_unavailable_base_5c1a9b7d2e",
                        "Rate unavailable for base currency.",
                      )
                    : t(
                        "moonpay_sell_rlusd_equivalent_sentence",
                        "{{amount}} seront envoyés à MoonPay en RLUSD pour ce retrait.",
                        { amount: rlusdEquivalentLabel || "0 RLUSD" },
                      )}
                </p>
		              ) : null}
		            </div>
	          ) : null}

	          {/* Arrow down */}
	          <div className="flex justify-center">
	            <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center">
	              <ArrowDownIcon className="w-5 h-5 text-xcannes-green" />
	            </div>
	          </div>

	          {/* Destination display */}
	          <div className="rounded-t-none rounded-b-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] via-white/[0.035] to-black/[0.40] shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15),inset_0_1px_0_rgba(255,255,255,0.07),inset_0_-24px_34px_rgba(0,0,0,0.68)]">
	            <div className="flex items-start gap-3">
	              <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
	                <BuildingLibraryIcon className="w-5 h-5 text-white/70" />
	              </div>
	              <div className="min-w-0">
	                <p className="text-[11px] tracking-[0.22em] uppercase text-white/45">
	                  {t("moonpay_sell_destination_prefix", "Vers :")}
	                </p>
	                <p className="text-[16px] md:text-[17px] text-white font-semibold truncate mt-1">
	                  {t("moonpay_sell_destination_bank_account", "Compte bancaire")}
	                </p>
	                <p className="text-[13px] md:text-sm leading-snug text-white/55 mt-2">
	                  {highlightPhrases(
	                    t(
	                      "moonpay_sell_destination_helper",
	                      "Vous renseignerez votre compte bancaire sur la page du partenaire (IBAN, etc.).",
	                    ),
	                    [
	                      "compte bancaire sur la page du partenaire (IBAN, etc.).",
	                      "votre compte bancaire sur la page du partenaire (IBAN, etc.).",
	                    ],
	                  )}
	                </p>
	              </div>
	            </div>
	          </div>

	          {wizardStep === 2 ? (
              <>
                <div className="rounded-xl bg-white/[0.03] ring-1 ring-white/10 ring-inset px-4 py-4 shadow-[0_4px_12px_rgba(0,0,0,0.35)]">
                  <p className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                    {t("ui_summary", "Résumé")}
                  </p>
                  <div className="mt-2 space-y-1 text-sm text-white/80">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/60">
                        {t("ui_amount", "Montant")}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {hasValidAmount
                          ? formatAmountWithSymbol(locale, amountValue, currencyUpper || "XRP", {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: 6,
                            })
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/60">
                        {t("ui_equivalent_rlusd", { defaultValue: "≈ RLUSD" })}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {conversionMissing
                          ? t(
                              "ui_rate_unavailable_base_5c1a9b7d2e",
                              "Rate unavailable for base currency.",
                            )
                          : rlusdAmountForXrpQuoteLabel || rlusdEquivalentLabel || "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-white/60">
                        {t("ui_equivalent_xrp", { defaultValue: "≈ XRP (XRPL)" })}
                      </span>
                      <span className="font-semibold tabular-nums">
                        {xrplQuoteState?.status === "loading"
                          ? t("ui_loading", "Loading...")
                          : xrpEquivalentLabel || "—"}
                      </span>
                    </div>
                    {xrplQuoteState?.status === "error" ? (
                      <p className="pt-2 text-[11px] text-white/55">
                        {t("ui_xrpl_quote_unavailable", {
                          defaultValue: "Taux XRPL indisponible pour le moment.",
                        })}
                      </p>
                    ) : null}
                  </div>
                </div>
	            <div>
	              <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
	                {t("moonpay_receive_in", "Receive in")}
	              </label>
	              <ModalSelect
	                value={fiatSelectValue}
	                onChange={setQuoteCurrency}
	                options={fiatOptions}
	                placeholder={fiatPlaceholder}
	                disabled={fiatLoading || fiatCurrencies.length === 0}
	                buttonClassName="w-full bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer disabled:opacity-60 hover:ring-white/25 transition-all duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
	                menuClassName={
	                  noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
	                }
	                selectClassName="xcannes-select w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 disabled:opacity-60 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
	              />
	              {showFiatError && (
	                <p className="text-xs text-red-400 mt-1">{fiatError}</p>
	              )}
	              {!fiatLoading && !fiatError && fiatUnavailable && (
	                <p className="text-[11px] text-white/55 mt-2">
	                  {t("moonpay_fiat_unavailable", "Fiat currencies unavailable")}
	                </p>
	              )}
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
	          <SwipeConfirmButton
	            label={continueLabel}
	            onConfirm={wizardStep === 1 ? () => setWizardStep(2) : generateSellUrl}
	            disabled={continueDisabled}
	            variant="xcannesGreen"
	            className="md:hidden"
	          />
	          <button
	            type="button"
	            onClick={wizardStep === 1 ? () => setWizardStep(2) : generateSellUrl}
	            disabled={continueDisabled}
	            className={`hidden md:block w-full text-xl py-4 ${greenActionBtnBase}`}
	          >
	            {continueLabel}
	          </button>
          <p className="mt-2 text-[11px] md:text-xs text-white/60 text-center">
            {t(
              "moonpay_sell_secure_bank_transfer_note",
              "Virement sécurisé vers votre banque",
            )}
          </p>
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
          <div className="flex justify-end pb-2">
            <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">3/3</div>
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
