import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export default function SupportAssistantWidget({ mode = "support" }) {
  const { t } = useTranslation("common");
  const isTrading = mode === "trading";
  const [assistantContainer, setAssistantContainer] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

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
    let timeoutId;
    const intervalId = window.setInterval(() => {
      if (assistantOpen) return;
      setShowPrompt(true);
      timeoutId = window.setTimeout(() => setShowPrompt(false), 2000);
    }, 20000);

    return () => {
      window.clearInterval(intervalId);
      if (timeoutId) window.clearTimeout(timeoutId);
    };
  }, [assistantOpen]);

  useEffect(() => {
    if (!isTrading || typeof window === "undefined") return;
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isTrading]);

  if (!assistantContainer) return null;

  const wrapperClassName = isTrading
    ? `fixed right-3 md:right-6 md:bottom-6 z-[9999] transition-all duration-300 ${
        isScrolled ? "bottom-3" : "bottom-20"
      }`
    : "fixed right-3 bottom-3 md:right-6 md:bottom-6 z-[9999]";

  const openLabel = isTrading
    ? t("ui_assistant_ia_48e9d9815a", "Assistant IA")
    : t("home_support_open", "Ouvrir le support");
  const openTitle = isTrading
    ? t("ui_assistant_ia_f1719273f5", "Assistant IA")
    : t("home_support_open", "Ouvrir le support");
  const panelVariant = isTrading ? "trading" : "support";
  const showBadge = false;
  const panelTitle = isTrading
    ? t("ui_assistant_xcannes_9d301c0d6a", "Assistant XCANNES")
    : t("home_support_title", "Support XCANNES");
  const closeLabel = isTrading
    ? t("ui_close_chat_d6b0b8eaa8", "Fermer le chat")
    : t("home_support_close", "Fermer");
  const messageTitle = isTrading
    ? t(
        "ui_hello_xcannes_assistant_e7c9e94d03",
        "Bonjour, je suis l'assistant XCANNES."
      )
    : t("home_support_msg_title", "Besoin d’aide ?");
  const messageBody = isTrading
    ? t(
        "ui_describe_trading_question_cc5c9669ff",
        "Décrivez votre question de trading (pair XRPL, Pyth, EOD, carnet d'ordres...) et je vous aiderai à comprendre ce que vous voyez à l'écran."
      )
    : t(
        "home_support_msg_body",
        "Posez une question sur le wallet, les paiements, la conversion ou les marchés. Nous vous guidons étape par étape."
      );
  const placeholderText = isTrading
    ? t("ui_write_message_5f2f86490f", "Écrire un message...")
    : t("home_support_placeholder", "Write your question…");
  const sendLabel = isTrading
    ? t("ui_send_504b64a87b", "Envoyer")
    : t("home_support_send", "Envoyer");
  const messageTitleClass = isTrading
    ? "text-sm font-medium text-white/90 mb-2"
    : "text-[13.5px] font-medium text-white/90 mb-2";
  const messageBodyClass = isTrading
    ? "text-xs text-white/60 leading-relaxed"
    : "text-[12.5px] text-white/60 leading-relaxed";

  return createPortal(
    <div className={wrapperClassName}>
      {assistantOpen && (
        <div
          className="ai-assistant-panel mb-3 w-[96vw] max-w-none md:max-w-lg"
          data-variant={panelVariant}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {showBadge && <div className="ai-badge">{badgeLabel}</div>}
              <p className="text-sm font-semibold text-white/90">
                {panelTitle}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setAssistantOpen(false)}
              className="ai-close-btn"
              aria-label={closeLabel}
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
            <p className={messageTitleClass}>
              {messageTitle}
            </p>
            <p className={messageBodyClass}>
              {messageBody}
            </p>
          </div>
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              placeholder={placeholderText}
              className="ai-input"
            />

            <button
              type="button"
              className="ai-send-btn"
              aria-label={sendLabel}
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
            aria-label={openLabel}
            title={openTitle}
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
              "absolute right-12 md:right-14 whitespace-nowrap rounded-full border border-black/10 bg-white px-5 py-2.5 text-[13px] text-black/90 shadow-xl transition-all duration-200",
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
          --assistant-panel-bg: #080c0a;
          --assistant-panel-border: rgba(255, 255, 255, 0.25);
          --assistant-panel-shadow:
            0 8px 32px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;
          --assistant-panel-blur: 0px;
          --assistant-badge-bg: rgba(6, 182, 212, 0.15);
          --assistant-badge-border: rgba(255, 255, 255, 0.25);
          --assistant-badge-color: #06b6d4;
          --assistant-message-bg: #0a0f0d;
          --assistant-message-border: rgba(255, 255, 255, 0.25);
          --assistant-input-bg: #0a0f0d;
          --assistant-input-border: rgba(255, 255, 255, 0.25);
          --assistant-input-border-focus: rgba(255, 255, 255, 0.4);
          --assistant-input-ring: rgba(16, 185, 129, 0.12);
          --assistant-send-bg: rgba(255, 255, 255, 0.06);
          --assistant-send-border: rgba(255, 255, 255, 0.25);
          --assistant-send-color: rgba(255, 255, 255, 0.75);
          --assistant-send-hover-bg: rgba(255, 255, 255, 0.1);
          --assistant-send-hover-border: rgba(255, 255, 255, 0.2);
          --assistant-send-hover-shadow: 0 0 12px rgba(0, 0, 0, 0.25);

          background: var(--assistant-panel-bg);
          backdrop-filter: blur(var(--assistant-panel-blur));
          -webkit-backdrop-filter: blur(var(--assistant-panel-blur));
          border: 0.1px solid var(--assistant-panel-border);
          border-radius: 16px;
          padding: 16px;
          box-shadow: var(--assistant-panel-shadow);

          animation: aiPanelFadeIn 200ms cubic-bezier(0.4, 0, 0.2, 1);
        }

        .ai-assistant-panel[data-variant="trading"] {
          --assistant-panel-bg: #080c0a;
          --assistant-panel-border: rgba(255, 255, 255, 0.25);
          --assistant-panel-shadow:
            0 8px 32px rgba(0, 0, 0, 0.3),
            0 0 0 1px rgba(255, 255, 255, 0.04) inset;
          --assistant-panel-blur: 0px;
          --assistant-badge-bg: rgba(6, 182, 212, 0.15);
          --assistant-badge-border: rgba(255, 255, 255, 0.25);
          --assistant-badge-color: #06b6d4;
          --assistant-message-bg: #0a0f0d;
          --assistant-message-border: rgba(255, 255, 255, 0.25);
          --assistant-input-bg: #0a0f0d;
          --assistant-input-border: rgba(255, 255, 255, 0.25);
          --assistant-input-border-focus: rgba(255, 255, 255, 0.4);
          --assistant-input-ring: rgba(16, 185, 129, 0.12);
          --assistant-send-bg: rgba(255, 255, 255, 0.06);
          --assistant-send-border: rgba(255, 255, 255, 0.25);
          --assistant-send-color: rgba(255, 255, 255, 0.75);
          --assistant-send-hover-bg: rgba(255, 255, 255, 0.1);
          --assistant-send-hover-border: rgba(255, 255, 255, 0.2);
          --assistant-send-hover-shadow: 0 0 12px rgba(0, 0, 0, 0.25);
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
          background: var(--assistant-badge-bg);
          border: 0.1px solid var(--assistant-badge-border);
          border-radius: 4px;
          font-size: 10px;
          font-weight: 700;
          color: var(--assistant-badge-color);
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
          min-height: 140px;
          max-height: 280px;
          overflow-y: auto;
          padding: 12px;
          background: var(--assistant-message-bg);
          border: 0.1px solid var(--assistant-message-border);
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
          background: var(--assistant-input-bg);
          border: 0.1px solid var(--assistant-input-border);
          border-radius: 8px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.9);
          transition: all 120ms;
        }

        .ai-input::placeholder {
          color: rgba(255, 255, 255, 0.35);
        }

        .ai-input:focus {
          outline: none;
          border-color: var(--assistant-input-border-focus);
          box-shadow: 0 0 0 3px var(--assistant-input-ring);
        }

        .ai-send-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 36px;
          height: 36px;
          background: var(--assistant-send-bg);
          border: 0.1px solid var(--assistant-send-border);
          border-radius: 8px;
          color: var(--assistant-send-color);
          cursor: pointer;
          transition: all 120ms;
        }

        .ai-send-btn:hover {
          background: var(--assistant-send-hover-bg);
          border-color: var(--assistant-send-hover-border);
          box-shadow: var(--assistant-send-hover-shadow);
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
