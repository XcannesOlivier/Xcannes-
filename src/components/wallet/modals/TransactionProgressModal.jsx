"use client";

import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";

/**
 * TransactionProgressModal — Overlay shown while an XRPL transaction is
 * being signed, submitted and confirmed (~3 s).
 *
 * Three visual states:
 *   1. "pending"   – spinner + pulsing text ("Conversion en cours…")
 *   2. "success"   – green ✓ animation + label ("Conversion confirmée !")
 *   3. "error"     – red ✕ + error message
 *
 * Props:
 *   visible       — whether the modal is shown
 *   status        — "pending" | "success" | "error"
 *   actionLabel   — human-readable label, e.g. "Conversion", "Paiement"
 *   errorMessage  — optional error string (for status === "error")
 *   onClose       — called when the modal finishes its auto-close sequence
 */
export default function TransactionProgressModal({
  visible = false,
  status = "pending",
  actionLabel = "",
  errorMessage = "",
  onClose,
}) {
  const { t } = useTranslation("common");
  const [closing, setClosing] = useState(false);

  // Label to display
  const label = actionLabel || t("ui_tx_progress_label", "Transaction");

  // ── Auto-close after success / error ─────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (status === "success") {
      const timer = setTimeout(() => {
        setClosing(true);
        setTimeout(() => onClose?.(), 300);
      }, 1600);
      return () => clearTimeout(timer);
    }
    if (status === "error") {
      const timer = setTimeout(() => {
        setClosing(true);
        setTimeout(() => onClose?.(), 300);
      }, 2800);
      return () => clearTimeout(timer);
    }
  }, [visible, status, onClose]);

  // Reset closing state when modal re-opens
  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  if (!visible) return null;

  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      className={`fixed inset-0 z-[10200] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4 transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-full max-w-xs rounded-2xl border bg-[#111518] p-8 shadow-2xl transition-all duration-300 ${
          closing ? "scale-95 opacity-0" : "scale-100 opacity-100"
        } ${
          isSuccess
            ? "border-emerald-500/30"
            : isError
              ? "border-red-500/30"
              : "border-white/10"
        }`}
      >
        <div className="flex flex-col items-center gap-5">
          {/* ── Spinner / Icon ─────────────────────────────── */}
          {isPending && (
            <div className="relative flex items-center justify-center w-16 h-16">
              {/* Outer ring — spinning */}
              <div className="absolute inset-0 rounded-full border-[3px] border-white/10 border-t-white/60 animate-spin" />
              {/* Inner pulse dot */}
              <span className="relative inline-flex h-4 w-4 rounded-full bg-white/70 animate-pulse" />
            </div>
          )}

          {isSuccess && (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/15 animate-[scaleIn_0.35s_ease-out]">
              <svg
                className="w-9 h-9 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                  className="animate-[drawCheck_0.4s_ease-out_0.15s_both]"
                  style={{
                    strokeDasharray: 24,
                    strokeDashoffset: 24,
                    animation: "drawCheck 0.4s ease-out 0.15s forwards",
                  }}
                />
              </svg>
            </div>
          )}

          {isError && (
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-500/15">
              <svg
                className="w-9 h-9 text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
          )}

          {/* ── Label ──────────────────────────────────────── */}
          <div className="text-center space-y-1.5">
            <p
              className={`text-[15px] font-semibold ${
                isSuccess
                  ? "text-emerald-300"
                  : isError
                    ? "text-red-300"
                    : "text-white/90"
              }`}
            >
              {isPending &&
                t("ui_tx_progress_pending", "{{label}} en cours…", { label })}
              {isSuccess &&
                t("ui_tx_progress_success", "{{label}} confirmée !", { label })}
              {isError &&
                t("ui_tx_progress_error", "{{label}} échouée", { label })}
            </p>

            {isPending && (
              <p className="text-[11px] text-white/40">
                {t(
                  "ui_tx_progress_pending_hint",
                  "Confirmation XRPL en cours…",
                )}
              </p>
            )}

            {isSuccess && (
              <p className="text-[11px] text-emerald-400/60">
                {t(
                  "ui_tx_progress_success_hint",
                  "Mise à jour du wallet…",
                )}
              </p>
            )}

            {isError && errorMessage && (
              <p className="text-[11px] text-red-400/70 max-w-[220px] break-words">
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Keyframe for the check-mark draw animation */}
      <style jsx global>{`
        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }
        @keyframes scaleIn {
          from {
            transform: scale(0.5);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
