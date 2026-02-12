import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import LanguageSwitcher, { getAllLanguages, mainLanguages } from "./LanguageSwitcher";

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

  const currentLanguage =
    allLanguages.find((lang) => lang.code === router.locale) ||
    allLanguages[0] || {
      code: router?.locale || router?.defaultLocale || "en",
      label: "Language",
      flag: "🌐",
      country: "",
    };

  const quickLanguages = useMemo(() => {
    const base = mainLanguages.filter((lang) =>
      supportedLocales.size ? supportedLocales.has(lang.code) : true
    );
    if (!base.find((lang) => lang.code === currentLanguage.code)) {
      return [...base, currentLanguage];
    }
    return base;
  }, [currentLanguage, supportedLocales]);

  const quickOthers = quickLanguages
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
    setExpanded(false);
  };

  if (isMobile) {
    return (
      <div ref={stripRef} className={`flex items-center gap-3 ${className}`}>
        <span className="text-[11px] uppercase tracking-[0.2em] text-white/50">
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
              className="text-lg font-medium text-white/70 hover:text-xcannes-green hover:underline underline-offset-4 transition-colors"
            >
              {formatLocaleInitials(lang.code)}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={t("langswitcher_open_menu", "Afficher toutes les langues")}
            className="text-lg font-medium text-white/70 hover:text-xcannes-green hover:underline underline-offset-4 transition-colors"
          >
            +
          </button>
        </div>

        <LanguageSwitcher
          hideTrigger
          open={menuOpen}
          onOpenChange={setMenuOpen}
          insideRefs={[stripRef]}
          onSelect={() => setExpanded(false)}
        />
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
        {quickOthers.map((lang, index) => (
          <button
            key={lang.code}
            type="button"
            onClick={() => changeLanguage(lang.code)}
            style={{ transitionDelay: expanded ? `${index * 100}ms` : "0ms" }}
            className={`h-7 px-2 text-lg font-medium transition-[opacity,transform,color] duration-200 ease-out hover:text-xcannes-green hover:underline underline-offset-4 ${
              expanded ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1"
            }`}
          >
            {formatLocaleInitials(lang.code)}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-label={t("langswitcher_open_menu", "Afficher toutes les langues")}
          style={{ transitionDelay: expanded ? `${quickOthers.length * 100}ms` : "0ms" }}
          className={`h-7 w-7 text-lg font-medium transition-[opacity,transform,color] duration-200 ease-out hover:text-xcannes-green hover:underline underline-offset-4 flex items-center justify-center ${
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
        className={`h-7 px-2.5 text-lg font-medium transition-colors hover:text-xcannes-green hover:underline underline-offset-4 ${
          expanded ? "text-white/70" : "text-white"
        }`}
      >
        {formatLocaleInitials(currentLanguage.code)}
      </button>

      <LanguageSwitcher
        hideTrigger
        open={menuOpen}
        onOpenChange={setMenuOpen}
        insideRefs={[stripRef]}
        onSelect={() => setExpanded(false)}
      />
    </div>
  );
}
