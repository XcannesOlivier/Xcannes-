import Link from "next/link";
import LanguageSwitcher from "./LanguageSwitcher";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import WSStatus from "./WSStatus";

export default function Header({ fixed = true }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const isDex = router.pathname === "/dex";
  const isHome = router.pathname === "/";

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const headerBgClass = (() => {
    // Pages avec gradient (DEX + Home) pour cohérence visuelle
    if (isDex || isHome) {
      const toColor = isDex ? "#040c13" : "var(--bg-base)";
      const gradientBase = `bg-gradient-to-b from-black via-black/95 to-[${toColor}]`;

      return scrolled
        ? `${gradientBase} backdrop-blur-md border-white/10`
        : `${gradientBase} backdrop-blur-sm border-white/5`;
    }

    // Autres pages : header sombre classique
    return scrolled
      ? "bg-black/95 backdrop-blur-md border-white/10"
      : "bg-black/80 backdrop-blur-sm border-white/5";
  })();

  return (
    <header
      className={`w-full h-16 ${
        fixed ? "fixed top-0 left-0 z-50" : "relative z-20"
      } px-6 flex items-center justify-between font-montserrat transition-all duration-300 border-b ${headerBgClass} text-white`}
    >
      {/* Logo simple texte style banque suisse */}
      <Link href="/">
        <div className="flex items-center gap-2 group whitespace-nowrap min-w-0">
          <span className="text-lg sm:text-xl md:text-2xl font-orbitron font-bold tracking-tight text-white group-hover:text-xcannes-green transition-colors duration-300">
            XCANNES
          </span>
          <span className="text-[10px] sm:text-[11px] text-white/40 font-light">
            |
          </span>
          <span className="text-[10px] sm:text-[11px] text-white/60 font-light tracking-wide truncate">
            Digital Asset Exchange
          </span>
        </div>
      </Link>

      {/* Navigation épurée */}
      <nav className="hidden md:flex items-center gap-8 font-[300] text-sm">
        {!isHome && (
          <Link
            href="/"
            className="hover:text-xcannes-green transition-colors duration-200"
          >
            {t("nav_home")}
          </Link>
        )}

        {!isDex && (
          <Link
            href="/dex"
            className="hover:text-xcannes-green transition-colors duration-200"
          >
            Trading
          </Link>
        )}

        <Link
          href="/wallet"
          className={`hover:text-xcannes-green transition-colors duration-200 ${
            router.pathname === "/wallet" ? "text-xcannes-green" : ""
          }`}
        >
          Wallet
        </Link>

        <LanguageSwitcher />
      </nav>

      {/* Menu mobile minimaliste */}
      <button
        className="md:hidden text-white text-2xl focus:outline-none hover:text-xcannes-green transition-colors"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Toggle menu"
        aria-expanded={menuOpen}
      >
        {menuOpen ? "×" : "☰"}
      </button>

      {menuOpen && (
        <div className="absolute top-16 left-0 w-full bg-black/95 backdrop-blur-md text-white flex flex-col items-center gap-6 py-8 md:hidden border-b border-white/10">
          {!isHome && (
            <Link
              href="/"
              onClick={() => setMenuOpen(false)}
              className="hover:text-xcannes-green transition-colors"
            >
              {t("nav_home")}
            </Link>
          )}

          {!isDex && (
            <Link
              href="/dex"
              onClick={() => setMenuOpen(false)}
              className="hover:text-xcannes-green transition-colors"
            >
              Trading
            </Link>
          )}

          <Link
            href="/wallet"
            onClick={() => setMenuOpen(false)}
            className={`hover:text-xcannes-green transition-colors ${
              router.pathname === "/wallet" ? "text-xcannes-green" : ""
            }`}
          >
            Wallet
          </Link>

          <LanguageSwitcher />
        </div>
      )}
    </header>
  );
}
