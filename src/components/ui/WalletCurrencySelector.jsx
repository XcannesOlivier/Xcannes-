"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import xcannesApi from "@/lib/xcannesApi";
import { useTranslation } from "next-i18next";
import { createPortal } from "react-dom";

const CURRENCY_FLAG_OVERRIDES = {
  EUR: "🇪🇺",
  XAF: "🌍",
  XOF: "🌍",
  XCD: "🌴"
};

// Petit set de devises les plus utilisées dans le monde
// Limité à une courte liste pour rester simple et rapide à parcourir.
const POPULAR_CURRENCIES = [
{ code: "CNY", name: "Yuan chinois" },
{ code: "HKD", name: "Dollar de Hong Kong" },
{ code: "NZD", name: "Dollar néo-zélandais" },
{ code: "SEK", name: "Couronne suédoise" },
{ code: "NOK", name: "Couronne norvégienne" }];

const DEFAULT_WALLET_CURRENCIES = new Set([
  "USD",
  "EUR",
  "CHF",
  "GBP",
  "CAD",
  "JPY",
  "AED",
  "AUD",
  "SGD",
]);

const normalizeCode = (code) => String(code || "").trim().toUpperCase();

function countryCodeToFlag(countryCode) {
  if (!countryCode || countryCode.length !== 2) return "🏳️";
  const codePoints = [...countryCode.toUpperCase()].map(
    (c) => 0x1f1e6 + (c.charCodeAt(0) - 65)
  );
  return String.fromCodePoint(...codePoints);
}

function getFlag(code) {
  if (!code) return "🏳️";
  const upper = String(code).toUpperCase();
  if (CURRENCY_FLAG_OVERRIDES[upper]) {
    return CURRENCY_FLAG_OVERRIDES[upper];
  }
  const countryGuess = upper.slice(0, 2);
  return countryCodeToFlag(countryGuess);
}

function AddCurrencyLogo({ className = "w-6 h-6 text-xcannes-green" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  );
}

