import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import Image from "next/image";
import { bankButtonClassName } from "../componentsGlobal/bankButtonClassName";

export default function XummSecuritySection() {
  const { t } = useTranslation("common");
  const [modalRoot, setModalRoot] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const el = document.createElement("div");
    el.id = "xumm-details-modal-root";
    document.body.appendChild(el);
    setModalRoot(el);
    return () => {
      if (document.body.contains(el)) document.body.removeChild(el);
    };
  }, []);

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
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 animate-slide-down text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t("xumm_section_title_part1")}{" "}
            <span className="text-white">
              {t("xumm_section_title_highlight")}
            </span>
          </h2>
          
          <p className="text-base sm:text-lg text-white/80 font-[400] mb-6 animate-fade-in max-w-3xl mx-auto">
            {t("xumm_section_description")}
          </p>
        </div>

        {/* Main Content - Split Layout */}
        <div className="grid lg:grid-cols-2 gap-12 items-start mb-12">
          {/* Left: Clean security panel (no photo) */}
          <div className="relative">
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 md:p-8 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-white/60">
                    {t("xumm_section_badge")}
                  </p>
                  <h3 className="mt-2 text-2xl font-montserrat font-semibold text-white">
                    {t("xumm_section_title_highlight")}
                  </h3>
                  <p className="mt-2 text-sm text-white/65">
                    {t("xumm_tagline")}
                  </p>
                </div>

                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    className="text-white/80"
                  >
                    <path
                      d="M7 7l10 10M17 7L7 17"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
              </div>

              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  "non_custodial",
                  "biometric",
                  "xrpl_native",
                ].map((id) => (
                  <div
                    key={id}
                    className="rounded-xl bg-black/25 border border-white/10 px-4 py-4"
                  >
                    <div className="text-xs font-semibold text-white/85">
                      {t(`xumm_feature_${id}_title`)}
                    </div>
                    <div className="mt-1 text-xs text-white/55 leading-relaxed">
                      {t(`xumm_feature_${id}_desc`)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right: Brief explanation + link to details */}
          <div className="space-y-4">
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">
                {t("xumm_how_it_works")}
              </h3>
              <p className="mt-2 text-sm text-white/65">
                {t(
                  "xumm_brief",
                  "Connexion sécurisée, validation biométrique, règlement rapide — sans partager vos clés."
                )}
              </p>

              <div className="mt-4 space-y-2 text-sm text-white/70">
                <div className="flex items-start gap-3">
                  <span className="text-xcannes-green font-semibold text-xs pt-0.5">
                    01
                  </span>
                  <span>{t("xumm_step1_title")}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xcannes-green font-semibold text-xs pt-0.5">
                    02
                  </span>
                  <span>{t("xumm_step2_title")}</span>
                </div>
                <div className="flex items-start gap-3">
                  <span className="text-xcannes-green font-semibold text-xs pt-0.5">
                    03
                  </span>
                  <span>{t("xumm_step3_title")}</span>
                </div>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setDetailsOpen(true)}
                  className={bankButtonClassName({
                    tone: "neutral",
                    variant: "soft",
                    size: "md",
                  })}
                >
                  {t("xumm_learn_more", "En savoir plus")}
                  <span className="inline-block ml-2 text-xs">→</span>
                </button>
                <a
                  href="https://xumm.app"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-white/60 hover:text-white transition-colors"
                >
                  {t("xumm_download_cta")}
                </a>
              </div>
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

        {modalRoot &&
          detailsOpen &&
          createPortal(
            <div
              className="fixed inset-0 z-[10060] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setDetailsOpen(false);
              }}
            >
              <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#040c13]/95 p-5 shadow-2xl">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h4 className="text-lg font-semibold text-white">
                      {t("xumm_modal_title", "Sécurité & validation Xumm")}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t("xumm_section_description")}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("xumm_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    { n: "01", title: t("xumm_step1_title"), desc: t("xumm_step1_desc") },
                    { n: "02", title: t("xumm_step2_title"), desc: t("xumm_step2_desc") },
                    { n: "03", title: t("xumm_step3_title"), desc: t("xumm_step3_desc") },
                  ].map((s) => (
                    <div
                      key={s.n}
                      className="rounded-xl bg-black/25 border border-white/10 px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-xcannes-green font-semibold text-xs pt-0.5">
                          {s.n}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-white/90">
                            {s.title}
                          </div>
                          <div className="mt-1 text-sm text-white/65">
                            {s.desc}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex items-center justify-between gap-3">
                  <a
                    href="https://xumm.app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className={bankButtonClassName({
                      tone: "green",
                      variant: "soft",
                      size: "md",
                    })}
                  >
                    {t("xumm_download_cta")}
                    <span className="inline-block ml-2 text-xs">→</span>
                  </a>
                  <div className="text-xs text-white/45">
                    {t("xumm_info_title")}
                  </div>
                </div>
              </div>
            </div>,
            modalRoot
          )}

      </div>
    </section>
  );
}
