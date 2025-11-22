import { useTranslation } from "next-i18next";

export default function BuyXCSSection() {
  const { t } = useTranslation("common");

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-5xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-orbitron font-[500] mb-3 animate-slide-down bg-gradient-to-b from-white to-white/70 bg-clip-text text-transparent drop-shadow-[0_2px_8px_rgba(255,255,255,0.3)]">
          {t("buy_title")}
        </h2>

        <p className="text-base sm:text-lg text-white/80 font-[400] mb-10 sm:mb-12 animate-fade-in">
          {t("buy_badge")}
        </p>

        <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 text-left">
          {/* Étape 1 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border-l-4 border-xcannes-green rounded-lg p-5 group transition-all duration-300">
            {/* Gros numéro en arrière-plan */}
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              01
            </div>

            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("buy_step1_title")}
            </h3>
            <p className="relative mb-4 text-sm text-white/70">
              {t("buy_step1_text")}
            </p>
            <div className="relative flex flex-col items-start gap-2">
              <a
                href="https://xumm.app/?lang=en"
                target="_blank"
                rel="noopener noreferrer"
                className="justify-content text-sm font-[500] text-white bg-xcannes-green/80 px-4 py-2 rounded transition transform duration-300 hover:scale-105 text-center"
              >
                {t("buy_step1_button1")}
              </a>
              <a
                href="/activate-wallet"
                className="justify-content text-sm font-[500] text-white bg-xcannes-green/80 px-4 py-2 rounded transition transform duration-300 hover:scale-105 text-center"
              >
                {t("buy_step1_button2")}
              </a>
            </div>
          </div>

          {/* Étape 2 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-5 group transition-all duration-300">
            {/* Gros numéro en arrière-plan */}
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              02
            </div>

            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("buy_step2_title")}
            </h3>
            <p className="relative mb-4 text-sm text-white/70">
              {t("buy_step2_text")}
            </p>
            <a
              href="https://xrpl.services?issuer=rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx&currency=XCS&limit=2006400"
              className="relative inline-block text-sm font-[500] text-white bg-xcannes-green/80 px-4 py-2 rounded transition transform duration-300 hover:scale-105"
            >
              {t("buy_step2_button")}
            </a>
          </div>

          {/* Étape 3 */}
          <div className="relative overflow-hidden bg-xcannes-background text-white/90 shadow-2xl border border-white/10 rounded-lg p-5 group transition-all duration-300">
            {/* Gros numéro en arrière-plan */}
            <div className="absolute -top-4 -right-4 text-[120px] font-orbitron font-bold text-xcannes-green/10 group-hover:text-xcannes-green/20 transition-colors duration-300 select-none">
              03
            </div>

            <h3 className="relative text-lg sm:text-xl text-xcannes-green font-[500] mb-2">
              {t("buy_step3_title")}
            </h3>
            <p className="relative mb-4 text-sm text-white/70">
              {t("buy_step3_text")}
            </p>
            <a
              href="/dex"
              className="relative inline-block text-sm font-[500] text-white bg-xcannes-green/80 px-4 py-2 rounded transition transform duration-300 hover:scale-105"
            >
              {t("buy_step3_button")}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
