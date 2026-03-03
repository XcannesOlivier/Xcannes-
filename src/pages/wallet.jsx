"use client";

import { useEffect, useRef, useState } from "react";
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

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("wallet-page");
    if (isEmbedded) document.body.classList.add("wallet-embedded");
    return () => {
      document.body.classList.remove("wallet-page");
      document.body.classList.remove("wallet-embedded");
    };
  }, [isEmbedded]);

  // ── Auto-lock: disconnect wallet when leaving this page ────
  // 1) Navigation away (cleanup runs when component unmounts)
  // 2) Tab switch / minimize (visibilitychange → hidden)
  // Embedded PWA mode is excluded — the PWA handles its own lock.
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;

  useEffect(() => {
    if (isEmbedded) return;

    // When the user switches tabs or minimizes the browser, disconnect
    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && isConnectedRef.current) {
        disconnectRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      // Component unmounting (navigating away) → disconnect
      if (isConnectedRef.current) {
        disconnectRef.current();
      }
    };
  }, [isEmbedded]);

  // ── Inactivity auto-lock: 5 min without interaction → disconnect ──
  useEffect(() => {
    if (isEmbedded) return;

    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
    let timer = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      if (!isConnectedRef.current) return;
      timer = setTimeout(() => {
        if (isConnectedRef.current) {
          disconnectRef.current();
        }
      }, INACTIVITY_MS);
    };

    const events = ["click", "scroll", "keydown", "touchstart", "mousemove"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    // Start the timer immediately
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
    };
  }, [isEmbedded, isConnected]);

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

	      <main className={`h-[100svh] overflow-hidden md:min-h-screen md:h-screen bg-[#0b0f10] text-white font-montserrat${isEmbedded ? " pwa-embedded-main" : ""}`}>
	        <div className={`w-full ${isEmbedded ? "" : "md:max-w-5xl lg:max-w-[1600px]"} h-full mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6`}>
	          <div className={`bg-[#0b0f10] h-full overflow-hidden ${isEmbedded ? "" : "border-0 rounded-none md:border md:border-white/10 md:rounded-xl lg:shadow-[0_0_28px_rgba(0,0,0,0.35)]"}`}>
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
