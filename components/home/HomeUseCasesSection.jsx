import { useTranslation } from "next-i18next";

export default function HomeUseCasesSection() {
  const { t } = useTranslation("common");

  const cases = [
    {
      key: "stability",
      title: t("home_usecase_1_title", "Protéger sa valeur en USD"),
      desc: t(
        "home_usecase_1_desc",
        "Rester exposé à la stabilité du dollar tout en conservant une UX en monnaie locale."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path
            d="M12 2v20"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M17 6H9.5a3.5 3.5 0 0 0 0 7H14.5a3.5 3.5 0 0 1 0 7H7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      ),
    },
    {
      key: "payments",
      title: t("home_usecase_2_title", "Paiements & transferts"),
      desc: t(
        "home_usecase_2_desc",
        "Envoyer, recevoir et payer en quelques secondes, avec validation via Xumm."
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
      title: t("home_usecase_3_title", "Conversion simple"),
      desc: t(
        "home_usecase_3_desc",
        "Convertir entre devises avec des taux marché (Pyth/XRPL) et une tarification claire."
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
      key: "markets",
      title: t("home_usecase_4_title", "Marchés en temps réel"),
      desc: t(
        "home_usecase_4_desc",
        "Suivre les variations FX et XRPL, et accéder aux marchés quand vous en avez besoin."
      ),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
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
  ];

  return (
    <section className="relative py-16 md:py-20 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3">
            {t("home_usecases_badge", "Cas d’usage")}
          </p>
          <h2 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
            {t("home_usecases_title", "Une expérience bancaire, une infrastructure moderne.")}
          </h2>
          <p className="mt-3 text-sm sm:text-base text-white/65 max-w-2xl mx-auto">
            {t(
              "home_usecases_subtitle",
              "XCANNES privilégie la clarté, la stabilité et le contrôle utilisateur."
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
                <div className="w-10 h-10 rounded-lg bg-xcannes-green/10 border border-xcannes-green/20 flex items-center justify-center text-xcannes-green">
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

