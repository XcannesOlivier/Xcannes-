import nextI18NextConfig from "../../next-i18next.config";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";

export async function getPageTranslations(locale, namespaces = ["common"]) {
  const safeLocale = locale || nextI18NextConfig?.i18n?.defaultLocale || "en";
  const safeNamespaces = Array.isArray(namespaces) ? namespaces : ["common"];

  // Always preload English resources so incomplete locales can fall back cleanly.
  return serverSideTranslations(safeLocale, safeNamespaces, nextI18NextConfig, [
    "en",
  ]);
}

