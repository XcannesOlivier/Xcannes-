import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { getAllLanguages, mainLanguages } from "./LanguageSwitcher";

function formatLocaleInitials(locale) {
  const base = String(locale || "").split("-")[0] || "";
  if (!base) return "";
  return base.toUpperCase();
}

export default function HeaderLanguageStrip({ className = "" }) {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [menuOpen, setMenuOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const stripRef = useRef(null);

  const supportedLocales = useMemo(
    () => new Set(router?.locales || []),
    [router?.locales]
  );

  const allLanguages = useMemo(
    () =>
      getAllLanguages().filter((lang) =>
        supportedLocales.size ? supportedLocales.has(lang.code) : true
      ),
    [supportedLocales]
  );

  const currentLanguage = useMemo(() => {
    return (
      allLanguages.find((lang) => lang.code === router.locale) ||
      allLanguages[0] || {
        code: router?.locale || router?.defaultLocale || "en",
        label: "Language",
        flag: "🌐",
        country: "",
      }
    );
  }, [allLanguages, router?.defaultLocale, router?.locale]);

  const quickLanguages = useMemo(() => {
    const base = mainLanguages.filter((lang) =>
      supportedLocales.size ? supportedLocales.has(lang.code) : true
    );
    if (!base.find((lang) => lang.code === currentLanguage.code)) {
      return [...base, currentLanguage];
    }
    return base;
  }, [currentLanguage, supportedLocales]);

  const quickOthersDesktop = quickLanguages
    .filter((lang) => lang.code !== currentLanguage.code)
    .slice()
    .reverse();

  const preferredOrder = useMemo(() => ["fr", "es", "en", "de"], []);
  const mobileOthers = useMemo(() => {
    const rankFor = (code) => {
      const base = String(code || "").split("-")[0].toLowerCase();
      const idx = preferredOrder.indexOf(base);
      return idx === -1 ? 999 : idx;
    };
    return quickLanguages
      .filter((lang) => lang.code !== currentLanguage.code)
      .slice()
      .sort((a, b) => rankFor(a.code) - rankFor(b.code));
  }, [currentLanguage.code, preferredOrder, quickLanguages]);

  const filteredLanguages = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return allLanguages;
    const scored = allLanguages
      .map((lang) => {
        const code = String(lang.code || "").toLowerCase();
        const label = String(lang.label || "").toLowerCase();
        const country = String(lang.country || "").toLowerCase();
        let score = 99;
        if (code.startsWith(term)) score = 0;
        else if (label.startsWith(term)) score = 1;
        else if (country.startsWith(term)) score = 2;
        else if (code.includes(term)) score = 3;
        else if (label.includes(term)) score = 4;
        else if (country.includes(term)) score = 5;
        if (score === 99) return null;
        return { lang, score };
      })
      .filter(Boolean)
      .sort((a, b) => {
        if (a.score !== b.score) return a.score - b.score;
        return String(a.lang.label || "").localeCompare(String(b.lang.label || ""));
      });
    return scored.map((item) => item.lang);
  }, [allLanguages, searchTerm]);

  useEffect(() => {
    if (menuOpen) setExpanded(true);
  }, [menuOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(max-width: 767px)");
    const sync = () => setIsMobile(media.matches);
    sync();
    if (media.addEventListener) {
      media.addEventListener("change", sync);
      return () => media.removeEventListener("change", sync);
    }
    media.addListener(sync);
    return () => media.removeListener(sync);
  }, []);

  useEffect(() => {
    if (!expanded || menuOpen) return;
    const handleClickOutside = (event) => {
      if (stripRef.current && !stripRef.current.contains(event.target)) {
        setExpanded(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [expanded, menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    const handleClickOutside = (event) => {
      if (stripRef.current && !stripRef.current.contains(event.target)) {
        setMenuOpen(false);
        setSearchTerm("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const changeLanguage = (locale) => {
    if (typeof window !== "undefined") {
      localStorage.setItem("NEXT_LOCALE", locale);
      document.cookie = `NEXT_LOCALE=${encodeURIComponent(
        locale
      )}; path=/; max-age=31536000; samesite=lax`;
    }

    const { pathname, asPath, query } = router;
    router.push({ pathname, query }, asPath, { locale });
    setMenuOpen(false);
    setSearchTerm("");
    setExpanded(false);
  };

  if (isMobile) {
    return (
      <div ref={stripRef} className={`flex flex-col items-start gap-2 ${className}`}>
        <div className="flex items-center gap-3">
          <span className="text-lg uppercase tracking-[0.2em] text-white/50">
            {t("langswitcher_label", "Langue")}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => changeLanguage(currentLanguage.code)}
              className="text-lg font-medium text-white underline underline-offset-4"
            >
              {formatLocaleInitials(currentLanguage.code)}
            </button>
            {mobileOthers.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => changeLanguage(lang.code)}
                className="text-lg font-medium text-white/70 hover:text-white hover:underline underline-offset-4 transition-colors"
              >
                {formatLocaleInitials(lang.code)}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setMenuOpen((open) => !open);
              }}
              aria-label={t("langswitcher_open_menu", "Afficher toutes les langues")}
              className="text-lg font-medium text-white/70 hover:text-white hover:underline underline-offset-4 transition-colors"
            >
              +
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="w-full bg-black/95 border border-white/30 rounded-lg p-2 shadow-2xl">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={t("langswitcher_search", "Rechercher une langue...")}
              className="w-full bg-black/40 border border-white/30 hover:border-white/30 focus:border-white/30 rounded-md px-2 py-1.5 text-base sm:text-sm text-white placeholder:text-white/50 focus:outline-none"
              autoFocus
            />
            {searchTerm.trim().length > 0 && (
              <div className="mt-2 max-h-[240px] overflow-y-auto">
                {filteredLanguages.length === 0 ? (
                  <div className="text-xs text-white/60 px-2 py-2">
                    {t("langswitcher_no_results", "Aucun résultat")}
                  </div>
                ) : (
                  filteredLanguages.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => changeLanguage(lang.code)}
                      className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                        lang.code === currentLanguage.code
                          ? "bg-xcannes-green/15 text-xcannes-green"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                    >
                      <span className="font-semibold">{formatLocaleInitials(lang.code)}</span>
                      <span className="text-[11px] text-white/50 truncate">{lang.label}</span>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      ref={stripRef}
      className={`relative flex items-center ${className}`}
    >
      <div
        className={`flex items-center gap-1 overflow-hidden transition-[max-width,opacity,transform] duration-400 ease-out ${
          expanded
            ? "max-w-[240px] opacity-100 translate-x-0 mr-1"
            : "max-w-0 opacity-0 -translate-x-1 md:translate-x-1 pointer-events-none"
        }`}
      >
        {quickOthersDesktop.map((lang, index) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => changeLanguage(lang.code)}
            style={{ transitionDelay: expanded ? `${index * 100}ms` : "0ms" }}
            className={`h-7 px-2 text-lg font-medium transition-[opacity,transform,color] duration-200 ease-out hover:text-white hover:underline underline-offset-4 ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
            }`}
          >
            {formatLocaleInitials(lang.code)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => {
            setSearchTerm("");
            setMenuOpen((open) => !open);
          }}
          aria-label={t("langswitcher_open_menu", "Afficher toutes les langues")}
          style={{ transitionDelay: expanded ? `${quickOthersDesktop.length * 100}ms` : "0ms" }}
          className={`h-7 w-7 text-lg font-medium transition-[opacity,transform,color] duration-200 ease-out hover:text-white hover:underline underline-offset-4 flex items-center justify-center ${
            expanded ? "opacity-100 translate-x-0 text-white/80" : "opacity-0 translate-x-1 text-white/80"
          }`}
        >
          +
        </button>
      </div>

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
        aria-label={t("langswitcher_current", "Langue actuelle")}
        className={`h-7 px-2.5 text-lg font-medium transition-colors hover:text-white hover:underline underline-offset-4 ${
          expanded ? "text-white/70" : "text-white"
        }`}
      >
        {formatLocaleInitials(currentLanguage.code)}
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-full mt-2 w-72 bg-black/95 border border-white/30 rounded-lg p-2 shadow-2xl z-50">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={t("langswitcher_search", "Rechercher une langue...")}
            className="w-full bg-black/40 border border-white/30 hover:border-white/30 focus:border-white/30 rounded-md px-2 py-1.5 text-base sm:text-sm text-white placeholder:text-white/50 focus:outline-none"
            autoFocus
          />
          {searchTerm.trim().length > 0 && (
            <div className="mt-2 max-h-[280px] overflow-y-auto">
              {filteredLanguages.length === 0 ? (
                <div className="text-xs text-white/60 px-2 py-2">
                  {t("langswitcher_no_results", "Aucun résultat")}
                </div>
              ) : (
                filteredLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => changeLanguage(lang.code)}
                    className={`w-full flex items-center justify-between px-2 py-1.5 rounded text-sm transition-colors ${
                      lang.code === currentLanguage.code
                        ? "bg-xcannes-green/15 text-xcannes-green"
                        : "text-white/80 hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span className="font-semibold">{formatLocaleInitials(lang.code)}</span>
                    <span className="text-[11px] text-white/50 truncate">{lang.label}</span>
                  </button>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
