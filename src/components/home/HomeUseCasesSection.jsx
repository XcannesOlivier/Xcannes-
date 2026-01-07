import { useTranslation } from "next-i18next";

export default function HomeUseCasesSection() {
  const { t } = useTranslation("common");

  const cases = [
    {
      key: "statements",
      title: t("home_v2_essentials_1_title", "Relevés & reçus"),
      desc: t(
        "home_v2_essentials_1_desc",
        "Suivre, prouver et exporter vos mouvements, par devise ou au global."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
      key: "payments",
      title: t("home_v2_essentials_2_title", "Payer / Recevoir"),
      desc: t(
        "home_v2_essentials_2_desc",
        "Demander (QR), recevoir et envoyer en quelques secondes, avec validation explicite."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 17l10-10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M10 7h7v7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "convert",
      title: t("home_v2_essentials_3_title", "Conversion"),
      desc: t(
        "home_v2_essentials_3_desc",
        "Taux affiché clairement avant validation."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M7 7h11l-2-2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 17H6l2 2"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "buy_sell",
      title: t("home_v2_essentials_4_title", "Acheter / Vendre"),
      desc: t(
        "home_v2_essentials_4_desc",
        "Accès fiat selon disponibilité par pays."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
  ];

  return (
    <section className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
            {t("home_v2_essentials_badge", "Essentiels")}
          </p>
          <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
            {t("home_v2_essentials_title", "L’essentiel, au quotidien.")}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
            {t(
              "home_v2_essentials_subtitle",
              "Une interface claire, sérieuse, centrée usage."
            )}
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {cases.map((item) => (
            <div
              key={item.key}
              className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/80">
                  {item.icon}
                </div>
                <div className="text-sm font-semibold text-white/90">
                  {item.title}
                </div>
              </div>
              <p className="mt-3 text-sm text-white/60 leading-relaxed">
                {item.desc}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
