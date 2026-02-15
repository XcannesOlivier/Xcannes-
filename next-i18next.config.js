module.exports = {
  fallbackLng: "en",
  use: [
    {
      type: "postProcessor",
      name: "glossaryTokens",
      process: (value) => {
        if (typeof value !== "string") return value;

        const mapGlossaire = {
          "1": "XCANNES",
          "5": "RLUSD",
          "7": "XRPL",
          "10": "RLUSD",
          "11": "XRP",
          "12": "WSJ",
          "13": "DEX",
        };

        const mapGlossary = {
          "1": "XCANNES",
          "2": "XCANNES",
          "5": "RLUSD",
          "6": "RLUSD",
          "7": "XRPL",
          "9": "XRPL",
          "13": "XRP",
        };

        // Replace broken glossary placeholders produced by machine translation.
        // Examples seen in locales: `_GLOSSAIRE_1___`, `__GLOSSARY_7__`, `__GLOSSARY_5_`.
        const replaced = value
          .replace(/_+GLOSSAIRE_(\d+)_+/g, (m, idx) => mapGlossaire[idx] || m)
          .replace(/_+GLOSSARY_(\d+)_+/g, (m, idx) => mapGlossary[idx] || m);

        // Heuristics for ambiguous `_GLOSSARY_*` tokens: keep scope narrow to avoid wrong replacements.
        // Seen in FR locales: `_GLOSSARY_11__ Ledger` should become `XRP Ledger`.
        return replaced
          .replace(/_+GLOSSARY_11_+(?=\s*Ledger\b)/g, "XRP")
          .replace(/_+GLOSSARY_11_+(?=\s*\/\s*(?:RLUSD|RLUSD)\b)/g, "XRP");
      },
    },
  ],
  postProcess: ["glossaryTokens"],
  i18n: {
    defaultLocale: "en",
    locales: [
      "en",
      "fr",
      "es",
      "zh",
      "ko",
      "ja",
      "pt",
      "hi",
      "de",
      "nl",
      "it",
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
      "rm-CH",
      "lb",
      "da-DK",
      "sv-SE",
      "no-NO",
      "fi-FI",
      "is-IS",
      "pl-PL",
      "ru-RU",
      "el-GR",
      "tr-TR",
      "th-TH",
      "vi-VN",
      "bn-BD",
      "ur-PK",
      "sw-KE",
      "wuu",
    ],
    localeDetection: false,
  },
  ns: ["common"],
  defaultNS: "common",
};
