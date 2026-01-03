import Link from "next/link";
import { useTranslation } from "next-i18next";
import { bankButtonClassName } from "../componentsGlobal/bankButtonClassName";

export default function HomeHowItWorksSection() {
  const { t } = useTranslation("common");

  const steps = [
    {
      key: "connect",
      n: "01",
      title: t("home_how_1_title", "Connectez votre wallet"),
      desc: t(
        "home_how_1_desc",
        "Connexion via Xumm/Xaman, validation biométrique, aucune clé privée partagée."
      ),
    },
    {
      key: "choose",
      n: "02",
      title: t("home_how_2_title", "Choisissez votre devise"),
      desc: t(
        "home_how_2_desc",
        "Affichez vos montants en EUR, MXN, ARS… tout en restant adossé au dollar."
      ),
    },
    {
      key: "move",
      n: "03",
      title: t("home_how_3_title", "Envoyez, payez, convertissez"),
      desc: t(
        "home_how_3_desc",
        "Transactions rapides sur XRPL et taux marché (Pyth/XRPL) pour la conversion."
      ),
    },
  ];

  return (
    <section className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
              {t("home_how_badge", "Comment ça fonctionne")}
            </p>
            <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
              {t("home_how_title", "Simple, transparent, orienté usage.")}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/65 max-w-xl">
              {t(
                "home_how_subtitle",
                "Une expérience proche d’une app bancaire, avec règlement on-chain et contrôle utilisateur."
              )}
            </p>

            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link
                href="/wallet"
                className={bankButtonClassName({ tone: "blue", variant: "soft", size: "md" })}
              >
                {t("home_how_cta_primary", "Ouvrir le wallet")}
              </Link>
              <Link
                href="/whitepaper"
                className={bankButtonClassName({ tone: "neutral", variant: "soft", size: "md" })}
              >
                {t("home_how_cta_secondary", "Comprendre l’architecture")}
                <span className="inline-block ml-2 text-xs">→</span>
              </Link>
            </div>
          </div>

          <div className="space-y-3">
            {steps.map((s) => (
              <div
                key={s.key}
                className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-4"
              >
                <div className="flex items-start gap-4">
                  <div className="text-xcannes-green font-montserrat font-semibold tracking-[0.2em] text-xs pt-1">
                    {s.n}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white/90">
                      {s.title}
                    </div>
                    <div className="mt-1 text-sm text-white/60 leading-relaxed">
                      {s.desc}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            <div className="bg-black/10 border border-white/10 rounded-xl px-5 py-4">
              <p className="text-xs text-white/55 leading-relaxed">
                {t(
                  "home_how_note",
                  "Note : la couche de règlement utilise un stablecoin USD régulé sur XRPL (détails dans le whitepaper)."
                )}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
