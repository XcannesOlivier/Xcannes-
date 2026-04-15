"use client";

import { useEffect, useRef, useState } from "react";

export default function StatementMonthSelect({
  value,
  onChange,
  options = [],
  menuClassName = "bg-elevated",
  label = "",
  onOpenChange,
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  const updateOpen = (next) => {
    const val = typeof next === "function" ? next(open) : next;
    setOpen(val);
    onOpenChange?.(val);
  };

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      if (triggerRef.current && triggerRef.current.contains(event.target))
        return;
      setOpen(false);
      onOpenChange?.(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open, onOpenChange]);

  const selectedOption =
    options.find((option) => String(option?.value) === String(value)) ||
    options[0] ||
    null;

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    updateOpen(false);
  };

  return (
    <div className={`relative ${open ? "z-50" : ""}`}>
      {label ? (
        <p className="text-xs text-white/60 mb-1">{label}</p>
      ) : null}
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          updateOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") updateOpen(false);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`statement-select w-full bg-[#101415] border border-white/10 rounded-[10px] px-3 py-2.5 text-sm text-white cursor-pointer transition-colors duration-150 flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:border-xcannes-green/60 focus-visible:ring-2 focus-visible:ring-xcannes-green/20 ${menuClassName}`}
      >
        <span className="truncate min-w-0 flex-1">
          {selectedOption?.label || ""}
        </span>
        <svg
          className={`w-3 h-3 text-white/60 transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M6 9l6 6 6-6"
          />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          role="listbox"
          className={`absolute z-50 mt-0 w-full max-h-[480px] overflow-y-auto rounded-[10px] border border-white/10 shadow-2xl bg-[#101415] ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option) => {
            const isSelected = String(option?.value) === String(value);
            if (isSelected) return null;
            return (
              <button
                key={String(option?.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`w-full px-3 py-2 text-sm text-center transition-colors ${
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-white/80 hover:bg-white/5"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
