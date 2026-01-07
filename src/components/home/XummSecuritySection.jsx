	import { useEffect, useState } from "react";
	import { createPortal } from "react-dom";
	import { useTranslation } from "next-i18next";
	import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

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
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 13l2 2 7-7" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 22A10 10 0 1 0 2 12" />
        </svg>
      ),
      gradient: "bg-xcannes-background",
      borderColor: "border-white/10",
      hoverBorder: "hover:border-white/10",
      iconBg: "bg-transparent",
      iconColor: "text-white",
      glowColor: "",
    },
  ];

  return (
    <section id="security" className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
            {t("home_v2_security_badge", "Sécurité & contrôle")}
          </p>
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t("home_v2_security_title", "Vous validez. Vous gardez le contrôle.")}
          </h2>
          <p className="text-base sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto">
            {t(
              "home_v2_security_subtitle",
              "Validation via l’app Xaman (ex‑XUMM). Chaque action est signée sur votre appareil."
            )}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          {features.map((feature) => (
            <div
              key={feature.id}
              className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-6"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex items-center justify-center w-10 h-10 rounded-lg bg-white/5 border border-white/10 text-white/85">
                  {feature.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-white/90">
                    {t(`home_v2_security_feature_${feature.id}_title`, feature.id)}
                  </div>
                  <div className="mt-1 text-sm text-white/60 leading-relaxed">
                    {t(`home_v2_security_feature_${feature.id}_desc`, "")}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={() => setDetailsOpen(true)}
            className={bankButtonClassName({
              tone: "neutral",
              variant: "soft",
              size: "md",
            })}
          >
            {t("home_v2_security_cta_details", "Détails")}
            <span className="inline-block ml-2 text-xs">→</span>
          </button>
          <a
            href="https://xumm.app"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-white/60 hover:text-white transition-colors"
          >
            {t("home_v2_security_cta_install", "Installer l’app")}
          </a>
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
                      {t("home_v2_security_modal_title", "Détails sécurité & validation")}
                    </h4>
                    <p className="mt-1 text-sm text-white/65">
                      {t(
                        "home_v2_security_modal_subtitle",
                        "Vous gardez le contrôle : validation biométrique et signature explicite."
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailsOpen(false)}
                    className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors"
                    aria-label={t("home_v2_security_modal_close", "Fermer")}
                  >
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {[
                    {
                      n: "01",
                      title: t("home_v2_security_step_1_title", "Connexion sécurisée"),
                      desc: t(
                        "home_v2_security_step_1_desc",
                        "Scannez le QR code depuis l’app de validation, sans partager de clé privée."
                      ),
                    },
                    {
                      n: "02",
                      title: t("home_v2_security_step_2_title", "Vérifiez et signez"),
                      desc: t(
                        "home_v2_security_step_2_desc",
                        "Vous voyez ce que vous validez, puis vous signez avec biométrie."
                      ),
                    },
                    {
                      n: "03",
                      title: t("home_v2_security_step_3_title", "Confirmation"),
                      desc: t(
                        "home_v2_security_step_3_desc",
                        "Vous recevez une confirmation en quelques secondes."
                      ),
                    },
                  ].map((s) => (
                    <div
                      key={s.n}
                      className="rounded-xl bg-black/25 border border-white/10 px-4 py-3"
                    >
                      <div className="flex items-start gap-3">
                        <div className="text-white/70 font-semibold text-xs pt-0.5">
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
                      tone: "neutral",
                      variant: "soft",
                      size: "md",
                    })}
                  >
                    {t("home_v2_security_modal_cta_install", "Installer l’app")}
                    <span className="inline-block ml-2 text-xs">→</span>
                  </a>
                  <div className="text-xs text-white/45">
                    {t(
                      "home_v2_security_modal_note",
                      "Conseil : prenez le temps de vérifier chaque écran avant validation."
                    )}
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
