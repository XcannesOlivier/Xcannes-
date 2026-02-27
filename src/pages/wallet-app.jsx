"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import Script from "next/script";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import SEOHead from "@/components/layout/SEOHead";

// Dynamic import to avoid SSR issues (WebCrypto, IndexedDB, WebAuthn)
const WalletAppShell = dynamic(
  () => import("@/components/walletApp/WalletAppShell"),
  { ssr: false }
);

export default function WalletAppPage() {
  const { t } = useTranslation("common");
  const [xrplReady, setXrplReady] = useState(
    typeof window !== "undefined" && !!window.xrpl
  );

  // Add body class for styling
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("wallet-app-page");
    return () => document.body.classList.remove("wallet-app-page");
  }, []);

  return (
    <>
      {/* xrpl.js — self-hosted, no external CDN */}
      <Script
        src="/lib/xrpl-4.4.3.min.js"
        strategy="afterInteractive"
        onLoad={() => setXrplReady(true)}
      />
      <SEOHead
        title={t("wallet_app_title", "Xcannes Wallet")}
        description={t(
          "wallet_app_description",
          "Portefeuille XRPL sécurisé avec Face ID et code PIN"
        )}
      />
      <main className="wa-page-root">
        <WalletAppShell />
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
