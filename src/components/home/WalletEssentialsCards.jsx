import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";

export default function WalletEssentialsCards({ variant = "home" }) {
  const { t } = useTranslation("common");
  const [modalRoot, setModalRoot] = useState(null);
  const [activeActionKey, setActiveActionKey] = useState(null);
  const [activeFlowKey, setActiveFlowKey] = useState(null);
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
        "Payer une demande (QR/code) ou envoyer à une adresse."
      ),
      modalLayout: {
        intro: t(
          "home_v2_essentials_2_modal_intro",
          "Deux parcours clairs pour envoyer des fonds depuis le wallet."
        ),
        flows: [
          {
            key: "pay_request",
            tabLabel: t(
              "home_v2_essentials_2_modal_flow_1_tab",
              "Payer une demande"
            ),
            title: t(
              "home_v2_essentials_2_modal_flow_1_title",
              "Parcours 1 · Payer une demande"
            ),
            intro: t(
              "home_v2_essentials_2_modal_flow_1_intro",
              "Réglez facilement une demande de paiement déjà préparée par le destinataire."
            ),
            steps: [
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_1_step_1_title",
                  "Recevoir la demande"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_1_step_1_desc",
                  "Le destinataire vous envoie une demande contenant le montant, la devise, son wallet."
                ),
                note: t(
                  "home_v2_essentials_2_modal_flow_1_step_1_note",
                  "Elle peut être reçue par message, e-mail, SMS, ou présentée en face à face via un QR code."
                ),
              },
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_1_step_2_title",
                  "Charger la demande"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_1_step_2_desc",
                  "Depuis votre wallet, importez la demande en :"
                ),
                details: [
                  t(
                    "home_v2_essentials_2_modal_flow_1_step_2_detail_1",
                    "Scannant le QR code"
                  ),
                  t(
                    "home_v2_essentials_2_modal_flow_1_step_2_detail_2",
                    "Chargeant une image du QR"
                  ),
                  t(
                    "home_v2_essentials_2_modal_flow_1_step_2_detail_3",
                    "Ou collant le code reçu"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_1_step_3_title",
                  "Vérifier et confirmer"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_1_step_3_desc",
                  "Les informations s’affichent automatiquement. Vérifiez-les, puis confirmez la transaction."
                ),
                note: t(
                  "home_v2_essentials_2_modal_flow_1_step_3_note",
                  "Chaque paiement nécessite une validation explicite pour garantir sécurité et contrôle."
                ),
              },
            ],
          },
          {
            key: "simple_send",
            tabLabel: t(
              "home_v2_essentials_2_modal_flow_2_tab",
              "Envoi simple"
            ),
            title: t(
              "home_v2_essentials_2_modal_flow_2_title",
              "Parcours 2 · Envoi simple"
            ),
            intro: t(
              "home_v2_essentials_2_modal_flow_2_intro",
              "Envoyez des fonds sans demande préalable, en renseignant vous-même le destinataire."
            ),
            steps: [
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_2_step_1_title",
                  "Choisir le destinataire"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_2_step_1_desc",
                  "Définissez le wallet du destinataire en :"
                ),
                details: [
                  t(
                    "home_v2_essentials_2_modal_flow_2_step_1_detail_1",
                    "Scannant un QR code s’il est en face de vous"
                  ),
                  t(
                    "home_v2_essentials_2_modal_flow_2_step_1_detail_2",
                    "Collant une adresse reçue par message, e-mail ou SMS"
                  ),
                  t(
                    "home_v2_essentials_2_modal_flow_2_step_1_detail_3",
                    "Ou sélectionnant une adresse enregistrée dans votre liste de wallets"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_2_step_2_title",
                  "Indiquer le paiement"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_2_step_2_desc",
                  "Renseignez :"
                ),
                details: [
                  t(
                    "home_v2_essentials_2_modal_flow_2_step_2_detail_1",
                    "La devise"
                  ),
                  t(
                    "home_v2_essentials_2_modal_flow_2_step_2_detail_2",
                    "Le montant"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_2_step_3_title",
                  "Vérifier et confirmer"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_2_step_3_desc",
                  "Vérifiez les informations affichées, puis confirmez l’envoi."
                ),
              },
              {
                title: t(
                  "home_v2_essentials_2_modal_flow_2_step_4_title",
                  "Confirmer la transaction"
                ),
                desc: t(
                  "home_v2_essentials_2_modal_flow_2_step_4_desc",
                  "Chaque transaction nécessite une validation explicite afin de garantir sécurité et contrôle."
                ),
              },
            ],
          },
        ],
        note: "",
      },
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
      modalLayout: {
        intro: t(
          "home_v2_essentials_5_modal_intro",
          "Deux parcours complémentaires pour recevoir des fonds ou demander un paiement."
        ),
        flows: [
          {
            key: "receive",
            tabLabel: t(
              "home_v2_essentials_5_modal_flow_1_tab",
              "Recevoir"
            ),
            title: t(
              "home_v2_essentials_5_modal_flow_1_title",
              "Parcours 1 · Recevoir"
            ),
            intro: t(
              "home_v2_essentials_5_modal_flow_1_intro",
              "Partagez votre adresse pour que l'on vous envoie des fonds directement."
            ),
            steps: [
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_1_step_1_title",
                  "Afficher votre adresse"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_1_step_1_desc",
                  "Votre wallet génère automatiquement une adresse de réception et un QR code prêt à être partagé."
                ),
                details: [
                  t(
                    "home_v2_essentials_5_modal_flow_1_step_1_detail_1",
                    "Copier l’adresse"
                  ),
                  t(
                    "home_v2_essentials_5_modal_flow_1_step_1_detail_2",
                    "Afficher le QR code"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_1_step_2_title",
                  "Partager avec le payeur"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_1_step_2_desc",
                  "Transmettez votre adresse ou votre QR :"
                ),
                details: [
                  t(
                    "home_v2_essentials_5_modal_flow_1_step_2_detail_1",
                    "Par message, e-mail ou SMS"
                  ),
                  t(
                    "home_v2_essentials_5_modal_flow_1_step_2_detail_2",
                    "En face à face, en laissant le payeur scanner le QR"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_1_step_3_title",
                  "Recevoir et suivre"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_1_step_3_desc",
                  "Le paiement apparaît dans votre wallet dès réception."
                ),
                note: t(
                  "home_v2_essentials_5_modal_flow_1_step_3_note",
                  "Chaque transaction est visible et traçable dans vos relevés."
                ),
              },
            ],
          },
          {
            key: "request",
            tabLabel: t(
              "home_v2_essentials_5_modal_flow_2_tab",
              "Demander"
            ),
            title: t(
              "home_v2_essentials_5_modal_flow_2_title",
              "Parcours 2 · Demande de paiement"
            ),
            intro: t(
              "home_v2_essentials_5_modal_flow_2_intro",
              "Créez une demande avec montant et devise, puis partagez-la."
            ),
            steps: [
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_2_step_1_title",
                  "Créer la demande"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_2_step_1_desc",
                  "Saisissez le montant, la devise et un libellé optionnel."
                ),
                details: [
                  t(
                    "home_v2_essentials_5_modal_flow_2_step_1_detail_1",
                    "Montant exact"
                  ),
                  t(
                    "home_v2_essentials_5_modal_flow_2_step_1_detail_2",
                    "Devise demandée"
                  ),
                  t(
                    "home_v2_essentials_5_modal_flow_2_step_1_detail_3",
                    "Mémo ou libellé (optionnel)"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_2_step_2_title",
                  "Générer le code"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_2_step_2_desc",
                  "XCANNES crée un QR et un code de demande."
                ),
                details: [
                  t(
                    "home_v2_essentials_5_modal_flow_2_step_2_detail_1",
                    "QR à scanner"
                  ),
                  t(
                    "home_v2_essentials_5_modal_flow_2_step_2_detail_2",
                    "Code à copier/coller"
                  ),
                ],
              },
              {
                title: t(
                  "home_v2_essentials_5_modal_flow_2_step_3_title",
                  "Partager et suivre"
                ),
                desc: t(
                  "home_v2_essentials_5_modal_flow_2_step_3_desc",
                  "Envoyez la demande au payeur et suivez le règlement dans votre wallet."
                ),
                note: t(
                  "home_v2_essentials_5_modal_flow_2_step_3_note",
                  "Le payeur valide explicitement la transaction avant l’envoi."
                ),
              },
            ],
          },
        ],
        note: "",
      },
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
  const hasModalContent = Boolean(
    activeAction?.modalLayout ||
    activeAction?.modalSections?.length ||
    activeAction?.modalPoints?.length
  );
  useEffect(() => {
    if (!activeAction?.modalLayout?.flows?.length) {
      setActiveFlowKey(null);
      return;
    }
    setActiveFlowKey(activeAction.modalLayout.flows[0].key);
  }, [activeActionKey]);

  const rootClassName = isCompact
    ? "h-full w-full flex flex-col min-h-0 gap-4"
    : "";
  const gridClassName = isCompact
    ? "grid grid-cols-1 grid-rows-7 gap-2 flex-1 min-h-0"
    : "grid sm:grid-cols-2 lg:grid-cols-1 gap-3";
  const cardPaddingClassName = isCompact ? "p-3" : "p-5";
  const baseLayoutClassName = isCompact
    ? "space-y-2"
    : "lg:flex lg:items-start lg:gap-6";
  const showCardBorders = variant !== "home";
  const titleRowClassName = isCompact
    ? "flex items-center gap-2.5"
    : "flex items-center gap-3 lg:items-start lg:min-w-[190px]";
  const titleClassName = isCompact
    ? "text-white/80 font-montserrat font-semibold tracking-[0.18em] text-[10px] uppercase leading-snug"
    : "text-white/80 font-montserrat font-semibold tracking-widest text-xs uppercase";
  const descClassName = isCompact
    ? "text-[12px] text-white/65 leading-snug line-clamp-2"
    : "text-[17px] sm:text-sm text-white/70 leading-relaxed";
  const ctaClassName = isCompact
    ? "mt-1 flex items-center gap-1.5 text-[10px] text-xcannes-green/70 transition-colors relative overflow-hidden"
    : "absolute bottom-3 right-4 flex items-center gap-2 text-xs text-xcannes-green/70 transition-colors relative overflow-hidden md:static md:mt-3 md:ml-0 md:self-auto lg:mt-0 lg:ml-auto lg:self-start lg:pt-0.5";

  const explanationKeys = visibleActions
    .filter((action) => !action.isPlain)
    .map((action) => action.key);
  const demoAction = actions.find((action) => action.key === "demo_intro");
  const listActions = isCompact
    ? visibleActions
    : visibleActions.filter((action) => action.key !== "demo_intro");

  const renderActionCard = (action, options = {}) => {
    const { wrapperClassNameOverride = "", keySuffix = "" } = options;
    const cardLayoutClassName = baseLayoutClassName;
    const descLayoutClassName = !isCompact ? "lg:mt-0 lg:flex-1" : "";
    const isExplanationCard = !action.isPlain;
    const isLastExplanation =
      explanationKeys[explanationKeys.length - 1] === action.key;
    const showSeparator =
      isExplanationCard &&
      !isLastExplanation &&
      !(action.key === "config" && !isCompact);
    const wrapperClassName =
      wrapperClassNameOverride || action.orderClassName || "";
    const cardClasses = [
      action.isPlain
        ? "bg-transparent border-none rounded-none shadow-none"
        : showCardBorders
        ? "bg-black/20 backdrop-blur-sm border border-xcannes-green/25 rounded-xl"
        : "bg-black/20 backdrop-blur-sm rounded-xl",
      "group/card",
      cardPaddingClassName,
      action.isPlain ? "" : "relative pb-10 md:pb-5",
      cardLayoutClassName,
      showCardBorders ? action.borderHoverClassName : "",
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
              <span className="md:hidden text-xcannes-green text-xl font-light">+</span>
              <span className="hidden md:inline text-xcannes-green text-xl font-light">+</span>
            </span>
            <span className="absolute inset-0 opacity-0 transition-all duration-200 ease-out group-hover/card:opacity-100 group-hover/card:scale-110" />
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
          key={`${action.key}${keySuffix ? `-${keySuffix}` : ""}`}
          className={wrapperClassName}
        >
          <div className={cardClasses}>{cardContent}</div>
        </div>
      );
    }

    return (
      <div
        key={`${action.key}${keySuffix ? `-${keySuffix}` : ""}`}
        className={wrapperClassName}
      >
        <button
          type="button"
          onClick={() => setActiveActionKey(action.key)}
          className={cardClasses}
          aria-haspopup="dialog"
          aria-expanded={activeActionKey === action.key}
        >
          {cardContent}
        </button>
        {showSeparator && (
          <div className="mt-2 flex justify-center">
            <svg
              className="w-[86%] h-[5px]"
              viewBox="0 0 100 6"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path
                d="M0 3 C 24 2.7 38 1.1 50 1.1 C 62 1.1 76 2.7 100 3 C 76 3.3 62 4.9 50 4.9 C 38 4.9 24 3.3 0 3 Z"
                fill="rgba(34,197,94,0.35)"
              />
            </svg>
          </div>
        )}
      </div>
    );
  };

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
        {!isCompact &&
          demoAction &&
          renderActionCard(demoAction, {
            wrapperClassNameOverride: "hidden lg:block lg:order-1 lg:-mb-2",
            keySuffix: "desktop",
          })}
        {listActions.map((action) => renderActionCard(action))}
        {!isCompact &&
          demoAction &&
          renderActionCard(demoAction, {
            wrapperClassNameOverride: "lg:hidden order-last",
            keySuffix: "mobile",
          })}
      </div>

      {modalRoot &&
        activeAction &&
        hasModalContent &&
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
              className="w-full max-w-[620px] rounded-2xl border border-white/10 bg-[#040c13]/95 p-6 sm:p-7 shadow-2xl backdrop-blur-md animate-[fadeScale_180ms_ease-out] motion-reduce:animate-none"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-4 mb-5">
                <h4
                  id={modalTitleId || undefined}
                  className="text-[23px] sm:text-[24px] font-semibold text-white leading-tight"
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

              <div
                className={
                  activeAction.modalLayout
                    ? "max-h-[70vh] flex flex-col min-h-0"
                    : "max-h-[70vh] overflow-y-auto pr-1"
                }
              >
                {activeAction.modalLayout ? (
                  <div className="flex flex-col gap-4 min-h-0">
                    <p
                      className={[
                        activeAction.key === "pay" ||
                        activeAction.key === "receive_request"
                          ? "text-[19px] sm:text-[13.5px]"
                          : "text-[13.5px]",
                        "text-white/65 leading-[1.6]",
                      ].join(" ")}
                    >
                      {activeAction.modalLayout.intro}
                    </p>
                    {activeAction.modalLayout.flows?.length ? (
                      <div className="flex gap-2">
                        {activeAction.modalLayout.flows.map((flow) => {
                          const isActive = flow.key === activeFlowKey;
                          const useGreenTabs =
                            activeAction.key === "receive_request";
                          const activeTabClass = useGreenTabs
                            ? "rounded-lg border border-xcannes-green/40 bg-xcannes-green/10 text-xcannes-green/90 font-semibold transition-all duration-200 hover:bg-xcannes-green/20 hover:text-xcannes-green hover:scale-105 active:scale-95"
                            : "rounded-lg border border-[#38BDF8]/30 bg-[#38BDF8]/10 text-[#5FC9F8]/80 font-semibold transition-all duration-200 hover:bg-[#38BDF8]/20 hover:text-[#5FC9F8] hover:scale-105 active:scale-95";
                          const inactiveTabClass = useGreenTabs
                            ? "rounded-lg border border-xcannes-green/30 bg-transparent text-xcannes-green/70 font-semibold transition-all duration-200 hover:border-xcannes-green/50 hover:text-xcannes-green/90"
                            : activeAction.key === "pay"
                            ? "rounded-lg border border-[#38BDF8]/40 bg-transparent text-white/60 font-semibold transition-all duration-200 hover:border-[#38BDF8]/60 hover:text-white/80"
                            : "rounded-lg border border-white/20 bg-transparent text-white/60 font-semibold transition-all duration-200 hover:border-white/35 hover:text-white/80";
                          return (
                            <button
                              key={flow.key}
                              type="button"
                              onClick={() => setActiveFlowKey(flow.key)}
                              className={`flex-1 px-3 py-2 ${
                                activeAction.key === "pay"
                                  ? "text-[15px] sm:text-sm"
                                  : activeAction.key === "receive_request"
                                  ? "text-[14px] sm:text-sm"
                                  : "text-xs md:text-sm"
                              } ${
                                isActive ? activeTabClass : inactiveTabClass
                              }`}
                            >
                              {flow.tabLabel || flow.title}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                    <div className="flex-1 overflow-y-auto pr-1 min-h-0">
                      <div className="grid grid-cols-1 gap-3">
                        {activeAction.modalLayout.flows
                          .filter((flow) =>
                            activeFlowKey ? flow.key === activeFlowKey : true
                          )
                          .map((flow) => (
                            <div
                              key={flow.title}
                              className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                            >
                              <div
                                className={[
                                  activeAction.key === "pay" ||
                                  activeAction.key === "receive_request"
                                    ? "text-[17px] sm:text-[13.5px]"
                                    : "text-[13.5px]",
                                  "font-semibold text-white/90",
                                ].join(" ")}
                              >
                                {flow.title}
                              </div>
                              {flow.intro ? (
                                <p
                                  className={[
                                    activeAction.key === "pay" ||
                                    activeAction.key === "receive_request"
                                      ? "text-[17px] sm:text-[12.5px]"
                                      : "text-[12.5px]",
                                    "mt-2 text-white/65 leading-relaxed",
                                  ].join(" ")}
                                >
                                  {flow.intro}
                                </p>
                              ) : null}
                              <ul className="mt-3 space-y-2.5">
                                {flow.steps.map((step, index) => {
                                  const stepKey =
                                    typeof step === "string"
                                      ? step
                                      : step.title || `${flow.title}-step-${index}`;
                                  const stepTitle =
                                    typeof step === "string" ? step : step.title;
                                  const stepDesc =
                                    typeof step === "string" ? "" : step.desc;
                                  const stepDetails =
                                    typeof step === "string" ? [] : step.details || [];
                                  const stepNote =
                                    typeof step === "string" ? "" : step.note;
                                  return (
                                    <li key={stepKey} className="flex items-start gap-3">
                                      <span
                                        className={`mt-0.5 flex h-5 w-5 items-center justify-center rounded-full border text-[11px] ${
                                          activeAction.key === "pay"
                                            ? "border-[#38BDF8]/50 text-[#5FC9F8]"
                                            : "border-xcannes-green/40 text-xcannes-green/80"
                                        }`}
                                      >
                                        {index + 1}
                                      </span>
                                      <div className="flex-1">
                                        {stepTitle ? (
                                          <div
                                            className={[
                                              activeAction.key === "pay" ||
                                              activeAction.key === "receive_request"
                                                ? "text-[16.5px] sm:text-[13px]"
                                                : "text-[13px]",
                                              "font-semibold text-white/85",
                                            ].join(" ")}
                                          >
                                            {stepTitle}
                                          </div>
                                        ) : null}
                                        {stepDesc ? (
                                          <p
                                            className={[
                                              activeAction.key === "pay" ||
                                              activeAction.key === "receive_request"
                                                ? "text-[16px] sm:text-[12.5px]"
                                                : "text-[12.5px]",
                                              "mt-1 text-white/70 leading-relaxed",
                                            ].join(" ")}
                                          >
                                            {stepDesc}
                                          </p>
                                        ) : null}
                                        {stepDetails.length ? (
                                          <ul
                                            className={[
                                              activeAction.key === "pay" ||
                                              activeAction.key === "receive_request"
                                                ? "text-[15.5px] sm:text-[12px]"
                                                : "text-[12px]",
                                              "mt-2 space-y-1.5 text-white/60",
                                            ].join(" ")}
                                          >
                                            {stepDetails.map((detail) => (
                                              <li key={detail} className="flex items-start gap-2">
                                                <span
                                                  className={`mt-1.5 h-1.5 w-1.5 rounded-full flex-shrink-0 ${
                                                    activeAction.key === "pay"
                                                      ? "bg-[#38BDF8]/70"
                                                      : "bg-xcannes-green/60"
                                                  }`}
                                                  aria-hidden="true"
                                                />
                                                <span>{detail}</span>
                                              </li>
                                            ))}
                                          </ul>
                                        ) : null}
                                        {stepNote ? (
                                          <p
                                            className={[
                                              activeAction.key === "pay" ||
                                              activeAction.key === "receive_request"
                                                ? "text-[15px] sm:text-[11.5px]"
                                                : "text-[11.5px]",
                                              "mt-2 text-white/50 italic leading-relaxed",
                                            ].join(" ")}
                                          >
                                            {stepNote}
                                          </p>
                                        ) : null}
                                      </div>
                                    </li>
                                  );
                                })}
                              </ul>
                            </div>
                          ))}
                      </div>
                      {activeAction.modalLayout.note?.trim() ? (
                        <div className="text-[12.5px] text-white/50 italic leading-relaxed">
                          {activeAction.modalLayout.note}
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : activeAction.modalSections?.length ? (
                  <div className="mt-4 space-y-3 text-sm text-white/70">
                    {activeAction.modalSections.map((section) => (
                      <div
                        key={section.title}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-3"
                      >
                        <div className="text-sm font-semibold text-white/90">
                          {section.title}
                        </div>
                        <ul className="mt-2 space-y-2">
                          {section.items.map((item) => (
                            <li key={item} className="flex items-start gap-2">
                              <span
                                className="mt-2 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0"
                                aria-hidden="true"
                              />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <ul className="mt-4 space-y-3 text-[14.5px] text-white/80 leading-relaxed">
                    {activeAction.modalPoints.map((point) => (
                      <li key={point} className="flex items-start gap-3">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-xcannes-green/70 flex-shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>,
          modalRoot
        )}
    </div>
  );
}
