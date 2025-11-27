import Link from "next/link";
import { useTranslation } from "next-i18next";

export default function TokenomicsSimplified() {
  const { t } = useTranslation("common");

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-orbitron font-[500] mb-3 animate-slide-down bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
            {t("tokenomics_simple_title")}
          </h2>
          
          <p className="text-base sm:text-lg text-white/80 font-[400] mb-6 animate-fade-in">
            {t("tokenomics_simple_description")}
          </p>
        </div>

        {/* Principe principal - GROS highlight */}
        <div className="bg-xcannes-background border border-white/10 rounded-lg p-8 mb-10 text-center shadow-2xl">
          <div className="text-6xl mb-6">🎯</div>
          <h3 className="text-3xl md:text-4xl font-orbitron font-bold text-white mb-4">
            {t("tokenomics_simple_principle")}
          </h3>
          <div className="flex items-center justify-center gap-4 text-5xl md:text-6xl font-orbitron font-bold">
            <span className="text-xcannes-green">1 XCS</span>
            <span className="text-white/40">=</span>
            <span className="text-white">1€</span>
          </div>
          <p className="text-white/60 mt-6 text-lg">
            {t("tokenomics_simple_principle_desc")}
          </p>
        </div>

        {/* Exemples concrets */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {/* Sans XCS */}
          <div className="bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-6 text-center transition-all duration-300">
            <div className="text-4xl mb-4">💳</div>
            <h4 className="text-xl font-bold text-white/90 mb-3">
              {t("tokenomics_example_standard_title")}
            </h4>
            <div className="text-5xl font-orbitron font-bold text-white/60 mb-2">
              29,90€
            </div>
            <p className="text-sm text-white/50">
              {t("tokenomics_example_standard_desc")}
            </p>
          </div>

          {/* Avec 15 XCS */}
          <div className="bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-6 text-center transition-all duration-300">
            <div className="text-4xl mb-4">✨</div>
            <h4 className="text-xl font-bold text-white/90 mb-3">
              {t("tokenomics_example_partial_title")}
            </h4>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-2xl text-white/40 line-through">29,90€</span>
              <span className="text-5xl font-orbitron font-bold text-xcannes-green">14,90€</span>
            </div>
            <p className="text-sm text-white/50">
              {t("tokenomics_example_partial_desc")}
            </p>
          </div>

          {/* Avec 29,90 XCS */}
          <div className="bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-6 text-center relative overflow-hidden transition-all duration-300">
            <div className="absolute top-2 right-2">
              <span className="bg-xcannes-green text-black text-xs font-bold px-3 py-1 rounded-full">
                {t("tokenomics_example_free_badge")}
              </span>
            </div>
            <div className="text-4xl mb-4">🎉</div>
            <h4 className="text-xl font-bold text-white mb-3">
              {t("tokenomics_example_free_title")}
            </h4>
            <div className="flex items-baseline justify-center gap-2 mb-2">
              <span className="text-2xl text-white/40 line-through">29,90€</span>
              <span className="text-5xl font-orbitron font-bold text-xcannes-green">GRATUIT</span>
            </div>
            <p className="text-sm text-white/50">
              {t("tokenomics_example_free_desc")}
            </p>
          </div>
        </div>

        {/* Caractéristiques du XCS */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Supply limité */}
          <div className="bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-6 hover:shadow-xcannes-green/20 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="text-4xl">🔒</div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-xcannes-green mb-2">
                  {t("tokenomics_feature_limited_title")}
                </h4>
                <p className="text-white/60 mb-3">
                  {t("tokenomics_feature_limited_desc")}
                </p>
                <div className="text-3xl font-orbitron font-bold text-xcannes-green">
                  2 006 400 XCS
                </div>
              </div>
            </div>
          </div>

          {/* Jamais consommé */}
          <div className="bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-6 transition-all duration-300">
            <div className="flex items-start gap-4">
              <div className="text-4xl">♻️</div>
              <div className="flex-1">
                <h4 className="text-xl font-bold text-xcannes-green mb-2">
                  {t("tokenomics_feature_reusable_title")}
                </h4>
                <p className="text-white/60 mb-3">
                  {t("tokenomics_feature_reusable_desc")}
                </p>
                <div className="inline-block bg-xcannes-green/20 border border-white/10 rounded-lg px-4 py-2">
                  <span className="text-xcannes-green font-semibold">
                    {t("tokenomics_feature_reusable_highlight")}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA Final */}
        <div className="text-center">
          <p className="text-white/60 mb-6 text-lg">
            {t("tokenomics_simple_cta_text")}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/dex"
              className="inline-block px-8 py-4 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-bold rounded-xl transition-all duration-300 transform hover:scale-105"
            >
              {t("tokenomics_simple_cta_primary")} →
            </Link>
            <Link
              href="/whitepaper"
              className="inline-block px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/10 text-white font-semibold rounded-xl transition-all duration-300"
            >
              {t("tokenomics_simple_cta_secondary")}
            </Link>
          </div>
        </div>

      </div>
    </section>
  );
}
