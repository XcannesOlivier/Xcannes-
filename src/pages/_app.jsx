import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/wallet-actions.css";
import { appWithTranslation } from "next-i18next";
import nextI18NextConfig from "../../next-i18next.config";
import { XummProvider } from "@/context/XummContext";
import { NativeWalletProvider } from "@/context/NativeWalletContext";
import { WalletProviderSwitch, useWallet } from "@/context/WalletContext";
import { XcannesWSProvider } from "@/context/XcannesWSContext"; // ✅ WebSocket centralisé
import XummQRModal from "@/components/xumm/XummQRModal";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function XummModalLayer({ children }) {
  const { qrModalData, closeQrModal } = useWallet();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  const isOpen = Boolean(qrModalData && (qrModalData.visible ?? true));
  const isWalletRoute = router.pathname === "/wallet";
  const allowBackgroundScroll = !isDesktop && (qrModalData?.type || "connect") === "connect";

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 1024px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

  const useInlineOnWallet = isWalletRoute && isDesktop;

  return (
    <>
      {children}
      {!useInlineOnWallet ? (
        <XummQRModal
          isOpen={isOpen}
          onClose={closeQrModal}
          uuid={qrModalData?.uuid}
          qrUrl={qrModalData?.qrUrl}
          deepLink={qrModalData?.deepLink}
          type={qrModalData?.type || "connect"}
          status={qrModalData?.status}
          enablePolling={false}
          lockBodyScrollEnabled={!allowBackgroundScroll}
        />
      ) : null}
    </>
  );
}

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
    };
    const handleEnd = () => setIsRouteChanging(false);
    router.events.on("routeChangeStart", handleStart);
    router.events.on("routeChangeComplete", handleEnd);
    router.events.on("routeChangeError", handleEnd);
    return () => {
      router.events.off("routeChangeStart", handleStart);
      router.events.off("routeChangeComplete", handleEnd);
      router.events.off("routeChangeError", handleEnd);
    };
  }, [router?.events, router.asPath, router?.locales]);

  return (
    <XummProvider>
      <NativeWalletProvider>
        <WalletProviderSwitch>
          <XcannesWSProvider>
            <div className="font-sans">
              <XummModalLayer>
                <div
                  key={router.asPath}
                  className={`page-transition page-transition--${transitionDirection}${
                    isRouteChanging ? " page-transition--exit" : ""
                  }`}
                >
                  <Component {...pageProps} />
                </div>
              </XummModalLayer>
            </div>
          </XcannesWSProvider>
        </WalletProviderSwitch>
      </NativeWalletProvider>
    </XummProvider>
  );
}

export default appWithTranslation(App, nextI18NextConfig); // ✅ conserve la trad
/* rebuild 20260227-2324 */
