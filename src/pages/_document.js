import Document, { Html, Head, Main, NextScript } from "next/document";

/**
 * _document.js — Injecte le nonce CSP dans tous les scripts Next.js.
 *
 * Le nonce peut être généré en amont (middleware / reverse proxy) et transmis
 * via le header `x-nonce`. Si absent, le nonce reste vide (aucun impact tant
 * qu'aucun CSP "script-src nonce-…" n'est activé côté headers).
 */
export default function XcannesDocument(props) {
  const nonce = props.nonce || "";
  const locale = props.__NEXT_DATA__.locale || "en";

  // Liste des locales RTL : 19 arabes + ourdou
  const rtlLocales = [
    "ar",
    "ar-AE",
    "ar-QA",
    "ar-KW",
    "ar-BH",
    "ar-OM",
    "ar-YE",
    "ar-EG",
    "ar-SD",
    "ar-LB",
    "ar-SY",
    "ar-MA",
    "ar-DZ",
    "ar-TN",
    "ar-LY",
    "ar-MR",
    "ar-JO",
    "ar-PS",
    "ar-IQ",
    "ur-PK",
  ];

  const isRTL = rtlLocales.includes(locale);
  const direction = isRTL ? "rtl" : "ltr";

  return (
    <Html lang={locale} dir={direction}>
      <Head nonce={nonce}>
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        {/* PWA manifest — verrouille l'orientation en portrait */}
        <link rel="manifest" href="/manifest.json" />
        {/* iOS PWA */}
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Xcannes" />
        <meta name="theme-color" content="#05090f" />
      </Head>
      <body>
        <Main />
        <NextScript nonce={nonce} />
      </body>
    </Html>
  );
}

XcannesDocument.getInitialProps = async (ctx) => {
  const initialProps = await Document.getInitialProps(ctx);
  const nonce = ctx.req?.headers?.["x-nonce"] || "";
  return { ...initialProps, nonce };
};
