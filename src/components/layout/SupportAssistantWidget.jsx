import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export default function SupportAssistantWidget() {
  const { t } = useTranslation("common");
  const [assistantContainer, setAssistantContainer] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "assistant-root";
    document.body.appendChild(el);
    setAssistantContainer(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      if (assistantOpen) return;
      setShowPrompt(true);
      window.setTimeout(() => setShowPrompt(false), 2000);
    }, 20000);

    return () => window.clearInterval(intervalId);
  }, [assistantOpen]);

  if (!assistantContainer) return null;

  return createPortal(
    <div className="fixed right-3 bottom-3 md:right-6 md:bottom-6 z-[9999]">
      {assistantOpen && (
        <div className="ai-assistant-panel mb-3 w-[96vw] max-w-none md:max-w-md">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="ai-badge">{t("home_support_badge", "SUP")}</div>
              <p className="text-sm font-semibold text-white/90">
                {t("home_support_title", "Support XCANNES")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="ai-close-btn"
              aria-label={t("home_support_close", "Fermer")}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <div className="ai-message-area">
            <p className="text-sm font-medium text-white/90 mb-2">
              {t("home_support_msg_title", "Besoin d’aide ?")}
            </p>
            <p className="text-xs text-white/60 leading-relaxed">
              {t(
                "home_support_msg_body",
                "Posez une question sur le wallet, les paiements, la conversion ou les marchés. Nous vous guidons étape par étape."
              )}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder={t("home_support_placeholder", "Write your question…")}
              className="ai-input"
            />

            <button
              type="button"
              className="ai-send-btn"
              aria-label={t("home_support_send", "Envoyer")}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="22" y1="2" x2="11" y2="13" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
      )}
      {!assistantOpen && (
        <div className="relative flex items-center justify-end">
          <button
            type="button"
            onClick={() => setAssistantOpen(true)}
            className="w-10 h-10 md:w-12 md:h-12 transition-all bg-transparent text-white hover:bg-white/10 border-2 border-white/30 rounded-full flex items-center justify-center relative overflow-hidden"
            aria-label={t("home_support_open", "Ouvrir le support")}
            title={t("home_support_open", "Ouvrir le support")}
          >
            <span
              className="tracking-wider relative z-10 inline-block text-lg md:text-xl"
              style={{ animation: "irregularPulse 3s ease-in-out infinite" }}
            >
              •••
            </span>
            <span
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              style={{ animation: "shimmer 2s ease-in-out infinite" }}
            />
          </button>
          <div
            className={[
              "absolute right-12 md:right-14 whitespace-nowrap rounded-full border border-white/10 bg-black/70 px-3 py-1 text-[11px] text-white/80 shadow-lg transition-all duration-200",
              showPrompt
                ? "opacity-100 translate-y-0"
                : "opacity-0 translate-y-1 pointer-events-none",
            ].join(" ")}
            aria-hidden={!showPrompt}
          >
            {t("home_support_prompt", "Comment puis-je vous aider ?")}
          </div>
        </div>
      )}
      <style jsx global>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%) rotate(0deg);
          }
          100% {
            transform: translateX(100%) rotate(360deg);
          }
        }
        @keyframes irregularPulse {
          0% {
            transform: scale(1);
          }
          15% {
            transform: scale(1.15);
          }
          25% {
            transform: scale(1);
          }
          40% {
            transform: scale(1.08);
          }
          50% {
            transform: scale(1);
          }
          75% {
            transform: scale(1.12);
          }
          85% {
            transform: scale(1);
          }
          100% {
            transform: scale(1);
          }
        }

        .ai-assistant-panel {
          background: rgba(0, 0, 0, 0.2);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          padding: 16px;
          box-shadow:
            0 8px 32px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;

          animation: aiPanelFadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes aiPanelFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .ai-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 2px 6px;
          background: rgba(6, 182, 212, 0.15);
          border: 1px solid rgba(6, 182, 212, 0.3);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: #06b6d4;
          letter-spacing: 0.5px;
        }

        .ai-close-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 24px;
          height: 24px;
          color: rgba(255, 255, 255, 0.4);
          transition: all 120ms;
          cursor: pointer;
          border-radius: 4px;
        }

        .ai-close-btn:hover {
          color: rgba(255, 255, 255, 0.9);
          background: rgba(255, 255, 255, 0.05);
        }

        .ai-close-btn:active {
          transform: scale(0.95);
        }

        .ai-message-area {
          min-height: 120px;
          max-height: 240px;
          overflow-y: auto;
          padding: 12px;
          background: #0a0f0d;
          border: 1px solid rgba(148, 163, 184, 0.18);
          border-radius: 8px;
        }

        .ai-message-area::-webkit-scrollbar {
          width: 4px;
        }

        .ai-message-area::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.04);
          border-radius: 2px;
        }

        .ai-message-area::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.14);
          border-radius: 2px;
        }

        .ai-message-area::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.22);
        }

        .ai-input {
          flex: 1;
          padding: 8px 12px;
          background: #0a0f0d;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 8px;
          font-size: 13px;
          color: rgba(255, 255, 255, 0.9);
          transition: all 120ms;
        }

        .ai-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .ai-input:focus {
          outline: none;
          border-color: rgba(255, 255, 255, 0.28);
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.12);
        }

        .ai-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          color: rgba(255, 255, 255, 0.75);
          cursor: pointer;
          transition: all 120ms;
        }

        .ai-send-btn:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(255, 255, 255, 0.2);
          box-shadow: 0 0 12px rgba(0, 0, 0, 0.25);
        }

        .ai-send-btn:active {
          transform: scale(0.95);
        }

        @media (max-width: 768px) {
          .ai-message-area {
            min-height: 100px;
            max-height: 200px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .ai-close-btn,
          .ai-send-btn,
          .ai-input {
            transition: none;
            animation: none;
          }

          .ai-assistant-panel {
            animation: none;
          }
        }
      `}</style>
    </div>,
    assistantContainer
  );
}
