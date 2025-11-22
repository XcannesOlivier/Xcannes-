import { Html, Head, Main, NextScript } from "next/document";

export default function Document(props) {
  // Détection des langues RTL (Right-To-Left)
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
      <Head>
        <script src="https://xumm.app/assets/cdn/xumm.min.js"></script>
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
