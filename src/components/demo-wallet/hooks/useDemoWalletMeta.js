"use client";

import { useCallback } from "react";

export function useDemoWalletMeta({
  walletAddress,
  walletLabel,
  hideAddress = false,
  addressBadge,
  addressBadgeClassName = "",
  addressTitle = "",
} = {}) {
  const renderWalletMeta = useCallback(
    (className = "") => {
      const resolvedLabel = String(walletLabel || "").trim();
      const resolvedAddress = String(walletAddress || "").trim();
      if (!resolvedAddress && !resolvedLabel) return null;
      return (
        <div className={`text-[10px] text-white/60 ${className}`}>
          <div className="text-[12px] md:text-[13px] font-semibold text-white/80 leading-tight">
            {resolvedLabel || "Wallet"}
          </div>
          {!hideAddress && resolvedAddress ? (
            <div className="font-mono flex flex-wrap items-center gap-2">
              <span className="break-all" title={addressTitle || undefined}>
                {resolvedAddress}
              </span>
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
          ) : addressBadge ? (
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={["text-[10px] font-semibold", addressBadgeClassName]
                  .filter(Boolean)
                  .join(" ")}
              >
                {addressBadge}
              </span>
            </div>
          ) : null}
        </div>
      );
    },
    [
      addressBadge,
      addressBadgeClassName,
      addressTitle,
      hideAddress,
      walletAddress,
      walletLabel,
    ],
  );

  return { renderWalletMeta };
}
