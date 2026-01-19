import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const [demoWalletId, setDemoWalletId] = useState("A");

  const actions = [
    {
      key: "statements",
      title: t("home_v2_essentials_1_title", "Relevés & justificatifs"),
      desc: t(
        "home_v2_essentials_1_desc",
        "Suivez, prouvez et exportez les mouvements, par devise ou globalement."
      ),
      orderClassName: "order-5 lg:order-7",
      iconClassName: "text-[#22C55E] bg-[rgba(34,197,94,0.08)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#22C55E] md:group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-[#22C55E]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 3h10a2 2 0 0 1 2 2v16l-3-2-2 2-2-2-2 2-3-2V5a2 2 0 0 1 2-2Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 7h6M9 11h6M9 15h4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "pay",
      title: t("home_v2_essentials_2_title", "Payer / Envoyer"),
      desc: t(
        "home_v2_essentials_2_desc",
        "Demandez (QR), recevez et envoyez en quelques secondes, avec validation explicite."
      ),
      orderClassName: "order-1 lg:order-2",
      iconClassName: "text-[#5FC9F8] bg-[rgba(56,189,248,0.14)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#5FC9F8] md:group-hover:bg-[rgba(56,189,248,0.2)]",
      borderHoverClassName: "group-hover:border-[#5FC9F8]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 17l10-10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 7h7v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "receive_request",
      title: t("home_v2_essentials_5_title", "Recevoir / Demander"),
      desc: t(
        "home_v2_essentials_5_desc",
        "Recevoir des fonds ou créer une demande."
      ),
      orderClassName: "order-2 lg:order-4",
      iconClassName: "text-[#22C55E] bg-[rgba(34,197,94,0.08)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#22C55E] md:group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-[#22C55E]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <line
            x1="12"
            y1="5"
            x2="12"
            y2="19"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <polyline
            points="19 12 12 19 5 12"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "convert",
      title: t("home_v2_essentials_3_title", "Conversion"),
      desc: t(
        "home_v2_essentials_3_desc",
        "Taux clairement affiché avant validation."
      ),
      orderClassName: "order-3 lg:order-5",
      iconClassName: "text-[#06B6D4] bg-[rgba(6,182,212,0.08)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#06B6D4] md:group-hover:bg-[rgba(6,182,212,0.14)]",
      borderHoverClassName: "group-hover:border-[#06B6D4]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <polyline
            points="17 1 21 5 17 9"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M3 11V9a4 4 0 0 1 4-4h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="7 23 3 19 7 15"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21 13v2a4 4 0 0 1-4 4H3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "config",
      title: t(
        "home_v2_essentials_6_title",
        "Configuration / Fonctionnement"
      ),
      desc: t(
        "home_v2_essentials_6_desc",
        "Mise en place simple, fonctionnement clair."
      ),
      orderClassName: "order-6 lg:order-8",
      iconClassName: "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#8B5CF6] md:group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-[#8B5CF6]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 7h10M18 7h2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 7a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M4 17h6M14 17h6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M14 17a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      key: "buy",
      title: t("home_v2_essentials_4_title", "Acheter / Vendre"),
      desc: t(
        "home_v2_essentials_4_desc",
        "Accès fiat selon la disponibilité du pays."
      ),
      orderClassName: "order-4 lg:order-6",
      iconClassName: "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] md:text-white/80 md:bg-white/5 md:group-hover:text-[#8B5CF6] md:group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-[#8B5CF6]/40",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <rect
            x="1"
            y="4"
            width="22"
            height="16"
            rx="2"
            ry="2"
            stroke="currentColor"
            strokeWidth="2"
          />
          <line
            x1="1"
            y1="10"
            x2="23"
            y2="10"
            stroke="currentColor"
            strokeWidth="2"
          />
        </svg>
      ),
    },
    {
      key: "demo_intro",
      title: t(
        "home_v2_demo_card_title",
        "Découvrez la démo du wallet XCANNES"
      ),
      desc: t(
        "home_v2_demo_card_desc",
        "Démo interactive, sans transaction réelle."
      ),
      orderClassName: "order-last lg:order-1",
      showArrow: true,
      isPlain: true,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <circle
            cx="12"
            cy="12"
            r="9"
            stroke="currentColor"
            strokeWidth="2"
          />
          <path
            d="M10 8l6 4-6 4V8Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(
              "home_v2_demo_title",
              "Une interface de compte, en multi‑devises."
            )}
          </h2>
          <p className="text-base sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto">
            {t(
              "home_v2_demo_subtitle",
              "Les essentiels, au quotidien."
            )}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="flex flex-col gap-8">
            <div className="order-1 lg:order-2">
              <div className="grid sm:grid-cols-2 lg:grid-cols-1 gap-4">
              {actions.map((action) => (
                <div
                  key={action.key}
                  className={[
                    action.isPlain
                      ? "bg-transparent border-none rounded-none shadow-none"
                      : "bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl",
                    "group p-5 lg:flex lg:items-start lg:gap-6",
                    action.borderHoverClassName,
                    action.orderClassName,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <div className="flex items-center gap-3 lg:min-w-[190px]">
                    {!action.isPlain && (
                      <div
                        className={[
                          "w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 transition-transform duration-200 group-hover:scale-110",
                          action.iconClassName,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        {action.icon}
                      </div>
                    )}
                    <div
                      className={
                        action.isPlain
                          ? "text-white/90 font-montserrat font-semibold text-sm sm:text-base tracking-normal"
                          : "text-white/80 font-montserrat font-semibold tracking-widest text-xs uppercase"
                      }
                    >
                      {action.title}
                    </div>
                  </div>
                  <p
                    className={[
                      "mt-2 text-sm leading-relaxed lg:mt-0 lg:flex-1",
                      action.isPlain ? "text-white/60" : "text-white/70",
                    ].join(" ")}
                  >
                    {action.desc}
                  </p>
                  {action.showArrow && (
                    <div className="mt-3 flex justify-end lg:mt-0 lg:ml-auto lg:self-center">
                      <span className="inline-flex lg:hidden text-xcannes-green/70 animate-pulse-slow" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M12 5v14"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M7 14l5 5 5-5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      <span className="hidden lg:inline-flex text-xcannes-green/70 animate-pulse-slow" aria-hidden="true">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M5 12h14"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="M14 7l5 5-5 5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>

          </div>

          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base text-white/70 min-w-0">
                  {t("home_v2_demo_preview_title", "Démo interactive (fictive)")}
                </p>
                <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1 flex-shrink-0">
                  {["A", "B"].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDemoWalletId(id)}
                      className={[
                        "px-2.5 md:px-3 py-1.5 text-xs rounded-md transition-colors border",
                        demoWalletId === id
                          ? id === "A"
                            ? "bg-xcannes-green/10 border-xcannes-green/30 text-xcannes-green"
                            : "bg-xcannes-blue-light/10 border-xcannes-blue-light/30 text-xcannes-blue-light"
                          : "border-transparent text-white/60 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="md:hidden">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                      <span className="hidden md:inline">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[680px] md:h-[720px] overflow-hidden">
              <DemoWalletDashboard
                key={demoWalletId}
                defaultWalletId={demoWalletId}
                theme={demoWalletId === "B" ? "dex" : "home"}
                showWalletSwitcher={false}
                showCompareLink={true}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
