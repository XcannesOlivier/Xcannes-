import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const mobileCardsRef = useRef(null);
  const [mobileCardsVisible, setMobileCardsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const el = mobileCardsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setMobileCardsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.05, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="demo" className="relative">

      {/* ===== Titre (commun mobile + desktop) ===== */}
      <div className="pt-16 md:pt-24 px-4 sm:px-6">
        <div className="relative max-w-7xl mx-auto text-center">
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
      </div>

      {/* ===== MOBILE : stacked sticky layout ===== */}
      <div className="lg:hidden">
        {/* Wallet demo – sticky, reste derrière */}
        <div className="sticky top-0 z-[1] bg-[#0b0f10]">
          <div className="px-4 sm:px-6 pt-8 pb-4">
            <div className="relative max-w-7xl mx-auto">
              <div className="bg-black/15 overflow-hidden rounded-md">
                <div className="h-[680px] md:h-[720px] overflow-hidden">
                  <DemoWalletDashboard
                    defaultWalletId="A"
                    allowBackgroundScrollOnMobile
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Cartes explicatives – scrollent par-dessus le wallet demo */}
        <div className="sticky-layer--cover relative z-[2] bg-[#0b0f10] overflow-x-hidden">
          <div
            ref={mobileCardsRef}
            className={`px-4 sm:px-6 pt-6 pb-16 mobile-cards-slide-in${mobileCardsVisible ? ' is-visible' : ''}`}
          >
            <div className="relative max-w-7xl mx-auto">
              <WalletEssentialsCards variant="home" />
            </div>
          </div>
        </div>
      </div>

      {/* ===== DESKTOP : layout grid côte à côte (inchangé) ===== */}
      <div className="hidden lg:block px-4 sm:px-6 pb-24">
        <div className="relative max-w-7xl mx-auto">
          <div className="mt-12 grid lg:grid-cols-[1.05fr_0.95fr] lg:gap-0 items-start">
            <div className="flex flex-col gap-8 lg:pr-10 lg:border-r lg:border-white/10">
              <WalletEssentialsCards variant="home" />
            </div>

            <div className="bg-black/15 overflow-hidden rounded-md">
              <div className="lg:pl-10">
                <div className="h-[720px] overflow-hidden">
                  <DemoWalletDashboard
                    defaultWalletId="A"
                    allowBackgroundScrollOnMobile
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </section>
  );
}
