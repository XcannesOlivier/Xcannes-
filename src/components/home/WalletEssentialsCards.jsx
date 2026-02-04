import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export default function WalletEssentialsCards({ variant = "home" }) {
  const { t } = useTranslation("common");
  const [modalRoot, setModalRoot] = useState(null);
  const [activeActionKey, setActiveActionKey] = useState(null);
  const isCompact = variant === "compare";

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "essentials-modal-root";
    document.body.appendChild(el);
    setModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

  useEffect(() => {
    if (!activeActionKey || typeof window === "undefined") return;
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setActiveActionKey(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeActionKey]);

  const actions = [
    {
      key: "statements",
      title: t("home_v2_essentials_1_title", "Relevés d'opération"),
      desc: t(
        "home_v2_essentials_1_desc",
        "Suivez les mouvements, par devise ou globalement."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_1_modal_point_1",
          "Relevés par devise ou globaux, en un clic."
        ),
        t(
          "home_v2_essentials_1_modal_point_2",
          "Partage et export en un clic."
        ),
        t(
          "home_v2_essentials_1_modal_point_3",
          "Historique clair pour le suivi comptable."
        ),
      ],
      orderClassName: "order-6 lg:order-8",
      iconClassName:
        "text-[#22C55E] bg-[rgba(34,197,94,0.08)] group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
        "Demandez (QR), recevez et envoyez en quelques secondes."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_2_modal_point_1",
          "Payer ou envoyer en quelques secondes."
        ),
        t(
          "home_v2_essentials_2_modal_point_2",
          "Validation explicite avant chaque transaction."
        ),
        t(
          "home_v2_essentials_2_modal_point_3",
          "QR et demandes intégrés pour aller plus vite."
        ),
      ],
      orderClassName: "order-1 lg:order-2",
      iconClassName:
        "text-[#5FC9F8] bg-[rgba(56,189,248,0.14)] group-hover:bg-[rgba(56,189,248,0.2)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      modalPoints: [
        t(
          "home_v2_essentials_5_modal_point_1",
          "Créer une demande de paiement en un clic."
        ),
        t(
          "home_v2_essentials_5_modal_point_2",
          "Partage rapide via QR ou lien."
        ),
        t(
          "home_v2_essentials_5_modal_point_3",
          "Suivi simple des paiements reçus."
        ),
      ],
      orderClassName: "order-2 lg:order-4",
      iconClassName:
        "text-[#22C55E] bg-[rgba(34,197,94,0.08)] group-hover:bg-[rgba(34,197,94,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      key: "convert_lines_mobile",
      title: t("home_v2_essentials_convert_lines_title", "Conversion & Lignes de comptes"),
      desc: t(
        "home_v2_essentials_lines_desc",
        "Activez et gérez vos devises locales en quelques étapes."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_3_modal_point_1",
          "Taux affiché avant confirmation."
        ),
        t(
          "home_v2_essentials_3_modal_point_2",
          "Conversion instantanée entre devises."
        ),
        t(
          "home_v2_essentials_3_modal_point_3",
          "Montants affichés clairement, sans surprise."
        ),
        t(
          "home_v2_essentials_lines_modal_point_1",
          "Activez une devise pour l'utiliser dans le wallet."
        ),
        t(
          "home_v2_essentials_lines_modal_point_2",
          "Allouez et ajustez vos montants en RLUSD."
        ),
        t(
          "home_v2_essentials_lines_modal_point_3",
          "Gérez les lignes actives et leur disponibilité."
        ),
      ],
      orderClassName: "order-3 lg:hidden",
      iconClassName:
        "text-[#06B6D4] bg-[rgba(6,182,212,0.08)] group-hover:bg-[rgba(6,182,212,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      key: "convert",
      title: t("home_v2_essentials_3_title", "Conversion"),
      desc: t(
        "home_v2_essentials_3_desc",
        "Taux clairement affiché avant validation."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_3_modal_point_1",
          "Taux affiché avant confirmation."
        ),
        t(
          "home_v2_essentials_3_modal_point_2",
          "Conversion instantanée entre devises."
        ),
        t(
          "home_v2_essentials_3_modal_point_3",
          "Montants affichés clairement, sans surprise."
        ),
      ],
      orderClassName: "hidden lg:block lg:order-5",
      iconClassName:
        "text-[#06B6D4] bg-[rgba(6,182,212,0.08)] group-hover:bg-[rgba(6,182,212,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      title: t("home_v2_essentials_6_title", "Configuration"),
      desc: t(
        "home_v2_essentials_6_desc",
        "Mise en place simple, fonctionnement clair."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_6_modal_point_1",
          "Paramètres simples, guidés pas à pas."
        ),
        t(
          "home_v2_essentials_6_modal_point_2",
          "Fonctionnement transparent, règles claires."
        ),
        t(
          "home_v2_essentials_6_modal_point_3",
          "Notifications et sécurité configurables."
        ),
      ],
      orderClassName: "order-7 lg:order-9",
      iconClassName:
        "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      modalPoints: [
        t(
          "home_v2_essentials_4_modal_point_1",
          "Accès fiat selon la disponibilité du pays."
        ),
        t(
          "home_v2_essentials_4_modal_point_2",
          "Acheter ou vendre en quelques étapes."
        ),
        t(
          "home_v2_essentials_4_modal_point_3",
          "Frais et limites indiqués avant validation."
        ),
      ],
      orderClassName: "order-5 lg:order-6",
      iconClassName:
        "text-[#8B5CF6] bg-[rgba(139,92,246,0.08)] group-hover:bg-[rgba(139,92,246,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
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
      key: "lines",
      title: t("home_v2_essentials_lines_title", "Lignes de comptes"),
      desc: t(
        "home_v2_essentials_lines_desc",
        "Activez et gérez vos devises locales en quelques étapes."
      ),
      modalPoints: [
        t(
          "home_v2_essentials_lines_modal_point_1",
          "Activez une devise pour l'utiliser dans le wallet."
        ),
        t(
          "home_v2_essentials_lines_modal_point_2",
          "Allouez et ajustez vos montants en RLUSD."
        ),
        t(
          "home_v2_essentials_lines_modal_point_3",
          "Gérez les lignes actives et leur disponibilité."
        ),
      ],
      orderClassName: "hidden lg:block lg:order-7",
      iconClassName:
        "text-[#F59E0B] bg-[rgba(245,158,11,0.08)] group-hover:bg-[rgba(245,158,11,0.14)]",
      borderHoverClassName: "group-hover:border-xcannes-green/60",
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M5 6h14M5 12h14M5 18h10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <circle cx="19" cy="18" r="2" stroke="currentColor" strokeWidth="2" />
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
      orderClassName: "order-last lg:order-1 lg:-mb-2",
      plainTitleClassName:
        "text-white/90 font-montserrat font-semibold text-xl sm:text-base lg:text-base tracking-normal",
      plainDescClassName: "text-white/60 text-lg sm:text-[15px] lg:text-sm italic",
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

  const visibleActions = isCompact
    ? actions.filter((action) => !action.isPlain)
    : actions;

  const activeAction = actions.find(
    (action) => action.key === activeActionKey
  );
  const modalTitleId = activeAction
    ? `essentials-modal-title-${activeAction.key}`
    : null;

  const rootClassName = isCompact
    ? "h-full w-full flex flex-col min-h-0 gap-4"
    : "";
  const gridClassName = isCompact
    ? "grid grid-cols-1 grid-rows-7 gap-2 flex-1 min-h-0"
    : "grid sm:grid-cols-2 lg:grid-cols-1 gap-4";
  const cardPaddingClassName = isCompact ? "p-3" : "p-5";
  const baseLayoutClassName = isCompact
    ? "space-y-2"
    : "lg:flex lg:items-start lg:gap-6";
  const titleRowClassName = isCompact
    ? "flex items-center gap-2.5"
    : "flex items-center gap-3 lg:items-start lg:min-w-[190px]";
  const titleClassName = isCompact
    ? "text-white/80 font-montserrat font-semibold tracking-[0.18em] text-[10px] uppercase leading-snug"
    : "text-white/80 font-montserrat font-semibold tracking-widest text-xs uppercase";
  const descClassName = isCompact
    ? "text-[12px] text-white/65 leading-snug line-clamp-2"
    : "text-sm text-white/70 leading-relaxed";
  const ctaClassName = isCompact
    ? "mt-1 flex items-center gap-1.5 text-[10px] text-xcannes-green/70 transition-colors relative overflow-hidden"
    : "mt-3 flex items-center gap-2 text-xs text-xcannes-green/70 transition-colors relative overflow-hidden lg:mt-0 lg:ml-auto lg:self-start lg:pt-0.5";

  return (
    <div className={rootClassName}>
      {isCompact && (
        <div className="px-0.5 text-center">
          <p className="text-[9px] uppercase tracking-[0.25em] text-white/50">
            {t("home_v2_demo_badge", "Démo du wallet (interface de compte)")}
          </p>
          <h3 className="mt-1 text-[28px] font-montserrat font-semibold text-white/90 leading-tight">
            {t("home_v2_demo_preview_title", "Démo interactive")}
          </h3>
          <p className="mt-1 text-[11px] text-white/60 leading-snug line-clamp-2 italic">
            {t(
              "home_v2_demo_card_desc",
              "Démo interactive, sans transaction réelle."
            )}
          </p>
        </div>
      )}

      <div className={gridClassName}>
        {visibleActions.map((action) => {
          const cardLayoutClassName = baseLayoutClassName;
          const descLayoutClassName = !isCompact ? "lg:mt-0 lg:flex-1" : "";
          const cardClasses = [
            action.isPlain
              ? "bg-transparent border-none rounded-none shadow-none"
            : "bg-black/20 backdrop-blur-sm border border-xcannes-green/25 rounded-xl",
            "group/card",
            cardPaddingClassName,
            cardLayoutClassName,
            action.borderHoverClassName,
            action.orderClassName,
            action.isPlain
              ? ""
              : "w-full text-left cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:bg-black/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
          ]
            .filter(Boolean)
            .join(" ");
          const effectiveTitle = action.title;
          const effectiveDesc = action.desc;
          const cardContent = (
            <>
              <div className={titleRowClassName}>
                {!action.isPlain && (
                  <div
                    className={[
                      "rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80 transition-transform duration-200 group-hover/card:scale-110",
                      isCompact ? "w-9 h-9" : "w-10 h-10",
                      !isCompact ? "lg:mt-0.5" : "",
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
                      ? action.plainTitleClassName ||
                        "text-white/90 font-montserrat font-semibold text-sm sm:text-base tracking-normal"
                      : titleClassName
                  }
                >
                  {effectiveTitle}
                </div>
              </div>
              <p
                className={[
                  "mt-2 italic",
                  descLayoutClassName,
                  action.isPlain
                    ? action.plainDescClassName || "text-white/60 text-sm"
                    : descClassName,
                ].join(" ")}
              >
                {effectiveDesc}
              </p>
              {!action.isPlain && (
                <div className={ctaClassName}>
                  <span className="relative z-10">
                    <span className="md:hidden">{t("home_v2_essentials_modal_cta", "En savoir plus")}</span>
                    <span className="hidden md:inline text-xcannes-green text-xl font-light">+</span>
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-r from-transparent via-xcannes-green/20 to-transparent -translate-x-full opacity-0 group-hover/card:translate-x-full group-hover/card:opacity-100 transition-all duration-700 ease-in-out" />
                </div>
              )}
              {action.showArrow && (
                <div className="mt-3 flex justify-end lg:mt-0 lg:ml-auto lg:self-center">
                  <span
                    className="inline-flex lg:hidden text-xcannes-green/70 animate-pulse-slow"
                    aria-hidden="true"
                  >
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
                  <span
                    className="hidden lg:inline-flex text-xcannes-green/70 animate-pulse-slow"
                    aria-hidden="true"
                  >
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
            </>
          );

          if (action.isPlain) {
            return (
              <div
                key={action.key}
                className={cardClasses}
              >
                {cardContent}
              </div>
            );
          }

          return (
            <button
              key={action.key}
              type="button"
              onClick={() => setActiveActionKey(action.key)}
              className={cardClasses}
              aria-haspopup="dialog"
              aria-expanded={activeActionKey === action.key}
            >
              {cardContent}
            </button>
          );
        })}
      </div>

      {modalRoot &&
        activeAction &&
        activeAction.modalPoints?.length &&
        createPortal(
          <div
            className="fixed inset-0 z-[10070] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setActiveActionKey(null);
              }
            }}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby={modalTitleId || undefined}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#050c12]/95 p-5 shadow-2xl animate-essentials-slide-in motion-reduce:animate-none"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4">
                <h4
                  id={modalTitleId || undefined}
                  className="text-lg font-semibold text-white"
                >
                  {activeAction.title}
                </h4>
                <button
                  type="button"
                  onClick={() => setActiveActionKey(null)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                  aria-label={t("ui_close_ed73c869c7", "Close")}
                >
                  ✕
                </button>
              </div>

              <ul className="mt-4 space-y-2 text-sm text-white/70">
                {activeAction.modalPoints.map((point) => (
                  <li key={point} className="flex items-start gap-2">
                    <span
                      className="mt-2 h-1.5 w-1.5 rounded-full bg-white/60 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>,
          modalRoot
        )}
    </div>
  );
}
