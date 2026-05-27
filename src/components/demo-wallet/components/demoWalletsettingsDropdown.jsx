"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { createPortal } from "react-dom";

const AVAILABLE_DEFAULT_CURRENCIES = ["EUR", "USD", "GBP", "CHF", "CAD", "JPY", "AUD"];

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴",
};

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65),
  );
  return String.fromCodePoint(...codePoints);
}

function getCurrencyFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) return CURRENCY_FLAG_OVERRIDES[upper];
  return countryCodeToFlag(upper.slice(0, 2));
}

function useEscapeClose(isOpen, onClose) {
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);
}

function SettingsPageModal({
  isOpen,
  onClose,
  ariaLabel,
  label,
  subtitle,
  contentClassName,
  children,
}) {
  const { t } = useTranslation("common");
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-[9999] bg-[#0b0f10]"
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
    >
      <div className="h-full w-full flex flex-col">
        <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                onClick={onClose}
                className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
                aria-label={t("back", "Retour")}
              >
                <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
              </button>
              <div className="min-w-0">
                <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                  {label}
                </div>
                <div className="text-[12px] text-white/80 mt-1 truncate">
                  {subtitle}
                </div>
              </div>
            </div>
            <span className="h-10 w-10" aria-hidden="true" />
          </div>
        </div>
        <div className={contentClassName || "flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4"}>
          {children}
        </div>
      </div>
    </div>
  );
}

