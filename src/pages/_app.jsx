import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/wallet-actions.css";
import { appWithTranslation } from "next-i18next";
import nextI18NextConfig from "../../next-i18next.config";
import { NativeWalletProvider } from "@/context/NativeWalletContext";
import { PwaEmbeddedProvider } from "@/context/PwaEmbeddedContext";
import { WalletProviderSwitch } from "@/context/WalletContext";
import { XcannesWSProvider } from "@/context/XcannesWSContext"; // ✅ WebSocket centralisé
import WalletRelayQRModal from "@/components/wallet/WalletRelayQRModal";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function App({ Component, pageProps }) {
  const router = useRouter();
  const [isRouteChanging, setIsRouteChanging] = useState(false);
  const [transitionDirection, setTransitionDirection] = useState("from-right");

  useEffect(() => {
    if (!router?.events) return;
    const normalizePath = (value) => {
      if (!value) return "";
      try {
        const url = new URL(String(value), window.location.origin);
        return url.pathname;
      } catch {
        return String(value).split("?")[0].split("#")[0];
      }
    };
    const stripLocalePrefix = (path) => {
      const normalized = normalizePath(path);
      const locales = router?.locales || [];
      for (const locale of locales) {
        const prefix = `/${locale}`;
        if (normalized === prefix) return "/";
        if (normalized.startsWith(`${prefix}/`)) {
          return normalized.slice(prefix.length) || "/";
        }
      }
      return normalized || "/";
    };

    let safetyTimer;
    const handleStart = (url) => {
      setIsRouteChanging(true);
      const fromPath = stripLocalePrefix(router.asPath || "/");
      const toPath = stripLocalePrefix(url || "/");
      if (fromPath === "/" && toPath === "/wallet") {
        setTransitionDirection("from-left");
      } else if (toPath === "/" && fromPath === "/wallet") {
        setTransitionDirection("from-left");
      } else {
        setTransitionDirection("from-right");
      }
      // Sécurité : si la transition se bloque (CDN lent, fetch échoué),
      // force la fin de l'animation après 1.5s pour ne pas rester bloqué
      if (safetyTimer) clearTimeout(safetyTimer);
      safetyTimer = setTimeout(() => setIsRouteChanging(false), 1500);
    };
    const handleEnd = () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      setIsRouteChanging(false);
    };
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleEnd);
    router.events.on("routeChangeError", handleEnd);
    return () => {
      if (safetyTimer) clearTimeout(safetyTimer);
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleEnd);
      router.events.off("routeChangeError", handleEnd);
    };
  }, [router?.events, router.asPath, router?.locales]);

  return (
    <NativeWalletProvider>
      <PwaEmbeddedProvider>
        <WalletProviderSwitch>
          <XcannesWSProvider>
            <WalletRelayQRModal />
            <div className="font-sans">
              <div
                className={`page-transition page-transition--${transitionDirection}${
                  isRouteChanging ? " page-transition--exit" : ""
                }`}
              >
                <Component {...pageProps} />
              </div>
            </div>
          </XcannesWSProvider>
        </WalletProviderSwitch>
      </PwaEmbeddedProvider>
    </NativeWalletProvider>
  );
}

export default appWithTranslation(App, nextI18NextConfig); // ✅ conserve la trad
/* rebuild 20260227-2324 */
