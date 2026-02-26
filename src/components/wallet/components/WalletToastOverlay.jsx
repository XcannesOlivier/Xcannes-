"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";

// ── Variant styling ─────────────────────────────────────────────────
const VARIANT_CLASSES = {
  success: "bg-emerald-600/95 text-white",
  error: "bg-red-600/95 text-white",
  warning: "bg-amber-500/95 text-black",
  info: "bg-[#1a2233]/95 text-white border border-white/10",
};

const VARIANT_ICONS = {
  success: "✓",
  error: "✕",
  warning: "⚠",
  info: "ℹ",
};

// ── Toast item ──────────────────────────────────────────────────────
function ToastItem({ toast, onDismiss }) {
  const cls = VARIANT_CLASSES[toast.variant] || VARIANT_CLASSES.info;
  const icon = VARIANT_ICONS[toast.variant] || "";

  return (
    <div
      role="alert"
      className={`
        ${cls}
        rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm
        flex items-start gap-3 min-w-[280px] max-w-[420px]
        animate-[slideUp_0.25s_ease-out]
        cursor-pointer select-none
      `}
      onClick={() => onDismiss(toast.id)}
    >
      {icon && (
        <span
          className="mt-0.5 text-base leading-none shrink-0"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <span className="text-sm leading-snug whitespace-pre-line break-words flex-1">
        {toast.message}
      </span>
    </div>
  );
}

// ── Confirm dialog ──────────────────────────────────────────────────
function ConfirmDialog({ confirmState, onResolve }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (confirmState) {
      confirmRef.current?.focus();
    }
  }, [confirmState]);

  if (!confirmState) return null;

  return (
    <div
      className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => onResolve(false)}
    >
      <div
        ref={confirmRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        className="
          bg-[#111820] border border-white/10 rounded-2xl shadow-2xl
          w-[90%] max-w-[420px] p-6
          flex flex-col gap-5
          animate-[fadeScale_0.2s_ease-out]
        "
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onResolve(false);
        }}
      >
        <p className="text-sm text-white/90 leading-relaxed whitespace-pre-line break-words">
          {confirmState.message}
        </p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              text-white/70 hover:text-white
              bg-white/5 hover:bg-white/10
              transition-colors
            "
            onClick={() => onResolve(false)}
          >
            Annuler
          </button>
          <button
            type="button"
            className="
              px-4 py-2 rounded-lg text-sm font-medium
              text-black bg-xcannes-green hover:bg-xcannes-green/90
              transition-colors
            "
            onClick={() => onResolve(true)}
          >
            Confirmer
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main overlay ────────────────────────────────────────────────────
/**
 * Renders toast stack + confirm dialog.
 * Must be placed inside WalletDashboard JSX.
 *
 * Props:
 *   toasts        — array from useWalletToast
 *   confirmState  — object | null from useWalletToast
 *   dismissToast  — fn(id) from useWalletToast
 *   resolveConfirm — fn(bool) from useWalletToast
 */
export default function WalletToastOverlay({
  toasts = [],
  confirmState = null,
  dismissToast,
  resolveConfirm,
}) {
  if (typeof window === "undefined") return null;

  const hasToasts = toasts.length > 0;
  const hasConfirm = Boolean(confirmState);
  if (!hasToasts && !hasConfirm) return null;

  return createPortal(
    <>
      {/* Toast stack — bottom center */}
      {hasToasts && (
        <div
          className="
            fixed bottom-4 left-1/2 -translate-x-1/2 z-[10000]
            flex flex-col-reverse items-center gap-2
            pointer-events-none
          "
        >
          {toasts.map((t) => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismissToast} />
            </div>
          ))}
        </div>
      )}

      {/* Confirm dialog */}
      {hasConfirm && (
        <ConfirmDialog confirmState={confirmState} onResolve={resolveConfirm} />
      )}
    </>,
    document.body,
  );
}
