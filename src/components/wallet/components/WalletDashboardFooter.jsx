"use client";

import Link from "next/link";

export default function WalletDashboardFooter({
  layout,
  xrplConnectionIndicator,
  isFullPageView,
  onOpenInfo,
}) {
  const showOpenFullWallet = !isFullPageView && layout?.showOpenFullWallet;
  const showTopBorder = layout?.statementVariant !== "dex-desktop";
  const showBottomBorder = layout?.statementVariant === "dex-mobile";
  // Sur desktop DEX (wallet sidebar), on enlève le bouton Info & Fees
  // car il est affiché dans le footer de la sidebar Orderbook.
  const showInfoButton =
    layout?.statementVariant !== "dex-mobile" &&
    layout?.statementVariant !== "dex-desktop";

  return (
    <div
      className={[
        "mt-auto shrink-0 z-20 bg-elevated",
        showTopBorder ? "border-t border-white/10" : "",
        showBottomBorder ? "border-b border-white/10" : "",
      ].join(" ")}
    >
      <div className="px-3 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-[11px] text-white/70 min-w-0">
          <span
            className={[
              "inline-flex h-2.5 w-2.5 rounded-full ring-4 flex-shrink-0",
              xrplConnectionIndicator?.dotClass || "bg-white/30",
              xrplConnectionIndicator?.ringClass || "ring-white/10",
              xrplConnectionIndicator?.pulse ? "animate-pulse" : "",
            ].join(" ")}
            aria-hidden="true"
          />
          <span className="font-medium truncate">
            {xrplConnectionIndicator?.label || "XRPL"}
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showOpenFullWallet && (
            <Link
              href="/wallet"
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 font-medium transition-all duration-300"
            >
              Open full wallet
            </Link>
          )}

          {showInfoButton && (
            <button
              type="button"
              onClick={onOpenInfo}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 font-medium transition-all duration-300"
              title="Wallet info & fees"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/5 border border-white/10 text-[12px] leading-none">
                i
              </span>
              <span className="hidden sm:inline">Info & Fees</span>
              <span className="sm:hidden">Info</span>
            </button>
          )}

          <div
            className={`${
              isFullPageView ? "block" : "hidden sm:block"
            } text-[10px] text-[#0f7fe1]/80`}
          >
            Secured via XUMM
          </div>
        </div>
      </div>
    </div>
  );
}
