/**
 * DemoWalletFooter — minimal footer for the demo wallet.
 *
 * Extracted from DemoWalletDashboard to keep the main component lean.
 */

import { useTranslation } from "next-i18next";

export default function DemoWalletFooter() {
  const { t } = useTranslation("common");

  return (
    <div
      className={[
        "shrink-0 border-t border-white/10 px-3 py-2",
        "bg-xcannes-surface-demo",
      ].join(" ")}
    >
      <div className="flex items-center justify-center">
        <span className="font-orbitron font-semibold tracking-[0.22em] text-white/80 uppercase text-[17px] md:text-xl leading-none">
          {t("ui_xcannes_30015bef4b", "XCANNES")}
        </span>
      </div>
    </div>
  );
}
