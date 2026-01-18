"use client";

import Head from "next/head";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
/**
 * Composant SEO professionnel pour méta tags
 * Optimisé pour Google, réseaux sociaux et accessibilité
 */
export default function SEOHead({
  title,
  description,
  canonical,
  ogImage = "/assets/img/og-image.jpg",
  ogType = "website",
}) {
  const router = useRouter();
  const { t } = useTranslation("common");

  const resolvedTitle =
    title || t("seo_default_title", "XCANNES | Compte multi-devises");
  const resolvedDescription =
    description ||
    t(
      "seo_default_description",
      "Trade and manage assets on XRPL with a fast, secure, and transparent experience."
    );

  const toOgLocale = (locale) => {
    if (!locale) return "en_US";
    if (locale.includes("-")) return locale.replace("-", "_");
    const fallback = {
      en: "en_US",
      fr: "fr_FR",
      es: "es_ES",
      de: "de_DE",
      it: "it_IT",
      nl: "nl_NL",
      pt: "pt_PT",
      ar: "ar_SA",
      hi: "hi_IN",
      zh: "zh_CN",
      ja: "ja_JP",
      ko: "ko_KR",
    };
    return fallback[locale] || `${locale}_${locale.toUpperCase()}`;
  };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://xcannes.com";
  const fullCanonical = canonical ? `${siteUrl}${canonical}` : siteUrl;
  const ogLocale = toOgLocale(router?.locale);
  return (
    <Head>
      {/* Meta de base */}
      <title>{resolvedTitle}</title>
      <meta name="description" content={resolvedDescription} />
      <link rel="canonical" href={fullCanonical} />
      {/* Open Graph (Facebook, LinkedIn) */}
      <meta property="og:type" content={ogType} />
      <meta property="og:title" content={resolvedTitle} />
      <meta property="og:description" content={resolvedDescription} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:image" content={`${siteUrl}${ogImage}`} />
      <meta property="og:site_name" content="XCannes" />
      <meta property="og:locale" content={ogLocale} />
      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={resolvedTitle} />
      <meta name="twitter:description" content={resolvedDescription} />
      <meta name="twitter:image" content={`${siteUrl}${ogImage}`} />
      {/* Données structurées (Schema.org) */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "FinancialService",
            name: "XCannes",
            description: resolvedDescription,
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
