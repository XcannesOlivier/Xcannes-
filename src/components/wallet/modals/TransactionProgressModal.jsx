"use client";

import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "next-i18next";

/**
 * TransactionProgressModal — Xumm-style overlay for XRPL transactions.
 *
 * Visual states:
 *   1. "pending"  – action label + 3 dots blinking sequentially
 *   2. "success"  – big "Validé ✓" with confetti / sparkle burst
 *   3. "error"    – red message
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

  const label = actionLabel || t("ui_tx_progress_label", "Transaction");

  // ── Confetti particles (generated once per mount) ────────────
  const confettiPieces = useMemo(
    () =>
      Array.from({ length: 40 }, (_, i) => ({
        id: i,
        // Random angle in radians around a circle
        angle: (Math.PI * 2 * i) / 40 + (Math.random() - 0.5) * 0.4,
        // Distance from center
        distance: 60 + Math.random() * 100,
        // Random rotation
        rotation: Math.random() * 360,
        // Size
        size: 4 + Math.random() * 5,
        // Delay
        delay: Math.random() * 0.3,
        // Color
        color: [
          "#34d399",
          "#6ee7b7",
          "#a7f3d0",
          "#fbbf24",
          "#f59e0b",
          "#60a5fa",
          "#a78bfa",
          "#f472b6",
          "#fb923c",
          "#ffffff",
        ][i % 10],
      })),
    [],
  );

  // ── Auto-close ───────────────────────────────────────────────
  useEffect(() => {
    if (!visible) return;
    if (status === "success") {
      const timer = setTimeout(() => {
        setClosing(true);
        setTimeout(() => onClose?.(), 350);
      }, 2400);
      return () => clearTimeout(timer);
    }
    if (status === "error") {
      const timer = setTimeout(() => {
        setClosing(true);
        setTimeout(() => onClose?.(), 350);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [visible, status, onClose]);

  useEffect(() => {
    if (visible) setClosing(false);
  }, [visible]);

  if (!visible) return null;

  const isPending = status === "pending";
  const isSuccess = status === "success";
  const isError = status === "error";

  return (
    <div
      className={`fixed inset-0 z-[10200] flex items-center justify-center bg-black/65 backdrop-blur-sm px-4 transition-opacity duration-350 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <div
        className={`relative w-full max-w-[280px] rounded-2xl border bg-[#0d1117] p-8 shadow-2xl transition-all duration-350 ${
          closing ? "scale-90 opacity-0" : "scale-100 opacity-100"
        } ${
          isSuccess
            ? "border-emerald-500/30"
            : isError
              ? "border-red-500/30"
              : "border-white/10"
        }`}
      >
        <div className="flex flex-col items-center gap-4">

          {/* ── PENDING: Label + 3 sequential dots ────────── */}
          {isPending && (
            <>
              <p className="text-[17px] font-semibold text-white/90 text-center">
                {label}
                {" "}
                {t("ui_tx_progress_pending_suffix", "en cours")}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className="inline-block w-3 h-3 rounded-full bg-white/80"
                  style={{ animation: "dotBlink 1.4s ease-in-out infinite 0s" }}
                />
                <span
                  className="inline-block w-3 h-3 rounded-full bg-white/80"
                  style={{ animation: "dotBlink 1.4s ease-in-out infinite 0.2s" }}
                />
                <span
                  className="inline-block w-3 h-3 rounded-full bg-white/80"
                  style={{ animation: "dotBlink 1.4s ease-in-out infinite 0.4s" }}
                />
              </div>
              <p className="text-[11px] text-white/40 mt-1">
                {t("ui_tx_progress_pending_hint", "Confirmation XRPL…")}
              </p>
            </>
          )}

          {/* ── SUCCESS: Big "Validé" + confetti burst ────── */}
          {isSuccess && (
            <div className="relative flex flex-col items-center">
              {/* Confetti burst */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  width: 280,
                  height: 280,
                  left: "50%",
                  top: "50%",
                  transform: "translate(-50%, -50%)",
                }}
              >
                {confettiPieces.map((p) => (
                  <span
                    key={p.id}
                    className="absolute rounded-sm"
                    style={{
                      width: p.size,
                      height: p.size,
                      backgroundColor: p.color,
                      left: "50%",
                      top: "50%",
                      opacity: 0,
                      animation: `confettiBurst 0.9s ease-out ${p.delay}s forwards`,
                      "--conf-x": `${Math.cos(p.angle) * p.distance}px`,
                      "--conf-y": `${Math.sin(p.angle) * p.distance}px`,
                      "--conf-rot": `${p.rotation}deg`,
                    }}
                  />
                ))}
              </div>

              {/* Checkmark circle */}
              <div
                className="flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/20 mb-3"
                style={{ animation: "scaleIn 0.4s ease-out" }}
              >
                <svg
                  className="w-9 h-9 text-emerald-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2.8}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M5 13l4 4L19 7"
                    style={{
                      strokeDasharray: 24,
                      strokeDashoffset: 24,
                      animation: "drawCheck 0.45s ease-out 0.25s forwards",
                    }}
                  />
                </svg>
              </div>

              {/* Big "Validé" */}
              <p
                className="text-[28px] font-bold text-emerald-400 tracking-wide"
                style={{ animation: "scaleIn 0.35s ease-out 0.15s both" }}
              >
                {t("ui_tx_progress_validated", "Validé")}
              </p>

              <p
                className="text-[12px] text-emerald-400/50 mt-1"
                style={{ animation: "fadeIn 0.4s ease-out 0.5s both" }}
              >
                {label} {t("ui_tx_progress_confirmed", "confirmée")}
              </p>
            </div>
          )}

          {/* ── ERROR ──────────────────────────────────────── */}
          {isError && (
            <>
              <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/15">
                <svg
                  className="w-8 h-8 text-red-400"
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
              <p className="text-[15px] font-semibold text-red-300 text-center">
                {label} {t("ui_tx_progress_error_suffix", "échouée")}
              </p>
              {errorMessage && (
                <p className="text-[11px] text-red-400/70 max-w-[220px] text-center break-words">
                  {errorMessage}
                </p>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Keyframes ──────────────────────────────────────────── */}
      <style jsx global>{`
        @keyframes dotBlink {
          0%, 80%, 100% {
            opacity: 0.15;
            transform: scale(0.7);
          }
          40% {
            opacity: 1;
            transform: scale(1);
          }
        }

        @keyframes confettiBurst {
          0% {
            opacity: 1;
            transform: translate(-50%, -50%) translate(0, 0) rotate(0deg) scale(1);
          }
          70% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%)
              translate(var(--conf-x), var(--conf-y))
              rotate(var(--conf-rot))
              scale(0.3);
          }
        }

        @keyframes drawCheck {
          to {
            stroke-dashoffset: 0;
          }
        }

        @keyframes scaleIn {
          from {
            transform: scale(0.3);
            opacity: 0;
          }
          to {
            transform: scale(1);
            opacity: 1;
          }
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
