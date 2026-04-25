"use client";
import { useTranslation } from "next-i18next";
import { MOONPAY_UI_ENABLED, TOPPER_UI_ENABLED } from "@/utils/featureFlags";

export default function WalletDashboardActionRow({ onAction }) {
  const { t } = useTranslation("common");
  const cashEnabled = MOONPAY_UI_ENABLED || TOPPER_UI_ENABLED;
  return (
    <div
      className="relative px-3 py-2 md:py-3 space-y-2 md:space-y-3"
    >
      <div className="grid grid-cols-4 gap-2 sm:gap-3 relative z-[1]">
        <div className="rounded-[20px] bg-[#0b0f10] shadow-[0_0_14px_3px_rgba(255,255,255,0.07),0_2px_10px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => onAction("sendChoice")}
          className="wallet-action-btn wallet-action-send group w-full"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-6 h-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
          </div>
          <span className="wallet-action-label !text-[18px] !font-medium">
            {t("ui_send_bee4f9e2f5", "Send")}
          </span>
        </button>
        </div>

        <div className="rounded-[20px] bg-[#0b0f10] shadow-[0_0_14px_3px_rgba(255,255,255,0.07),0_2px_10px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => onAction("receive")}
          className="wallet-action-btn wallet-action-receive group w-full"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-6 h-6"
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
          <span className="wallet-action-label !text-[16px] !font-normal">
            {t("ui_receive_127eab0703", "Receive")}
          </span>
        </button>
        </div>

        <div className="rounded-[20px] bg-[#0b0f10] shadow-[0_0_14px_3px_rgba(255,255,255,0.07),0_2px_10px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => onAction("swap")}
          className="wallet-action-btn wallet-action-swap group w-full"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-6 h-6"
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
          <span className="wallet-action-label !text-[16px] !font-normal">
            {t("ui_convert_e0fbc97f15", "Convert")}
          </span>
        </button>
        </div>

        <div className="rounded-[20px] bg-[#0b0f10] shadow-[0_0_14px_3px_rgba(255,255,255,0.07),0_2px_10px_rgba(0,0,0,0.4)]">
        <button
          type="button"
          onClick={() => {
            if (!cashEnabled) return;
            onAction("cashChoice");
          }}
          disabled={!cashEnabled}
          aria-disabled={!cashEnabled}
          title={
            cashEnabled
              ? undefined
              : t("ui_funds_disabled", {
                  defaultValue: "Onramp/offramp est temporairement désactivé.",
                })
          }
          className={[
            "wallet-action-btn wallet-action-buysell group w-full",
            !cashEnabled ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          <div className="wallet-action-icon">
            <svg
              className="w-7 h-7"
              viewBox="0 0 24 24"
              fill="none"
            >
              <text
                x="12"
                y="17"
                textAnchor="middle"
                fill="currentColor"
                fontSize="18"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                +/−
              </text>
            </svg>
          </div>
          <span className="wallet-action-label !text-[16px] !font-normal">Funds</span>
        </button>
        </div>
      </div>
    </div>
  );
}
