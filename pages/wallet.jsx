"use client";

import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import WalletDashboard from "../components/WalletDashboard";
import SEOHead from "../components/SEOHead";
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
      
      <div className="min-h-screen bg-black text-white font-montserrat">
        <WalletDashboard preview={!isConnected} />
      </div>
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
