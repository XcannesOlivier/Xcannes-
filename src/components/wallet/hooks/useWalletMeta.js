"use client";

import { useCallback } from "react";
import WalletActiveLabel from "../components/WalletActiveLabel";

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
    (classNameOrOptions = "", maybeOptions = null) => {
      const options =
        classNameOrOptions && typeof classNameOrOptions === "object"
          ? classNameOrOptions
          : maybeOptions || {};
      const className =
        classNameOrOptions && typeof classNameOrOptions === "object"
          ? String(classNameOrOptions.className || "")
          : String(classNameOrOptions || "");

      const resolvedLabel = String(walletLabel || "").trim();
      const resolvedAddress = String(walletAddress || "").trim();
      const resolvedPrefix = String(labelPrefix || "").trim();
      if (!resolvedAddress && !resolvedLabel) return null;

      const variant = String(options?.variant || "default");
      const effectivePrefix =
        options?.prefix != null ? String(options.prefix) : resolvedPrefix;

      if (variant === "pill") {
        return (
          <div className={className}>
            <div
              className={[
                "inline-flex max-w-full items-center rounded-xl px-3 py-2",
                options?.pillClassName || "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <WalletActiveLabel
                prefix={effectivePrefix}
                label={resolvedLabel || "Wallet"}
                labelWrap={Boolean(options?.labelWrap)}
                className={options?.labelRowClassName || ""}
                prefixClassName={options?.prefixClassName || ""}
                labelClassName={options?.labelClassName || ""}
                dotClassName={options?.dotClassName || ""}
              />
            </div>
          </div>
        );
      }

      if (variant === "pill-column") {
        return (
          <div className={className}>
            <div
              className={[
                "inline-flex flex-col items-center gap-1 rounded-3xl px-6 py-2",
                options?.pillClassName || "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <span className={["text-white/70 text-[14px] font-medium tracking-wide", options?.prefixClassName || ""].filter(Boolean).join(" ")}>
                {effectivePrefix}
              </span>
              <div className="flex items-center gap-2">
                <span className={["h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse", options?.dotClassName || ""].filter(Boolean).join(" ")} aria-hidden />
                <span className={["text-white/95 text-[14px] font-semibold", options?.labelClassName || ""].filter(Boolean).join(" ")}>
                  {resolvedLabel || "Wallet"}
                </span>
              </div>
            </div>
          </div>
        );
      }

      return (
        <div className={`text-xs text-white/60 ${className}`}>
          <div className="text-xl md:text-2xl font-semibold text-white/80 leading-tight">
            <WalletActiveLabel
              prefix={effectivePrefix}
              label={resolvedLabel || "Wallet"}
              labelClassName="font-semibold text-white/80"
            />
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
