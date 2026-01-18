"use client";

import { useRouter } from "next/router";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "next-i18next";

// Langues principales toujours visibles
const mainLanguages = [
  { code: "en", label: "English", flag: "🇬🇧", country: "United Kingdom" },
  { code: "fr", label: "Français", flag: "🇫🇷", country: "France" },
  { code: "es", label: "Español", flag: "🇪🇸", country: "Spain" },
  { code: "de", label: "Deutsch", flag: "🇩🇪", country: "Germany" },
];

const languagesByRegion = {
  europe: {
    label: "Europe",
    icon: "🇪🇺",
    languages: [
      { code: "it", label: "Italiano", flag: "🇮🇹", country: "Italy" },
      { code: "pt", label: "Português", flag: "🇵🇹", country: "Portugal" },
      { code: "nl", label: "Nederlands", flag: "🇳🇱", country: "Netherlands" },
      { code: "pl-PL", label: "Polski", flag: "🇵🇱", country: "Poland" },
      { code: "ru-RU", label: "Русский", flag: "🇷🇺", country: "Russia" },
      { code: "el-GR", label: "Ελληνικά", flag: "🇬🇷", country: "Greece" },
      { code: "tr-TR", label: "Türkçe", flag: "🇹🇷", country: "Turkey" },
      { code: "da-DK", label: "Dansk", flag: "🇩🇰", country: "Denmark" },
      { code: "sv-SE", label: "Svenska", flag: "🇸🇪", country: "Sweden" },
      { code: "no-NO", label: "Norsk", flag: "🇳🇴", country: "Norway" },
      { code: "fi-FI", label: "Suomi", flag: "🇫🇮", country: "Finland" },
      { code: "is-IS", label: "Íslenska", flag: "🇮🇸", country: "Iceland" },
      { code: "rm-CH", label: "Rumantsch", flag: "🇨🇭", country: "Switzerland" },
      {
        code: "lb",
        label: "Lëtzebuergesch",
        flag: "🇱🇺",
        country: "Luxembourg",
      },
    ],
  },
  asia: {
    label: "Asia",
    icon: "🇨🇳",
    languages: [
      { code: "zh", label: "中文", flag: "🇨🇳", country: "China" },
      { code: "wuu", label: "吴语", flag: "🇨🇳", country: "China" },
      { code: "ja", label: "日本語", flag: "🇯🇵", country: "Japan" },
      { code: "ko", label: "한국어", flag: "🇰🇷", country: "South Korea" },
      { code: "hi", label: "हिन्दी", flag: "🇮🇳", country: "India" },
      { code: "th-TH", label: "ไทย", flag: "🇹🇭", country: "Thailand" },
      { code: "vi-VN", label: "Tiếng Việt", flag: "🇻🇳", country: "Vietnam" },
      { code: "bn-BD", label: "বাংলা", flag: "🇧🇩", country: "Bangladesh" },
      { code: "ur-PK", label: "اردو", flag: "🇵🇰", country: "Pakistan" },
    ],
  },
  middleEast: {
    label: "Middle East",
    icon: "🇦🇪",
    languages: [
      { code: "ar", label: "العربية", flag: "🇸🇦", country: "Saudi Arabia" },
      { code: "ar-AE", label: "العربية", flag: "🇦🇪", country: "UAE" },
      { code: "ar-QA", label: "العربية", flag: "🇶🇦", country: "Qatar" },
      { code: "ar-KW", label: "العربية", flag: "🇰🇼", country: "Kuwait" },
      { code: "ar-BH", label: "العربية", flag: "🇧🇭", country: "Bahrain" },
      { code: "ar-OM", label: "العربية", flag: "🇴🇲", country: "Oman" },
      { code: "ar-YE", label: "العربية", flag: "🇾🇪", country: "Yemen" },
      { code: "ar-JO", label: "العربية", flag: "🇯🇴", country: "Jordan" },
      { code: "ar-PS", label: "العربية", flag: "🇵🇸", country: "Palestine" },
      { code: "ar-IQ", label: "العربية", flag: "🇮🇶", country: "Iraq" },
      { code: "ar-LB", label: "العربية", flag: "🇱🇧", country: "Lebanon" },
      { code: "ar-SY", label: "العربية", flag: "🇸🇾", country: "Syria" },
    ],
  },
  africa: {
    label: "Africa",
    icon: "🌍",
    languages: [
      { code: "ar-EG", label: "العربية", flag: "🇪🇬", country: "Egypt" },
      { code: "ar-SD", label: "العربية", flag: "🇸🇩", country: "Sudan" },
      { code: "ar-MA", label: "الدارجة", flag: "🇲🇦", country: "Morocco" },
      { code: "ar-DZ", label: "الدارجة", flag: "🇩🇿", country: "Algeria" },
      { code: "ar-TN", label: "التونسي", flag: "🇹🇳", country: "Tunisia" },
      { code: "ar-LY", label: "العربية", flag: "🇱🇾", country: "Libya" },
      { code: "ar-MR", label: "العربية", flag: "🇲🇷", country: "Mauritania" },
      { code: "sw-KE", label: "Kiswahili", flag: "🇰🇪", country: "Kenya" },
    ],
  },
};

const getAllLanguages = () => {
  const allLangs = [...mainLanguages];
  Object.values(languagesByRegion).forEach((region) => {
    allLangs.push(...region.languages);
  });
  return allLangs;
};

