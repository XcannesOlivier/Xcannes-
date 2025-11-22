"use client";

import Head from "next/head";
/**
 * Composant SEO professionnel pour méta tags
 * Optimisé pour Google, réseaux sociaux et accessibilité
 */
export default function SEOHead({
  title = "XCannes - Bureau de change crypto",
  description = "Échangez vos devises instantanément via blockchain à Cannes. XCS : rapide, sécurisé, transparent.",
  canonical,
  ogImage = "/assets/img/og-image.jpg",
  ogType = "website",
}) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://xcannes.com";
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : siteUrl;
  return (
    <Head>
      {/* Meta de base */}
      <title>{title}</title>
      <meta name="description" content={description} />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <link rel="canonical" href={fullCanonical} />
      {/* Open Graph (Facebook, LinkedIn) */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      <meta property="og:site_name" content="XCannes" />
      <meta property="og:locale" content="fr_FR" />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />
      {/* Données structurées (Schema.org) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            name: "XCannes",
            description: description,
            url: siteUrl,
            areaServed: "Cannes, France",
            serviceType: "Currency Exchange, Cryptocurrency",
          }),
        }}
      />
      {/* Favicons */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    </Head>
  );
}
