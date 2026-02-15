"use client";

import { useEffect } from "react";
import Link from "next/link";
	import { useTranslation } from "next-i18next";
	import { getPageTranslations } from "@/i18n/getPageTranslations";
	import WalletDashboard from "@/components/wallet/WalletDashboard";
	import SEOHead from "@/components/layout/SEOHead";
	import { useXumm } from "@/context/XummContext";

export default function Wallet() {
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("wallet-page");
    return () => {
      document.body.classList.remove("wallet-page");
    };
  }, []);

  return (
    <>
      <SEOHead
        title={t("wallet_page_title", "Wallet - XCANNES")}
        description={t(
          "wallet_page_description",
          "Manage your XRPL wallet, trustlines, and assets on XCANNES"
        )}
      />

      <div className="hidden md:flex fixed top-5 left-6 z-40">
        <Link href="/" className="header-nav-link header-nav-link-compact text-white/70 group relative">
          <span aria-hidden="true" className="header-nav-arrow wallet-edge-arrow">‹</span>
          <span className="pointer-events-none absolute left-0 top-full mt-2 whitespace-nowrap rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs text-white/80 opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
            {t("nav_home", "Page d'accueil")}
          </span>
        </Link>
      </div>

      <main className="min-h-[100svh] h-auto overflow-visible md:min-h-screen md:h-screen md:overflow-hidden bg-elevated text-white font-montserrat">
        <div className="w-full md:max-w-5xl lg:max-w-[1600px] min-h-[100svh] h-auto md:h-full md:min-h-0 mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6">
          <div className="bg-elevated min-h-[100svh] h-auto overflow-visible md:h-full md:min-h-0 md:overflow-hidden border-0 rounded-none md:border md:border-white/15 md:rounded-xl lg:shadow-[0_0_28px_rgba(22,163,74,0.12)]">
            <WalletDashboard
              preview={!isConnected}
              variant="full"
              showDesktopStatement
              qrSizingVariant="dex"
              showMobileHomeLink
              allowBackgroundScrollOnMobile
            />
          </div>
        </div>
      </main>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"])),
    },
  };
}
