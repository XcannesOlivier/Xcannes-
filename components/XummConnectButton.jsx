import { useState } from "react";
import { useXumm } from "../context/XummContext";
import { useTranslation } from "next-i18next";
import WalletDashboard from "./WalletDashboard";

export default function XummConnectButton({ small = false }) {
  const { wallet, isConnected, connect, disconnect } = useXumm();
  const { t } = useTranslation("common");
  const [showDashboard, setShowDashboard] = useState(false);

  if (isConnected) {
    return (
      <>
        <div className="inline-flex items-center gap-3">
          {/* Badge connecté - cliquable pour ouvrir dashboard */}
          <button
            onClick={() => setShowDashboard(true)}
            className={`flex items-center gap-3 ${
              small ? "px-4 py-2" : "px-6 py-3"
            } bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg backdrop-blur-sm hover:bg-xcannes-green/20 transition-all duration-200 cursor-pointer group`}
          >
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-xcannes-green animate-pulse" />
              <span
                className={`${
                  small ? "text-xs" : "text-sm"
                } font-medium text-xcannes-green group-hover:text-xcannes-green`}
              >
                {t("wallet_connected")}
              </span>
            </div>
            <span
              className={`${
                small ? "text-xs" : "text-sm"
              } font-mono text-white/60 group-hover:text-white`}
            >
              {wallet.slice(0, 6)}...{wallet.slice(-4)}
            </span>
            <span className="text-white/40 group-hover:text-white text-xs">
              👁️
            </span>
          </button>

          {/* Bouton déconnexion */}
          <button
            onClick={disconnect}
            className={`${
              small ? "px-3 py-2 text-xs" : "px-4 py-3 text-sm"
            } bg-white/5 hover:bg-red-500/20 text-white/70 hover:text-red-400 border border-white/10 hover:border-red-500/40 rounded-lg font-medium transition-all duration-300`}
            aria-label="Se déconnecter du wallet"
          >
            <span className="hidden sm:inline">{t("wallet_disconnect")}</span>
            <span className="sm:hidden">✕</span>
          </button>
        </div>

        {/* Modal Dashboard */}
        {showDashboard && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
            <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              {/* Bouton fermer */}
              <button
                onClick={() => setShowDashboard(false)}
                className="absolute top-4 right-4 z-10 w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 text-white rounded-full transition-all"
                aria-label="Close dashboard"
              >
                ✕
              </button>

              <WalletDashboard />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <button
      onClick={connect}
      className={`${
        small ? "px-4 py-1.5 text-xs" : "px-5 py-2 text-sm"
      } bg-[#3052ff] hover:bg-[#2642d9] text-white font-medium rounded-lg transition-all duration-200`}
      aria-label="Connecter votre wallet XRPL"
    >
      {t("wallet_connect")}
    </button>
  );
}
