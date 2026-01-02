"use client";

import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import WalletDashboard from "../components/componentsGlobal/WalletDashboard";
import SEOHead from "../components/componentsGlobal/SEOHead";
import { useXumm } from "../context/XummContext";

export default function Wallet() {
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();

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
        <div className="w-full md:max-w-5xl h-[100svh] md:h-full md:min-h-0 mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6">
          <div className="bg-elevated backdrop-blur-sm h-[100svh] overflow-hidden md:h-full md:min-h-0 md:overflow-hidden border-0 rounded-none md:border md:border-white/15 md:rounded-xl">
            <WalletDashboard preview={!isConnected} variant="full" />
          </div>
        </div>
      </main>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
