/**
 * DemoWalletActionBar — the 4 action buttons (Send, Receive, Convert, Buy/Sell).
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";
import { MOONPAY_UI_ENABLED, TOPPER_UI_ENABLED } from "@/utils/featureFlags";

export default function DemoWalletActionBar({
  setSendTab,
  setActiveAction,
  setCashModalTab,
}) {
  const { t } = useTranslation("common");
  const cashEnabled = MOONPAY_UI_ENABLED || TOPPER_UI_ENABLED;

  return (
    <div className="px-3 py-2 md:py-3 border-b border-white/5">
      <div className="grid grid-cols-4 gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => {
            setSendTab("manual");
            setActiveAction("send");
          }}
          title={t(
            "demo_tt_send",
            "Envoyer un paiement dans la devise choisie.",
          )}
          className="wallet-action-btn wallet-action-send group"
        >
          <div className="wallet-action-icon">
            <svg
              className="w-5 h-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {/* Viewfinder corners */}
              <path d="M2 7V3a1 1 0 0 1 1-1h4" />
              <path d="M17 2h4a1 1 0 0 1 1 1v4" />
              <path d="M22 17v4a1 1 0 0 1-1 1h-4" />
              <path d="M7 22H3a1 1 0 0 1-1-1v-4" />
              {/* Scan line */}
              <line x1="4" y1="12" x2="20" y2="12" />
            </svg>
          </div>
          <span className="wallet-action-label !text-base !font-medium">
            {t("demo_tab_send", "Envoyer")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveAction("receive");
          }}
          title={t(
            "demo_tt_receive",
            "Recevoir des fonds ou créer une demande.",
          )}
          className="wallet-action-btn wallet-action-receive group"
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
          <span className="wallet-action-label !text-sm !font-normal">
            {t("demo_receive", "Recevoir")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setActiveAction("swap");
          }}
          title={t(
            "demo_tt_convert",
            "Convertir entre devises internes (démo).",
          )}
          className="wallet-action-btn wallet-action-swap group"
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
          <span className="wallet-action-label !text-sm !font-normal">
            {t("demo_tab_convert", "Convertir")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (!cashEnabled) return;
            setCashModalTab("choice");
            setActiveAction("cash");
          }}
          title={t("demo_tt_cash", "Acheter ou vendre des cryptos (démo).")}
          disabled={!cashEnabled}
          aria-disabled={!cashEnabled}
          className={[
            "wallet-action-btn wallet-action-buysell group",
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
          <span className="wallet-action-label !text-sm !font-normal">
            Funds
          </span>
        </button>
      </div>
    </div>
  );
}
