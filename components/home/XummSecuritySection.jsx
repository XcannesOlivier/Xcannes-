import { useTranslation } from "next-i18next";
import Image from "next/image";

export default function XummSecuritySection() {
  const { t } = useTranslation("common");

  const features = [
    {
      id: "non_custodial",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-transparent",
      iconColor: "text-white",
      glowColor: "",
    },
    {
      id: "biometric",
      icon: (
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" />
        </svg>
      ),
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-transparent",
      iconColor: "text-white",
      glowColor: "",
    },
    {
      id: "xrpl_native",
      icon: (
        <div className="relative w-20 h-20 rounded-xl overflow-hidden">
          <Image 
            src="/images/xrpl.png" 
            alt="XRPL Logo"
            fill
            className="object-contain"
          />
        </div>
      ),
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-transparent",
      iconColor: "",
      glowColor: "",
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-orbitron font-[500] mb-3 animate-slide-down bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
            {t("xumm_section_title_part1")}{" "}
            <span className="bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent">
              {t("xumm_section_title_highlight")}
            </span>
          </h2>
          
          <p className="text-base sm:text-lg text-white/80 font-[400] mb-6 animate-fade-in max-w-3xl mx-auto">
            {t("xumm_section_description")}
          </p>
        </div>

        {/* Main Content - Split Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-12">
          
          {/* Left: Xumm Logo/Visual */}
          <div className="relative">
            <div className="relative bg-xcannes-background border border-white/10 rounded-lg overflow-hidden shadow-2xl">
              
              {/* Background Image - Xumm - Plus nette */}
              <div className="relative w-full h-[400px]">
                <Image 
                  src="/images/xumm.jpg" 
                  alt="Xumm Wallet Background"
                  fill
                  className="object-cover"
                  priority
                  quality={100}
                  unoptimized
                />
                
                {/* Gradient overlay minimal pour texte */}
                <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/40" />
                
                {/* Titre en haut */}
                <div className="absolute top-8 left-0 right-0 text-center">
                  <h3 className="text-4xl font-bold text-white mb-2 drop-shadow-[0_4px_16px_rgba(0,0,0,1)]">Xumm Wallet</h3>
                  <p className="text-white font-medium text-lg drop-shadow-[0_2px_12px_rgba(0,0,0,1)]">{t("xumm_tagline")}</p>
                </div>

                {/* Trust indicators en bas - intégrés dans l'image */}
                <div className="absolute bottom-8 left-0 right-0">
                  <div className="flex justify-center gap-8">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">500K+</div>
                      <div className="text-xs text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">{t("xumm_users")}</div>
                    </div>
                    <div className="w-px bg-white/40 shadow-lg"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">XRPL</div>
                      <div className="text-xs text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">{t("xumm_native")}</div>
                    </div>
                    <div className="w-px bg-white/40 shadow-lg"></div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-white drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">100%</div>
                      <div className="text-xs text-white/90 drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">{t("xumm_security")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: How it works */}
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-xcannes-green mb-6">
              {t("xumm_how_it_works")}
            </h3>

            {/* Step 1 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-xcannes-green/30 rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-xl font-bold text-xcannes-green">1</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {t("xumm_step1_title")}
                </h4>
                <p className="text-white/60 leading-relaxed">
                  {t("xumm_step1_desc")}
                </p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-xcannes-green/30 rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-xl font-bold text-xcannes-green">2</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {t("xumm_step2_title")}
                </h4>
                <p className="text-white/60 leading-relaxed">
                  {t("xumm_step2_desc")}
                </p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-12 h-12 bg-xcannes-green/30 rounded-xl flex items-center justify-center border border-white/10">
                <span className="text-xl font-bold text-xcannes-green">3</span>
              </div>
              <div>
                <h4 className="text-lg font-semibold text-white mb-2">
                  {t("xumm_step3_title")}
                </h4>
                <p className="text-white/60 leading-relaxed">
                  {t("xumm_step3_desc")}
                </p>
              </div>
            </div>

            {/* CTA */}
            <div className="pt-4">
              <a
                href="https://xumm.app"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-6 py-3 bg-xcannes-green hover:bg-xcannes-green/90 text-white font-semibold rounded-lg transition-all duration-300 hover:-translate-y-0.5"
              >
                {t("xumm_download_cta")}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                </svg>
              </a>
            </div>
          </div>
        </div>

        {/* Security Features Grid */}
        <div className="grid md:grid-cols-3 gap-6 mb-10">
          {features.map((feature) => (
            <div
              key={feature.id}
              className={`group relative ${feature.gradient} text-white/90 shadow-2xl border ${feature.borderColor} ${feature.hoverBorder} rounded-lg p-6 transition-all duration-300 hover:shadow-2xl ${feature.glowColor} hover:-translate-y-1`}
            >
              {/* Icon */}
              <div className={`w-14 h-14 ${feature.iconBg} rounded-lg flex items-center justify-center mb-4 ${feature.iconColor} shadow-lg transition-transform duration-300 group-hover:scale-110`}>
                {feature.icon}
              </div>

              {/* Title */}
              <h4 className="text-xl font-bold text-xcannes-green mb-2">
                {t(`xumm_feature_${feature.id}_title`)}
              </h4>

              {/* Description */}
              <p className="text-white/60 leading-relaxed text-sm">
                {t(`xumm_feature_${feature.id}_desc`)}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Info Banner */}
        <div className="bg-xcannes-background border border-white/10 rounded-lg p-6 shadow-2xl">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <h4 className="text-base font-semibold text-white/90 mb-2">
                {t("xumm_info_title")}
              </h4>
              <p className="text-white/70 leading-relaxed text-sm">
                {t("xumm_info_desc")}
              </p>
            </div>
          </div>
        </div>

      </div>
    </section>
  );
}
