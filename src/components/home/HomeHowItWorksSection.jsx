	import Link from "next/link";
	import { useTranslation } from "next-i18next";
	import PriceTicker from "@/components/marketGlobal/PriceTicker";
	import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function HomeHowItWorksSection({ pairs = [] }) {
  const { t } = useTranslation("common");

  return (
    <section id="infrastructure" className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div>
            <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
              {t("home_v2_infra_badge", "Infrastructure (optionnel)")}
            </p>
            <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
              {t("home_v2_infra_title", "Infrastructure (détails)")}
            </h2>
            <p className="mt-3 text-sm sm:text-base text-white/65 max-w-xl">
              {t(
                "home_v2_infra_subtitle",
                "Pour les profils experts : règlement, unité stable, sources de prix."
              )}
            </p>

            <div className="mt-8">
              <Link
                href="/whitepaper"
                className={bankButtonClassName({ tone: "neutral", variant: "soft", size: "md" })}
              >
                {t("home_v2_infra_cta", "Lire l’architecture")}
                <span className="inline-block ml-2 text-xs">→</span>
              </Link>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl px-5 py-5 min-w-0">
            {Array.isArray(pairs) && pairs.length > 0 && (
              <div className="mb-4">
                <p className="text-[11px] uppercase tracking-[0.25em] text-white/50 mb-2">
                  {t("home_v2_infra_ticker_label", "Marchés (secondaire)")}
                </p>
                <div className="rounded-xl overflow-hidden border border-white/10 min-w-0 max-w-full">
                  <PriceTicker
                    pairs={pairs}
                    fixed={false}
                    mobileVariant="scroll"
                    backgroundClass="bg-black/10 border-b border-white/10"
                  />
                </div>
              </div>
            )}
            <div className="space-y-3 text-sm text-white/65">
              {[
                t("home_v2_infra_point1", "Règlement : XRPL"),
                t("home_v2_infra_point2", "Unité stable : RLUSD"),
                t("home_v2_infra_point3", "Sources de prix : Pyth + FX EOD (fallback)"),
                t("home_v2_infra_point4", "Marchés : DEX + données temps réel (WebSocket)"),
              ].map((line) => (
                <div key={line} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-white/30" />
                  <span>{line}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
