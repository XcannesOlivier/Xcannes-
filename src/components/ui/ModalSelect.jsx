"use client";

import Image from "next/image";
import { createPortal } from "react-dom";
import { isValidElement, useCallback, useEffect, useMemo, useRef, useState } from "react";

export default function ModalSelect({
  value,
  onChange,
  options = [],
  placeholder = "",
  buttonClassName = "",
  menuClassName = "",
  optionClassName = "",
  selectClassName = "",
  iconClassName = "",
  useNativeSelect = true,
  hideMobileSelectedRight = false,
  useMobileSelectedLabel = false,
  showMobileOptionRight = false,
  backdropClassName = "",
  disabled = false,
  hideSelected = false,
  portal = false,
  portalTarget = null,
}) {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const isClosingRef = useRef(false);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  const openMenu = useCallback(() => {
    isClosingRef.current = false;
    setOpen(true);
    requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
  }, []);

  const closeMenu = useCallback(() => {
    if (isClosingRef.current) return;
    isClosingRef.current = true;
    setVisible(false);
    setTimeout(() => {
      setOpen(false);
      isClosingRef.current = false;
    }, 130);
  }, []);

  const toggleMenu = useCallback(() => {
    if (open && !isClosingRef.current) closeMenu();
    else if (!open) openMenu();
  }, [open, openMenu, closeMenu]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (popupRef.current && popupRef.current.contains(event.target)) return;
      if (triggerRef.current && triggerRef.current.contains(event.target)) return;
      closeMenu();
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, closeMenu]);

  // Block body scroll / swipe on mobile while dropdown is open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleTouchMove = (e) => {
      // Allow scrolling inside the dropdown list itself
      if (popupRef.current && popupRef.current.contains(e.target)) return;
      e.preventDefault();
    };
    document.addEventListener("touchmove", handleTouchMove, { passive: false });

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("touchmove", handleTouchMove);
    };
  }, [open]);

  // ── Portal positioning (fixed dropdown rendered at body level) ──
  const [portalStyle, setPortalStyle] = useState(null);

  // Resolve the actual DOM node to portal into
  const resolvedPortalTarget = portalTarget || (portal ? (typeof document !== 'undefined' ? document.body : null) : null);
  const isScoped = !!portalTarget; // portalTarget = scoped container (not body)

  useEffect(() => {
    if (!open || !resolvedPortalTarget) { setPortalStyle(null); return; }
    if (isScoped) {
      // Position relative to scrollable container
      const update = () => {
        if (!triggerRef.current || !resolvedPortalTarget) return;
        const tRect = triggerRef.current.getBoundingClientRect();
        const cRect = resolvedPortalTarget.getBoundingClientRect();
        setPortalStyle({
          position: 'absolute',
          top: tRect.bottom - cRect.top + resolvedPortalTarget.scrollTop - 1,
          left: tRect.left - cRect.left + resolvedPortalTarget.scrollLeft,
          width: tRect.width,
        });
      };
      update();
      resolvedPortalTarget.addEventListener('scroll', update, { passive: true });
      window.addEventListener('resize', update);
      return () => {
        resolvedPortalTarget.removeEventListener('scroll', update);
        window.removeEventListener('resize', update);
      };
    }
    // Body-level portal: fixed positioning
    const update = () => {
      if (!triggerRef.current) return;
      const r = triggerRef.current.getBoundingClientRect();
      setPortalStyle({ position: 'fixed', top: r.bottom - 1, left: r.left, width: r.width });
    };
    update();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [open, resolvedPortalTarget, isScoped]);

  const selected = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value]);

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    closeMenu();
  };

  const renderIcon = (icon) => {
    if (!icon) return null;
    const cls = iconClassName || "text-base leading-none";
    if (isValidElement(icon)) {
      return <span className={cls}>{icon}</span>;
    }
    if (typeof icon === "string" || typeof icon === "number") {
      return (
        <span className={cls} aria-hidden="true">
          {icon}
        </span>
      );
    }
    if (icon?.src) {
      return (
        <Image
          src={icon.src}
          alt={icon.alt || ""}
          width={18}
          height={18}
          className="w-4 h-4 object-contain"
        />
      );
    }
    return null;
  };

  const selectedLeft = selected?.labelLeft ?? selected?.label ?? placeholder;
  const selectedRight = selected?.labelRight ?? null;
  const customMenuClassName = useNativeSelect ? "relative hidden md:block" : "relative";
  const mobileSelectedLabel = useMobileSelectedLabel
    ? selected?.labelMobile ?? selectedLeft
    : selectedLeft;
  const showMobileSelectedRight = !hideMobileSelectedRight && !useMobileSelectedLabel;
  const selectedRightClassName =
    hideMobileSelectedRight || useMobileSelectedLabel ? "hidden md:inline" : "";

  return (
    <>
      {open && backdropClassName ? (
        resolvedPortalTarget ? createPortal(
          <div
            className={`${isScoped ? 'absolute' : 'fixed'} inset-0 z-[60] !mt-0 transition-opacity duration-[100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              visible ? "opacity-100" : "opacity-0"
            } ${backdropClassName}`}
            aria-hidden="true"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onClick={(e) => { e.stopPropagation(); closeMenu(); }}
          />,
          resolvedPortalTarget
        ) : (
          <div
            className={`fixed inset-0 z-40 transition-opacity duration-[100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              visible ? "opacity-100" : "opacity-0"
            } ${backdropClassName}`}
            aria-hidden="true"
            onPointerDown={(e) => { e.stopPropagation(); }}
            onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); }}
            onClick={(e) => { e.stopPropagation(); closeMenu(); }}
          />
        )
      ) : null}
      <div className={customMenuClassName}>
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            toggleMenu();
          }}
          className={`w-full flex items-center justify-between gap-2 ${
            backdropClassName
              ? (open ? "relative z-[70]" : "relative z-[61]")
              : ""
          } ${open ? "!rounded-b-none !ring-0 !shadow-none border border-white/10 border-b-0" : ""} ${buttonClassName}`}
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {renderIcon(selected?.icon)}
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <span className="truncate md:hidden">
                {mobileSelectedLabel}
              </span>
              <span className="truncate hidden md:inline">
                {selectedLeft}
              </span>
              {selectedRight ? (
                <span className={`ml-auto text-white/60 tabular-nums ${selectedRightClassName}`}>
                  {selectedRight}
                </span>
              ) : null}
            </span>
          </span>
          <svg
            className={`w-3 h-3 transition-transform duration-[100ms] ease-[cubic-bezier(0.16,1,0.3,1)] ${
              visible ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {open && !portal && (
          <div
            ref={popupRef}
            data-modal-select-dropdown
            className={`absolute z-50 mt-0 w-full max-h-64 overflow-y-auto rounded-b-lg !ring-0 border border-white/10 border-t-0 shadow-2xl origin-top transition-all duration-[100ms] ${
              visible
                ? "opacity-100 scale-y-100 translate-y-0 ease-[cubic-bezier(0.16,1,0.3,1)]"
                : "opacity-0 scale-y-[0.92] -translate-y-1 ease-[cubic-bezier(0.4,0,1,1)]"
            } ${menuClassName}`}
            style={{ WebkitOverflowScrolling: "touch", willChange: "transform, opacity" }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {options.filter((opt) => !hideSelected || String(opt.value) !== String(value)).map((opt) => {
              const left = opt.labelLeft ?? opt.label;
              const mobileLeft = opt.labelMobile ?? left;
              const optionLeft = showMobileOptionRight ? left : mobileLeft;
              const right = opt.labelRight ?? null;
              const rightClassName = showMobileOptionRight
                ? "ml-auto text-white/50 tabular-nums"
                : "ml-auto text-white/50 tabular-nums hidden md:inline";
              const description = opt.description ?? null;
              return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 ${optionClassName}`}
              >
                <span className="flex items-start gap-2">
                  {renderIcon(opt.icon)}
                  {description ? (
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate md:hidden">{optionLeft}</span>
                        <span className="truncate hidden md:inline">{left}</span>
                        {right ? (
                          <span className={rightClassName}>
                            {right}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-[13px] text-white/40 leading-snug mt-0.5 whitespace-normal break-all">
                        {description}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate md:hidden">{optionLeft}</span>
                      <span className="truncate hidden md:inline">{left}</span>
                      {right ? (
                        <span className={rightClassName}>
                          {right}
                        </span>
                      ) : null}
                    </span>
                  )}
                </span>
              </button>
              );
            })}
          </div>
        )}
        {open && portal && resolvedPortalTarget ? createPortal(
          <div
            ref={popupRef}
            data-modal-select-dropdown
            className={`${isScoped ? 'absolute' : 'fixed'} z-[70] !mt-0 max-h-64 overflow-y-auto rounded-b-lg !ring-0 border border-white/10 border-t-0 shadow-2xl origin-top transition-all duration-[100ms] ${
              visible
                ? "opacity-100 scale-y-100 translate-y-0 ease-[cubic-bezier(0.16,1,0.3,1)]"
                : "opacity-0 scale-y-[0.92] -translate-y-1 ease-[cubic-bezier(0.4,0,1,1)]"
            } ${menuClassName}`}
            style={{ ...(portalStyle || {}), WebkitOverflowScrolling: "touch", willChange: "transform, opacity" }}
            onPointerDown={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            {options.filter((opt) => !hideSelected || String(opt.value) !== String(value)).map((opt) => {
              const left = opt.labelLeft ?? opt.label;
              const mobileLeft = opt.labelMobile ?? left;
              const optionLeft = showMobileOptionRight ? left : mobileLeft;
              const right = opt.labelRight ?? null;
              const rightClassName = showMobileOptionRight
                ? "ml-auto text-white/50 tabular-nums"
                : "ml-auto text-white/50 tabular-nums hidden md:inline";
              const description = opt.description ?? null;
              return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 ${optionClassName}`}
              >
                <span className="flex items-start gap-2">
                  {renderIcon(opt.icon)}
                  {description ? (
                    <span className="flex flex-col min-w-0 flex-1">
                      <span className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="truncate md:hidden">{optionLeft}</span>
                        <span className="truncate hidden md:inline">{left}</span>
                        {right ? (
                          <span className={rightClassName}>
                            {right}
                          </span>
                        ) : null}
                      </span>
                      <span className="font-mono text-[13px] text-white/40 leading-snug mt-0.5 whitespace-normal break-all">
                        {description}
                      </span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate md:hidden">{optionLeft}</span>
                      <span className="truncate hidden md:inline">{left}</span>
                      {right ? (
                        <span className={rightClassName}>
                          {right}
                        </span>
                      ) : null}
                    </span>
                  )}
                </span>
              </button>
              );
            })}
          </div>,
          resolvedPortalTarget
        ) : null}
      </div>
      {useNativeSelect ? (
      <div className="relative md:hidden">
        <div
          className={`pointer-events-none w-full flex items-center justify-between gap-2 ${selectClassName} ${
            disabled ? "opacity-60" : ""
          }`}
          aria-hidden="true"
        >
          <span className="flex items-center gap-2 min-w-0 flex-1">
            {renderIcon(selected?.icon)}
            <span className="flex items-center gap-2 min-w-0 flex-1">
              <span className={`truncate ${selected ? "" : "text-white/50"}`}>
                {mobileSelectedLabel}
              </span>
              {showMobileSelectedRight && selectedRight ? (
                <span className="ml-auto text-white/60 tabular-nums">
                  {selectedRight}
                </span>
              ) : null}
            </span>
          </span>
          <svg
            className="w-3 h-3 text-white/60"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
        <select
          className={`absolute inset-0 w-full h-full opacity-0 ${selectClassName}`}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          disabled={disabled}
        >
          {options.map((opt) => {
            const label =
              opt.labelMobile ||
              (typeof opt.icon === "string" || typeof opt.icon === "number"
                ? `${opt.icon} ${opt.label}`
                : opt.label);
            return (
              <option key={String(opt.value)} value={opt.value}>
                {label}
              </option>
            );
          })}
        </select>
      </div>
      ) : null}
    </>
  );
}
