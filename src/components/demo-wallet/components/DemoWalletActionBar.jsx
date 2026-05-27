/**
 * DemoWalletActionBar — the 4 action buttons (Send, Receive, Convert, Buy/Sell).
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";
import { MOONPAY_UI_ENABLED, TOPPER_UI_ENABLED } from "@/utils/featureFlags";

const CARD_CLASS =
  "rounded-[22px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.04),0_6px_14px_rgba(0,0,0,0.50),inset_0_-14px_20px_rgba(0,0,0,0.78)]";

const BTN_CLASS =
  "wallet-action-btn group w-full !rounded-[22px] !py-3.5 !px-2 !gap-2 min-h-[92px]";
const ICON_CLASS = "wallet-action-icon !w-[44px] !h-[44px] !rounded-[16px]";

export default function DemoWalletActionBar({
  setSendTab,
  setActiveAction,
  setCashModalTab,
}) {
  const { t } = useTranslation("common");
  const cashEnabled = MOONPAY_UI_ENABLED || TOPPER_UI_ENABLED;

  return (
    <div className="relative px-3 pt-[24px] pb-2 space-y-2">
      <div className="grid grid-cols-4 gap-2 sm:gap-3 relative z-[1]">
        <div className={CARD_CLASS}>
          <button
            type="button"
            onClick={() => {
              setSendTab("manual");
              setActiveAction("sendChoice");
            }}
            title={t("demo_tt_send", "Envoyer un paiement dans la devise choisie.")}
            className={`${BTN_CLASS} wallet-action-send`}
          >
            <div className={`${ICON_CLASS} !text-white`}>
              <svg
                className="w-[24px] h-[24px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="19" x2="12" y2="5" />
                <polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-medium">
              {t("ui_send_bee4f9e2f5", "Envoyer")}
            </span>
          </button>
        </div>

        <div className={CARD_CLASS}>
          <button
            type="button"
            onClick={() => setActiveAction("receive")}
            title={t("demo_tt_receive", "Recevoir des fonds ou créer une demande.")}
            className={`${BTN_CLASS} wallet-action-receive`}
          >
            <div className={`${ICON_CLASS} !text-[#16A34A]`}>
              <svg
                className="w-[24px] h-[24px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal">
              {t("ui_receive_127eab0703", "Recevoir")}
            </span>
          </button>
        </div>

        <div className={CARD_CLASS}>
          <button
            type="button"
            onClick={() => setActiveAction("swap")}
            title={t("demo_tt_convert", "Convertir entre devises internes (démo).")}
            className={`${BTN_CLASS} wallet-action-swap`}
          >
            <div className={`${ICON_CLASS} !text-[#16A34A]`}>
              <svg
                className="w-[24px] h-[24px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="17 1 21 5 17 9" />
                <path d="M3 11V9a4 4 0 0 1 4-4h14" />
                <polyline points="7 23 3 19 7 15" />
                <path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal">
              {t("ui_convert_e0fbc97f15", "Convertir")}
            </span>
          </button>
        </div>

        <div className={CARD_CLASS}>
          <button
            type="button"
            onClick={() => {
              if (!cashEnabled) return;
              setCashModalTab("choice");
              setActiveAction("cash");
            }}
            disabled={!cashEnabled}
            aria-disabled={!cashEnabled}
            title={
              cashEnabled
                ? t("demo_tt_cash", "Acheter ou vendre des cryptos (démo).")
                : t("ui_funds_disabled", {
                    defaultValue:
                      "Onramp/offramp est temporairement désactivé.",
                  })
            }
            className={[
              `${BTN_CLASS} wallet-action-buysell`,
              !cashEnabled ? "opacity-40 cursor-not-allowed" : "",
            ].join(" ")}
          >
            <div className={`${ICON_CLASS} !text-[#16A34A]`}>
              <svg className="w-[24px] h-[24px]" viewBox="0 0 24 24" fill="none">
                <text
                  x="12"
                  y="17"
                  textAnchor="middle"
                  fill="currentColor"
                  fontSize="19"
                  fontWeight="700"
                  fontFamily="system-ui, sans-serif"
                >
                  +/−
                </text>
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal !leading-tight -mt-1 text-center">
              <span className="block">Banque &amp;</span>
              <span className="block">Swap</span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
