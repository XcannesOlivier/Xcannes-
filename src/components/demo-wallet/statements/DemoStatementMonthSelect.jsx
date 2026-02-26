"use client";

import { useEffect, useRef, useState } from "react";

export default function DemoStatementMonthSelect({
  value,
  onChange,
  options = [],
  menuClassName = "bg-elevated",
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event) => {
      if (menuRef.current && menuRef.current.contains(event.target)) return;
      if (triggerRef.current && triggerRef.current.contains(event.target))
        return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedOption =
    options.find((option) => String(option?.value) === String(value)) ||
    options[0] ||
    null;

  const handleSelect = (nextValue) => {
    onChange?.(nextValue);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        ref={triggerRef}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="statement-select w-full bg-black/40 border border-transparent rounded-md px-3 py-1.5 text-sm text-white cursor-pointer transition-colors flex items-center justify-between gap-2"
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
          className={`absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-transparent shadow-2xl ${menuClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {options.map((option) => {
            const isSelected = String(option?.value) === String(value);
            return (
              <button
                key={String(option?.value)}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => handleSelect(option.value)}
                className={`w-full px-3 py-2 text-sm text-left transition-colors ${
                  isSelected
                    ? "bg-white/10 text-white"
                    : "text-white/70 hover:bg-white/5"
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
