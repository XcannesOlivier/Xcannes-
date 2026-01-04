"use client";

import { useCallback } from "react";

export function useWalletMeta({ walletAddress, walletLabel } = {}) {
  const renderWalletMeta = useCallback(
    (className = "") => {
      if (!walletAddress) return null;
      return (
        <div className={`text-[10px] text-white/50 ${className}`}>
          <div className="font-semibold text-white/70">
            {walletLabel || "Wallet"}
          </div>
          <div className="font-mono break-all">{walletAddress}</div>
        </div>
      );
    },
    [walletAddress, walletLabel]
  );

  return { renderWalletMeta };
}

