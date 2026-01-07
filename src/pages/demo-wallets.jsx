import SEOHead from "@/components/layout/SEOHead";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import Link from "next/link";

export default function DemoWalletsComparePage() {
  const { t } = useTranslation("common");

  return (
    <>
      <SEOHead
        title={t("demo_compare_title", "XCANNES — Démo : Wallet A / Wallet B")}
        description={t(
          "demo_compare_desc",
          "Comparez Wallet A et Wallet B côte à côte (démo fictive)."
        )}
        canonical="/demo-wallets"
      />

      <Link
        href="/"
        className="fixed top-4 right-4 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/30 border border-white/10 text-white/70 hover:text-white hover:bg-black/40 transition-colors"
        aria-label={t("demo_compare_close", "Retour à l’accueil")}
        title={t("demo_compare_close", "Retour à l’accueil")}
      >
        ✕
      </Link>

      <main className="min-h-screen bg-xcannes-background px-4 sm:px-6 pt-10 pb-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-end justify-between gap-4 mb-6">
            <div className="min-w-0">
              <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-2">
                {t("demo_compare_badge", "Démo")}
              </p>
              <h1 className="text-2xl sm:text-3xl font-montserrat font-semibold text-white">
                {t("demo_compare_h1", "Wallet A / Wallet B")}
              </h1>
              <p className="mt-2 text-sm text-white/60 max-w-2xl">
                {t(
                  "demo_compare_subtitle",
                  "Démo fictive : comparez les deux wallets côte à côte. Aucune transaction réelle."
                )}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden min-h-[680px]">
              <DemoWalletDashboard
                defaultWalletId="A"
                theme="home"
                showWalletSwitcher={false}
                showCompareLink={false}
              />
            </div>
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden min-h-[680px]">
              <DemoWalletDashboard
                defaultWalletId="B"
                theme="dex"
                showWalletSwitcher={false}
                showCompareLink={false}
              />
            </div>
          </div>
        </div>
      </main>
    </>
  );
}

export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
