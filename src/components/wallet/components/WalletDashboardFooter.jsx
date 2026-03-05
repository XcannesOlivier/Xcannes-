"use client";

import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback } from "react";
import { useTranslation } from "next-i18next";

export default function WalletDashboardFooter({
  layout,
  xrplConnectionIndicator,
  isFullPageView,
  onOpenInfo,
  // Settings props for mobile settings button
  isConnected,
  wallet,
  onDisconnect,
  onCopyAddress,
  onOpenWalletLabelEditor,
  onRefreshWallet,
  isConnecting,
  isRefreshing,
  isWalletLabelLocked,
}) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const showOpenFullWallet = !isFullPageView && layout?.showOpenFullWallet;
  const showTopBorder = layout?.statementVariant !== "dex-desktop";
  const showBottomBorder = layout?.statementVariant === "dex-mobile";
  // Bouton Info & Fees visible uniquement sur la page wallet complète (desktop)
  const showInfoButton = isFullPageView;

  // Sur mobile (DEX), on veut un fallback "hard reload" si la navigation Next échoue
  // (souvent visible comme: URL qui change mais page qui ne se met pas à jour).
  const withHardNavFallback = useCallback(
    (href) => (e) => {
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
    [router?.events, router?.locales],
  );

  return (
    <div
      className={[
        "mt-auto shrink-0 z-20 bg-elevated",
        showTopBorder ? "border-t border-white/10" : "",
        showBottomBorder ? "border-b border-white/10" : "",
      ].join(" ")}
    >
      <div className="px-5 md:px-3 py-4 md:py-3 flex items-center justify-between gap-2 relative min-h-[52px] md:min-h-0">
        {/* Mobile: XCANNES centré */}
        <span className="md:hidden absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="font-orbitron font-semibold tracking-[0.22em] text-white/80 uppercase text-[17px]">
            {t("ui_xcannes_3cdc66a392", "XCANNES")}
          </span>
        </span>

        {/* Desktop: XCANNES | Multi-currency wallet centré */}
        <span className="hidden md:flex absolute inset-0 items-center justify-center pointer-events-none">
          <span className="font-orbitron font-semibold tracking-[0.22em] text-white/80 uppercase text-lg leading-none">
            {t("ui_xcannes_3cdc66a392", "XCANNES")}
          </span>
          <span className="mx-2.5 text-[12px] font-light text-white/30">|</span>
          <span className="text-[15px] font-light italic text-white/40">
            {t("ui_global_usd_wallet_202f7e48be", "Multi-currency wallet")}
          </span>
        </span>

        {/* Desktop: espace vide (XRPL indicator masqué) | Mobile: espace vide (le titre est centré en absolute) */}
        <div className="flex items-center gap-2 text-[11px] text-white/70 min-w-0">
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {showOpenFullWallet && (
            <Link
              href="/wallet"
              onClick={withHardNavFallback("/wallet")}
              className="px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-[11px] text-white/70 border border-white/10 font-medium transition-all duration-300"
            >
              {t("wallet_footer_open_full_wallet", "Open full wallet")}
            </Link>
          )}


        </div>
      </div>
    </div>
  );
}
