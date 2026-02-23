import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";

export default function WalletProductSection() {
  const { t } = useTranslation("common");

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
