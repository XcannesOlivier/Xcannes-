/**
 * DemoWalletActionBar — the 4 action buttons (Send, Receive, Convert, Buy/Sell).
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";

export default function DemoWalletActionBar({
  setSendTab,
  setActiveAction,
  setSwapDefaultView,
  setSwapLockedView,
  setCashModalTab,
}) {
  const { t } = useTranslation("common");

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
              <line x1="7" y1="17" x2="17" y2="7"></line>
              <polyline points="7 7 17 7 17 17"></polyline>
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
            {t("demo_receive", "Recevoir")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setSwapDefaultView("convert");
            setSwapLockedView(null);
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
            {t("demo_tab_convert", "Convertir")}
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setCashModalTab("buy");
            setActiveAction("cash");
          }}
          title={t("demo_tt_cash", "Acheter ou vendre des cryptos (démo).")}
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
              <rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect>
              <line x1="1" y1="10" x2="23" y2="10"></line>
            </svg>
          </div>
          <span className="wallet-action-label !text-lg !font-bold">+/−</span>
        </button>
      </div>
    </div>
  );
}
