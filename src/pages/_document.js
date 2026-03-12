import Document, { Html, Head, Main, NextScript } from "next/document";

/**
 * _document.js — Injecte le nonce CSP dans tous les scripts Next.js.
 *
 * Le nonce est généré par src/middleware.js et transmis via le header `x-nonce`.
 * <Head nonce> et <NextScript nonce> l'appliquent à tous les <script> générés.
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
