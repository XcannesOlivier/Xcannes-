"use client";

import { useEffect, useRef, useState } from "react";

const VARIANTS = {
  blue: {
    track: "border-[#38BDF8]/40 bg-[#38BDF8]/20",
    thumb: "bg-[#38BDF8] text-black",
    disabledTrack: "border-[#38BDF8]/25 bg-[#38BDF8]/10",
    disabledThumb: "bg-[#38BDF8]/35 text-black/70",
    disabledLabel: "text-[#38BDF8]/60",
  },
  green: {
    track: "border-[#22C55E]/40 bg-[#22C55E]/20",
    thumb: "bg-[#22C55E] text-black",
    disabledTrack: "border-[#22C55E]/25 bg-[#22C55E]/10",
    disabledThumb: "bg-[#22C55E]/35 text-black/70",
    disabledLabel: "text-[#22C55E]/60",
  },
  cyan: {
    track: "border-[#06B6D4]/40 bg-[#06B6D4]/20",
    thumb: "bg-[#06B6D4] text-black",
    disabledTrack: "border-[#06B6D4]/25 bg-[#06B6D4]/10",
    disabledThumb: "bg-[#06B6D4]/35 text-black/70",
    disabledLabel: "text-[#06B6D4]/60",
  },
  xcannesGreen: {
    track: "border-[#10B981]/40 bg-[#10B981]/20",
    thumb: "bg-[#10B981] text-black",
    label: "text-[#10B981]",
    disabledTrack: "border-[#10B981]/25 bg-[#10B981]/10",
    disabledThumb: "bg-[#10B981]/25 text-black/70",
    disabledLabel: "text-[#10B981]/60",
  },
  orange: {
    track: "border-orange-400/40 bg-gradient-to-r from-orange-500/20 to-amber-600/20",
    thumb: "bg-gradient-to-r from-orange-500 to-amber-600 text-black",
    disabledTrack:
      "border-orange-400/25 bg-gradient-to-r from-orange-500/10 to-amber-600/10",
    disabledThumb:
      "bg-gradient-to-r from-orange-500/40 to-amber-600/40 text-black/70",
    disabledLabel: "text-orange-400/60",
  },
};

export default function SwipeConfirmButton({
  label,
  onConfirm,
  disabled = false,
  variant = "blue",
  className = "",
}) {
  const trackRef = useRef(null);
  const thumbRef = useRef(null);
  const startXRef = useRef(0);
  const startOffsetRef = useRef(0);
  const [offset, setOffset] = useState(0);
  const [maxOffset, setMaxOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const updateBounds = () => {
      if (!trackRef.current || !thumbRef.current) return;
      const nextMax =
        trackRef.current.clientWidth - thumbRef.current.clientWidth - 8;
      setMaxOffset(nextMax > 0 ? nextMax : 0);
      setOffset((prev) => Math.min(prev, nextMax > 0 ? nextMax : 0));
    };
    updateBounds();
    window.addEventListener("resize", updateBounds);
    return () => window.removeEventListener("resize", updateBounds);
  }, []);

  useEffect(() => {
    if (disabled) setOffset(0);
  }, [disabled]);

  const handlePointerDown = (event) => {
    if (disabled) return;
    setDragging(true);
    startXRef.current = event.clientX;
    startOffsetRef.current = offset;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    if (!dragging) return;
    const delta = event.clientX - startXRef.current;
    const nextOffset = Math.min(
      Math.max(startOffsetRef.current + delta, 0),
      maxOffset
    );
    setOffset(nextOffset);
  };

  const handlePointerUp = () => {
    if (!dragging) return;
    setDragging(false);
    const threshold = maxOffset * 0.9;
    if (offset >= threshold && !disabled) {
      setOffset(maxOffset);
      onConfirm?.();
      setTimeout(() => setOffset(0), 250);
      return;
    }
    setOffset(0);
  };

  const variantStyle = VARIANTS[variant] || VARIANTS.blue;
  const trackClassName = disabled
    ? variantStyle.disabledTrack || "border-white/15 bg-white/5"
    : variantStyle.track;
  const thumbClassName = disabled
    ? variantStyle.disabledThumb || "bg-white/10 text-white/50"
    : variantStyle.thumb;
  const labelClassName = disabled
    ? variantStyle.disabledLabel || "text-white/40"
    : variantStyle.label || "text-white/80";

  return (
    <div className={className}>
      <div
        ref={trackRef}
        className={`relative h-11 rounded-lg border ${trackClassName}`}
      >
        <span
          className={`pointer-events-none absolute inset-0 flex items-center justify-center text-xs font-semibold ${labelClassName}`}
        >
          {label}
        </span>
        <button
          type="button"
          ref={thumbRef}
          aria-label={label}
          disabled={disabled}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`absolute left-1 top-1 flex h-9 w-9 items-center justify-center rounded-md ${thumbClassName} ${
            dragging ? "" : "transition-transform duration-200"
          } touch-none cursor-pointer`}
          style={{ transform: `translateX(${offset}px)` }}
        >
          <span className="text-sm font-bold">{">>"}</span>
        </button>
      </div>
    </div>
  );
}
