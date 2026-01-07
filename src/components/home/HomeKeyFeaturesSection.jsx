"use client";

import Link from "next/link";
import { useTranslation } from "next-i18next";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function HomeKeyFeaturesSection() {
  const { t } = useTranslation("common");

  const features = [
    {
      key: "payreq",
      title: t("home_feature_payreq_title", "Demande de paiement (QR)"),
      desc: t(
        "home_feature_payreq_desc",
        "Générez une demande et faites payer en quelques secondes, avec validation via Xaman."
      ),
      ctaHref: "/wallet",
      cta: t("home_feature_payreq_cta", "Créer une demande"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M6 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M18 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M9 9h6v6H9z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "statements",
      title: t("home_feature_statements_title", "Relevés & reçus"),
      desc: t(
        "home_feature_statements_desc",
        "Relevé global et par devise, avec reçus / export pour prouver paiements, transferts et conversions."
      ),
      ctaHref: "/wallet",
      cta: t("home_feature_statements_cta", "Voir un relevé"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
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
      key: "moonpay",
      title: t("home_feature_moonpay_title", "Acheter / Vendre (fiat)"),
      desc: t(
        "home_feature_moonpay_desc",
        "On‑ramp et off‑ramp via MoonPay (selon disponibilité par pays)."
      ),
      ctaHref: "/wallet",
      cta: t("home_feature_moonpay_cta", "Ouvrir Buy/Sell"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 1v22"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17 5H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "news",
      title: t("home_feature_news_title", "News locales"),
      desc: t(
        "home_feature_news_desc",
        "Flux news agrégé depuis des sources locales, utile pour le contexte de marché."
      ),
      ctaHref: "/dex",
      cta: t("home_feature_news_cta", "Voir les news"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4h14a2 2 0 0 1 2 2v14H6a2 2 0 0 1-2-2V4Z"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M8 8h8M8 12h8M8 16h5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "pricing",
      title: t("home_feature_pricing_title", "Taux & sources"),
      desc: t(
        "home_feature_pricing_desc",
        "Taux FX en temps réel (Pyth) avec fallback journalier (EOD) et tarification (spread) transparente."
      ),
      ctaHref: "/dex",
      cta: t("home_feature_pricing_cta", "Voir les marchés"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 16l4-5 4 3 4-7 4 4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "currencylines",
      title: t("home_feature_currencylines_title", "Lignes de devises & lock XCS"),
      desc: t(
        "home_feature_currencylines_desc",
        "Activez/supprimez des lignes (EUR, MXN…) et allouez votre base USD, avec verrouillage XCS pour activer les fonctionnalités."
      ),
      ctaHref: "/wallet",
      cta: t("home_feature_currencylines_cta", "Gérer les lignes"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2v20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M5 7h14M7 12h10M5 17h14"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      ),
    },
    {
      key: "dex",
      title: t("home_feature_dex_title", "DEX & graphiques"),
      desc: t(
        "home_feature_dex_desc",
        "Données temps réel (WebSocket) : orderbooks, trades, bougies et indicateurs (XRPL + FX)."
      ),
      ctaHref: "/dex",
      cta: t("home_feature_dex_cta", "Accéder au DEX"),
      icon: (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
          <path
            d="M3 3v18h18"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M7 14l3-3 3 2 5-6"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
            {t("home_features_badge", "Fonctionnalités clés")}
          </p>
          <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
            {t("home_features_title", "Tout ce qui compte, au même endroit.")}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
            {t(
              "home_features_subtitle",
              "Une expérience locale (monnaie du pays) avec valeur adossée au dollar (USD) — et des outils utiles au quotidien."
            )}
          </p>
          <p className="mt-2 text-[11px] text-white/45 max-w-2xl mx-auto">
            {t(
              "home_features_note_rlusd",
              "Note : la base est stable en USD. Le règlement on-chain passe via RLUSD (stablecoin USD régulé sur XRPL)."
            )}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((item) => (
            <div
              key={item.key}
              className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex items-center justify-center w-9 h-9 rounded-lg bg-xcannes-green/10 border border-xcannes-green/20 text-xcannes-green">
                  {item.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">
                    {item.title}
                  </div>
                  <div className="mt-1 text-sm text-white/60 leading-relaxed">
                    {item.desc}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Link
                  href={item.ctaHref}
                  className={bankButtonClassName({
                    tone: item.ctaHref === "/dex" ? "green" : "blue",
                    variant: "soft",
                    size: "sm",
                  })}
                >
                  {item.cta}
                  <span className="inline-block ml-2 text-xs">→</span>
                </Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
