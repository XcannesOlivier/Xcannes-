"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { QRCodeSVG } from "qrcode.react";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { useWallet } from "@/context/WalletContext";
import PreferredCurrencySelector from "./PreferredCurrencySelector";
import { createPortal } from "react-dom";

/**
 * Settings gear button + dropdown menu.
 * Shared between WalletDashboardHeader (desktop) and WalletDashboardFooter (mobile).
 *
 * @param {object} props
 * @param {"header"|"footer"} props.position – controls drop direction and responsive visibility
 */
export default function WalletSettingsDropdown({
  position = "header",
  isDesktopPanel = false,
  onOpenInfo,
  onOpenXrplActivity,
  onOpenSecurity,
  onOpenHelp,
  onOpenTerms,
  // Preferred currency props
  preferredCurrency,
  topCurrencies,
  fawazCurrencies,
  fawazLoading,
  onLoadFawazCurrencies,
  onPreferredCurrencyChange,
  allowedCurrencyCodes = null,
}) {
  const { t } = useTranslation("common");
  const { goToChoice } = useWallet();
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
  const [desktopMenuStyle, setDesktopMenuStyle] = useState(null);
  const [desktopArrowX, setDesktopArrowX] = useState(null);
  const [desktopPlacement, setDesktopPlacement] = useState("bottom");
  const settingsIconShellClassName =
    "inline-flex h-12 w-12 items-center justify-center rounded-[16px] bg-black/30 ring-1 ring-white/10 ring-inset shadow-[0_4px_12px_rgba(0,0,0,0.28),inset_0_1px_0_rgba(255,255,255,0.04)] shrink-0";
  const settingsSupportIconShellClassName =
    "inline-flex h-[70px] w-[96px] items-center justify-center rounded-[26px] shrink-0";
  const settingsRowClassName =
    "w-full flex items-center gap-3 px-3 py-3 rounded-[20px] border border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent hover:border-white/15 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/10";
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
    <svg
      viewBox="-1 7 102 112"
      className="w-8 h-8"
      fill="none"
      aria-hidden
    >
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
      <path d="M15 18.5c0-3 2.3-5.5 5.3-5.5h7.4c3 0 5.3 2.5 5.3 5.5v6.8c0 3-2.3 5.5-5.3 5.5H24l-5.5 4.2v-4.2h-1.2c-3 0-5.3-2.5-5.3-5.5v-6.8Z" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
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

  const RETURN_FLAG = "__XCANNES_RETURN_TO_SETTINGS_DROPDOWN__";

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
      window.dispatchEvent(new CustomEvent("xcannes:wallet-settings-open"));
    } catch {
      // ignore
    }
  }, []);

  const closeSecurityModal = useCallback(() => {
    setShowSecurityModal(false);
    reopenSettingsDropdown();
  }, [reopenSettingsDropdown]);

  const closeHelpModal = useCallback(() => {
    setShowHelpModal(false);
    reopenSettingsDropdown();
  }, [reopenSettingsDropdown]);

  const closeTermsModal = useCallback(() => {
    setShowTermsModal(false);
    reopenSettingsDropdown();
  }, [reopenSettingsDropdown]);

  // Allow the PWA host to reopen the dropdown after returning from "add account" flow.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => setIsOpen(true);
    window.addEventListener("xcannes:wallet-settings-open", handler);
    return () => window.removeEventListener("xcannes:wallet-settings-open", handler);
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

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e) => {
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen]);

  // Close help modal on Escape
  useEffect(() => {
    if (!showHelpModal) return;
    const handler = (e) => {
      if (e.key === "Escape") closeHelpModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeHelpModal, showHelpModal]);

  // Close security modal on Escape
  useEffect(() => {
    if (!showSecurityModal) return;
    const handler = (e) => {
      if (e.key === "Escape") closeSecurityModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeSecurityModal, showSecurityModal]);

  // Close terms modal on Escape
  useEffect(() => {
    if (!showTermsModal) return;
    const handler = (e) => {
      if (e.key === "Escape") closeTermsModal();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [closeTermsModal, showTermsModal]);

  const HELP_QA = [
    {
      q: t("ui_help_q1", "Comment recevoir des fonds ?"),
      a: t(
        "ui_help_a1",
        "Ouvrez “Recevoir”, partagez le QR code ou copiez votre adresse publique.",
      ),
    },
    {
      q: t("ui_help_q2", "Quels sont les frais ?"),
      a: t(
        "ui_help_a2",
        "Les frais XRPL varient selon le réseau. XCANNES affiche les coûts avant validation quand c’est possible.",
      ),
    },
    {
      q: t("ui_help_q3", "Pourquoi une conversion RLUSD ?"),
      a: t(
        "ui_help_a3",
        "Certaines opérations utilisent RLUSD comme base. Vous pouvez convertir depuis/vers vos lignes de devises.",
      ),
    },
    {
      q: t("ui_help_q4", "Que faire si une transaction est en attente ?"),
      a: t(
        "ui_help_a4",
        "Attendez la validation sur le ledger. Si le réseau est lent, relancez le rafraîchissement du wallet.",
      ),
    },
    {
      q: t("ui_help_q5", "Sécurité : comment verrouiller mon wallet ?"),
      a: t(
        "ui_help_a5",
        "Le wallet se déconnecte automatiquement après inactivité et lors du changement d’onglet (hors mode PWA).",
      ),
    },
  ];

  // header → visible on md+ only ; footer → mobile only ; inline → always visible
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
      setDesktopInlinePanelTarget(
        document.getElementById("wallet-desktop-inline-panel"),
      );
    } catch {
      setDesktopInlinePanelTarget(null);
    }
  }, [isDesktopInlinePanel, isOpen]);

  const shouldPortalToInlinePanel = Boolean(
    isDesktopInlinePanel && desktopInlinePanelTarget,
  );

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

    // Prefer aligning the menu's right edge with the button's right edge.
    let left = buttonRect.right - menuW;
    left = Math.max(margin, Math.min(left, viewportW - menuW - margin));

    // Prefer opening below; if not enough space, open above.
    const fitsBelow = buttonRect.bottom + margin + menuH + margin <= viewportH;
    const fitsAbove = buttonRect.top - margin - menuH >= margin;

    let top;
    let placement = "bottom";
    if (!fitsBelow && fitsAbove) {
      placement = "top";
      top = Math.max(margin, buttonRect.top - margin - menuH);
    } else {
      top = Math.max(
        margin,
        Math.min(viewportH - menuH - margin, buttonRect.bottom + margin),
      );
    }

    // Arrow X in menu coordinates (clamped so it never hits rounded corners).
    const buttonCenterX = buttonRect.left + buttonRect.width / 2;
    const arrowX = Math.max(
      18,
      Math.min(menuW - 18, buttonCenterX - left),
    );

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
    // Use capture to handle scroll containers (dashboard has nested scroll areas).
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
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
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
    const velocity = delta / duration; // px/ms
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
          className={inlineButton ? "w-[26px] h-[26px] lg:w-[22px] lg:h-[22px]" : "w-6 h-6 lg:w-5 lg:h-5"}
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
                style={{
                  ...(shouldPortalToInlinePanel
                    ? {}
                    : isDesktop
                      ? desktopMenuStyle || {}
                      : {}),
                  transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                  transition: overlayDragging
                    ? "none"
                    : "transform 220ms cubic-bezier(0.2,0,0,1)",
                  opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
                  backgroundImage:
                    "radial-gradient(520px circle at 80% 0%, rgba(255,255,255,0.08), transparent 55%), radial-gradient(900px circle at 100% 50%, rgba(0,255,150,0.10), transparent 35%), radial-gradient(700px circle at 0% 100%, rgba(0,255,150,0.07), transparent 60%)",
                }}
                className={[
                  shouldPortalToInlinePanel
                    ? "absolute inset-0 z-50 bg-elevated flex flex-col min-h-0 overflow-hidden will-change-transform"
                    : "fixed inset-0 z-50 bg-elevated flex flex-col min-h-0 overflow-hidden will-change-transform",
                  shouldPortalToInlinePanel
                    ? ""
                    : "md:fixed md:inset-auto md:w-[min(420px,calc(100vw-32px))] md:rounded-xl md:border md:border-white/10 md:bg-elevated md:shadow-[0_28px_90px_rgba(0,0,0,0.6)] md:overflow-visible md:animate-walletSettingsIn",
                ].join(" ")}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerEnd}
                onPointerCancel={handleOverlayPointerEnd}
              >
                {/* Pointer (desktop) */}
                {!shouldPortalToInlinePanel ? (
                  <div
                    className="hidden md:block absolute h-3.5 w-3.5 bg-elevated border border-white/10 rotate-45"
                    style={
                      !isDesktop || desktopArrowX == null
                        ? undefined
                        : {
                            left: `${Math.round(desktopArrowX - 7)}px`,
                            top: desktopPlacement === "bottom" ? "-7px" : undefined,
                            bottom:
                              desktopPlacement === "top" ? "-7px" : undefined,
                          }
                    }
                    aria-hidden
                  />
                ) : null}

                  {/* Mobile header */}
                  <div
                    className="shrink-0 md:hidden"
                    onPointerDown={(event) => {
                      maybeStartOverlayDrag(event, "fixed");
                    }}
                  >
                    <div className="flex justify-center pt-3 pb-1">
                      <div
                        className="w-16 h-5 flex items-center justify-center"
                        aria-hidden
                      >
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

                  {/* Desktop header */}
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
	              {/* Section: Comptes */}
	              <div className="pt-2 md:pt-2.5">
	                <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
	                  {t("ui_settings_section_accounts", "Comptes")}
	                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setIsOpen(false);

                    // PWA embedded: navigate directly to choice screen (already authenticated)
                    if (goToChoice) {
                      goToChoice();
                      return;
                    }

                    // Desktop: show QR modal for wallet-app to scan
                    if (isDesktop) {
                      setShowQrModal(true);
                    } else {
                      // Non-PWA mobile: open wallet-app in new tab
                      window.open("/wallet-app/?action=choice", "_blank");
                    }
                  }}
                  className={settingsRowClassName}
                >
                  <span className={`${settingsIconShellClassName} bg-black text-white/60`}>
                    <SettingsAddWalletIcon />
                  </span>
                  <div className="min-w-0 flex-1">
	                    <div className="text-[13px] font-medium text-white/90">
	                      {t("ui_add_wallet", "Ajouter un compte")}
	                    </div>
	                    <div className="text-[11px] text-white/45 mt-0.5">
	                      {t(
	                        "ui_add_wallet_hint",
	                        "Créer ou importer un compte existant",
	                      )}
	                    </div>
	                  </div>
                  <span className="text-white/25 text-lg">›</span>
                </button>
              </div>

              {/* Section: Réseau */}
              {onOpenXrplActivity ? (
                <div className="mt-4">
                  <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
                    {t("ui_settings_section_network", "Réseau")}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      markReturnToSettings();
                      setIsOpen(false);
                      onOpenXrplActivity?.();
                    }}
                    className={settingsRowClassName}
                  >
                    <span className={settingsIconShellClassName}>
                      <SettingsXrplIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white/90">
                        {t(
                          "ui_xrpl_network_activity_6c7a1d9b5e",
                          "Activité du réseau XRPL",
                        )}
                      </div>
                      <div className="text-[11px] text-white/45 mt-0.5">
                        {t(
                          "ui_xrpl_network_activity_hint_2c7a1d9b5e",
                          "Voir les frais et les opérations du réseau",
                        )}
                      </div>
                    </div>
                    <span className="text-white/25 text-lg">›</span>
                  </button>
                </div>
              ) : null}

              {/* Section: Préférences */}
              {preferredCurrency && (
                <>
                  <div className="mt-4">
	                    <div className="px-1.5 pb-2 text-[10px] font-semibold tracking-[0.22em] text-white/35">
	                      {t("ui_settings_section_preferences", "Préférences")}
	                    </div>
	                    <div className="rounded-[20px] border border-white/10 bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] p-2.5 transition-colors duration-150">
	                      <PreferredCurrencySelector
	                        currentCurrency={preferredCurrency}
	                        topCurrencies={topCurrencies}
	                        allCurrencies={fawazCurrencies}
	                        isLoading={fawazLoading}
                        allowedCurrencyCodes={allowedCurrencyCodes}
                        onSelect={(code) => {
                          onPreferredCurrencyChange?.(code);
                        }}
                        onOpen={onLoadFawazCurrencies}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* Section: Support */}
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
                    className="w-full flex items-center gap-3 px-3 py-0 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
                  >
                    <span className={`${settingsSupportIconShellClassName} text-white/85`}>
                      <SettingsRlusdIcon />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium text-white/85">
                        {t("ui_stablecoin_rlusd", "Stablecoin RLUSD")}
                      </div>
                      <div className="text-[11px] text-white/40 mt-0.5">
                        {t("ui_stablecoin_rlusd_hint", "En savoir plus sur Ripple.com")}
                      </div>
                    </div>
                    <span className="text-white/20 text-lg">↗</span>
                  </a>

                  <button
                    type="button"
                    onClick={() => {
                      markReturnToSettings();
                      onOpenInfo?.();
                      setIsOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
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
                    className="w-full flex items-center gap-3 px-3 py-0 border-t border-white/10 text-left bg-white/5 shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] hover:bg-transparent transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/20 focus-visible:ring-inset"
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
              </div>
            );

            if (shouldPortalToInlinePanel) {
              return createPortal(menu, desktopInlinePanelTarget);
            }
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
            className="relative bg-[#151b1e] border border-white/10 rounded-2xl p-6 shadow-2xl max-w-xs w-full mx-4 text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="absolute top-3 right-3 text-white/40 hover:text-white/80 transition-colors"
              aria-label="Fermer"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
	            </button>
	            <p className="text-sm text-white/80 font-medium mb-4">
	              {t("ui_scan_qr_to_open_app", "Scannez avec votre mobile pour ouvrir XCANNES App")}
	            </p>
            <div className="inline-block rounded-xl bg-white p-3">
              <QRCodeSVG
                value={JSON.stringify({ type: "xcannes:navigate", screen: "choice" })}
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
      )}

      {/* Fullscreen security modal */}
	      {showSecurityModal && (
	        <div
	          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
	          role="dialog"
          aria-modal="true"
          aria-label={t("ui_security", "Sécurité")}
        >
	          <div className="h-full w-full flex flex-col">
	            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex items-center gap-3 min-w-0 flex-1">
	                  <button
	                    type="button"
	                    onClick={closeSecurityModal}
	                    className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
	                    aria-label={t("back", "Retour")}
	                  >
	                    <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
	                  </button>
	                  <div className="min-w-0">
	                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
	                    {t("ui_security", "Sécurité")}
	                  </div>
	                  <div className="text-[12px] text-white/80 mt-1 truncate">
	                    {t("ui_security_subtitle", "Protection du compte XCANNES")}
	                  </div>
	                  </div>
	                </div>
	                <span className="h-10 w-10" aria-hidden="true" />
	              </div>
	            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_account", "Compte")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_security_account_body",
                    "XCANNES protège l’accès à vos opérations via la connexion au wallet (Xumm / PWA) et des mécanismes de verrouillage automatique. Nous n’affichons pas vos clés privées dans l’interface.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_lock", "Verrouillage")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_security_lock_body",
                    "Le wallet peut se déconnecter automatiquement après une période d’inactivité et lors du changement d’onglet (selon le mode). Utilisez aussi le bouton de déconnexion pour verrouiller immédiatement.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_security_section_tips", "Bonnes pratiques")}
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-white/75">
                  <li>
                    {t(
                      "ui_security_tip_1",
                      "Ne partagez jamais vos phrases de récupération / secrets.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_security_tip_2",
                      "Vérifiez toujours l’adresse et le montant avant de signer.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_security_tip_3",
                      "Évitez les réseaux Wi‑Fi publics pour des opérations sensibles.",
                    )}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen help modal (FAQ) */}
	      {showHelpModal && (
	        <div
	          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
          role="dialog"
          aria-modal="true"
          aria-label={t("ui_questions_and_help", "Aide & FAQ")}
        >
	          <div className="h-full w-full flex flex-col">
	            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex items-center gap-3 min-w-0 flex-1">
	                  <button
	                    type="button"
	                    onClick={closeHelpModal}
	                    className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
	                    aria-label={t("back", "Retour")}
	                  >
	                    <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
	                  </button>
	                  <div className="min-w-0">
	                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
	                    {t("ui_questions_and_help", "Aide & FAQ")}
	                  </div>
	                  <div className="text-[12px] text-white/80 mt-1 truncate">
	                    {t("ui_questions_and_help_subtitle", "Réponses rapides")}
	                  </div>
	                  </div>
	                </div>
	                <span className="h-10 w-10" aria-hidden="true" />
	              </div>
	            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-2">
              {HELP_QA.map((item, idx) => {
                const open = helpOpenIndex === idx;
                const id = `wallet-help-${idx}`;
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
            </div>
          </div>
        </div>
      )}

      {/* Fullscreen terms modal */}
	      {showTermsModal && (
	        <div
	          className="fixed inset-0 z-[9999] bg-[#0b0f10]"
          role="dialog"
          aria-modal="true"
          aria-label={t("ui_terms_of_use", "Conditions d'utilisations")}
        >
	          <div className="h-full w-full flex flex-col">
	            <div className="shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20">
	              <div className="flex items-center justify-between gap-3">
	                <div className="flex items-center gap-3 min-w-0 flex-1">
	                  <button
	                    type="button"
	                    onClick={closeTermsModal}
	                    className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
	                    aria-label={t("back", "Retour")}
	                  >
	                    <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
	                  </button>
	                  <div className="min-w-0">
	                  <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
	                    {t("ui_terms_of_use", "Conditions d'utilisations")}
	                  </div>
	                  <div className="text-[12px] text-white/80 mt-1 truncate">
	                    {t("ui_terms_subtitle", "Conditions d'utilisation XCANNES")}
	                  </div>
	                  </div>
	                </div>
	                <span className="h-10 w-10" aria-hidden="true" />
	              </div>
	            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-5 space-y-4">
              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_scope", "Portée")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_terms_scope_body",
                    "Ces conditions encadrent l’utilisation du wallet et des services XCANNES. Elles ne constituent pas un conseil financier.",
                  )}
                </div>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_user", "Responsabilités")}
                </div>
                <ul className="mt-2 space-y-2 text-[13px] text-white/75">
                  <li>
                    {t(
                      "ui_terms_user_1",
                      "Vous êtes responsable des adresses, montants et destinataires avant signature.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_terms_user_2",
                      "Ne partagez jamais vos secrets / phrases de récupération.",
                    )}
                  </li>
                  <li>
                    {t(
                      "ui_terms_user_3",
                      "Respectez les lois applicables à votre juridiction.",
                    )}
                  </li>
                </ul>
              </div>

              <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
                <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
                  {t("ui_terms_section_limits", "Limites")}
                </div>
                <div className="mt-2 text-[13px] leading-relaxed text-white/75">
                  {t(
                    "ui_terms_limits_body",
                    "XCANNES s’appuie sur XRPL et des fournisseurs tiers. La disponibilité, les délais de validation et les frais réseau peuvent varier.",
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
