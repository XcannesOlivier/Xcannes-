"use client";
import { useTranslation } from "next-i18next";

export default function WalletDashboardActionRow({ layout, onAction }) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`px-3 py-2 md:py-3 border-b border-white/5 space-y-2 md:space-y-3 ${layout.actionRowClass}`}
    >
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onAction("send")}
          className="wallet-action-btn wallet-action-send group"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Corner brackets */}
              <path d="M2 7V3a1 1 0 0 1 1-1h4" />
              <path d="M17 2h4a1 1 0 0 1 1 1v4" />
              <path d="M22 17v4a1 1 0 0 1-1 1h-4" />
              <path d="M7 22H3a1 1 0 0 1-1-1v-4" />
              {/* Inner QR pattern */}
              <rect x="6" y="6" width="4.5" height="4.5" rx="0.5" />
              <rect x="13.5" y="6" width="4.5" height="4.5" rx="0.5" />
              <rect x="6" y="13.5" width="4.5" height="4.5" rx="0.5" />
              <rect x="14.5" y="14.5" width="1.5" height="1.5" rx="0.2" />
              <rect x="17" y="14.5" width="1.5" height="1.5" rx="0.2" />
              <rect x="14.5" y="17" width="1.5" height="1.5" rx="0.2" />
              <rect x="17" y="17" width="1.5" height="1.5" rx="0.2" />
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-medium">
            {t("ui_send_bee4f9e2f5", "Send")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onAction("receive")}
          className="wallet-action-btn wallet-action-receive group"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </div>
          <span className="wallet-action-label !text-sm !font-normal">
            {t("ui_receive_127eab0703", "Receive")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onAction("swap")}
          className="wallet-action-btn wallet-action-swap group"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          </div>
          <span className="wallet-action-label !text-sm !font-normal">
            {t("ui_convert_e0fbc97f15", "Convert")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => onAction("cash")}
          className="wallet-action-btn wallet-action-buysell group"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
              <line x1="5" y1="21" x2="19" y2="21"></line>
            </svg>
          </div>
          <span className="wallet-action-label !text-lg !font-bold">Fonds</span>
        </button>
      </div>
    </div>
  );
}
