import Link from "next/link";
import { useTranslation } from "next-i18next";
import Image from "next/image";

export default function WhyXcannesSection() {
  const { t } = useTranslation("common");

  const pillars = [
    {
      id: "transparent",
      icon: null,
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-xcannes-green/30",
      iconColor: "text-xcannes-green",
      glowColor: "",
      backgroundImage: true,
      backgroundType: "svg",
      backgroundSvg: (
        <svg className="w-full h-full" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="0.8" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
        </svg>
      ),
    },
    {
      id: "subscription",
      icon: null,
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-xcannes-green/30",
      iconColor: "text-xcannes-green",
      glowColor: "",
      backgroundImage: true,
      backgroundType: "image",
      backgroundSrc: "/images/xrpl.png",
    },
    {
      id: "technology",
      icon: null,
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-white/10",
      iconColor: "",
      glowColor: "",
      backgroundImage: true,
      backgroundType: "image",
      backgroundSrc: "/images/adn.png",
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        {/* Section Title */}
        <h2 className="text-3xl sm:text-4xl font-orbitron font-[500] text-center mb-3 animate-slide-down bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
          {t("why_title_part1")}{" "}
          <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">{t("why_title_highlight")}</span>
          {t("why_title_part2")}
        </h2>
        
        <p className="text-center text-white/80 text-base sm:text-lg mb-10 max-w-2xl mx-auto">
          {t("why_subtitle")}
        </p>

        {/* 3 Pillars Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {pillars.map((pillar) => (
            <div
              key={pillar.id}
              className={`group relative ${pillar.gradient} text-white/90 shadow-2xl border ${pillar.borderColor} ${pillar.hoverBorder} rounded-lg p-6 transition-all duration-300 hover:shadow-2xl ${pillar.glowColor} hover:-translate-y-1 overflow-hidden`}
            >
              {/* Background image ou SVG */}
              {pillar.backgroundImage && (
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                  {pillar.backgroundType === 'svg' ? (
                    <div className="w-full h-full flex items-center justify-end pr-8 pt-8 text-white/30">
                      {pillar.backgroundSvg}
                    </div>
                  ) : (
                    <Image 
                      src={pillar.backgroundSrc} 
                      alt=""
                      fill
                      className="object-contain object-right-top"
                      style={{ transform: 'translate(20%, -10%)' }}
                    />
                  )}
                </div>
              )}

              {/* Icon with glow */}
              {pillar.icon && (
                <div className={`w-16 h-16 ${pillar.iconBg} rounded-xl flex items-center justify-center mb-6 ${pillar.iconColor} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                  {pillar.icon}
                </div>
              )}

              {/* Title */}
              <h3 className={`text-2xl font-bold text-white/90 mb-4 ${pillar.backgroundImage ? 'relative z-10' : ''}`}>
                {t(`why_pillar_${pillar.id}_title`)}
              </h3>

              {/* Description */}
              <p className={`text-white/70 leading-relaxed text-base ${pillar.backgroundImage ? 'relative z-10' : ''}`}>
                {t(`why_pillar_${pillar.id}_description`)}
              </p>

              {/* Key feature highlight with icon */}
              <div className={`mt-6 pt-6 border-t border-white/10 ${pillar.backgroundImage ? 'relative z-10' : ''}`}>
                <div className="flex items-center gap-2 text-sm">
                  <span className="w-2 h-2 rounded-full bg-xcannes-green"></span>
                  <span className="text-white/80 font-medium">
                    {t(`why_pillar_${pillar.id}_highlight`)}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-white/60 mb-6 text-base">
            {t("why_cta_text")}
          </p>
          <Link
            href="/dex"
            className="inline-flex items-center justify-center px-8 py-3 rounded-lg bg-xcannes-green hover:bg-xcannes-green/90 text-white font-semibold text-sm tracking-wide transition-all duration-200 hover:-translate-y-0.5"
          >
            {t("why_cta_button")} →
          </Link>
        </div>
      </div>
    </section>
  );
}
