"use client";

import { useTranslation } from "next-i18next";

export default function WalletNotConnectedNotice({
  show = false,
  className = "",
  variant = "preview", // "preview" | "demo"
  contextLabel = "",
}) {
  const { t } = useTranslation("common");
  if (!show) return null;

  const isDemo = variant === "demo";
  const title = isDemo
    ? t("demo_notice_title", "Mode démo")
    : t("wallet_not_connected_title", "Portefeuille non connecté");

  const desc = isDemo
    ? t(
        "demo_notice_desc",
        "Tout est fictif : aucune transaction réelle, aucune connexion au wallet XRPL."
      )
    : t(
        "wallet_not_connected_desc",
        "Vous êtes en mode aperçu. Connectez votre portefeuille pour activer cette fonctionnalité."
      );

  return (
    <div
      className={[
        isDemo
          ? "rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3"
          : "rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-3">
        <div
          className={[
            "mt-0.5 inline-flex h-8 w-8 items-center justify-center rounded-lg border",
            isDemo
              ? "bg-emerald-500/15 border-emerald-500/20 text-emerald-200"
              : "bg-amber-500/15 border-amber-500/20 text-amber-200",
          ].join(" ")}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path
              d="M12 9v4m0 4h.01"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M10.3 3.1 2.2 17.2A2 2 0 0 0 4 20h16a2 2 0 0 0 1.8-2.8L13.7 3.1a2 2 0 0 0-3.4 0Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <div className="min-w-0">
          <div
            className={[
              "text-xs font-semibold",
              isDemo ? "text-emerald-200" : "text-amber-200",
            ].join(" ")}
          >
            {title}
            {contextLabel ? (
              <span className={isDemo ? "text-emerald-200/70" : "text-amber-200/70"}>
                {" "}
                · {contextLabel}
              </span>
            ) : null}
          </div>
          <div
            className={[
              "mt-1 text-[11px] leading-relaxed",
              isDemo ? "text-emerald-200/80" : "text-amber-200/80",
            ].join(" ")}
          >
            {desc}
          </div>
        </div>
      </div>
    </div>
  );
}
