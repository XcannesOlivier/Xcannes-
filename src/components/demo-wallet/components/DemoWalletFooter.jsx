/**
 * DemoWalletFooter — XRPL connection status bar + "Info & Fees" button.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";

export default function DemoWalletFooter({ setWalletInfoOpen }) {
  const { t } = useTranslation("common");

  return (
    <div
      className={[
        "shrink-0 border-t border-white/10 px-3 py-2",
        "bg-[#0b0f10]",
      ].join(" ")}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="text-[11px] text-white/60 font-medium">
          {t("ui_xrpl_not_connected_0d0d4a67a1", "XRPL non connecté")}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            type="button"
            onClick={() => setWalletInfoOpen(true)}
            className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-white/5 hover:bg-white/10 text-[11px] text-white/70 font-medium transition-all duration-300"
            title={t("wallet_footer_info_title", "Wallet info & fees")}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[12px] leading-none">
              i
            </span>
            <span>{t("wallet_footer_info_fees", "Info & Fees")}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
