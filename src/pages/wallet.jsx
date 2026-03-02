"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
		import { useTranslation } from "next-i18next";
		import { getPageTranslations } from "@/i18n/getPageTranslations";
		import WalletDashboard from "@/components/wallet/WalletDashboard";
		import WalletConnectScreen from "@/components/wallet/WalletConnectScreen";
		import SEOHead from "@/components/layout/SEOHead";
		import { useWallet } from "@/context/WalletContext";

/** Detect PWA embedded mode (?embedded=pwa) */
function useIsEmbedded() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEmbedded(params.get("embedded") === "pwa" || !!window.__XCANNES_PWA_EMBEDDED__);
  }, []);
  return embedded;
}

export default function Wallet() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { isConnected, isSessionReady, disconnect } = useWallet();
  const isEmbedded = useIsEmbedded();

  // Déconnexion automatique du wallet quand l'utilisateur quitte la page /wallet
  useEffect(() => {
    const handleRouteChange = (url) => {
      // Si la nouvelle URL n'est pas /wallet, déconnecter
      const targetPath = url.split("?")[0].replace(/\/$/, "") || "/";
      if (targetPath !== "/wallet") {
        disconnect();
      }
    };

    router.events.on("routeChangeStart", handleRouteChange);
    return () => {
      router.events.off("routeChangeStart", handleRouteChange);
    };
  }, [router.events, disconnect]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("wallet-page");
    if (isEmbedded) document.body.classList.add("wallet-embedded");
    return () => {
      document.body.classList.remove("wallet-page");
      document.body.classList.remove("wallet-embedded");
    };
  }, [isEmbedded]);

  // In embedded mode, don't redirect — wait for PWA to provide wallet via postMessage
  // Non-embedded, non-connected: show WalletConnectScreen (no redirect)

  if (!isSessionReady) {
    // In embedded mode, show a loading state while waiting for PWA init
    if (isEmbedded) {
      return (
        <main className="min-h-[100svh] flex items-center justify-center bg-[#0b0f10] text-white">
          <div className="animate-pulse text-white/40 text-sm">Chargement du wallet…</div>
        </main>
      );
    }
    return null;
  }

  // Not connected: show wallet-app style connect screen with QR code
  if (!isConnected && !isEmbedded) {
    return (
      <>
        <SEOHead
          title={t("wallet_page_title", "Wallet - XCANNES")}
          description={t(
            "wallet_page_description",
            "Manage your XRPL wallet, trustlines, and assets on XCANNES"
          )}
        />
        <WalletConnectScreen />
      </>
    );
  }

  return (
    <>
      {/* Hide SEO head and nav in embedded mode */}
      {!isEmbedded && (
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
        </>
      )}

	      <main className={`min-h-[100svh] h-auto overflow-visible md:min-h-screen md:h-screen md:overflow-hidden bg-[#0b0f10] text-white font-montserrat${isEmbedded ? " pwa-embedded-main" : ""}`}>
	        <div className={`w-full ${isEmbedded ? "" : "md:max-w-5xl lg:max-w-[1600px]"} min-h-[100svh] h-auto md:h-full md:min-h-0 mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6`}>
	          <div className={`bg-[#0b0f10] min-h-[100svh] h-auto overflow-visible md:h-full md:min-h-0 md:overflow-hidden ${isEmbedded ? "" : "border-0 rounded-none md:border md:border-white/10 md:rounded-xl lg:shadow-[0_0_28px_rgba(0,0,0,0.35)]"}`}>
	            <WalletDashboard
	              variant={isEmbedded ? "full" : "full"}
              showDesktopStatement={!isEmbedded}
              qrSizingVariant="dex"
              showMobileHomeLink={!isEmbedded}
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
