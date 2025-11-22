import Head from "next/head";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function Whitepaper() {
  const [showScrollTop, setShowScrollTop] = useState(false);

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
        <title>Livre Blanc - XCANNES (XCS)</title>
      </Head>

      <main className="max-w-4xl mx-auto px-6 py-16 text-white bg-black/20 rounded-lg shadow-lg font-montserrat font-[300] relative">
        {/* Top Buttons */}
        <div className="flex justify-center gap-4 mb-10">
          <Link href="/" className="px-6 py-2 rounded-full font-[500] bg-xcannes-green text-white hover:bg-xcannes-green hover:text-white transition transform hover:scale-105 shadow">
             Home
            
          </Link>
          <Link href="/dex" className="px-6 py-2 rounded-full border border-white 
          font-bolt bg-black text-white  hover:bg-white hover:text-black transition transform hover:scale-105 shadow">
              DEX
            
          </Link>
        </div>

        <header className="text-center mb-12">
          <h1 className="text-3xl font-orbitron text-xcannes-green font-[600]">📘 Livre Blanc Officiel - XCANNES (XCS)</h1>
          <p className="text-black-700 mt-2 text-sm">
            L’identité numérique et financière de Cannes et sa région
          </p>
          <p className="text-xs text-black-700 mt-1">📅 Version 1.0 — 02/02/2025</p>
        </header>

        {/* Table des matières */}
        <nav className="mb-12">
          <h2 className="text-lg text-xcannes-green font-[500] mb-3">📑 Sommaire</h2>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><a href="#section1" className="text-white hover:underline">1. XCANNES, une monnaie numérique dédiée</a></li>
            <li><a href="#section2" className="text-white hover:underline">2. Pourquoi le XRP Ledger (XRPL) ?</a></li>
            <li><a href="#section3" className="text-white hover:underline">3. Un jeton pour l’économie locale</a></li>
            <li><a href="#section4" className="text-white hover:underline">4. Économie du jeton</a></li>
            <li><a href="#section5" className="text-white hover:underline">5. Où acheter et stocker XCS</a></li>
            <li><a href="#section6" className="text-white hover:underline">6. Sécurité et conformité</a></li>
            <li><a href="#section7" className="text-white hover:underline">7. Feuille de route</a></li>
            <li><a href="#section8" className="text-white hover:underline">8. Conclusion</a></li>
          </ul>
        </nav>

        {/* Sections complètes ici... */}
         {/* Section 1 */}
         <section id="section1"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">1. XCANNES, une monnaie numérique dédiée à Cannes et sa région</h2>
          <p className="mb-3">
            Le XCANNES (XCS) est un jeton numérique conçu pour s’intégrer dans l’écosystème économique de Cannes et sa région, une destination emblématique reconnue pour son dynamisme économique, son rayonnement international et son activité culturelle.
          </p>
          <ul className="list-disc pl-5 mb-3">
            <li>Créer une identité numérique forte pour Cannes, à l’image de son prestige.</li>
            <li>Offrir un moyen de paiement rapide, fiable et peu coûteux pour les commerçants et utilisateurs.</li>
            <li>Développer une alternative moderne et décentralisée pour faciliter les échanges locaux.</li>
          </ul>
          <p>
            XCANNES vise à accompagner l’évolution numérique de la ville, en proposant une monnaie digitale qui reflète l’identité et l’exclusivité de Cannes, tout en restant accessible à tous, y compris aux visiteurs et aux acteurs économiques de la région.
          </p>
        </section>

        {/* Section 2 */}
        <section id="section2"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">2. Pourquoi le XRP Ledger (XRPL) ?</h2>
          <p className="mb-3">
            Le XCANNES (XCS) est basé sur le XRP Ledger (XRPL), un registre distribué performant, reconnu pour sa sécurité, rapidité et faible coût des transactions.
          </p>
          <ul className="list-disc pl-5">
            <li>Transactions rapides : validation en 3 à 5 secondes.</li>
            <li>Frais ultra-bas : inférieurs à 0,0002 € par transaction.</li>
            <li>Écologique : pas de minage, consommation énergétique réduite.</li>
            <li>Fiabilité prouvée : actif depuis 2012, jamais compromis.</li>
            <li>Évolutivité : jusqu’à 1 500 transactions/seconde.</li>
            <li>Interopérabilité : compatible avec d’autres actifs numériques.</li>
          </ul>
          <p className="mt-3">
            ⚜️ Le XRPL garantit à XCANNES une infrastructure robuste, rapide et évolutive — parfaitement adaptée à une ville moderne comme Cannes.
          </p>
        </section>
                {/* Section 3 */}
          <section id="section3"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">
            3. Un jeton conçu pour l’économie locale et régionale
          </h2>
          <p className="mb-3">
            Le XCANNES a été pensé pour soutenir et moderniser l’économie locale, en offrant un moyen de paiement digital adapté aux besoins des commerçants, habitants et visiteurs.
          </p>
          <ul className="list-disc pl-5">
            <li>Moyen de paiement universel dans les commerces, hôtels, restaurants et services locaux.</li>
            <li>Accès privilégié à des offres et expériences exclusives en XCS.</li>
            <li>Utilisation possible lors d’événements emblématiques (Festival de Cannes, etc.).</li>
            <li>Développement futur vers e-commerce et services digitaux.</li>
          </ul>
          <p className="mt-3">
            XCANNES n’est pas qu’un jeton, c’est un levier économique et un outil d’innovation au service de la ville et de sa région.
          </p>
        </section>

        {/* Section 4 */}
        <section id="section4"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">4. Économie du jeton XCANNES (XCS)</h2>
          <ul className="list-disc pl-5 mb-3">
            <li><strong>Offre totale fixe :</strong> 2 006 400 XCS. Aucun nouveau jeton ne pourra être créé après l’émission initiale.</li>
            <li><strong>Divisibilité :</strong> Jusqu’à 6 décimales pour les micro-transactions.</li>
            <li><strong>Système de burning :</strong> Une fraction des frais est brûlée à chaque transaction (déflation contrôlée).</li>
            <li><strong>Distribution stratégique :</strong></li>
            <ul className="list-disc pl-6">
              <li>Jetons alloués à des partenaires et institutions locales pour stimuler l’adoption.</li>
              <li>Déblocage progressif des jetons pour éviter les fluctuations de marché.</li>
            </ul>
          </ul>
          <p>
            ⚜️ Grâce à cette structure, XCANNES assure une gestion saine et une adoption durable sur le long terme.
          </p>
        </section>
        {/* Section 5 */}
        <section id="section5"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">5. Où acheter et stocker XCANNES ?</h2>
          <p className="mb-3"><strong>Comment acheter XCS ?</strong></p>
          <ul className="list-disc pl-5 mb-3">
            <li>Sur le site officiel via le bouton “Buy Now” (plateforme dédiée : carte, crypto, etc.)</li>
            <li>Sur des DEX compatibles XRPL comme Sologenic ou Orchestra Finance</li>
            <li>Prochainement sur des CEX (plateformes centralisées) dès le listing</li>
          </ul>
          <p className="mb-3"><strong>Où stocker XCS ?</strong></p>
          <ul className="list-disc pl-5">
            <li>Cold wallets (Ledger Nano X/S, Decent...) pour le stockage long terme</li>
            <li>Hot wallets compatibles XRPL (Xaman/XUMM, GateHub...)</li>
          </ul>
          <p className="mt-3">
            ⚜️ Pour une sécurité maximale, privilégiez les portefeuilles matériels pour conserver vos tokens sur le long terme.
          </p>
        </section>

        {/* Section 6 */}
        <section id="section6"  className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">6. Sécurité et conformité réglementaire</h2>
          <ul className="list-disc pl-5 mb-3">
            <li>XCANNES repose sur le registre public XRPL : transparence, traçabilité, fiabilité</li>
            <li>Pas de promesse de rendement : XCS est un outil, pas un produit spéculatif</li>
            <li>Cadre aligné avec les bonnes pratiques (KYC/AML, conformité juridique)</li>
          </ul>
        </section>

        {/* Section 7 */}
        <section id="section7" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">7. Feuille de route & développements futurs</h2>
          <ul className="list-disc pl-5">
            <li>📍 Phase 1 : Lancement et partenariats locaux</li>
            <li>📱 Phase 2 : Intégration e-commerce & apps mobiles</li>
            <li>🌍 Phase 3 : Adoption large, interopérabilité, paiements avancés</li>
          </ul>
          <p className="mt-3">
            XCANNES évoluera avec les besoins de son territoire et les innovations du XRPL.
          </p>
        </section>

        {/* Section 8 */}
        <section id="section8" className="mb-10">
          <h2 className="text-xl text-xcannes-green font-medium mb-2">8. Conclusion</h2>
          <p className="mb-3">
            XCANNES est bien plus qu’un simple jeton numérique : c’est l’identité numérique et financière d’une ville tournée vers l’avenir.
          </p>
          <p className="mb-3">
            🌍 Avec XCS, Cannes modernise ses échanges, affirme son autonomie, et devient une pionnière des territoires connectés.
          </p>
          <p>
            ⚜️ Une crypto à l’image de Cannes : prestigieuse, utile, visionnaire.
          </p>
        </section>
        {/* Remplace les [...] par tes paragraphes complets comme déjà codés précédemment */}

        {/* Bottom Buttons */}
        <div className="flex justify-center gap-4 mt-12">
          <Link href="/" className="px-6 py-2 rounded-full font-[500] bg-xcannes-green text-white hover:bg-xcannes-green hover:text-white transition transform hover:scale-105 shadow">
             Home
            
          </Link>
          <Link href="/dex" className="px-6 py-2 rounded-full font-[500] bg-black text-white border border-white hover:bg-white hover:text-black transition transform hover:scale-105 shadow">
              DEX
            
          </Link>
        </div>

        {/* Scroll to top button */}
        {showScrollTop && (
          <button
            onClick={scrollToTop}
            className="fixed bottom-6 right-6 z-50 bg-xcannes-green text-black px-4 py-2 rounded-full shadow-lg hover:scale-105 transition"
          >
            ⬆️ Haut de page
          </button>
        )}
      </main>
    </>
  );
}
