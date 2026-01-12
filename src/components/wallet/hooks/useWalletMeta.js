"use client";

import { useCallback } from "react";

export function useWalletMeta({
  walletAddress,
  walletLabel,
  addressBadge,
  addressBadgeClassName = ""
} = {}) {
  const renderWalletMeta = useCallback(
    (className = "") => {
      if (!walletAddress) return null;
      return (
        <div className={`text-[10px] text-white/50 ${className}`}>
          <div className="font-semibold text-white/70">
            {walletLabel || "Wallet"}
          </div>
          <div className="font-mono flex flex-wrap items-center gap-2">
            <span className="break-all">{walletAddress}</span>
            {addressBadge ? (
              <span
                className={[
                  "text-[10px] font-semibold",
                  addressBadgeClassName,
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {addressBadge}
              </span>
            ) : null}
          </div>
        </div>
      );
    },
    [walletAddress, walletLabel, addressBadge, addressBadgeClassName]
  );

  return { renderWalletMeta };
}
