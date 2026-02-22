import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";
import Image from "next/image";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const appStoreBadgeSrc =
    "https://tools.applemediaservices.com/api/badges/download-on-the-app-store/black/fr-fr?size=250x83";
  const googlePlayBadgeSrc =
    "https://play.google.com/intl/en_us/badges/static/images/badges/fr_badge_web_generic.png";

  return (
    <section id="demo" className="relative py-24 pt-16 md:pt-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center">
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(
              "home_v2_demo_title",
              "Une interface de compte, en multi‑devises."
            )}
          </h2>
          <p className="text-lg sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto italic">
            {t(
              "home_v2_demo_subtitle",
              "Les essentiels, au quotidien."
            )}
          </p>
        </div>

        <div className="mt-12 grid lg:grid-cols-[1.05fr_0.95fr] gap-10 lg:gap-0 items-start">
          <div className="flex flex-col gap-8 lg:pr-10 lg:border-r lg:border-white/10 order-2 lg:order-1">
            <div className="order-1 lg:order-2">
              <WalletEssentialsCards variant="home" />
            </div>
            
            {/* Bloc de téléchargement mobile - affiché après les cartes sur mobile */}
            <div className="md:hidden order-2 flex flex-col items-center justify-center gap-4 text-center mt-6">
              <p className="text-sm text-white/70">
                {t(
                  "home_v2_hero_store_cta_hint",
                  "Téléchargez l'application XCANNES sur votre mobile."
                )}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-4">
                <a
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                  aria-label={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                >
                  <Image
                    src={appStoreBadgeSrc}
                    alt={t("home_v2_hero_app_store_aria", "Télécharger XCANNES sur l'App Store")}
                    className="h-12 w-auto"
                    width={250}
                    height={83}
                    loading="lazy"
                    unoptimized
                  />
                </a>

                <a
                  href="#"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex"
                  aria-label={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                >
                  <Image
                    src={googlePlayBadgeSrc}
                    alt={t("home_v2_hero_google_play_aria", "Télécharger XCANNES sur Google Play")}
                    className="h-[60px] w-auto"
                    width={646}
                    height={250}
                    loading="lazy"
                    unoptimized
                  />
                </a>
              </div>
            </div>

          </div>

	          <div className="bg-black/15 overflow-hidden rounded-md order-1 lg:order-2">
	            <div className="lg:pl-10">
	            <div className="h-[680px] md:h-[720px] overflow-hidden">
	              <DemoWalletDashboard
	                defaultWalletId="A"
	                theme="home"
                showWalletSwitcher={false}
                allowBackgroundScrollOnMobile
              />
            </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
