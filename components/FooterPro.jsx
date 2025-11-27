import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { useXumm } from "../context/XummContext";

export default function FooterPro() {
  const { t } = useTranslation("common");
  const router = useRouter();
  const isDex = router.pathname === "/dex";
  const { wallet, isConnected } = useXumm();

  const [xrplConnected, setXrplConnected] = useState(true); // Backend gère la connexion
  const [xrplLoading, setXrplLoading] = useState(false);

  const socials = [
    {
      name: "Twitter",
      url: "https://twitter.com/xcannes",
      svg: (
        <svg
          className="w-4 h-4"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
        </svg>
      ),
    },
  ];

  // Connexion XRPL gérée par le backend - pas besoin de vérifier côté client
  /*
  useEffect(() => {
    // Désactivé temporairement - la connexion XRPL est gérée par le backend
    setXrplConnected(true);
    setXrplLoading(false);
  }, []);
  */

  return (
    <footer className="w-screen max-w-none text-white pt-16 pb-8 px-6 border-t border-white/10 bg-gradient-to-b from-xcannes-background to-black">
      <div className="max-w-6xl mx-auto">
        {/* Section principale épurée */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-12">
          {/* Colonne 1 - Branding */}
          <div className="text-center md:text-left">
            <h3 className="text-2xl font-orbitron font-bold mb-2 text-white">
              XCANNES
            </h3>
            <p className="text-sm text-white/60 mb-4">{t("footer_branding")}</p>
            <p className="text-xs text-white/40">
              {t("footer_powered")}
              <br />
              {t("footer_created")}
            </p>
          </div>

          {/* Colonne 2 - Liens essentiels */}
          <div className="text-center">
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">
              {t("footer_nav_title")}
            </h4>
            <ul className="text-sm space-y-2">
              <li>
                <Link
                  href="/dex"
                  className="text-white/70 hover:text-xcannes-green transition-colors"
                >
                  {t("footer_nav_trading")}
                </Link>
              </li>
              <li>
                <Link
                  href="/whitepaper"
                  className="text-white/70 hover:text-xcannes-green transition-colors"
                >
                  {t("footer_nav_whitepaper")}
                </Link>
              </li>
              <li>
                <Link
                  href="/disclaimer"
                  className="text-white/70 hover:text-xcannes-green transition-colors flex items-center justify-center gap-2"
                >
                  <span>🏛️</span>
                  <span>Legal Info</span>
                </Link>
              </li>
            </ul>
          </div>

          {/* Colonne 3 - Contact & Réseaux */}
          <div className="text-center md:text-right">
            <h4 className="font-semibold text-white mb-4 text-sm uppercase tracking-wider">
              {t("footer_contact_title")}
            </h4>
            <p className="text-sm mb-4">
              <Link
                href="/contact"
                className="text-white/70 hover:text-xcannes-green transition-colors"
              >
                {t("footer_contact_email")}
              </Link>
            </p>

            {/* Réseaux sociaux minimalistes */}
            <div className="flex gap-4 justify-center md:justify-end mt-6 items-center">
              {socials.map((s) => (
                <a
                  key={s.name}
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="opacity-60 hover:opacity-100 transition-opacity text-white"
                  aria-label={s.name}
                >
                  {s.svg}
                </a>
              ))}

              {/* Wall Street Journal */}
              <a
                href="https://www.wsj.com/finance/currencies"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity ml-2"
                aria-label="Wall Street Journal"
              >
                <span className="text-xs text-white/60 uppercase tracking-wider">
                  WSJ
                </span>
              </a>

              {/* Festival de Cannes */}
              <a
                href="https://www.festival-cannes.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="opacity-60 hover:opacity-100 transition-opacity ml-2"
                aria-label="Festival de Cannes"
              >
                <span className="text-xs text-white/60 uppercase tracking-wider">
                  CANNES
                </span>
              </a>
            </div>
          </div>
        </div>

        {/* Ligne de séparation */}
        <div className="border-t border-white/5 pt-6">
          <div className="flex flex-col md:flex-row justify-between items-center text-xs text-white/40 gap-4">
            <p>{t("footer_copyright")}</p>

            <div
              className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/40 border border-white/10"
              title={
                xrplLoading
                  ? t("footer_xrpl_checking")
                  : xrplConnected
                  ? t("footer_xrpl_connected")
                  : t("footer_xrpl_disconnected")
              }
            >
              <div
                className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                  xrplLoading
                    ? "bg-yellow-500 animate-pulse"
                    : xrplConnected
                    ? "bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"
                    : "bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
                }`}
              ></div>
              <span className="text-[10px] text-white/40 uppercase tracking-wider">
                XRPL
              </span>
            </div>

            <a
              href="https://icis.corp.delaware.gov/ecorp/entitysearch/namesearch.aspx"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-xcannes-green transition-colors"
            >
              Reg. No. 10157026
            </a>
          </div>
        </div>

        {/* Wallet connecté si applicable */}
        {isConnected && (
          <div className="mt-6 text-center">
            <p className="text-xs text-xcannes-green/60">
              {t("footer_wallet_connected")} {wallet.slice(0, 8)}...
              {wallet.slice(-6)}
            </p>
          </div>
        )}
      </div>
    </footer>
  );
}
