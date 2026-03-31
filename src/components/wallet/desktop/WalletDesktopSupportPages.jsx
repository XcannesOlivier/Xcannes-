"use client";

import { useState } from "react";
import { useTranslation } from "next-i18next";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";

function DesktopPageShell({ title, subtitle, ariaLabel, onBack, children }) {
  const { t } = useTranslation("common");

  return (
    <div
      className="flex flex-col h-full bg-[#0b0f10]"
      role="region"
      aria-label={ariaLabel}
    >
      <div className="sticky top-0 z-10 shrink-0 px-4 pt-4 pb-3 border-b border-white/10 bg-black/20 backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              type="button"
              onClick={onBack}
              className="h-10 w-10 -ml-1 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white flex items-center justify-center transition-colors flex-shrink-0"
              aria-label={t("back", "Retour")}
              title={t("back", "Retour")}
            >
              <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
            </button>
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-[0.24em] uppercase text-white/60">
                {title}
              </div>
              <div className="text-[12px] text-white/80 mt-1 truncate">
                {subtitle}
              </div>
            </div>
          </div>
          <span className="h-10 w-10" aria-hidden="true" />
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}

export function WalletDesktopSecurityPage({ onBack }) {
  const { t } = useTranslation("common");

  return (
    <DesktopPageShell
      ariaLabel={t("ui_security", "Sécurité")}
      title={t("ui_security", "Sécurité")}
      subtitle={t("ui_security_subtitle", "Protection du compte XCANNES")}
      onBack={onBack}
    >
      <div className="px-4 py-5 space-y-4">
        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_security_section_account", "Compte")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "ui_security_account_body",
              "XCANNES protège l’accès à vos opérations via la connexion au wallet (Xumm / PWA) et des mécanismes de verrouillage automatique. Nous n’affichons pas vos clés privées dans l’interface.",
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_security_section_lock", "Verrouillage")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "ui_security_lock_body",
              "Le wallet peut se déconnecter automatiquement après une période d’inactivité et lors du changement d’onglet (selon le mode). Utilisez aussi le bouton de déconnexion pour verrouiller immédiatement.",
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_security_section_tips", "Bonnes pratiques")}
          </div>
          <ul className="mt-2 space-y-2 text-[13px] text-white/75">
            <li>
              {t(
                "ui_security_tip_1",
                "Ne partagez jamais vos phrases de récupération / secrets.",
              )}
            </li>
            <li>
              {t(
                "ui_security_tip_2",
                "Vérifiez toujours l’adresse et le montant avant de signer.",
              )}
            </li>
            <li>
              {t(
                "ui_security_tip_3",
                "Évitez les réseaux Wi‑Fi publics pour des opérations sensibles.",
              )}
            </li>
          </ul>
        </div>
      </div>
    </DesktopPageShell>
  );
}

export function WalletDesktopHelpPage({ onBack }) {
  const { t } = useTranslation("common");
  const [helpOpenIndex, setHelpOpenIndex] = useState(0);

  const HELP_QA = [
    {
      q: t("ui_help_q1", "Comment recevoir des fonds ?"),
      a: t(
        "ui_help_a1",
        "Ouvrez “Recevoir”, partagez le QR code ou copiez votre adresse publique.",
      ),
    },
    {
      q: t("ui_help_q2", "Quels sont les frais ?"),
      a: t(
        "ui_help_a2",
        "Les frais XRPL varient selon le réseau. XCANNES affiche les coûts avant validation quand c’est possible.",
      ),
    },
    {
      q: t("ui_help_q3", "Pourquoi une conversion RLUSD ?"),
      a: t(
        "ui_help_a3",
        "Certaines opérations utilisent RLUSD comme base. Vous pouvez convertir depuis/vers vos lignes de devises.",
      ),
    },
    {
      q: t("ui_help_q4", "Que faire si une transaction est en attente ?"),
      a: t(
        "ui_help_a4",
        "Attendez la validation sur le ledger. Si le réseau est lent, relancez le rafraîchissement du wallet.",
      ),
    },
    {
      q: t("ui_help_q5", "Sécurité : comment verrouiller mon wallet ?"),
      a: t(
        "ui_help_a5",
        "Le wallet se déconnecte automatiquement après inactivité et lors du changement d’onglet (hors mode PWA).",
      ),
    },
  ];

  return (
    <DesktopPageShell
      ariaLabel={t("ui_questions_and_help", "Questions et aides")}
      title={t("ui_questions_and_help", "Questions et aides")}
      subtitle={t("ui_questions_and_help_subtitle", "Réponses rapides")}
      onBack={onBack}
    >
      <div className="px-4 py-4 space-y-2">
        {HELP_QA.map((item, idx) => {
          const open = helpOpenIndex === idx;
          const id = `wallet-help-desktop-${idx}`;

          return (
            <div
              key={id}
              className="rounded-[14px] border border-white/10 bg-white/5 overflow-hidden"
            >
              <button
                type="button"
                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left"
                onClick={() => setHelpOpenIndex(open ? -1 : idx)}
                aria-expanded={open}
                aria-controls={`${id}-panel`}
              >
                <div className="text-[14px] font-medium text-white/90">
                  {item.q}
                </div>
                <svg
                  className={[
                    "w-5 h-5 text-white/50 transition-transform",
                    open ? "rotate-180" : "",
                  ].join(" ")}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {open && (
                <div
                  id={`${id}-panel`}
                  className="px-4 pb-4 text-[12px] leading-relaxed text-white/70"
                >
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </DesktopPageShell>
  );
}

export function WalletDesktopTermsPage({ onBack }) {
  const { t } = useTranslation("common");

  return (
    <DesktopPageShell
      ariaLabel={t("ui_terms_of_use", "Conditions d'utilisations")}
      title={t("ui_terms_of_use", "Conditions d'utilisations")}
      subtitle={t("ui_terms_subtitle", "Conditions d'utilisation XCANNES")}
      onBack={onBack}
    >
      <div className="px-4 py-5 space-y-4">
        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_terms_section_scope", "Portée")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "ui_terms_scope_body",
              "Ces conditions encadrent l’utilisation du wallet et des services XCANNES. Elles ne constituent pas un conseil financier.",
            )}
          </div>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_terms_section_user", "Responsabilités")}
          </div>
          <ul className="mt-2 space-y-2 text-[13px] text-white/75">
            <li>
              {t(
                "ui_terms_user_1",
                "Vous êtes responsable des adresses, montants et destinataires avant signature.",
              )}
            </li>
            <li>
              {t(
                "ui_terms_user_2",
                "Ne partagez jamais vos secrets / phrases de récupération.",
              )}
            </li>
            <li>
              {t(
                "ui_terms_user_3",
                "Respectez les lois applicables à votre juridiction.",
              )}
            </li>
          </ul>
        </div>

        <div className="rounded-[14px] border border-white/10 bg-white/5 p-4">
          <div className="text-[12px] tracking-[0.22em] uppercase text-white/45">
            {t("ui_terms_section_limits", "Limites")}
          </div>
          <div className="mt-2 text-[13px] leading-relaxed text-white/75">
            {t(
              "ui_terms_limits_body",
              "XCANNES s’appuie sur XRPL et des fournisseurs tiers. La disponibilité, les délais de validation et les frais réseau peuvent varier.",
            )}
          </div>
        </div>
      </div>
    </DesktopPageShell>
  );
}

