import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/wallet-actions.css";
import { appWithTranslation } from "next-i18next";
import nextI18NextConfig from "../../next-i18next.config";
import { XummProvider, useXumm } from "@/context/XummContext";
import { XcannesWSProvider } from "@/context/XcannesWSContext"; // ✅ WebSocket centralisé
import XummQRModal from "@/components/xumm/XummQRModal";
import { useRouter } from "next/router";
import { useEffect, useState } from "react";

function XummModalLayer({ children }) {
  const { qrModalData, closeQrModal } = useXumm();
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);

  const isOpen = Boolean(qrModalData && (qrModalData.visible ?? true));
  const isWalletRoute = router.pathname === "/wallet";

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
        />
      ) : null}
    </>
  );
}

function App({ Component, pageProps }) {
  return (
    <XummProvider>
      <XcannesWSProvider>
        <XummModalLayer>
          <Component {...pageProps} />
        </XummModalLayer>
      </XcannesWSProvider>
    </XummProvider>
  );
}

export default appWithTranslation(App, nextI18NextConfig); // ✅ conserve la trad
