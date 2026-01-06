"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";

export default function WalletDashboardFooter({
  layout,
  xrplConnectionIndicator,
  isFullPageView,
  onOpenInfo,
}) {
  const router = useRouter();
  const showOpenFullWallet = !isFullPageView && layout?.showOpenFullWallet;
  const showTopBorder = layout?.statementVariant !== "dex-desktop";
  const showBottomBorder = layout?.statementVariant === "dex-mobile";
  // Sur desktop DEX (wallet sidebar), on enlève le bouton Info & Fees
  // car il est affiché dans le footer de la sidebar Orderbook.
  const showInfoButton =
    layout?.statementVariant !== "dex-mobile" &&
    layout?.statementVariant !== "dex-desktop";

  // Sur mobile (DEX), on veut un fallback "hard reload" si la navigation Next échoue
  // (souvent visible comme: URL qui change mais page qui ne se met pas à jour).
  const withHardNavFallback = useCallback(
    (href) =>
      (e) => {
        if (typeof window === "undefined") return;
        if (!e || e.defaultPrevented) return;
        if (e.button != null && e.button !== 0) return;
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        const rawHref =
          e?.currentTarget?.getAttribute?.("href") || String(href || "");
        if (!rawHref) return;

        let didStart = false;
        let didComplete = false;
        let didError = false;
        let didFallback = false;
        const events = router?.events;
        let quickFallbackTimer;
        let stuckFallbackTimer;

        const hrefUrl = new URL(rawHref, window.location.origin);
        const targetPath = hrefUrl.pathname + hrefUrl.search + hrefUrl.hash;

        const normalizeAsPath = (value) => {
          if (!value) return "";
          try {
            const u = new URL(String(value), window.location.origin);
            return u.pathname + u.search + u.hash;
          } catch {
            return String(value);
          }
        };

        const stripLocalePrefix = (asPath) => {
          const normalized = normalizeAsPath(asPath);
          const locales = router?.locales || [];
          for (const locale of locales) {
            const prefix = `/${locale}`;
            if (normalized === prefix) return "/";
            if (normalized.startsWith(`${prefix}/`)) {
              return normalized.slice(prefix.length) || "/";
            }
          }
          return normalized;
        };

        const matchesTarget = (url) => {
          const normalized = normalizeAsPath(url);
          return stripLocalePrefix(normalized) === stripLocalePrefix(targetPath);
        };

        const cleanup = () => {
          if (!events?.off) return;
          events.off("routeChangeStart", markStart);
          events.off("routeChangeComplete", markComplete);
          events.off("routeChangeError", markError);
          if (quickFallbackTimer) window.clearTimeout(quickFallbackTimer);
          if (stuckFallbackTimer) window.clearTimeout(stuckFallbackTimer);
        };

        const doFallback = () => {
          if (didFallback) return;
          if (didComplete) return;
          didFallback = true;
          cleanup();
          window.location.assign(hrefUrl.toString());
        };

        const markStart = (url) => {
          if (!matchesTarget(url)) return;
          didStart = true;
        };
        const markComplete = (url) => {
          if (!matchesTarget(url)) return;
          didComplete = true;
          cleanup();
        };
        const markError = (url) => {
          if (!matchesTarget(url)) return;
          didError = true;
          cleanup();
          window.setTimeout(doFallback, 0);
        };

        if (events?.on) {
          events.on("routeChangeStart", markStart);
          events.on("routeChangeComplete", markComplete);
          events.on("routeChangeError", markError);
        }

        quickFallbackTimer = window.setTimeout(() => {
          if (didComplete) return;
          if (!didStart) doFallback();
        }, 450);

        stuckFallbackTimer = window.setTimeout(() => {
          if (didComplete) return;
          if (didError || didStart) doFallback();
        }, 2200);
      },
    [router?.events, router?.locales]
  );

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
              onClick={withHardNavFallback("/wallet")}
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
