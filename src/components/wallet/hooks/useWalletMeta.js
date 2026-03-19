"use client";

import { useCallback } from "react";

export function useWalletMeta({
  walletAddress,
  walletLabel,
  labelPrefix = "",
  hideAddress = false,
  addressBadge,
  addressBadgeClassName = "",
  addressTitle = "",
} = {}) {
  const renderWalletMeta = useCallback(
    (className = "") => {
      const resolvedLabel = String(walletLabel || "").trim();
      const resolvedAddress = String(walletAddress || "").trim();
      const resolvedPrefix = String(labelPrefix || "").trim();
      if (!resolvedAddress && !resolvedLabel) return null;
      return (
        <div className={`text-xs text-white/60 ${className}`}>
          <div className="text-xl md:text-2xl font-semibold text-white/80 leading-tight">
            {resolvedPrefix ? (
              <span className="font-medium text-white/55 mr-2">
                {resolvedPrefix}
              </span>
            ) : null}
            {resolvedLabel || "Wallet"}
          </div>
          {!hideAddress && resolvedAddress ? (
            <div className="font-mono text-xs md:text-base flex flex-wrap items-center gap-2">
              <span className="break-all" title={addressTitle || undefined}>
                {resolvedAddress}
              </span>
              {addressBadge ? (
                <span
                  className={[
                    "text-xs font-semibold",
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
                className={["text-xs font-semibold", addressBadgeClassName]
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
      labelPrefix,
      walletAddress,
      walletLabel,
    ],
  );

  return { renderWalletMeta };
}
