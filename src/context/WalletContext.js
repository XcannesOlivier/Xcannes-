/**
 * WalletContext — Unified wallet interface
 *
 * Wraps both XummContext and NativeWalletContext behind a single
 * `useWallet()` hook that exposes the EXACT same interface as useXumm().
 *
 * Components import `useWallet` instead of `useXumm` — the active
 * provider is selected by the user and stored in localStorage.
 *
 * Supported providers:
 *   - "xumm"   → XummContext (Xumm/Xaman app)
 *   - "native"  → NativeWalletContext (Xcannes Wallet relay + Face ID)
 */

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useXumm } from "@/context/XummContext";
import { useNativeWallet } from "@/context/NativeWalletContext";

const WalletContext = createContext();

const PROVIDER_STORAGE_KEY = "xcannes_wallet_provider";
const VALID_PROVIDERS = ["xumm", "native"];
const DEFAULT_PROVIDER = "xumm";

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

  const xumm = useXumm();
  const native = useNativeWallet();

  // Pick the active provider's values
  const current = activeProvider === "native" ? native : xumm;

  const switchProvider = useCallback(
    (provider) => {
      if (!VALID_PROVIDERS.includes(provider)) return;
      // Disconnect current wallet before switching
      if (current.isConnected) {
        current.disconnect();
      }
      saveProvider(provider);
      setActiveProvider(provider);
    },
    [current]
  );

  // Enhanced context value: same interface + provider switching
  const value = {
    // --- Same interface as useXumm() ---
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

    // --- Provider switching ---
    activeProvider,
    switchProvider,
    providers: VALID_PROVIDERS,
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
};

/**
 * useWallet() — Drop-in replacement for useXumm().
 * Returns the same interface + { activeProvider, switchProvider, providers }.
 */
export const useWallet = () => useContext(WalletContext);

/**
 * Backward compatibility: re-export as useXumm so existing imports still work
 * after migrating to WalletContext.
 */
export const useXummCompat = () => useContext(WalletContext);