function DemoPreferredCurrencySelector({
  currentCurrency = "USD",
  topCurrencies = [],
  allCurrencies = [],
  isLoading = false,
  allowedCurrencyCodes,
  onSelect,
  onOpen,
}) {
  const { t } = useTranslation("common");
  const rootRef = useRef(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [search, setSearch] = useState("");
  const searchRef = useRef(null);

  const normalizedTopCurrencies = useMemo(() => {
    if (Array.isArray(topCurrencies) && topCurrencies.length > 0) return topCurrencies;
    return ["USD", "EUR", "GBP", "CHF", "CAD"].map((code) => ({ code, name: "", symbol: "" }));
  }, [topCurrencies]);

  const topCodeSet = useMemo(() => {
    return new Set(normalizedTopCurrencies.map((c) => c.code));
  }, [normalizedTopCurrencies]);

  const uniqueCurrencies = useMemo(() => {
    const list = [];
    const seen = new Set();
    const allowedSet =
      Array.isArray(allowedCurrencyCodes) && allowedCurrencyCodes.length > 0
        ? new Set(allowedCurrencyCodes.map((c) => String(c || "").toUpperCase()))
        : new Set(AVAILABLE_DEFAULT_CURRENCIES.map((c) => String(c || "").toUpperCase()));

    for (const code of allowedSet) {
      if (!code || seen.has(code)) continue;
      seen.add(code);
      list.push({ code, name: "", symbol: "" });
    }

    const candidates = [
      ...normalizedTopCurrencies,
      ...(Array.isArray(allCurrencies) ? allCurrencies : []),
    ];

    for (const raw of candidates) {
      const code = String(raw?.code || "").toUpperCase();
      if (allowedSet.size > 0 && !allowedSet.has(code)) continue;
      if (!code || seen.has(code)) continue;
      seen.add(code);
      list.push({
        code,
        name: String(raw?.name || ""),
        symbol: String(raw?.symbol || ""),
      });
    }

    if (Array.isArray(allCurrencies) && allCurrencies.length > 0) {
      const metaByCode = new Map(
        allCurrencies
          .map((c) => ({
            code: String(c?.code || "").toUpperCase(),
            name: String(c?.name || ""),
            symbol: String(c?.symbol || ""),
          }))
          .filter((c) => c.code)
          .map((c) => [c.code, c]),
      );
      for (let i = 0; i < list.length; i += 1) {
        const meta = metaByCode.get(list[i].code);
        if (!meta) continue;
        if (!list[i].name && meta.name) list[i].name = meta.name;
        if (!list[i].symbol && meta.symbol) list[i].symbol = meta.symbol;
      }
    }

    const current = String(currentCurrency || "").toUpperCase();
    if (current && !seen.has(current)) {
      list.unshift({ code: current, name: "", symbol: "" });
    }

    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [allCurrencies, allowedCurrencyCodes, currentCurrency, normalizedTopCurrencies]);

  const filteredCurrencies = useMemo(() => {
    if (!search.trim()) return uniqueCurrencies;
    const q = search.trim().toUpperCase();
    return uniqueCurrencies.filter(
      (c) => c.code.includes(q) || (c.name && c.name.toUpperCase().includes(q)),
    );
  }, [search, uniqueCurrencies]);

  const visibleCurrencies = useMemo(() => {
    if (search.trim()) return filteredCurrencies;
    const rest = filteredCurrencies.filter((c) => !topCodeSet.has(c.code));
    return [...normalizedTopCurrencies, ...rest];
  }, [filteredCurrencies, normalizedTopCurrencies, search, topCodeSet]);

  const selectedCurrency = useMemo(() => {
    return uniqueCurrencies.find((c) => c.code === currentCurrency) || { code: currentCurrency, name: "", symbol: "" };
  }, [currentCurrency, uniqueCurrencies]);

  const close = useCallback(() => {
    setIsExpanded(false);
    setSearch("");
  }, []);

  useEffect(() => {
    if (!isExpanded) return;
    const handler = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) close();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [close, isExpanded]);

  const handleSelect = useCallback(
    (code) => {
      onSelect?.(code);
      close();
    },
    [close, onSelect],
  );

  return (
    <div className="space-y-2" ref={rootRef}>
      <div className="text-[10px] font-semibold text-white/55 tracking-[0.22em] px-1">
        {t("ui_preferred_currency_label", "Devise principale")}
      </div>

      <button
        type="button"
        onClick={() => {
          setIsExpanded((v) => {
            const next = !v;
            if (next) onOpen?.();
            if (next) setSearch("");
            return next;
          });
        }}
        className={[
          "w-full flex items-center gap-3 px-3 py-2 md:py-3 rounded-[18px] transition-colors",
          "bg-black/25 ring-1 ring-inset ring-white/10 hover:bg-black/30 hover:ring-white/15",
        ].join(" ")}
        aria-haspopup="listbox"
        aria-expanded={isExpanded}
      >
        <span className="h-7 w-7 md:h-8 md:w-8 inline-flex items-center justify-center rounded-[8px] bg-transparent text-[22px] md:text-[22px] leading-none shrink-0">
          {getCurrencyFlag(currentCurrency)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 min-w-0">
            <div className="text-[15px] font-semibold text-white/90 leading-tight shrink-0">
              {currentCurrency}
            </div>
            <div className="text-[11px] text-white/45 truncate">
              {selectedCurrency?.name || t("ui_currency_picker_hint", "Choisir une devise")}
            </div>
          </div>
        </div>
        <span className="text-white/35 shrink-0">
          <svg
            className={["w-5 h-5 transition-transform", isExpanded ? "rotate-180" : ""].join(" ")}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
            aria-hidden
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </span>
      </button>

      {isExpanded && (
        <div className="rounded-xl border border-white/10 bg-black/30 p-2 space-y-2">
          <div className="relative px-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onPointerDown={(e) => e.stopPropagation()}
              placeholder={t("search", "Rechercher")}
              className="w-full rounded-lg bg-black/30 border border-white/10 px-3 py-2 text-[12px] text-white/85 placeholder:text-white/35 focus:outline-none focus:border-xcannes-green/60 focus:ring-2 focus:ring-xcannes-green/20"
            />
            {isLoading ? (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] text-white/35">
                {t("loading", "Chargement…")}
              </div>
            ) : null}
          </div>

          <div className="max-h-56 overflow-y-auto overscroll-contain pr-1">
            <div className="space-y-1">
              {visibleCurrencies.map((c) => {
                const selected = String(c.code).toUpperCase() === String(currentCurrency).toUpperCase();
                return (
                  <button
                    key={c.code}
                    type="button"
                    className={[
                      "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
                      selected ? "bg-white/10 text-white" : "hover:bg-white/5 text-white/85",
                    ].join(" ")}
                    onClick={() => handleSelect(c.code)}
                  >
                    <span className="h-6 w-6 inline-flex items-center justify-center rounded-md text-[18px] leading-none shrink-0">
                      {getCurrencyFlag(c.code)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-2 min-w-0">
                        <div className="text-[13px] font-semibold truncate">{c.code}</div>
                        <div className="text-[11px] text-white/40 truncate">{c.name}</div>
                      </div>
                    </div>
                    {selected ? <span className="text-xcannes-green text-[12px] font-semibold">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * DemoWalletSettingsDropdown — settings gear button + dropdown menu.
 * Demo-only counterpart of `WalletSettingsDropdown` (same structure, independent implementation).
 */
export default function DemoWalletSettingsDropdown({
  position = "header",
  isDesktopPanel = false,
  onOpenInfo,
  onOpenXrplActivity,
  onOpenSecurity,
  onOpenHelp,
  onOpenTerms,
  preferredCurrency = "USD",
  topCurrencies = [],
  fawazCurrencies = [],
  fawazLoading = false,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
  allowedCurrencyCodes = AVAILABLE_DEFAULT_CURRENCIES,
  onCopyAddress,
  onResetDemo,
  resetDisabled = false,
}) {
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
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
  const [showQrModal, setShowQrModal] = useState(false);
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [helpOpenIndex, setHelpOpenIndex] = useState(0);
  const ref = useRef(null);
  const buttonRef = useRef(null);
  const menuRef = useRef(null);
  const hoverResetTimerRef = useRef(null);
  const lastMobileHoverElRef = useRef(null);
  const [desktopMenuStyle, setDesktopMenuStyle] = useState(null);
  const [desktopArrowX, setDesktopArrowX] = useState(null);
  const [desktopPlacement, setDesktopPlacement] = useState("bottom");

  const settingsIconShellClassName =
    "inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset shadow-[0_4px_12px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] shrink-0";
  const settingsSupportIconShellClassName =
    "inline-flex h-[70px] w-[96px] items-center justify-center rounded-[26px] shrink-0";
  const settingsRowClassName =
    "wallet-settings-row w-full flex items-center gap-3 px-3 py-3 rounded-[20px] border border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent hover:border-white/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10";

  const clearMobileStickyHoverReset = useCallback(() => {
    if (hoverResetTimerRef.current) {
      clearTimeout(hoverResetTimerRef.current);
      hoverResetTimerRef.current = null;
    }
    const last = lastMobileHoverElRef.current;
    if (last) {
      last.classList.remove("xcannes-reset-hover");
      lastMobileHoverElRef.current = null;
    }
  }, []);

  const scheduleMobileStickyHoverReset = useCallback(
    (el) => {
      if (!el) return;
      clearMobileStickyHoverReset();
      try {
        el.classList.remove("xcannes-reset-hover");
      } catch {
        // ignore
      }
      lastMobileHoverElRef.current = el;
      hoverResetTimerRef.current = setTimeout(() => {
        try {
          el.classList.add("xcannes-reset-hover");
        } catch {
          // ignore
        }
      }, 2000);
    },
    [clearMobileStickyHoverReset],
  );

  useEffect(() => {
    if (!isOpen) {
      clearMobileStickyHoverReset();
      return;
    }
    return () => clearMobileStickyHoverReset();
  }, [isOpen, clearMobileStickyHoverReset]);

  const SettingsAddWalletIcon = () => (
    <svg viewBox="0 0 48 48" className="w-10 h-10" fill="none" aria-hidden>
      <path
        d="M24 14v20M14 24h20"
        stroke="rgba(255,255,255,0.74)"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    </svg>
  );

  const SettingsXrplIcon = () => (
    <Image
      src="/symbols/xrp.png"
      alt="XRP"
      width={32}
      height={32}
      className="w-8 h-8 object-contain"
      draggable={false}
      unoptimized
      loading="eager"
    />
  );

  const SettingsRlusdIcon = () => (
    <svg viewBox="-1 7 102 112" className="w-8 h-8" fill="none" aria-hidden>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="currentColor"
        d="M88.6703 74.1905C84.8403 71.9705 80.5203 71.3305 76.2403 71.1905C72.6503 71.0705 67.3003 68.7705 67.3003 62.1905C67.3209 59.8202 68.2676 57.552 69.938 55.8704C71.6085 54.1887 73.8703 53.2269 76.2403 53.1905C80.5203 53.0405 84.8403 52.4005 88.6703 50.1905C92.1093 48.1991 94.9638 45.3381 96.9472 41.8946C98.9307 38.4511 99.9733 34.5464 99.9703 30.5725C99.9673 26.5987 98.9189 22.6955 96.9303 19.255C94.9417 15.8145 92.0829 12.9577 88.641 10.9715C85.1991 8.98532 81.2952 7.93963 77.3213 7.93945C73.3475 7.93927 69.4435 8.9846 66.0014 10.9705C62.5593 12.9563 59.7003 15.8129 57.7113 19.2532C55.7224 22.6935 54.6737 26.5966 54.6703 30.5705C54.6703 34.9605 56.2303 39.0005 58.2303 42.7505C59.9003 45.9005 60.7503 51.7505 55.0003 55.0605C52.9221 56.2169 50.4734 56.5128 48.1796 55.8846C45.8857 55.2565 43.9294 53.7544 42.7303 51.7005C40.4803 48.1005 37.7303 44.7005 33.9603 42.5305C30.517 40.5443 26.6115 39.4993 22.6364 39.5005C18.6612 39.5017 14.7564 40.549 11.3142 42.5373C7.87207 44.5255 5.01378 47.3847 3.02656 50.8274C1.03933 54.2702 -0.00683594 58.1753 -0.00683594 62.1505C-0.00683594 66.1256 1.03933 70.0307 3.02656 73.4735C5.01378 76.9163 7.87207 79.7754 11.3142 81.7637C14.7564 83.7519 18.6612 84.7993 22.6364 84.8005C26.6115 84.8017 30.517 83.7567 33.9603 81.7705C37.7603 79.5705 40.4803 76.2005 42.7303 72.6005C44.5803 69.6005 49.1903 65.8805 55.0003 69.2405C57.0411 70.4629 58.5213 72.4367 59.1233 74.7381C59.7253 77.0396 59.4011 79.4853 58.2203 81.5505C56.2203 85.3005 54.6703 89.3405 54.6703 93.7305C54.6706 97.7076 55.7176 101.615 57.7062 105.059C59.6947 108.503 62.5548 111.363 65.9989 113.352C69.443 115.341 73.3499 116.388 77.327 116.389C81.3041 116.389 85.2113 115.343 88.656 113.355C92.1007 111.368 94.9616 108.508 96.9512 105.065C98.9407 101.621 99.9889 97.7142 99.9903 93.7371C99.9918 89.76 98.9464 85.8525 96.9594 82.4074C94.9724 78.9623 92.1136 76.1008 88.6703 74.1105V74.1905Z"
      />
    </svg>
  );

  const SettingsInfoIcon = () => (
    <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none" aria-hidden>
      <circle cx="24" cy="24" r="13.5" stroke="rgba(255,255,255,0.18)" strokeWidth="1.4" />
      <path d="M24 22v9" stroke="rgba(255,255,255,0.86)" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="24" cy="17" r="1.4" fill="rgba(255,255,255,0.86)" />
    </svg>
  );

  const SettingsSecurityIcon = () => (
    <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none" aria-hidden>
      <path d="M24 11l11 5.2v8.2c0 8.1-6.1 12.7-11 14.6-4.9-1.9-11-6.5-11-14.6v-8.2L24 11Z" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M19.5 24.5l3.2 3.2 5.8-6.2" stroke="rgba(255,255,255,0.86)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  const SettingsHelpIcon = () => (
    <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none" aria-hidden>
      <path
        d="M19 13H29A6 6 0 0 1 35 19V25A6 6 0 0 1 29 31H26L24 35L22 31H19A6 6 0 0 1 13 25V19A6 6 0 0 1 19 13Z"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="18.5" cy="22" r="1.2" fill="rgba(255,255,255,0.82)" />
      <circle cx="24" cy="22" r="1.2" fill="rgba(255,255,255,0.82)" />
      <circle cx="29.5" cy="22" r="1.2" fill="rgba(255,255,255,0.82)" />
    </svg>
  );

  const SettingsDocIcon = () => (
    <svg viewBox="0 0 48 48" className="w-14 h-14" fill="none" aria-hidden>
      <path d="M17 11.5h11l5 5V34c0 2-1.6 3.5-3.5 3.5h-12c-1.9 0-3.5-1.5-3.5-3.5V15c0-1.9 1.6-3.5 3.5-3.5Z" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M28 11.5V17h5" stroke="rgba(255,255,255,0.30)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M19.5 22h9M19.5 27h9M19.5 32h6" stroke="rgba(255,255,255,0.82)" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );

  const SettingsCopyIcon = () => (
    <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.8} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9h10v12H9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
    </svg>
  );

  const SettingsResetIcon = () => (
    <svg className="w-14 h-14" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 .34-.02.67-.07 1h2.02c.03-.33.05-.66.05-1 0-4.42-3.58-8-8-8zm-6.93 7H3.05c-.03.33-.05.66-.05 1 0 4.42 3.58 8 8 8v3l4-4-4-4v3c-3.31 0-6-2.69-6-6 0-.34.02-.67.07-1z" />
    </svg>
  );

  const RETURN_FLAG = "__XCANNES_RETURN_TO_DEMO_SETTINGS_DROPDOWN__";

  const markReturnToSettings = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window[RETURN_FLAG] = true;
    } catch {
      // ignore
    }
  }, []);

  const reopenSettingsDropdown = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window[RETURN_FLAG] = false;
      } catch {
        // ignore
      }
    }
    try {
      window.dispatchEvent(new CustomEvent("xcannes:demo-wallet-settings-open"));
    } catch {
      // ignore
    }
  }, []);

  const makeModalCloser = useCallback(
    (setter) => () => {
      setter(false);
      reopenSettingsDropdown();
    },
    [reopenSettingsDropdown],
  );

  const closeSecurityModal = useMemo(() => makeModalCloser(setShowSecurityModal), [makeModalCloser]);
  const closeHelpModal = useMemo(() => makeModalCloser(setShowHelpModal), [makeModalCloser]);
  const closeTermsModal = useMemo(() => makeModalCloser(setShowTermsModal), [makeModalCloser]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setIsOpen(true);
    window.addEventListener("xcannes:demo-wallet-settings-open", handler);
    return () => window.removeEventListener("xcannes:demo-wallet-settings-open", handler);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) return;
      if (ref.current && ref.current.contains(e.target)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  useEscapeClose(isOpen, () => setIsOpen(false));
  useEscapeClose(showHelpModal, closeHelpModal);
  useEscapeClose(showSecurityModal, closeSecurityModal);
  useEscapeClose(showTermsModal, closeTermsModal);

  const HELP_QA = [
    {
      q: t("demo_help_q1", "Démo : comment fonctionne cette page ?"),
      a: t("demo_help_a1", "Ce menu reprend la structure du wallet réel, mais fonctionne en mode démonstration."),
    },
    {
      q: t("demo_help_q2", "Démo : puis-je envoyer des fonds ?"),
      a: t("demo_help_a2", "Non. La démo illustre l’interface et quelques interactions sans signature de transaction."),
    },
    {
      q: t("demo_help_q3", "Démo : à quoi sert RLUSD ?"),
      a: t("demo_help_a3", "La démo utilise RLUSD comme base de conversion pour illustrer l’affichage multi-devises."),
    },
  ];

  const visibilityClass =
    position === "header"
      ? "hidden md:relative md:block"
      : position === "footer"
        ? "relative md:hidden"
        : "relative";

  const inlineButton = position === "inline";

  const isDesktop =
    typeof window !== "undefined"
      ? window.matchMedia?.("(min-width: 768px)")?.matches
      : false;

  const isDesktopInlinePanel =
    isDesktopPanel &&
    typeof window !== "undefined" &&
    window.matchMedia?.("(min-width: 1024px)")?.matches;

  const [desktopInlinePanelTarget, setDesktopInlinePanelTarget] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    if (!isDesktopInlinePanel) {
      setDesktopInlinePanelTarget(null);
      return;
    }
    try {
      setDesktopInlinePanelTarget(document.getElementById("wallet-desktop-inline-panel"));
    } catch {
      setDesktopInlinePanelTarget(null);
    }
  }, [isDesktopInlinePanel, isOpen]);

  const shouldPortalToInlinePanel = Boolean(isDesktopInlinePanel && desktopInlinePanelTarget);

  const updateDesktopPosition = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!window.matchMedia?.("(min-width: 768px)")?.matches) return;
    if (isDesktopInlinePanel) return;
    if (!buttonRef.current || !menuRef.current) return;

    const margin = 12;
    const viewportW = window.innerWidth;
    const viewportH = window.innerHeight;

    const buttonRect = buttonRef.current.getBoundingClientRect();
    const menuW = menuRef.current.offsetWidth || 360;
    const menuH = menuRef.current.offsetHeight || 480;

    let left = buttonRect.right - menuW;
    left = Math.max(margin, Math.min(left, viewportW - menuW - margin));

    const fitsBelow = buttonRect.bottom + margin + menuH + margin <= viewportH;
    const fitsAbove = buttonRect.top - margin - menuH >= margin;

    let top;
    let placement = "bottom";
    if (!fitsBelow && fitsAbove) {
      placement = "top";
      top = Math.max(margin, buttonRect.top - margin - menuH);
    } else {
      top = Math.max(margin, Math.min(viewportH - menuH - margin, buttonRect.bottom + margin));
    }

    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const arrowX = Math.max(18, Math.min(menuW - 18, buttonCenterX - left));

    setDesktopPlacement(placement);
    setDesktopArrowX(arrowX);
    setDesktopMenuStyle({ top: `${Math.round(top)}px`, left: `${Math.round(left)}px` });
  }, [isDesktopInlinePanel]);

  useLayoutEffect(() => {
    if (!isOpen) return;
    if (isDesktopInlinePanel) return;
    updateDesktopPosition();

    const onTick = () => updateDesktopPosition();
    window.addEventListener("resize", onTick);
    window.addEventListener("scroll", onTick, true);
    return () => {
      window.removeEventListener("resize", onTick);
      window.removeEventListener("scroll", onTick, true);
    };
  }, [isDesktopInlinePanel, isOpen, updateDesktopPosition]);

  useEffect(() => {
    if (isOpen) return;
    setDesktopMenuStyle(null);
    setDesktopArrowX(null);
    setDesktopPlacement("bottom");
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) return;
    try {
      const listEl = overlayListRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    setOverlayDragging(false);
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
  }, [isOpen]);

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
    const meta = overlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration;
    const shouldClose = delta > 160 || velocity > 1.0;

    overlayDragMetaRef.current.pending = false;
    overlayDragMetaRef.current.dragging = false;
    setOverlayDragging(false);
    releaseOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      setOverlayTranslateY(Math.max(delta, height));
      window.setTimeout(() => setIsOpen(false), 180);
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

  return (
    <div className={visibilityClass} ref={ref}>
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        ref={buttonRef}
        className={[
          inlineButton
            ? "shrink-0 h-10 px-2.5 flex items-center justify-center gap-2 rounded-md transition-all active:scale-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]"
            : "shrink-0 h-9 px-2.5 flex items-center justify-center gap-2 rounded-lg border transition-all active:scale-95 drop-shadow-[0_0_8px_rgba(255,255,255,0.25)]",
          isOpen
            ? inlineButton
              ? "text-white"
              : "border-transparent text-white"
            : "border-transparent text-white/60 hover:text-white",
        ].join(" ")}
        aria-label={t("ui_settings_label", "Paramètres")}
        aria-haspopup="menu"
        aria-expanded={isOpen}
      >
        <svg
          className={inlineButton ? "w-[22px] h-[22px] lg:w-[20px] lg:h-[20px] opacity-70 hover:opacity-90" : "w-6 h-6 lg:w-5 lg:h-5"}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={1.8}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.066z"
          />
          <circle cx="12" cy="12" r="3" />
        </svg>
        <span className="hidden lg:inline text-base font-medium">
          {t("ui_settings_label", "Paramètres")}
        </span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop on mobile (tap to close) */}
          <button
            type="button"
            aria-label={t("close", "Fermer")}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px] md:hidden"
            onClick={() => setIsOpen(false)}
            style={{
              opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)),
            }}
          />

          {(() => {
            const menu = (
              <div
                role="menu"
                ref={(node) => {
                  menuRef.current = node;
                  overlayRef.current = node;
                }}
                onPointerDownCapture={(event) => {
                  if (event.pointerType !== "touch") return;
                  const el =
                    event.target instanceof Element
                      ? event.target.closest(".wallet-settings-row")
                      : null;
                  if (!el) return;
                  scheduleMobileStickyHoverReset(el);
                }}
                style={{
                  ...(shouldPortalToInlinePanel
                    ? {}
                    : isDesktop
                      ? desktopMenuStyle || undefined
                      : {
                          transform: `translateY(${overlayTranslateY}px)`,
                          transition: overlayDragging ? "none" : "transform 180ms ease-out",
                        }),
                }}
                className={[
                  "fixed inset-0 z-50 overflow-y-auto bg-xcannes-surface-demo demo-wallet-tooltip-scope animate-walletSettingsIn flex flex-col",
                  shouldPortalToInlinePanel ? "md:static md:inset-auto md:z-auto md:h-full" : "",
                  !shouldPortalToInlinePanel ? "md:rounded-[28px] md:shadow-2xl md:border md:border-white/10 md:max-w-[420px] md:h-auto md:inset-auto" : "",
                  !shouldPortalToInlinePanel && isDesktop ? "md:overflow-hidden" : "",
                ].join(" ")}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerEnd}
                onPointerCancel={handleOverlayPointerEnd}
              >
                {!shouldPortalToInlinePanel ? (
                  <div
                    className="hidden md:block absolute h-3.5 w-3.5 bg-elevated border border-white/10 rotate-45"
                    style={
                      !isDesktop || desktopArrowX == null
                        ? undefined
                        : {
                            left: `${Math.round(desktopArrowX - 7)}px`,
                            top: desktopPlacement === "bottom" ? "-7px" : undefined,
                            bottom: desktopPlacement === "top" ? "-7px" : undefined,
                          }
                    }
                    aria-hidden
                  />
                ) : null}

                <div
                  className="shrink-0 md:hidden"
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "fixed");
                  }}
                >
                  <div className="flex justify-center pt-3 pb-1">
                    <div className="w-16 h-5 flex items-center justify-center" aria-hidden>
                      <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                    </div>
                  </div>
                  <div className="flex items-center justify-center px-4 pt-2 pb-2">
                    <div className="text-[12px] font-semibold tracking-[0.32em] text-white/90">
                      {t("ui_settings_label", "Paramètres")}
                    </div>
                  </div>
                  <div className="px-6 pb-3">
                    <div className="h-px bg-white/10" />
                  </div>
                </div>

                <div className="hidden md:flex items-center justify-center px-4 py-4 border-b border-white/10">
                  <div className="text-[18px] font-semibold text-white">
                    {t("ui_settings_label", "Paramètres")}
                  </div>
                </div>

                <div
                  ref={overlayListRef}
                  className={[
                    "flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 pb-4 md:px-3 md:pb-3",
                    shouldPortalToInlinePanel
                      ? ""
                      : "md:max-h-[min(680px,calc(100vh-140px))] md:overflow-y-auto md:overscroll-contain",
                  ].join(" ")}
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "list");
                  }}
                >
                  <div className="pt-2 md:pt-2.5">
                    <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                      {t("ui_settings_section_accounts", "Comptes")}
                    </div>

                    <div className="rounded-[20px] bg-elevated">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          setIsOpen(false);
                          if (isDesktop) {
                            setShowQrModal(true);
                          } else {
                            window.open("/wallet-app/?action=choice", "_blank");
                          }
                        }}
                        className={settingsRowClassName}
                      >
                        <span className={`${settingsIconShellClassName} bg-transparent text-white/60`}>
                          <SettingsAddWalletIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/90">
                            {t("ui_add_wallet", "Ajouter un compte")}
                          </div>
                          <div className="text-[11px] text-white/45 mt-0.5">
                            {t("ui_add_wallet_hint", "Créer ou importer un compte existant")}
                          </div>
                        </div>
                        <span className="text-white/25 text-lg">›</span>
                      </button>
                    </div>
                  </div>

                  {onOpenXrplActivity ? (
                    <div className="mt-4">
                      <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                        {t("ui_settings_section_network", "Réseau")}
                      </div>

                      <div className="rounded-[20px] bg-elevated">
                        <button
                          type="button"
                          onClick={() => {
                            markReturnToSettings();
                            setIsOpen(false);
                            onOpenXrplActivity?.();
                          }}
                          className={settingsRowClassName}
                        >
                          <span className={`${settingsIconShellClassName} bg-black`}>
                            <SettingsXrplIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-white/90">
                              {t("ui_xrpl_network_activity_6c7a1d9b5e", "Activité du réseau XRPL")}
                            </div>
                            <div className="text-[11px] text-white/45 mt-0.5">
                              {t("ui_xrpl_network_activity_hint_2c7a1d9b5e", "Voir les frais et les opérations du réseau")}
                            </div>
                          </div>
                          <span className="text-white/25 text-lg">›</span>
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {preferredCurrency && (
                    <div className="mt-4">
                      <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                        {t("ui_settings_section_preferences", "Préférences")}
                      </div>
                      <div className="rounded-[20px] bg-elevated">
                        <div className="rounded-[20px] border border-white/10 bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] p-2.5 transition-colors duration-150">
                          <DemoPreferredCurrencySelector
                            currentCurrency={preferredCurrency}
                            topCurrencies={topCurrencies}
                            allCurrencies={fawazCurrencies}
                            isLoading={fawazLoading}
                            allowedCurrencyCodes={allowedCurrencyCodes}
                            onSelect={(code) => onPreferredCurrencyChange?.(code)}
                            onOpen={onLoadFawazCurrencies}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="mt-4">
                    <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                      {t("ui_settings_section_support", "Support")}
                    </div>

                    <div className="rounded-[20px] border border-white/10 bg-elevated overflow-hidden">
                      <a
                        href="https://rlusd.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => setIsOpen(false)}
                        className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 text-left bg-white/5 border border-white/10 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent hover:border-white/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                      >
                        <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                          <SettingsRlusdIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("ui_stablecoin_rlusd", "Stablecoin RLUSD")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_stablecoin_rlusd_hint", "En savoir plus sur rlusd.com")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">↗</span>
                      </a>

                      {onCopyAddress ? (
                        <button
                          type="button"
                          onClick={() => {
                            onCopyAddress?.();
                            setIsOpen(false);
                          }}
                          className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                        >
                          <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                            <SettingsCopyIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-white/85">
                              {t("ui_copy_xrpl_address_4f63ed10fc", "Copier l'adresse XRPL")}
                            </div>
                            <div className="text-[11px] text-white/40 mt-0.5">
                              {t("ui_copy_address_82d1cf6e94", "Copier l'adresse")}
                            </div>
                          </div>
                          <span className="text-white/20 text-lg">›</span>
                        </button>
                      ) : null}

                      {onResetDemo ? (
                        <button
                          type="button"
                          disabled={resetDisabled}
                          onClick={() => {
                            if (resetDisabled) return;
                            onResetDemo?.();
                            setIsOpen(false);
                          }}
                          className={[
                            "wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset",
                            resetDisabled ? "opacity-50 cursor-not-allowed" : "",
                          ].join(" ")}
                        >
                          <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                            <SettingsResetIcon />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] font-medium text-white/85">
                              {t("demo_reset", "Réinitialiser")}
                            </div>
                            <div className="text-[11px] text-white/40 mt-0.5">
                              {t("demo_tt_reset", "Réinitialiser la démo.")}
                            </div>
                          </div>
                          <span className="text-white/20 text-lg">›</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => {
                          markReturnToSettings();
                          onOpenInfo?.();
                          setIsOpen(false);
                        }}
                        className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                      >
                        <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                          <SettingsInfoIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("ui_fees_and_how_it_works", "Frais et fonctionnement")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_settings_info_hint", "Comprendre les frais et le fonctionnement")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          markReturnToSettings();
                          setIsOpen(false);
                          if (isDesktopPanel) {
                            onOpenSecurity?.();
                            return;
                          }
                          setShowSecurityModal(true);
                        }}
                        className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                      >
                        <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                          <SettingsSecurityIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("ui_security", "Sécurité")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_security_hint", "Comprendre la protection du compte")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          markReturnToSettings();
                          setIsOpen(false);
                          if (isDesktopPanel) {
                            onOpenHelp?.();
                            return;
                          }
                          setHelpOpenIndex(0);
                          setShowHelpModal(true);
                        }}
                        className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                      >
                        <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                          <SettingsHelpIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("ui_questions_and_help", "Aide & FAQ")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_questions_and_help_hint", "Questions fréquentes et réponses")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          markReturnToSettings();
                          setIsOpen(false);
                          if (isDesktopPanel) {
                            onOpenTerms?.();
                            return;
                          }
                          setShowTermsModal(true);
                        }}
                        className="wallet-settings-row w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                      >
                        <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                          <SettingsDocIcon />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[13px] font-medium text-white/85">
                            {t("ui_terms_of_use", "Conditions d'utilisations")}
                          </div>
                          <div className="text-[11px] text-white/40 mt-0.5">
                            {t("ui_terms_of_use_hint", "Lire les conditions d'utilisation")}
                          </div>
                        </div>
                        <span className="text-white/20 text-lg">›</span>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="hidden md:flex pointer-events-none justify-center pt-6 pb-4" aria-hidden>
                  <span className="block w-[120px] h-[4px] rounded-full bg-white/10" />
                </div>
              </div>
            );

            if (shouldPortalToInlinePanel) return createPortal(menu, desktopInlinePanelTarget);
            return menu;
          })()}

          <style jsx global>{`
            @keyframes walletSettingsIn {
              from {
                opacity: 0;
                transform: translateY(4px);
              }
              to {
                opacity: 1;
                transform: translateY(0);
              }
            }
            .animate-walletSettingsIn {
              animation: walletSettingsIn 150ms ease-out both;
            }
          `}</style>
        </>
      )}

      {/* QR Code modal (desktop) — scanné par wallet-app mobile */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative overflow-hidden bg-xcannes-surface-demo border border-white/10 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 bg-xcannes-surface-demo bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.06),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.025),transparent_55%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-black/5 to-black/65" />
            </div>
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-4 right-4 z-20 p-2 text-white/45 hover:text-white/80 transition-colors"
              aria-label={t("close", "Fermer")}
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
                aria-hidden
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="relative z-10">
              <p className="text-sm text-white/80 font-medium mb-4 px-10 pt-1">
                {t("ui_scan_qr_to_open_app", "Scannez avec votre mobile pour ouvrir XCANNES App")}
              </p>
              <div className="inline-block rounded-xl bg-white p-3">
                <QRCodeSVG
                  value={JSON.stringify({ type: "xcannes:navigate", screen: "choice", demo: true })}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
              <p className="mt-3 text-[11px] text-white/40">
                {t("ui_create_or_import_wallet", "Créer ou importer un compte")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen security modal */}
      <SettingsPageModal
        isOpen={showSecurityModal}
        onClose={closeSecurityModal}
        ariaLabel={t("ui_security", "Sécurité")}
        label={t("ui_security", "Sécurité")}
        subtitle={t("demo_security_subtitle", "Sécurité (démo)")}
      >
        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("demo_security_section", "Mode démo")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "demo_security_body",
              "Cette démo ne signe aucune transaction. Elle illustre uniquement l’interface et certains parcours.",
            )}
          </div>
        </div>
      </SettingsPageModal>

      {/* Fullscreen help modal */}
      <SettingsPageModal
        isOpen={showHelpModal}
        onClose={closeHelpModal}
        ariaLabel={t("ui_questions_and_help", "Aide & FAQ")}
        label={t("ui_questions_and_help", "Aide & FAQ")}
        subtitle={t("ui_questions_and_help_subtitle", "Réponses rapides")}
        contentClassName="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2"
      >
        {HELP_QA.map((item, idx) => {
          const open = helpOpenIndex === idx;
          const id = `demo-wallet-help-${idx}`;
          return (
            <div
              key={id}
              className="rounded-[14px] border border-white/10 bg-white/5 overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                onClick={() => setHelpOpenIndex(open ? -1 : idx)}
                aria-expanded={open}
                aria-controls={`${id}-panel`}
              >
                <div className="text-[14px] font-medium text-white/90">
                  {item.q}
                </div>
                <svg
                  className={[
                    "w-5 h-5 text-white/50 transition-transform",
                    open ? "rotate-180" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {open && (
                <div
                  id={`${id}-panel`}
                  className="px-4 pb-4 text-[12px] leading-relaxed text-white/70"
                >
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </SettingsPageModal>

      {/* Fullscreen terms modal */}
      <SettingsPageModal
        isOpen={showTermsModal}
        onClose={closeTermsModal}
        ariaLabel={t("ui_terms_of_use", "Conditions d'utilisations")}
        label={t("ui_terms_of_use", "Conditions d'utilisations")}
        subtitle={t("demo_terms_subtitle", "Conditions d’utilisation (démo)")}
      >
        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("demo_terms_scope", "Portée")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "demo_terms_scope_body",
              "Ce contenu est fourni à titre de démonstration et ne constitue pas un document contractuel.",
            )}
          </div>
        </div>
      </SettingsPageModal>
    </div>
  );
}
