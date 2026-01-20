	import Link from "next/link";
	import { useTranslation } from "next-i18next";
	import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function WhyXcannesSection() {
  const { t } = useTranslation("common");

  return (
    <section id="final-cta" className="relative py-20 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto text-center">
        <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
          {t("home_v2_final_title", "Commencez par la démo, puis ouvrez le wallet.")}
        </h2>
        <p className="text-center text-white/70 text-base sm:text-lg max-w-2xl mx-auto">
          {t("home_v2_final_subtitle", "Simple à comprendre. Prêt à utiliser.")}
        </p>

        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center items-center">
          <Link
            href="/wallet"
            className={bankButtonClassName({ tone: "blue", variant: "soft", size: "lg" })}
          >
            {t("home_v2_final_cta_primary", "Ouvrir le wallet")}
          </Link>
        </div>
      </div>
    </section>
  );
}
