import Link from "next/link";
import HeaderLanguageStrip from "./HeaderLanguageStrip";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { lockBodyScroll } from "@/utils/bodyScrollLock";

export default function Header({ fixed = true }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const isDex = router.pathname === "/dex";
  const isHome = router.pathname === "/";

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const withHardNavFallback = useCallback(
    (href, { onBeforeFallback } = {}) =>
    (e) => {
      if (typeof window === "undefined") return;
      if (!e || e.defaultPrevented) return;
      if (e.button != null && e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // keep new-tab behavior

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
        onBeforeFallback?.();
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

      // If Next router doesn't even start, fallback quickly.
      quickFallbackTimer = window.setTimeout(() => {
        if (didComplete) return;
        if (!didStart) doFallback();
      }, 450);

      // If router started but got stuck (or errored without proper recovery), fallback later.
      stuckFallbackTimer = window.setTimeout(() => {
        if (didComplete) return;
        if (didError || didStart) doFallback();
      }, 2200);
    },
    [router?.events, router?.locales]
  );

  const withMobileNavDelay = useCallback(
    (href, { delay = 350 } = {}) =>
    (e) => {
      if (typeof window === "undefined") return;
      if (!e || e.defaultPrevented) return;
      if (e.button != null && e.button !== 0) return; // only left click
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // keep new-tab behavior

      e.preventDefault();

      const linkEl = e.currentTarget;
      if (linkEl?.classList) linkEl.classList.add("is-animating");

      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      const effectiveDelay = reduceMotion ? 0 : delay;

      window.setTimeout(() => {
        if (linkEl?.classList) linkEl.classList.remove("is-animating");
        setMenuOpen(false);

        const safeTarget = linkEl || { getAttribute: () => String(href || "") };
        const handler = withHardNavFallback(href);
        handler({
          defaultPrevented: false,
          button: 0,
          metaKey: false,
          ctrlKey: false,
          shiftKey: false,
          altKey: false,
          currentTarget: safeTarget,
        });

        router.push(href);
      }, effectiveDelay);
    },
    [router, withHardNavFallback]
  );

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    if (!menuOpen || !isMobile) return;
    return lockBodyScroll();
  }, [menuOpen]);

  const headerBgClass = (() => {
    // DEX + Home: fond noir uniforme (même rendu)
    if (isDex || isHome) {
      return scrolled ?
      "bg-black backdrop-blur-md border-white/10" :
      "bg-black backdrop-blur-sm border-white/5";
    }

    // Autres pages : header sombre classique
    return scrolled ?
    "bg-black/95 backdrop-blur-md border-white/10" :
    "bg-black/80 backdrop-blur-sm border-white/5";
  })();

  return (
    <header
      className={`w-full h-16 ${
      fixed ? "fixed top-0 left-0 z-50" : "relative z-20"} px-6 flex items-center justify-between font-montserrat transition-all duration-300 border-b ${
      headerBgClass} text-white`}>

      {/* Logo simple texte style banque suisse */}
      <div className="flex items-center gap-2 whitespace-nowrap min-w-0">
        <span className="text-lg sm:text-xl md:text-2xl font-orbitron font-bold tracking-tight text-white">
          {t("ui_xcannes_43b38baa2c", "XCANNES")}
        </span>
        <span className="text-[10px] sm:text-[11px] text-white/40 font-light">
          |
        </span>
        <span className="text-[15px] sm:text-[17px] md:text-[16px] text-white/60 font-light italic tracking-wide truncate">
          {t("header_tagline", "Compte multi-devises")}
        </span>
      </div>

      <div className="flex items-center gap-5">
        {/* Navigation épurée */}
        <nav className="hidden md:flex items-center gap-30 font-[300] text-lg">
          {!isHome &&
          <Link
            href="/"
            className={`header-nav-link ${isDex ? "is-reverse" : ""}`}
            onClick={withHardNavFallback("/")}>

              <span className="header-nav-label">{t("nav_home")}</span>
              <span aria-hidden="true" className="header-nav-arrow">{isDex ? "<" : ">"}</span>
            </Link>
          }

          {!isDex &&
          <Link
            href="/dex"
            className="header-nav-link"
            onClick={withHardNavFallback("/dex")}>

              <span className="header-nav-label">{t("nav_trading", "Markets")}</span>
              <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
            </Link>
          }

          <Link
            href="/wallet"
            className={`header-nav-link ${
            router.pathname === "/wallet" ? "is-active" : ""}`
            }
            onClick={withHardNavFallback("/wallet")}>

            <span className="header-nav-label">{t("nav_wallet", "Wallet")}</span>
            <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
          </Link>

        </nav>

        <HeaderLanguageStrip className="hidden md:flex ml-4" />

        {/* Menu mobile minimaliste */}
        <button
          className="md:hidden text-white focus:outline-none hover:text-xcannes-green transition-colors"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label={t("ui_toggle_menu_9e88e70e51", "Toggle menu")}
          aria-expanded={menuOpen}>
          <span className={`header-burger ${menuOpen ? "is-open" : ""}`} aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>
      </div>

      <div
        className={`fixed top-16 left-0 right-0 bottom-0 md:hidden bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          menuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
        onClick={() => setMenuOpen(false)}
        aria-hidden={!menuOpen}
      />

      <div
        className={`absolute top-16 left-0 w-full bg-black/95 backdrop-blur-md text-white flex flex-col items-center gap-6 md:hidden border-b border-white/10 overflow-hidden transition-all duration-500 ease-out z-50 ${
          menuOpen
            ? "opacity-100 translate-y-0 pointer-events-auto max-h-[420px] py-8"
            : "opacity-0 -translate-y-2 pointer-events-none max-h-0 py-0"
        }`}
        aria-hidden={!menuOpen}
      >
          {!isHome &&
        <Link
          href="/"
          onClick={withMobileNavDelay("/")}
          className={`header-nav-link w-full justify-between px-8 ${isDex ? "is-reverse" : ""}`}>

              <span className="header-nav-label">{t("nav_home")}</span>
              <span aria-hidden="true" className="header-nav-arrow">{isDex ? "<" : ">"}</span>
            </Link>
        }

          {!isDex &&
        <Link
          href="/dex"
          onClick={withMobileNavDelay("/dex")}
          className="header-nav-link w-full justify-between px-8">

              <span className="header-nav-label">{t("nav_trading", "Markets")}</span>
              <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
            </Link>
        }

          <Link
          href="/wallet"
          onClick={withMobileNavDelay("/wallet")}
          className={`header-nav-link w-full justify-between px-8 ${
          router.pathname === "/wallet" ? "is-active" : ""}`
          }>

            <span className="header-nav-label">{t("nav_wallet", "Wallet")}</span>
            <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
          </Link>

          <div className="pt-2 w-full flex justify-start px-8">
            <HeaderLanguageStrip />
          </div>

        </div>
    </header>);

}
