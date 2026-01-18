"use client";

import Image from "next/image";
import { isValidElement, useEffect, useMemo, useRef, useState } from "react";

export default function ModalSelect({
  value,
  onChange,
  options = [],
  placeholder = "",
  buttonClassName = "",
  menuClassName = "",
  optionClassName = "",
  selectClassName = "",
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const popupRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (popupRef.current && popupRef.current.contains(event.target)) return;
      if (triggerRef.current && triggerRef.current.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = useMemo(() => {
    return options.find((opt) => String(opt.value) === String(value)) || null;
  }, [options, value]);

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  const renderIcon = (icon) => {
    if (!icon) return null;
    if (isValidElement(icon)) {
      return <span className="text-base leading-none">{icon}</span>;
    }
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
          width={18}
          height={18}
          className="w-4 h-4 object-contain"
        />
      );
    }
    return null;
  };

  return (
    <>
      <div className="relative hidden md:block">
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          onClick={(e) => {
            e.stopPropagation();
            if (disabled) return;
            setOpen((prev) => !prev);
          }}
          className={`w-full flex items-center justify-between gap-2 ${buttonClassName}`}
        >
          <span className="flex items-center gap-2 min-w-0">
            {renderIcon(selected?.icon)}
            <span className="truncate">
              {selected ? selected.label : placeholder}
            </span>
          </span>
          <svg
            className={`w-3 h-3 transition-transform ${
              open ? "rotate-180" : ""
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
        {open && (
          <div
            ref={popupRef}
            className={`absolute z-50 mt-1 w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 shadow-2xl ${menuClassName}`}
            style={{ WebkitOverflowScrolling: "touch" }}
            onClick={(e) => e.stopPropagation()}
          >
            {options.map((opt) => (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => handleSelect(opt.value)}
                className={`w-full text-left px-3 py-2 text-sm text-white/80 hover:bg-white/10 ${optionClassName}`}
              >
                <span className="flex items-center gap-2">
                  {renderIcon(opt.icon)}
                  <span className="truncate">{opt.label}</span>
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
      <select
        className={`md:hidden ${selectClassName}`}
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
    </>
  );
}
