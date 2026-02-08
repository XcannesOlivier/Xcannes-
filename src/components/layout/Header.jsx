import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useRouter } from "next/router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";

export default function Header({ fixed = true }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const isDex = router.pathname === "/dex";
  const isHome = router.pathname === "/";

  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const settingsRef = useRef(null);

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

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClickOutside = (event) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target)) {
        setSettingsOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setSettingsOpen(false);
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [settingsOpen]);

  const headerBgClass = (() => {
    // DEX: gradient sombre pour conserver l'ambiance graphique
    if (isDex) {
      const gradientBase = "bg-gradient-to-b from-black via-black/95 to-[#0a0f0d]";
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
          <span className="text-[12px] sm:text-[13px] text-white/60 font-light tracking-wide truncate">
            {t("header_tagline", "Compte multi-devises")}
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

            {t("nav_trading", "Markets")}
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

        <div ref={settingsRef} className="relative">
          <button
            onClick={() => setSettingsOpen((open) => !open)}
            aria-haspopup="true"
            aria-expanded={settingsOpen}
            aria-controls="header-settings-menu"
            aria-label={t("ui_parameters_da2b8022f7", "Paramètres")}
            className={`p-2 transition-all flex items-center justify-center ${
              settingsOpen ? "text-xcannes-green" : "text-white/70 hover:text-white"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>
          {settingsOpen && (
            <div
              id="header-settings-menu"
              role="menu"
              className="absolute right-0 top-full mt-2 min-w-[240px] bg-black/95 backdrop-blur-xl border border-white/20 rounded-xl p-3 shadow-2xl z-40"
            >
              <div className="text-[10px] font-semibold text-white/90 mb-2 pb-1.5 border-b border-white/10">
                {t("ui_parameters_da2b8022f7", "Paramètres")}
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-end rounded-lg px-2.5 py-2 bg-white/5">
                  <LanguageSwitcher onSelect={() => setSettingsOpen(false)} />
                </div>
              </div>
            </div>
          )}
        </div>
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

              {t("nav_trading", "Markets")}
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

          <LanguageSwitcher onSelect={() => setMenuOpen(false)} />
        </div>
      }
    </header>);

}
