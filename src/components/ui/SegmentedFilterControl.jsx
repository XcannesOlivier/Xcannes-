import { useRef } from "react";

/**
 * Premium iOS-style sliding segmented control.
 * tabs: [{ key, label }]
 * value: currently active key
 * onChange: (key) => void
 */

const TAB_COLORS = {
  all:        { bg: "rgba(255,255,255,0.10)",   text: "rgba(255,255,255,0.85)" },
  credit:     { bg: "rgba(34,197,94,0.13)",     text: "rgb(134,239,172)" },   // green-300
  debit:      { bg: "rgba(239,68,68,0.13)",     text: "rgb(252,165,165)" },   // red-300
  conversion: { bg: "rgba(59,130,246,0.13)",    text: "rgb(147,197,253)" },   // blue-300
};

const INACTIVE_TEXT = "rgba(255,255,255,0.45)";

// Spring-like cubic-bezier — slight overshoot, quick settle
const SPRING = "cubic-bezier(0.34, 1.18, 0.64, 1)";
const DURATION = "270ms";

export default function SegmentedFilterControl({ tabs, value, onChange, className = "" }) {
  const prevIndexRef = useRef(0);
  const activeIndex = tabs.findIndex((t) => t.key === value);

  function handleClick(key) {
    if (key === value) return;
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate(8);
    }
    prevIndexRef.current = activeIndex;
    onChange(key);
  }

  const activeColor = TAB_COLORS[value] ?? TAB_COLORS.all;

  const capsuleStyle = {
    position: "absolute",
    top: "3px",
    bottom: "3px",
    left: `${(activeIndex / tabs.length) * 100}%`,
    width: `${100 / tabs.length}%`,
    borderRadius: "12px",
    backgroundColor: activeColor.bg,
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.12), 0 1px 3px rgba(0,0,0,0.3)",
    transition: `left ${DURATION} ${SPRING}, background-color ${DURATION} ease`,
    pointerEvents: "none",
  };

  return (
    <div
      className={`relative flex items-center p-[3px] ${className}`}
      style={{ borderRadius: "14px" }}
    >
      {/* Sliding capsule */}
      <span aria-hidden style={capsuleStyle} />

      {tabs.map((tab) => {
        const isActive = tab.key === value;
        const color = TAB_COLORS[tab.key] ?? TAB_COLORS.all;
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => handleClick(tab.key)}
            style={{
              color: isActive ? color.text : INACTIVE_TEXT,
              transition: `color ${DURATION} ease`,
              position: "relative", // above capsule
              zIndex: 1,
            }}
            className="flex-1 py-[10px] text-center text-sm font-light whitespace-nowrap select-none"
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
