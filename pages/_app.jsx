import "../styles/globals.css";
import "../styles/animations.css";
import { appWithTranslation } from "next-i18next";
import nextI18NextConfig from "../next-i18next.config";
import { XummProvider } from "../context/XummContext";
import { XcannesWSProvider } from "../context/XcannesWSContext"; // ✅ WebSocket centralisé

function App({ Component, pageProps }) {
  return (
    <XummProvider>
      <XcannesWSProvider>
        <Component {...pageProps} />
      </XcannesWSProvider>
    </XummProvider>
  );
}

export default appWithTranslation(App, nextI18NextConfig); // ✅ conserve la trad
