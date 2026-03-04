import Link from "next/link";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import SEOHead from "@/components/layout/SEOHead";

export default function Custom404() {
  const { t } = useTranslation("common");

  return (
    <>
      <SEOHead title="404 - XCANNES" description="Page not found" />
      <main className="min-h-screen flex flex-col items-center justify-center bg-[#0b0f10] text-white font-montserrat px-4">
        <h1 className="text-6xl font-bold text-[#c9a84c] mb-4">404</h1>
        <p className="text-white/60 text-lg mb-8">
          {t("error_page_not_found", "Cette page n'existe pas.")}
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-[#c9a84c] hover:bg-[#b89a40] text-[#0a0a0a] font-semibold rounded-xl transition-all duration-200 hover:scale-105 active:scale-95"
        >
          {t("nav_home", "Page d'accueil")}
        </Link>
      </main>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"])),
    },
  };
}
