import "@/styles/globals.css";
import "@/styles/animations.css";
import "@/styles/wallet-actions.css";
import { appWithTranslation } from "next-i18next";
import nextI18NextConfig from "../../next-i18next.config";
import { XummProvider, useXumm } from "@/context/XummContext";
import { XcannesWSProvider } from "@/context/XcannesWSContext"; // ✅ WebSocket centralisé
import XummQRModal from "@/components/xumm/XummQRModal";

function XummModalLayer({ children }) {
  const { qrModalData, closeQrModal } = useXumm();

  const isOpen = Boolean(qrModalData && (qrModalData.visible ?? true));

  return (
    <>
      {children}
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
