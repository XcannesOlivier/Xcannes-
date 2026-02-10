"use client";

	import { useEffect } from "react";
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

      <main className="h-[100svh] overflow-hidden md:min-h-screen md:h-screen md:overflow-hidden bg-elevated text-white font-montserrat">
        <div className="w-full md:max-w-5xl lg:max-w-[1600px] h-[100svh] md:h-full md:min-h-0 mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6">
          <div className="bg-elevated h-[100svh] overflow-hidden md:h-full md:min-h-0 md:overflow-hidden border-0 rounded-none md:border md:border-white/15 md:rounded-xl lg:shadow-[0_0_28px_rgba(255,255,255,0.08)]">
            <WalletDashboard
              preview={!isConnected}
              variant="full"
              showDesktopStatement
              qrSizingVariant="dex"
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
