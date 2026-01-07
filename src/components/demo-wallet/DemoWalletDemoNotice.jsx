"use client";

import { useTranslation } from "next-i18next";

export default function DemoWalletDemoNotice({ className = "" }) {
  const { t } = useTranslation("common");

  return (
    <div
      className={[
        "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="note"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/20 text-emerald-200">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 2 2 7l10 5 10-5-10-5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M2 17l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M2 12l10 5 10-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-emerald-200">
            {t("demo_notice_title", "Mode démo")}
          </div>
          <div className="mt-1 text-[11px] text-emerald-200/80 leading-relaxed">
            {t(
              "demo_notice_desc",
              "Tout est fictif : aucune transaction réelle, aucune connexion au wallet XRPL."
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