export default function LanguageSwitcher({ variant = "dropdown", onSelect }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [isOpen, setIsOpen] = useState(false);
  const [openRegion, setOpenRegion] = useState(null);
  const dropdownRef = useRef(null);
  const isInline = variant === "inline";

  const supportedLocales = new Set(router?.locales || []);
  const allLanguages = getAllLanguages().filter((lang) =>
    supportedLocales.size ? supportedLocales.has(lang.code) : true
  );
  const currentLanguage =
    allLanguages.find((lang) => lang.code === router.locale) ||
    allLanguages[0] || {
      code: router?.locale || router?.defaultLocale || "en",
      label: "Language",
      flag: "🌐",
      country: "",
    };

  useEffect(() => {
    if (isInline) return;
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
        setOpenRegion(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isInline]);

  const changeLanguage = (locale, country) => {
    // Stocker le pays dans localStorage pour que NewsFeed puisse le lire
    if (typeof window !== 'undefined') {
      localStorage.setItem('selectedCountry', country);
      localStorage.setItem("NEXT_LOCALE", locale);
      document.cookie = `NEXT_LOCALE=${encodeURIComponent(
        locale
      )}; path=/; max-age=31536000; samesite=lax`;
      // Déclencher un event custom pour notifier NewsFeed
      window.dispatchEvent(new CustomEvent('countryChanged', { detail: { country } }));
    }
    
    onSelect?.();
    const { pathname, asPath, query } = router;
    router.push({ pathname, query }, asPath, { locale });
    setIsOpen(false);
    setOpenRegion(null);
  };

  const toggleRegion = (regionKey) => {
    setOpenRegion(openRegion === regionKey ? null : regionKey);
  };

  return (
    <div
      ref={dropdownRef}
      className={`${isInline ? "w-full text-[11px]" : "relative text-[11px]"}`}
    >
      {!isInline && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-lg transition-all duration-300"
          aria-label={t("langswitcher_aria_label", "Change language")}
        >
          <span className="text-lg">{currentLanguage.flag}</span>
          <span className="hidden sm:inline text-[11px] font-medium text-white/80">
            {currentLanguage.code.toUpperCase()}
          </span>
          <svg
            className={`w-4 h-4 text-white/60 transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      )}

      {(isInline || isOpen) && (
        <div
          className={`${
            isInline
              ? "w-full bg-transparent border-0 shadow-none rounded-none"
              : "absolute right-0 top-full mt-2 w-30 bg-black/95 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-50 animate-fadeIn"
          } overflow-hidden max-h-[400px] overflow-y-auto`}
        >
          <div className="border-b-2 border-white/20">
            <div className="px-2 py-1 bg-white/10">
              <span className="text-[9px] font-bold text-white/60 uppercase tracking-wide">
                {t("langswitcher_main_label", "Main")}
              </span>
            </div>
            {mainLanguages
              .filter((lang) =>
                supportedLocales.size ? supportedLocales.has(lang.code) : true
              )
              .map((lang) => (
              <button
                key={lang.code}
                onClick={() => changeLanguage(lang.code, lang.country)}
                className={`w-full flex items-center gap-1.5 px-2 py-1.5 transition-all duration-200 ${
                  currentLanguage.code === lang.code
                    ? "bg-xcannes-green/20 text-xcannes-green"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="text-base">{lang.flag}</span>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-xs font-semibold">{lang.label}</div>
                  <div className="text-[9px] opacity-60 truncate">
                    {lang.country}
                  </div>
                </div>
                {currentLanguage.code === lang.code && (
                  <svg
                    className="w-3 h-3 text-xcannes-green flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            ))}
          </div>

          <div className="px-2 py-1 bg-white/5">
            <span className="text-[9px] font-bold text-white/60 uppercase tracking-wide">
              {t("langswitcher_regions_label", "Regions")}
            </span>
          </div>

          {Object.entries(languagesByRegion).map(([regionKey, region]) => {
            const regionLanguages = region.languages.filter((lang) =>
              supportedLocales.size ? supportedLocales.has(lang.code) : true
            );
            if (!regionLanguages.length) return null;
            return (
              <div
                key={regionKey}
                className="border-b border-white/10 last:border-b-0"
              >
              <button
                onClick={() => toggleRegion(regionKey)}
                className="w-full flex items-center justify-between px-2 py-1.5 bg-white/5 hover:bg-white/10 transition-all duration-200"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">{region.icon}</span>
                  <span className="text-[10px] font-bold text-white/90">
                    {region.label}
                  </span>
                </div>
                <svg
                  className={`w-3 h-3 text-white/60 transition-transform duration-200 flex-shrink-0 ${
                    openRegion === regionKey ? "rotate-180" : ""
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>

              {openRegion === regionKey && (
                <div className="bg-black/50">
                  {regionLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => changeLanguage(lang.code, lang.country)}
                      className={`w-full flex items-center gap-1.5 px-4 py-1 transition-all duration-200 ${
                        currentLanguage.code === lang.code
                          ? "bg-xcannes-green/20 text-xcannes-green"
                          : "text-white/70 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="text-sm">{lang.flag}</span>
                      <div className="flex-1 text-left min-w-0">
                        <div className="text-[10px] font-medium truncate">
                          {lang.label}
                        </div>
                        <div className="text-[8px] opacity-60 truncate">
                          {lang.country}
                        </div>
                      </div>
                      {currentLanguage.code === lang.code && (
                        <svg
                          className="w-2.5 h-2.5 text-xcannes-green flex-shrink-0"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
