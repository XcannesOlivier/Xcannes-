import { useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const [demoWalletId, setDemoWalletId] = useState("A");

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6 overflow-hidden">
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
          <div className="flex flex-col gap-8 lg:pr-10 lg:border-r lg:border-white/10">
            <div className="order-1 lg:order-2">
              <WalletEssentialsCards variant="home" />
            </div>

          </div>

          <div className="bg-black/15 overflow-hidden rounded-xl">
            <div className="lg:pl-10">
            <div className="px-5 py-4 border-b border-white/5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base text-white/70 min-w-0">
                  {t("home_v2_demo_preview_title", "Démo interactive (fictive)")}
                </p>
                <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1 flex-shrink-0">
                  {["A", "B"].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDemoWalletId(id)}
                      className={[
                        "px-2.5 md:px-3 py-1.5 text-xs rounded-md transition-colors border",
                        demoWalletId === id
                          ? id === "A"
                            ? "bg-xcannes-green/10 border-xcannes-green/30 text-xcannes-green"
                            : "bg-xcannes-blue-light/10 border-xcannes-blue-light/30 text-xcannes-blue-light"
                          : "border-transparent text-white/60 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="md:hidden">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                      <span className="hidden md:inline">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[680px] md:h-[720px] overflow-hidden">
              <DemoWalletDashboard
                key={demoWalletId}
                defaultWalletId={demoWalletId}
                theme={demoWalletId === "B" ? "dex" : "home"}
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
