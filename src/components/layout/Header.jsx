import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "next-i18next";

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

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerBgClass = (() => {
    // DEX: gradient sombre pour conserver l'ambiance graphique
    if (isDex) {
      const gradientBase = "bg-gradient-to-b from-black via-black/95 to-[#040c13]";
      return scrolled ?
      `${gradientBase} backdrop-blur-md border-white/10` :
      `${gradientBase} backdrop-blur-sm border-white/5`;
    }

    // Home: fond noir uniforme (pas de teinte bleue)
    if (isHome) {
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
      <Link href="/" onClick={withHardNavFallback("/")}>
        <div className="flex items-center gap-2 group whitespace-nowrap min-w-0">
          <span className="text-lg sm:text-xl md:text-2xl font-orbitron font-bold tracking-tight text-white group-hover:text-xcannes-green transition-colors duration-300">{t("ui_xcannes_43b38baa2c", "XCANNES")}

          </span>
          <span className="text-[10px] sm:text-[11px] text-white/40 font-light">
            |
          </span>
          <span className="text-[10px] sm:text-[11px] text-white/60 font-light tracking-wide truncate">
            {t("header_tagline", "Digital Asset Exchange")}
          </span>
        </div>
      </Link>

      {/* Navigation épurée */}
      <nav className="hidden md:flex items-center gap-8 font-[300] text-sm">
        {!isHome &&
        <Link
          href="/"
          className="hover:text-xcannes-green transition-colors duration-200"
          onClick={withHardNavFallback("/")}>

            {t("nav_home")}
          </Link>
        }

        {!isDex &&
        <Link
          href="/dex"
          className="hover:text-xcannes-green transition-colors duration-200"
          onClick={withHardNavFallback("/dex")}>

            {t("nav_trading", "Trading")}
          </Link>
        }

        <Link
          href="/wallet"
          className={`hover:text-xcannes-green transition-colors duration-200 ${
          router.pathname === "/wallet" ? "text-xcannes-green" : ""}`
          }
          onClick={withHardNavFallback("/wallet")}>

          {t("nav_wallet", "Wallet")}
        </Link>

        <LanguageSwitcher />
      </nav>

      {/* Menu mobile minimaliste */}
      <button
        className="md:hidden text-white text-2xl focus:outline-none hover:text-xcannes-green transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label={t("ui_toggle_menu_9e88e70e51", "Toggle menu")}
        aria-expanded={menuOpen}>

        {menuOpen ? "×" : "☰"}
      </button>

      {menuOpen &&
      <div className="absolute top-16 left-0 w-full bg-black/95 backdrop-blur-md text-white flex flex-col items-center gap-6 py-8 md:hidden border-b border-white/10">
          {!isHome &&
        <Link
          href="/"
          onClick={(e) => {
            setMenuOpen(false);
            withHardNavFallback("/")(e);
          }}
          className="hover:text-xcannes-green transition-colors">

              {t("nav_home")}
            </Link>
        }

          {!isDex &&
        <Link
          href="/dex"
          onClick={(e) => {
            setMenuOpen(false);
            withHardNavFallback("/dex")(e);
          }}
          className="hover:text-xcannes-green transition-colors">

              {t("nav_trading", "Trading")}
            </Link>
        }

          <Link
          href="/wallet"
          onClick={(e) => {
            setMenuOpen(false);
            withHardNavFallback("/wallet")(e);
          }}
          className={`hover:text-xcannes-green transition-colors ${
          router.pathname === "/wallet" ? "text-xcannes-green" : ""}`
          }>

            {t("nav_wallet", "Wallet")}
          </Link>

          <LanguageSwitcher />
        </div>
      }
    </header>);

}