export default function WalletCurrencySelector({
  value,
  onChange,
  placeholder = "Select currency...",
  triggerLabel = "",
  triggerVariant = "button",
  fullscreenPortalTarget = null,
  extraOptions = [],
  quickOptions = [],
  showQuickAdd = true,
  excludeCodes = [],
  buttonClassName = "",
  buttonStyle = undefined,
  fullscreen = false,
  closeSignal = undefined,
  walletLabel = null,
  walletAddress = null,
  addedCurrencyCodes = [],
}) {
  const { t } = useTranslation("common");
  const [currencies, setCurrencies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [entryAnimateReady, setEntryAnimateReady] = useState(false);
  const [walletInfoOpen, setWalletInfoOpen] = useState(false);
  const [walletAddressExpanded, setWalletAddressExpanded] = useState(false);
  const [walletCopyNotice, setWalletCopyNotice] = useState("");
  const walletCopyNoticeTimerRef = useRef(null);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);
  const fullscreenBackdropRef = useRef(null);
  const fullscreenOverlayRef = useRef(null);
  const fullscreenListRef = useRef(null);
  const overlayTranslateYRef = useRef(0);
  const overlayRafRef = useRef(0);
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

  const applyOverlayTranslateY = (nextY, { animate } = { animate: false }) => {
    overlayTranslateYRef.current = nextY;
    const overlayEl = fullscreenOverlayRef.current;
    const backdropEl = fullscreenBackdropRef.current;
    const clampedY = Math.max(0, Number(nextY) || 0);

    if (overlayEl) {
      const panelOpacity = Math.max(0, Math.min(1, 1 - clampedY / 420));
      overlayEl.style.transform = `translate3d(0, ${clampedY}px, 0)`;
      overlayEl.style.opacity = String(panelOpacity);
      overlayEl.style.transition = animate
        ? "transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)"
        : "none";
    }

    if (backdropEl) {
      const opacity = Math.max(0, Math.min(1, 1 - clampedY / 420));
      backdropEl.style.opacity = String(opacity);
      backdropEl.style.transition = animate ? "opacity 220ms ease" : "none";
    }
  };

  const scheduleOverlayTranslateY = (nextY) => {
    overlayTranslateYRef.current = nextY;
    if (overlayRafRef.current) return;
    overlayRafRef.current = window.requestAnimationFrame(() => {
      overlayRafRef.current = 0;
      const overlayEl = fullscreenOverlayRef.current;
      const backdropEl = fullscreenBackdropRef.current;
      const clampedY = Math.max(0, Number(overlayTranslateYRef.current) || 0);
      if (overlayEl) {
        overlayEl.style.transform = `translate3d(0, ${clampedY}px, 0)`;
        overlayEl.style.opacity = String(Math.max(0, Math.min(1, 1 - clampedY / 420)));
      }
      if (backdropEl) {
        backdropEl.style.opacity = String(Math.max(0, Math.min(1, 1 - clampedY / 420)));
      }
    });
  };

  const excludedSet = useMemo(() => {
    return new Set((excludeCodes || []).map(normalizeCode).filter(Boolean));
  }, [excludeCodes]);

  const addedCurrencySet = useMemo(() => {
    const dynamicCodes = (addedCurrencyCodes || [])
      .map((code) => normalizeCode(code))
      .filter(Boolean);
    return new Set([...DEFAULT_WALLET_CURRENCIES, ...dynamicCodes]);
  }, [addedCurrencyCodes]);

  const entryAnimationEnabled = open && fullscreen;

  useEffect(() => {
    if (!entryAnimationEnabled) {
      setEntryAnimateReady(false);
      return undefined;
    }
    setEntryAnimateReady(false);
    const rafId = window.requestAnimationFrame(() => {
      setEntryAnimateReady(true);
    });
    return () => {
      window.cancelAnimationFrame(rafId);
    };
  }, [entryAnimationEnabled]);

  const getEntryAnimationStyle = (index, direction = "left") => {
    if (!entryAnimationEnabled) return undefined;
    const delay = Math.max(0, Number(index) || 0) * 50;
    const offset = direction === "right" ? 30 : -30;
    return {
      opacity: entryAnimateReady ? 1 : 0,
      transform: `translate3d(${entryAnimateReady ? 0 : offset}px, 0, 0)`,
      transitionProperty: "transform, opacity",
      transitionDuration: "340ms",
      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      transitionDelay: `${delay}ms`,
      willChange: "transform, opacity",
    };
  };

  const getFooterAnimationStyle = () => {
    if (!entryAnimationEnabled) return undefined;
    return {
      opacity: entryAnimateReady ? 1 : 0,
      transform: `translate3d(0, ${entryAnimateReady ? 0 : 20}px, 0)`,
      transitionProperty: "transform, opacity",
      transitionDuration: "380ms",
      transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
      transitionDelay: "120ms",
      willChange: "transform, opacity",
    };
  };

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const list = await xcannesApi.getFxCurrencies();
        if (cancelled || !Array.isArray(list)) {
          setCurrencies([]);
          return;
        }
        setCurrencies(
          list
            .map((c) => {
              const code = normalizeCode(c?.code);
              if (!code) return null;
              return { ...c, code };
            })
            .filter(Boolean)
        );
      } catch (err) {
        setCurrencies([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    if (fullscreen) return;
    const handleClick = (e) => {
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      if (triggerRef.current && triggerRef.current.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [fullscreen, open]);

  // Ferme le modal quand closeSignal change (ex: ouverture d'un autre modal)
  useEffect(() => {
    if (closeSignal === undefined) return;
    setOpen(false);
  }, [closeSignal]);

  useEffect(() => {
    if (!open) return;
    if (!fullscreen) return;
    if (fullscreenPortalTarget) return;
    try {
      applyOverlayTranslateY(0, { animate: false });
      // Ensure any pending rAF from a previous open doesn't apply stale values.
      if (overlayRafRef.current) {
        window.cancelAnimationFrame(overlayRafRef.current);
        overlayRafRef.current = 0;
      }
    } catch {
      // ignore
    }
    const prevOverflow = document?.body?.style?.overflow;
    try {
      if (typeof document !== "undefined") document.body.style.overflow = "hidden";
    } catch {
      // ignore
    }
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
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
  }, [fullscreen, fullscreenPortalTarget, open]);

  useEffect(() => {
    if (open) return;
    setWalletInfoOpen(false);
    setWalletAddressExpanded(false);
    setWalletCopyNotice("");
    if (walletCopyNoticeTimerRef.current) {
      clearTimeout(walletCopyNoticeTimerRef.current);
      walletCopyNoticeTimerRef.current = null;
    }
    try {
      const listEl = fullscreenListRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    try {
      if (overlayRafRef.current) {
        window.cancelAnimationFrame(overlayRafRef.current);
        overlayRafRef.current = 0;
      }
    } catch {
      // ignore
    }
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
  }, [open]);

  useEffect(() => {
    return () => {
      if (walletCopyNoticeTimerRef.current) {
        clearTimeout(walletCopyNoticeTimerRef.current);
      }
    };
  }, []);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = fullscreenListRef.current;
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
    try {
      event?.stopPropagation?.();
    } catch {
      // ignore
    }
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = fullscreenListRef.current;
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
    try {
      event?.stopPropagation?.();
    } catch {
      // ignore
    }
    const meta = overlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        fullscreenOverlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = fullscreenListRef.current;
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
      applyOverlayTranslateY(overlayTranslateYRef.current, { animate: false });
    }

    meta.lastDelta = delta;
    scheduleOverlayTranslateY(delta);
  };

  const handleOverlayPointerEnd = (event) => {
    try {
      event?.stopPropagation?.();
    } catch {
      // ignore
    }
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
    releaseOverlayScrollLock();

    if (shouldClose) {
      const height = typeof window !== "undefined" ? window.innerHeight : 9999;
      applyOverlayTranslateY(Math.max(delta, height), { animate: true });
      window.setTimeout(() => {
        setOpen(false);
      }, 180);
      return;
    }

    applyOverlayTranslateY(0, { animate: true });
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

  const normalizedQuickOptions = useMemo(() => {
    return (quickOptions || [])
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          const code = normalizeCode(item);
          if (!code) return null;
          return { code, name: code };
        }
        const code = normalizeCode(item.code);
        if (!code) return null;
        return { code, name: item.name || code };
      })
      .filter(Boolean)
      .filter((c) => !excludedSet.has(normalizeCode(c.code)));
  }, [excludedSet, quickOptions]);

  const mergedCurrencies = useMemo(() => {
    const extras = [...(extraOptions || []), ...normalizedQuickOptions]
      .map((item) => {
        const code = normalizeCode(item?.code);
        if (!code) return null;
        return { code, name: item?.name || code };
      })
      .filter(Boolean);
    const baseMap = new Map();
    currencies.forEach((c) => {
      const code = normalizeCode(c?.code);
      if (!code || excludedSet.has(code)) return;
      baseMap.set(code, { ...c, code });
    });
    extras.forEach((c) => {
      const code = normalizeCode(c?.code);
      if (!code || excludedSet.has(code)) return;
      if (!baseMap.has(code)) {
        baseMap.set(code, { ...c, code });
      }
    });
    return Array.from(baseMap.values());
  }, [currencies, extraOptions, excludedSet, normalizedQuickOptions]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return mergedCurrencies;
    return mergedCurrencies.filter((c) => {
      const code = c.code.toLowerCase();
      const name = (c.name || "").toLowerCase();
      return code.includes(term) || name.includes(term);
    });
  }, [mergedCurrencies, search]);

  const popularCurrencies = useMemo(() => {
    const preferred = normalizedQuickOptions.length > 0 ? normalizedQuickOptions : POPULAR_CURRENCIES;
    const source = [...preferred, ...POPULAR_CURRENCIES, ...mergedCurrencies];
    const seen = new Set();
    return source
      .map((item) => {
        const code = normalizeCode(item?.code);
        if (!code) return null;
        return { code, name: item?.name || code };
      })
      .filter(Boolean)
      .filter((item) => {
        if (excludedSet.has(item.code)) return false;
        if (addedCurrencySet.has(item.code)) return false;
        if (seen.has(item.code)) return false;
        seen.add(item.code);
        return true;
      })
      .slice(0, 5)
      .map((item) => {
        const fromList = mergedCurrencies.find((c) => normalizeCode(c.code) === item.code);
        return fromList || item;
      });
  }, [addedCurrencySet, excludedSet, mergedCurrencies, normalizedQuickOptions]);

  const selected = useMemo(() => {
    if (!value) return null;
    const upper = normalizeCode(value);
    return mergedCurrencies.find((c) => normalizeCode(c.code) === upper) || {
      code: upper,
      name: upper,
    };
  }, [value, mergedCurrencies]);

  const handleSelect = (code) => {
    if (onChange) {
      onChange(normalizeCode(code));
    }
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        ref={triggerRef}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={
          buttonClassName ||
          (triggerVariant === "text"
            ? "inline-flex items-center gap-2 text-base md:text-[15px] leading-snug text-xcannes-green/85 font-normal hover:text-xcannes-green transition-colors"
            : "w-full bg-black/20 border border-white/10 rounded-md px-2.5 py-1.5 text-[15px] text-white/70 flex items-center justify-between gap-2 hover:border-white/20 hover:text-white/85 transition-colors active:scale-98")
        }
        style={buttonStyle}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={triggerVariant === "text" ? "" : "truncate"}>
            {String(triggerLabel || "").trim()
              ? triggerLabel
              : selected
                ? `${selected.code} – ${selected.name}`
                : placeholder}
          </span>
        </div>
        {triggerVariant === "text" ? null : (
          <svg
            className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
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
        )}
      </button>

	      {open && !fullscreen &&
	      <div
	        ref={popupRef}
	        className="absolute z-50 mt-1 w-full max-h-72 overflow-hidden rounded-xl bg-[#0B0F14] ring-1 ring-white/10 ring-inset shadow-[0_28px_90px_rgba(0,0,0,0.7)] overscroll-contain flex flex-col"
	        style={{ WebkitOverflowScrolling: 'touch' }}
	        onClick={(e) => e.stopPropagation()}>

	          <div className="px-3 pt-2 pb-2 border-b border-white/10 space-y-2 bg-[#0B0F14]">
            {showQuickAdd ?
            <>
                {normalizedQuickOptions.length > 0 ?
              <div className="text-[14px] font-semibold text-white/60">
                    {t("ui_quick_add_e62e925d4f", "Quick add")}
                  </div> :
              null}
                {/* Raccourci pour les devises les plus utilisées */}
                <div className="flex items-center gap-1 overflow-x-auto">
                  {(normalizedQuickOptions.length > 0 ? normalizedQuickOptions : POPULAR_CURRENCIES).map((c) =>
                <button
                  key={c.code}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelect(c.code);
                  }}
                  className="flex items-center gap-1 rounded-full border border-white/10 bg-black/30 px-2 py-1 text-[15px] text-white/80 hover:border-accent-rlusd shrink-0 active:scale-95">

                      <span className="text-lg">{getFlag(c.code)}</span>
                      <span className="font-mono">{c.code}</span>
                    </button>
                )}
                </div>
              </> :
            null}
            <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onFocus={(e) => e.stopPropagation()}
            placeholder={t("ui_search_currency_045b7c357f", "Rechercher une devise…")}
            className="w-full rounded-3xl bg-transparent ring-1 ring-white/[0.07] ring-inset px-2.5 py-1.5 text-[15px] font-light text-white/85 placeholder:text-white/35 outline-none focus:ring-1 focus:ring-white/15" />

          </div>
          <div className="flex-1 min-h-0 overflow-y-auto px-4">
            {loading ? (
              <div className="px-3 py-3 text-base text-muted flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
                {t("ui_loading_currencies_9af59a0977", "Loading currencies...")}
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-3 text-base text-muted">
                {t("ui_no_currencies_found_b70888825e", "No currencies found.")}
              </div>
            ) : (
              <ul className="divide-y divide-white/10">
                {filtered.map((c) => {
                  const isAlreadyAdded = addedCurrencySet.has(normalizeCode(c.code));
                  return (
                  <li key={c.code}>
                    <button
                      type="button"
                      disabled={isAlreadyAdded}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!isAlreadyAdded) handleSelect(c.code);
                      }}
                      className={[
                        "w-full px-3 py-2 text-base bg-white/[0.03] flex items-center gap-2 text-left",
                        isAlreadyAdded
                          ? "text-white/40 cursor-default"
                          : "group text-white/80 hover:bg-white/[0.06] active:scale-98",
                      ].join(" ")}>
                      <span className="text-lg">{getFlag(c.code)}</span>
                      <div className="min-w-0 flex-1 flex items-center gap-2">
                        <span className="font-mono text-[15px] md:text-[17px] whitespace-nowrap">{c.code}</span>
                        <span className="text-[15px] md:text-[17px] text-white/45 truncate">
                          {c.name}
                        </span>
                      </div>
                      {isAlreadyAdded ? (
                        <span className="text-[12px] text-white/55 shrink-0 inline-flex items-center gap-1.5">
                          <span className="text-xcannes-green text-[13px] leading-none" aria-hidden>✓</span>
                          <span>{t("ui_currency_already_added_short", "ajoutée")}</span>
                        </span>
                      ) : (
                        <AddCurrencyLogo className="w-4 h-4 text-xcannes-green shrink-0 transition-transform duration-200 group-hover:scale-125" />
                      )}
                    </button>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      }

      {open && fullscreen
        ? createPortal(
            <div
              className={
                fullscreenPortalTarget
                  ? "absolute inset-0 z-[10020]"
                  : "fixed inset-0 z-[10020]"
              }
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onPointerCancel={(e) => e.stopPropagation()}
            >
              <div
                className="absolute inset-0 bg-black/80 md:backdrop-blur-sm"
                ref={fullscreenBackdropRef}
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(false);
                }}
              />
              <div
                ref={fullscreenOverlayRef}
                role="dialog"
                aria-modal="true"
                className={[
                  "absolute inset-0 bg-elevated flex flex-col min-h-0 overflow-hidden pb-[env(safe-area-inset-bottom)]",
                  fullscreenPortalTarget
                    ? ""
                    : "sm:inset-6 sm:rounded-2xl sm:ring-1 sm:ring-white/10 sm:shadow-2xl",
                  "will-change-transform",
                ].join(" ")}
                onPointerMove={handleOverlayPointerMove}
                onPointerUp={handleOverlayPointerEnd}
                onPointerCancel={handleOverlayPointerEnd}
              >
                <div
                  className="touch-none"
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "fixed");
                  }}
                >
                  <div className="sm:hidden flex justify-center pt-3 pb-1">
                    <div className="w-16 h-5 flex items-center justify-center" aria-hidden>
                      <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                    </div>
                  </div>

                  <div className="relative flex items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0 text-left">
                      <div className="flex items-center gap-3">
                        <AddCurrencyLogo className="w-7 h-7 text-xcannes-green shrink-0" />
                        <div className="text-white/80 md:text-white font-light text-[30px] md:text-[34px] tracking-tight">
                          {t("ui_select_currency_title", "Ajouter une devise")}
                        </div>
                      </div>
                      <div className="mt-2 text-[15px] md:text-[18px] font-light text-white/50 leading-relaxed max-w-none md:max-w-[60ch]">
                        {t(
                          "ui_select_currency_subtitle_add_currency",
                          "Choisissez une devise. Elle sera ajoutée automatiquement lors de votre première transaction.",
                        )}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setOpen(false)}
                      className="hidden sm:inline-flex absolute right-4 top-4 text-white/70 hover:text-white transition-colors text-xl"
                      aria-label={t("ui_close", "Fermer")}
                    >
                      ✕
                    </button>
                  </div>

                  <div className="px-4 pb-4" style={{ paddingTop: 'clamp(20px, 3vw, 32px)' }}>
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
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        onFocus={(e) => e.stopPropagation()}
                        placeholder={t("ui_search_currency_045b7c357f", "Rechercher une devise…")}
                        className="w-full pl-11 pr-4 py-2.5 bg-transparent ring-1 ring-white/10 ring-inset rounded-3xl text-white font-light focus:outline-none focus:ring-1 focus:ring-white/20 transition-all duration-150"
                      />
                    </div>
                    {popularCurrencies.length > 0 ? (
                      <div className="mt-4">
                        <div className="mb-2 text-[11px] tracking-[0.14em] text-white/45 font-medium">
                          {t("ui_popular_currencies", "Populaires")}
                        </div>
                        <div className="grid grid-cols-5 gap-2">
                          {popularCurrencies.map((c, index) => {
                            const active = normalizeCode(c.code) === normalizeCode(value);
                            return (
                              <button
                                key={`popular-${c.code}`}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSelect(c.code);
                                }}
                                className={[
                                  "rounded-xl px-2 py-1.5 sm:py-2 ring-1 transition-colors flex flex-col items-center text-center gap-0.5 min-h-[64px] sm:min-h-[78px]",
                                  active
                                    ? "bg-xcannes-green/10 ring-xcannes-green/25 text-white"
                                    : "bg-white/[0.03] ring-white/[0.07] text-white/80 hover:bg-white/[0.06] hover:ring-white/15",
                                ].join(" ")}
                                style={getEntryAnimationStyle(index, "left")}
                              >
                                <span className="text-xl leading-none">{getFlag(c.code)}</span>
                                <span className="text-[13px] font-mono leading-tight">{c.code}</span>
                                <span className="text-[11px] text-white/55 leading-tight truncate w-full">
                                  {c.name || c.code}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div
                  ref={fullscreenListRef}
                  className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-4"
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "list");
                  }}
                >
                  {loading ? (
                    <div className="px-4 py-6 text-sm text-white/60 flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin" />
                      {t("ui_loading_currencies_9af59a0977", "Loading currencies...")}
                    </div>
                  ) : filtered.length === 0 ? (
                    <div className="px-4 py-6 text-sm text-white/60">
                      {t("ui_no_currencies_found_b70888825e", "No currencies found.")}
                    </div>
                  ) : (
                    filtered.map((c, index) => {
                      const active = normalizeCode(c.code) === normalizeCode(value);
                      const isAlreadyAdded = addedCurrencySet.has(normalizeCode(c.code));
                      return (
                        <button
                          key={c.code}
                          type="button"
                          disabled={isAlreadyAdded}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isAlreadyAdded) handleSelect(c.code);
                          }}
                          className={[
                            "w-full flex items-center gap-3 px-4 py-3 text-left border-b border-white/5 last:border-b-0 bg-white/[0.03]",
                            isAlreadyAdded
                              ? "text-white/40 cursor-default"
                              : [
                                  "group",
                                  active ? "bg-xcannes-green/10 text-white" : "hover:bg-white/[0.06] text-white/80",
                                ].join(" "),
                          ].join(" ")}
                          style={getEntryAnimationStyle(index, "right")}
                        >
                          <span className="text-lg">{getFlag(c.code)}</span>
                          <div className="min-w-0 flex-1 flex items-center gap-2">
                            <span className="text-sm font-light font-mono whitespace-nowrap">
                              {c.code}
                            </span>
                            <span className="text-sm text-white/55 truncate">
                              {c.name || c.code}
                            </span>
                          </div>
                          {isAlreadyAdded ? (
                            <span className="text-[12px] text-white/55 shrink-0 inline-flex items-center gap-1.5">
                              <span className="text-xcannes-green text-[13px] leading-none" aria-hidden>✓</span>
                              <span>{t("ui_currency_already_added_short", "ajoutée")}</span>
                            </span>
                          ) : (
                            <AddCurrencyLogo className="w-4 h-4 text-xcannes-green shrink-0 transition-transform duration-200 group-hover:scale-125" />
                          )}
                        </button>
                      );
                    })
                  )}
                </div>

	                <div className="px-4 pt-3 pb-4 bg-transparent" style={getFooterAnimationStyle()}>
	                  {walletLabel ? (
	                    <div className="w-full rounded-2xl ring-1 ring-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] px-3.5 py-3">
	                      <div className="flex items-center gap-3">
	                        <div className="h-9 w-9 rounded-xl bg-xcannes-green/10 ring-1 ring-xcannes-green/25 text-xcannes-green flex items-center justify-center shrink-0">
	                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="w-[18px] h-[18px]" aria-hidden="true">
	                            <rect x="3.5" y="4" width="13" height="16" rx="2.2" />
	                            <path d="M8 9h4.8" />
	                            <path d="M8 12h6.8" />
	                          </svg>
	                        </div>
	                        <div className="min-w-0 flex-1">
	                          <div className="text-[11px] text-white/50">{t("ui_added_in_wallet", "Ajout dans")}</div>
	                          <div className="mt-0.5 inline-flex items-center gap-2">
	                            <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green shrink-0 animate-pulse" aria-hidden />
	                            <span className="text-[22px] leading-none text-white/92 font-light truncate">{walletLabel}</span>
	                          </div>
	                        </div>
	                        <button
	                          type="button"
	                          onClick={() => {
	                            setWalletInfoOpen((prev) => !prev);
	                            setWalletAddressExpanded(false);
	                            setWalletCopyNotice("");
	                          }}
	                          className="p-1 text-white/35 hover:text-white/60 transition-colors shrink-0"
	                          aria-label={t("ui_account_address", "Adresse du compte")}
	                          aria-expanded={walletInfoOpen}
	                        >
	                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 transition-transform ${walletInfoOpen ? "rotate-90" : ""}`} aria-hidden="true">
	                            <polyline points="9 18 15 12 9 6" />
	                          </svg>
	                        </button>
	                      </div>
	                      {walletInfoOpen && walletAddress ? (
	                        <div className="mt-3 pt-2.5 border-t border-white/10">
	                          <p className="text-[12px] text-white/55 mb-1.5">{t("ui_account_address", "Adresse du compte")}</p>
	                          <div className="flex items-center gap-1.5 min-w-0">
	                            <button
	                              type="button"
	                              className={`min-w-0 flex-1 text-left text-xs text-white/55 font-mono font-light ${walletAddressExpanded ? "break-all whitespace-normal" : "truncate"}`}
	                              title={walletAddress}
	                              onClick={() => setWalletAddressExpanded((prev) => !prev)}
	                              aria-label={t("ui_toggle_wallet_address_truncation", "Afficher l'adresse complète")}
	                            >
	                              {walletAddressExpanded ? walletAddress : `${walletAddress.slice(0, 8)}…${walletAddress.slice(-6)}`}
	                            </button>
	                            <button
	                              type="button"
	                              onClick={async () => {
	                                if (!navigator?.clipboard?.writeText) {
	                                  setWalletCopyNotice(t("ui_copy_unavailable", "Copie indisponible"));
	                                  return;
	                                }
	                                await navigator.clipboard.writeText(walletAddress);
	                                setWalletCopyNotice(t("ui_copied_address", "Adresse copiée"));
	                                if (walletCopyNoticeTimerRef.current) clearTimeout(walletCopyNoticeTimerRef.current);
	                                walletCopyNoticeTimerRef.current = window.setTimeout(() => {
	                                  setWalletCopyNotice("");
	                                }, 3000);
	                              }}
	                              className="shrink-0 text-white/40 hover:text-white/70 transition-colors p-0.5"
	                              title={t("ui_copy_address", "Copier l'adresse")}
	                              aria-label={t("ui_copy_address", "Copier l'adresse")}
	                            >
	                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
	                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
	                                <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" />
	                              </svg>
	                            </button>
	                          </div>
	                          <div className={`mt-1 text-[11px] text-xcannes-green/85 transition-opacity duration-200 ${walletCopyNotice ? "opacity-100" : "opacity-0"}`} role="status" aria-live="polite">
	                            {walletCopyNotice || " "}
	                          </div>
	                        </div>
	                      ) : null}
	                    </div>
	                  ) : (
	                    <span className="text-[15px] font-light text-white/55">{t("ui_search_results", "Sélectionnez une devise.")}</span>
	                  )}
	                </div>
                {/* Bottom indicator removed */}
              </div>
            </div>,
            fullscreenPortalTarget || document.body,
          )
        : null}
    </div>);

}
