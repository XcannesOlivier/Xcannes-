import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";

export default function Whitepaper() {
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { t } = useTranslation("common");

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <>
      <Head>
        <title>{t("whitepaper_meta_title", "Whitepaper - XCANNES (XCS)")}</title>
      </Head>

      <main className="max-w-4xl mx-auto px-6 py-16 text-white bg-black/20 rounded-lg shadow-lg font-montserrat font-[300] relative">
        {/* Top Buttons */}
        <div className="flex justify-center gap-4 mb-10">
          <Link
            href="/"
            className="px-6 py-2 rounded-full font-[500] bg-xcannes-green text-white hover:bg-xcannes-green hover:text-white transition transform hover:scale-105 shadow"
          >
            {t("nav_home", "Home")}
          </Link>
          <Link
            href="/wallet"
            className="px-6 py-2 rounded-full border border-white font-bolt bg-black text-white hover:bg-white hover:text-black transition transform hover:scale-105 shadow"
          >
            {t("nav_wallet", "Wallet")}
          </Link>
        </div>

        <header className="text-center mb-12">
          <h1 className="text-3xl font-orbitron text-xcannes-green font-[600]">
            {t(
              "whitepaper_title",
              "📘 Official Whitepaper - XCANNES (XCS)"
            )}
          </h1>
          <p className="text-black-700 mt-2 text-sm">
            {t(
              "whitepaper_subtitle",
              "The digital and financial identity of Cannes and its region"
            )}
          </p>
          <p className="text-xs text-black-700 mt-1">
            {t("whitepaper_version", "📅 Version 1.0 — 02/02/2025")}
          </p>
        </header>

        {/* Table des matières */}
        <nav className="mb-12">
          <h2 className="text-lg text-xcannes-green font-[500] mb-3">
            {t("whitepaper_toc_title", "📑 Table of contents")}
          </h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li>
              <a href="#section1" className="text-white hover:underline">
                {t("whitepaper_toc_1", "1. XCANNES, a dedicated digital currency")}
              </a>
            </li>
            <li>
              <a href="#section2" className="text-white hover:underline">
                {t("whitepaper_toc_2", "2. Why the XRP Ledger (XRPL)?")}
              </a>
            </li>
            <li>
              <a href="#section3" className="text-white hover:underline">
                {t("whitepaper_toc_3", "3. A token for the local economy")}
              </a>
            </li>
            <li>
              <a href="#section4" className="text-white hover:underline">
                {t("whitepaper_toc_4", "4. Token economics")}
              </a>
            </li>
            <li>
              <a href="#section5" className="text-white hover:underline">
                {t("whitepaper_toc_5", "5. Where to buy and store XCS")}
              </a>
            </li>
            <li>
              <a href="#section6" className="text-white hover:underline">
                {t("whitepaper_toc_6", "6. Security and compliance")}
              </a>
            </li>
            <li>
              <a href="#section7" className="text-white hover:underline">
                {t("whitepaper_toc_7", "7. Roadmap")}
              </a>
            </li>
            <li>
              <a href="#section8" className="text-white hover:underline">
                {t("whitepaper_toc_8", "8. Conclusion")}
              </a>
            </li>
          </ul>
        </nav>

        {/* Sections complètes ici... */}
         {/* Section 1 */}
         <section id="section1" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t(
              "whitepaper_s1_title",
              "1. XCANNES, a digital currency dedicated to Cannes and its region"
            )}
          </h2>
          <p className="mb-3">
            {t(
              "whitepaper_s1_p1",
              "XCANNES (XCS) is a digital token designed to integrate into the economic ecosystem of Cannes and its region—an iconic destination known for its economic dynamism, international reach, and cultural activity."
            )}
          </p>
          <ul className="list-disc pl-5 mb-3">
            <li>
              {t(
                "whitepaper_s1_li1",
                "Create a strong digital identity for Cannes, reflecting its prestige."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s1_li2",
                "Offer a fast, reliable, and low-cost payment method for merchants and users."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s1_li3",
                "Develop a modern, decentralized alternative to facilitate local exchanges."
              )}
            </li>
          </ul>
          <p>
            {t(
              "whitepaper_s1_p2",
              "XCANNES aims to support the city's digital transition by offering a digital currency that reflects Cannes' identity and exclusivity, while remaining accessible to everyone—including visitors and regional economic actors."
            )}
          </p>
        </section>

        {/* Section 2 */}
        <section id="section2" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s2_title", "2. Why the XRP Ledger (XRPL)?")}
          </h2>
          <p className="mb-3">
            {t(
              "whitepaper_s2_p1",
              "XCANNES (XCS) is built on the XRP Ledger (XRPL), a high-performance distributed ledger known for its security, speed, and low transaction costs."
            )}
          </p>
          <ul className="list-disc pl-5">
            <li>
              {t(
                "whitepaper_s2_li1",
                "Fast transactions: validation in 3 to 5 seconds."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s2_li2",
                "Ultra-low fees: under €0.0002 per transaction."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s2_li3",
                "Eco-friendly: no mining, reduced energy consumption."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s2_li4",
                "Proven reliability: live since 2012, never compromised."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s2_li5",
                "Scalable: up to 1,500 transactions per second."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s2_li6",
                "Interoperable: compatible with other digital assets."
              )}
            </li>
          </ul>
          <p className="mt-3">
            {t(
              "whitepaper_s2_p2",
              "⚜️ XRPL provides XCANNES with a robust, fast, and scalable infrastructure—perfectly suited for a modern city like Cannes."
            )}
          </p>
        </section>
                {/* Section 3 */}
          <section id="section3" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t(
              "whitepaper_s3_title",
              "3. A token designed for the local and regional economy"
            )}
          </h2>
          <p className="mb-3">
            {t(
              "whitepaper_s3_p1",
              "XCANNES was designed to support and modernize the local economy by offering a digital payment method tailored to the needs of merchants, residents, and visitors."
            )}
          </p>
          <ul className="list-disc pl-5">
            <li>
              {t(
                "whitepaper_s3_li1",
                "A universal payment method across shops, hotels, restaurants, and local services."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s3_li2",
                "Privileged access to offers and exclusive experiences in XCS."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s3_li3",
                "Potential usage during landmark events (Cannes Film Festival, etc.)."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s3_li4",
                "Future development towards e-commerce and digital services."
              )}
            </li>
          </ul>
          <p className="mt-3">
            {t(
              "whitepaper_s3_p2",
              "XCANNES is more than a token: it is an economic lever and an innovation tool serving the city and its region."
            )}
          </p>
        </section>

        {/* Section 4 */}
        <section id="section4" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s4_title", "4. XCANNES (XCS) token economics")}
          </h2>
          <ul className="list-disc pl-5 mb-3">
            <li>
              <strong>{t("whitepaper_s4_li1_label", "Fixed total supply:")}</strong>{" "}
              {t(
                "whitepaper_s4_li1_text",
                "2,006,400 XCS. No new tokens can be created after the initial issuance."
              )}
            </li>
            <li>
              <strong>{t("whitepaper_s4_li2_label", "Divisibility:")}</strong>{" "}
              {t(
                "whitepaper_s4_li2_text",
                "Up to 6 decimals for micro-transactions."
              )}
            </li>
            <li>
              <strong>{t("whitepaper_s4_li3_label", "Burning system:")}</strong>{" "}
              {t(
                "whitepaper_s4_li3_text",
                "A fraction of fees is burned on each transaction (controlled deflation)."
              )}
            </li>
            <li>
              <strong>{t("whitepaper_s4_li4_label", "Strategic distribution:")}</strong>
            </li>
            <ul className="list-disc pl-6">
              <li>
                {t(
                  "whitepaper_s4_li4_sub1",
                  "Tokens allocated to local partners and institutions to drive adoption."
                )}
              </li>
              <li>
                {t(
                  "whitepaper_s4_li4_sub2",
                  "Progressive token release to avoid market fluctuations."
                )}
              </li>
            </ul>
          </ul>
          <p>
            {t(
              "whitepaper_s4_p1",
              "⚜️ Thanks to this structure, XCANNES ensures healthy management and sustainable long-term adoption."
            )}
          </p>
        </section>
        {/* Section 5 */}
        <section id="section5" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s5_title", "5. Where to buy and store XCANNES?")}
          </h2>
          <p className="mb-3">
            <strong>{t("whitepaper_s5_buy_title", "How to buy XCS?")}</strong>
          </p>
          <ul className="list-disc pl-5 mb-3">
            <li>
              {t(
                "whitepaper_s5_buy_li1",
                "On the official site via the “Buy Now” button (dedicated platform: card, crypto, etc.)"
              )}
            </li>
            <li>
              {t(
                "whitepaper_s5_buy_li2",
                "On XRPL-compatible DEXs such as Sologenic or Orchestra Finance"
              )}
            </li>
            <li>
              {t(
                "whitepaper_s5_buy_li3",
                "Soon on CEXs (centralized exchanges) once listed"
              )}
            </li>
          </ul>
          <p className="mb-3">
            <strong>{t("whitepaper_s5_store_title", "Where to store XCS?")}</strong>
          </p>
          <ul className="list-disc pl-5">
            <li>
              {t(
                "whitepaper_s5_store_li1",
                "Cold wallets (Ledger Nano X/S, Decent...) for long-term storage"
              )}
            </li>
            <li>
              {t(
                "whitepaper_s5_store_li2",
                "XRPL-compatible hot wallets (Xaman/XUMM, GateHub...)"
              )}
            </li>
          </ul>
          <p className="mt-3">
            {t(
              "whitepaper_s5_p1",
              "⚜️ For maximum security, prefer hardware wallets to keep your tokens long term."
            )}
          </p>
        </section>

        {/* Section 6 */}
        <section id="section6" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s6_title", "6. Security and regulatory compliance")}
          </h2>
          <ul className="list-disc pl-5 mb-3">
            <li>
              {t(
                "whitepaper_s6_li1",
                "XCANNES relies on the public XRPL ledger: transparency, traceability, reliability."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s6_li2",
                "No promise of returns: XCS is a tool, not a speculative product."
              )}
            </li>
            <li>
              {t(
                "whitepaper_s6_li3",
                "Framework aligned with best practices (KYC/AML, legal compliance)."
              )}
            </li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="section7" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s7_title", "7. Roadmap & future developments")}
          </h2>
          <ul className="list-disc pl-5">
            <li>
              {t(
                "whitepaper_s7_li1",
                "📍 Phase 1: Launch and local partnerships"
              )}
            </li>
            <li>
              {t(
                "whitepaper_s7_li2",
                "📱 Phase 2: E-commerce integration & mobile apps"
              )}
            </li>
            <li>
              {t(
                "whitepaper_s7_li3",
                "🌍 Phase 3: Broad adoption, interoperability, advanced payments"
              )}
            </li>
          </ul>
          <p className="mt-3">
            {t(
              "whitepaper_s7_p1",
              "XCANNES will evolve with the needs of its territory and innovations from XRPL."
            )}
          </p>
        </section>

        {/* Section 8 */}
        <section id="section8" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            {t("whitepaper_s8_title", "8. Conclusion")}
          </h2>
          <p className="mb-3">
            {t(
              "whitepaper_s8_p1",
              "XCANNES is much more than a simple digital token: it is the digital and financial identity of a forward-looking city."
            )}
          </p>
          <p className="mb-3">
            {t(
              "whitepaper_s8_p2",
              "🌍 With XCS, Cannes modernizes its exchanges, asserts its autonomy, and becomes a pioneer among connected territories."
            )}
          </p>
          <p>
            {t(
              "whitepaper_s8_p3",
              "⚜️ A crypto in the image of Cannes: prestigious, useful, visionary."
            )}
          </p>
        </section>
        {/* Remplace les [...] par tes paragraphes complets comme déjà codés précédemment */}

        {/* Bottom Buttons */}
        <div className="flex justify-center gap-4 mt-12">
          <Link
            href="/"
            className="px-6 py-2 rounded-full font-[500] bg-xcannes-green text-white hover:bg-xcannes-green hover:text-white transition transform hover:scale-105 shadow"
          >
            {t("nav_home", "Home")}
          </Link>
          <Link
            href="/wallet"
            className="px-6 py-2 rounded-full font-[500] bg-black text-white border border-white hover:bg-white hover:text-black transition transform hover:scale-105 shadow"
          >
            {t("nav_wallet", "Wallet")}
          </Link>
        </div>

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-xcannes-green text-black px-4 py-2 rounded-full shadow-lg hover:scale-105 transition"
          >
            {t("whitepaper_scroll_top", "⬆️ Back to top")}
          </button>
        )}
      </main>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"])),
    },
  };
}
