import Link from "next/link";
import XummConnectButton from "./XummConnectButton";
import LanguageSwitcher from "./LanguageSwitcher";
import { useRouter } from "next/router";
import { useState, useEffect } from "react";
import { useTranslation } from "next-i18next";
import WSStatus from "./WSStatus";

export default function Header({ fixed = true }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const isDex = router.pathname === "/dex";
  const isStable = router.pathname === "/stable-exchange";
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

  return (
    <header
      className={`w-full h-16 ${
        fixed ? "fixed top-0 left-0 z-50" : "relative z-20"
      } px-6 flex items-center justify-between font-montserrat transition-all duration-300 border-b ${
        scrolled
          ? "bg-black/95 backdrop-blur-md border-white/10"
          : "bg-black/80 backdrop-blur-sm border-white/5"
      } text-white`}
    >
      {/* Logo simple texte style banque suisse */}
      <Link href="/">
        <div className="flex items-center gap-3 group">
          <span className="text-xl md:text-2xl font-orbitron font-bold tracking-tight text-white group-hover:text-xcannes-green transition-colors duration-300">
            XCANNES
          </span>
          <span className="hidden md:inline text-xs text-white/40 font-light">
            | Digital Asset Exchange
          </span>
        </div>
      </Link>

      {/* Navigation épurée */}
      <nav className="hidden md:flex items-center gap-8 font-[300] text-sm">
        <Link
          href={isDex ? "/" : "/dex"}
          className="hover:text-xcannes-green transition-colors duration-200"
        >
          {isDex ? t("nav_home") : t("nav_trading")}
        </Link>

        <Link
          href="/stable-exchange"
          className={`hover:text-xcannes-green transition-colors duration-200 ${
            isStable ? "text-xcannes-green" : ""
          }`}
        >
          {t("nav_stable_exchange", "Stable Exchange")}
        </Link>

        <LanguageSwitcher />

        <WSStatus />

        {isDex && (
          <>
            {/* Bulle Assistant - Version desktop discrète */}
            <button
              type="button"
              onClick={() => {
                alert('Assistant IA - À venir');
              }}
              className="text-sm font-bold py-1 px-2 transition-all bg-gradient-to-br from-[#6366f1] to-[#4f46e5] text-white hover:from-[#5b5dd8] hover:to-[#4338ca] border border-[#6366f1]/50 rounded-xl flex items-center justify-center relative overflow-hidden shadow-md shadow-[#6366f1]/15"
              aria-label="Assistant IA"
              title="Assistant IA"
            >
              <span className="tracking-wider relative z-10 inline-block text-xs" style={{ animation: 'irregularPulse 3s ease-in-out infinite' }}>•••</span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent" 
                    style={{ animation: 'shimmer 2s ease-in-out infinite' }}></span>
              <style jsx>{`
                @keyframes shimmer {
                  0% { transform: translateX(-100%); }
                  100% { transform: translateX(100%); }
                }
                @keyframes irregularPulse {
                  0% { transform: scale(1); }
                  15% { transform: scale(1.15); }
                  25% { transform: scale(1); }
                  40% { transform: scale(1.08); }
                  50% { transform: scale(1); }
                  75% { transform: scale(1.12); }
                  85% { transform: scale(1); }
                  100% { transform: scale(1); }
                }
              `}</style>
            </button>
            <XummConnectButton small />
          </>
        )}
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
          <Link
            href={isDex ? "/" : "/dex"}
            onClick={() => setMenuOpen(false)}
            className="hover:text-xcannes-green transition-colors"
          >
            {isDex ? t("nav_home") : t("nav_trading")}
          </Link>

          <Link
            href="/stable-exchange"
            onClick={() => setMenuOpen(false)}
            className={`hover:text-xcannes-green transition-colors ${
              isStable ? "text-xcannes-green" : ""
            }`}
          >
            {t("nav_stable_exchange", "Stable Exchange")}
          </Link>

          <LanguageSwitcher />

          {isDex && <XummConnectButton small />}
        </div>
      )}
    </header>
  );
}
