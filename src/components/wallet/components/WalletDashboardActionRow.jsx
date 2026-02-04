"use client";
import { useTranslation } from "next-i18next";

export default function WalletDashboardActionRow({
  layout,
  onAction,
}) {
  const { t } = useTranslation("common");
  return (
    <div
      className={`px-3 py-2 md:py-3 border-b border-white/5 space-y-2 md:space-y-3 ${layout.actionRowClass}`}>

      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => onAction("send")}
          className="wallet-action-btn wallet-action-send group">

          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">

              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-medium md:!font-normal">{t("ui_send_bee4f9e2f5", "Send")}</span>
        </button>

        <button
          type="button"
          onClick={() => onAction("receive")}
          className="wallet-action-btn wallet-action-receive group">

          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4 transition-transform duration-150 group-hover:translate-y-0.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">

              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-medium md:!font-normal">{t("ui_receive_127eab0703", "Receive")}</span>
        </button>

        <button
          type="button"
          onClick={() => onAction("swap")}
          className="wallet-action-btn wallet-action-swap group">

          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4 transition-transform duration-150 group-hover:rotate-90"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">

              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-medium md:!font-normal">{t("ui_convert_e0fbc97f15", "Convert")}</span>
        </button>

        <button
          type="button"
          onClick={() => onAction("cash")}
          className="wallet-action-btn wallet-action-buysell group">

          <div className="wallet-action-icon">
            <svg
              className="w-4 h-4 transition-transform duration-150 group-hover:scale-110"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">

              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-bold">{t("ui_buy_sell_ec2ec12982", "Buy/Sell")}</span>
        </button>
      </div>

    </div>);

}
