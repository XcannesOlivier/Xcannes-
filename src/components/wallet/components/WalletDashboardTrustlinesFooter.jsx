"use client";import { useTranslation } from "next-i18next";

export default function WalletDashboardTrustlinesFooter({ totalLockedXcs, onClose }) {const { t } = useTranslation("common");
  return (
    <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
      <p className="text-[11px] text-white/60">{t("ui_total_locked_xcs_9519342799", "Total locked XCS:")}
        {" "}
        <span className="font-semibold text-white">
          {Number(totalLockedXcs || 0).toLocaleString("en-US", {
            maximumFractionDigits: 4
          })}{" "}{t("ui_xcs_57effc1747", "XCS")}

        </span>
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        className="w-full px-3 py-2 rounded-lg bg-white/5 text-xs text-white/80 hover:bg-white/10 transition-colors active:scale-95">{t("ui_close_9061dbe683", "Fermer")}


      </button>
    </div>);

}