import { useTranslation } from "next-i18next";

export default function RoadmapDistributionSection() {
  const { t } = useTranslation("common");

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-5xl mx-auto">
        <h2 className="text-3xl sm:text-4xl font-orbitron font-[500] mb-3 animate-slide-down bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
          {t("roadmap_title_part1")}{" "}
          <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
            {t("roadmap_title_highlight")}
          </span>
        </h2>

        <p className="text-base sm:text-lg text-white/80 font-[400] mb-10 sm:mb-12 animate-fade-in">
          {t("roadmap_description")}
        </p>

        {/* Section 1-2-3: Supply fixe, Utilité, Évolutif */}
        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 text-left mb-10">
          {/* Section 1 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border-l-4 border-xcannes-green rounded-lg p-5 group hover:shadow-xcannes-green/20 transition-all duration-300">
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              01
            </div>
            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("roadmap_section1_title")}
            </h3>
            <p className="relative text-sm text-white/70">
              {t("roadmap_section1_desc")}
            </p>
          </div>

          {/* Section 2 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border-l-4 border-xcannes-green rounded-lg p-5 group transition-all duration-300">
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              02
            </div>
            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("roadmap_section2_title")}
            </h3>
            <p className="relative text-sm text-white/70">
              {t("roadmap_section2_desc")}
            </p>
          </div>

          {/* Section 3 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border-l-4 border-xcannes-green rounded-lg p-5 group transition-all duration-300">
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              03
            </div>
            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("roadmap_section3_title")}
            </h3>
            <p className="relative text-sm text-white/70">
              {t("roadmap_section3_desc")}
            </p>
          </div>
        </div>

        {/* Résumé simple - 4 items */}
        <div className="bg-xcannes-background border border-white/10 rounded-lg p-6 shadow-2xl">
          <h3 className="text-2xl sm:text-3xl text-xcannes-green font-orbitron font-[500] text-center mb-8">
            {t("roadmap_summary_title")}
          </h3>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 text-left">
            {/* Item 1 */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/10 hover:border-white/10 transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-xcannes-green/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🔒</span>
                </div>
                <div>
                  <h4 className="text-base font-[500] text-xcannes-green mb-1">
                    {t("roadmap_summary_item1_label")}
                  </h4>
                  <p className="text-sm text-white/70">
                    {t("roadmap_summary_item1_desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Item 2 */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/10 hover:border-white/10 transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-xcannes-green/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">📊</span>
                </div>
                <div>
                  <h4 className="text-base font-[500] text-xcannes-green mb-1">
                    {t("roadmap_summary_item2_label")}
                  </h4>
                  <p className="text-sm text-white/70">
                    {t("roadmap_summary_item2_desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Item 3 */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/10 hover:border-white/10 transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-xcannes-green/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">💳</span>
                </div>
                <div>
                  <h4 className="text-base font-[500] text-xcannes-green mb-1">
                    {t("roadmap_summary_item3_label")}
                  </h4>
                  <p className="text-sm text-white/70">
                    {t("roadmap_summary_item3_desc")}
                  </p>
                </div>
              </div>
            </div>

            {/* Item 4 */}
            <div className="bg-black/30 backdrop-blur-sm rounded-lg p-5 border border-white/10 hover:border-white/10 transition-all duration-300">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 bg-xcannes-green/30 rounded-lg flex items-center justify-center flex-shrink-0">
                  <span className="text-lg">🚀</span>
                </div>
                <div>
                  <h4 className="text-base font-[500] text-xcannes-green mb-1">
                    {t("roadmap_summary_item4_label")}
                  </h4>
                  <p className="text-sm text-white/70">
                    {t("roadmap_summary_item4_desc")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
