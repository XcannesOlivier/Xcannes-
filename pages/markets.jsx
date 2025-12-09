"use client";

import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useRouter } from "next/router";
import SEOHead from "../components/SEOHead";
import Link from "next/link";

export default function Markets() {
  const { t } = useTranslation("common");
  const router = useRouter();

  const marketSections = [
    {
      title: t("stable_exchange", "Stablecoins Exchange"),
      description: t("stable_exchange_desc", "Real-time prices from XRPL and Pyth Network"),
      icon: "💱",
      href: "/stable-exchange",
      color: "from-blue-500/20 to-cyan-500/20",
      borderColor: "border-blue-500/30",
    },
    {
      title: t("eod_markets", "EOD Markets"),
      description: t("eod_markets_desc", "Daily closing rates for 170+ currencies"),
      icon: "📊",
      href: "/eod-exchange",
      color: "from-purple-500/20 to-pink-500/20",
      borderColor: "border-purple-500/30",
    },
    {
      title: t("wallet", "Wallet"),
      description: t("wallet_desc", "Manage your XRPL assets, trustlines, and transactions"),
      icon: "👛",
      href: "/wallet",
      color: "from-green-500/20 to-emerald-500/20",
      borderColor: "border-green-500/30",
    },
  ];

  return (
    <>
      <SEOHead 
        title={t("markets_page_title", "Markets - XCANNES")} 
        description={t("markets_page_description", "Access all trading markets and wallet features")} 
      />

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white font-montserrat">
        <div className="max-w-6xl mx-auto px-4 py-20">
          {/* Header */}
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-5xl font-orbitron font-bold text-white mb-4">
              {t("markets_title", "Markets")}
            </h1>
            <p className="text-white/60 text-lg">
              {t("markets_subtitle", "Access all trading markets and wallet features")}
            </p>
          </div>

          {/* Grid de sections */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {marketSections.map((section, index) => (
              <Link
                key={index}
                href={section.href}
                className="group"
              >
                <div
                  className={`h-full bg-gradient-to-br ${section.color} backdrop-blur-sm border ${section.borderColor} rounded-2xl p-6 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-xcannes-green/10`}
                >
                  {/* Icon */}
                  <div className="text-6xl mb-4 group-hover:scale-110 transition-transform duration-300">
                    {section.icon}
                  </div>

                  {/* Title */}
                  <h2 className="text-2xl font-orbitron font-bold text-white mb-3 group-hover:text-xcannes-green transition-colors">
                    {section.title}
                  </h2>

                  {/* Description */}
                  <p className="text-white/70 text-sm mb-4">
                    {section.description}
                  </p>

                  {/* Arrow */}
                  <div className="flex items-center gap-2 text-xcannes-green font-medium text-sm group-hover:gap-4 transition-all">
                    <span>{t("access", "Access")}</span>
                    <span>→</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Info section */}
          <div className="mt-16 bg-slate-800/30 backdrop-blur-sm border border-slate-700 rounded-xl p-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-xcannes-green mb-2">
                  {t("markets_count", "3")}
                </div>
                <div className="text-white/60 text-sm">
                  {t("active_markets", "Active Markets")}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-xcannes-green mb-2">
                  170+
                </div>
                <div className="text-white/60 text-sm">
                  {t("currencies", "Currencies")}
                </div>
              </div>
              <div>
                <div className="text-3xl font-bold text-xcannes-green mb-2">
                  24/7
                </div>
                <div className="text-white/60 text-sm">
                  {t("availability", "Availability")}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
