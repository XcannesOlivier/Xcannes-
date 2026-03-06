/**
 * WalletContext — Unified wallet interface
 *
 * Wraps NativeWalletContext and PwaEmbeddedContext behind a single
 * `useWallet()` hook that exposes the same interface everywhere.
 *
 * Components import `useWallet` instead of provider-specific hooks — the
 * active provider is selected automatically or by the user and stored in
 * localStorage.
 *
 * Supported providers:
 *   - "native" → NativeWalletContext (Xcannes Wallet relay + Face ID)
 *   - "pwa"    → PwaEmbeddedContext (PWA iframe bridge, instant postMessage)
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useNativeWallet } from "@/context/NativeWalletContext";
import { usePwaEmbedded, isPwaEmbedded } from "@/context/PwaEmbeddedContext";

const WalletContext = createContext();

const PROVIDER_STORAGE_KEY = "xcannes_wallet_provider";
const VALID_PROVIDERS = ["native", "pwa"];
const DEFAULT_PROVIDER = "native";

function readProvider() {
  if (typeof window === "undefined") return DEFAULT_PROVIDER;
  try {
    const saved = localStorage.getItem(PROVIDER_STORAGE_KEY);
    return VALID_PROVIDERS.includes(saved) ? saved : DEFAULT_PROVIDER;
  } catch {
    return DEFAULT_PROVIDER;
  }
}

function saveProvider(provider) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PROVIDER_STORAGE_KEY, provider);
  } catch {
    // Ignore
  }
}

export const WalletProviderSwitch = ({ children }) => {
  const [activeProvider, setActiveProvider] = useState(DEFAULT_PROVIDER);

  // Read from localStorage on mount
  useEffect(() => {
    setActiveProvider(readProvider());
  }, []);

  // Only native and pwa providers remain
  const native = useNativeWallet();
  const pwa = usePwaEmbedded();

  // Auto-select "pwa" provider when running inside the PWA iframe
  useEffect(() => {
    if (isPwaEmbedded() && activeProvider !== "pwa") {
      setActiveProvider("pwa");
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Pick the active provider's values
  const current =
    activeProvider === "pwa" ? pwa :
    native;

  // ✅ Value memoïzé pour éviter de re-rendre les 13+ consumers à chaque render parent
  const value = useMemo(() => ({
    // --- Same interface as useNativeWallet() / usePwaEmbedded() ---
    wallet: current.wallet,
    isConnected: current.isConnected,
    isConnecting: current.isConnecting,
    isSessionReady: current.isSessionReady,
    balance: current.balance,
    isWalletActivated: current.isWalletActivated,
    qrModalData: current.qrModalData,
    connect: current.connect,
    disconnect: current.disconnect,
    refreshBalance: current.refreshBalance,
    signTransaction: current.signTransaction,
    closeQrModal: current.closeQrModal,

    // --- Multi-wallet ---
    walletAddresses: current.walletAddresses || [],
    switchWallet: current.switchWallet || (() => {}),
  }), [
    current.wallet,
    current.isConnected,
    current.isConnecting,
    current.isSessionReady,
    current.balance,
    current.isWalletActivated,
    current.qrModalData,
    current.connect,
    current.disconnect,
    current.refreshBalance,
    current.signTransaction,
    current.closeQrModal,
    current.walletAddresses,
    current.switchWallet,
  ]);

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

/**
 * useWallet() — Unified wallet hook.
 * Returns the same interface + { activeProvider, switchProvider, providers }.
 */
export const useWallet = () => useContext(WalletContext);


