import SEOHead from "@/components/layout/SEOHead";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";
import SupportAssistantWidget from "@/components/layout/SupportAssistantWidget";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import Link from "next/link";
import { useEffect, useState } from "react";
import { buildDefaultDemoState, migrateDemoState } from "@/components/demo-wallet/DemoWalletModel";

const DEMO_STATE_STORAGE_KEY = "xcannes_demo_wallet_state_v1";

function isValidDemoState(value) {
  if (!value || typeof value !== "object") return false;
  const wallets = value.wallets;
  if (!wallets || typeof wallets !== "object") return false;
  if (!wallets.A || !wallets.B) return false;
  if (!wallets.A.allocations || !wallets.B.allocations) return false;
  return true;
}

export default function DemoWalletsComparePage() {
  const { t } = useTranslation("common");
  const [demoState, setDemoState] = useState(() => buildDefaultDemoState());
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DEMO_STATE_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (isValidDemoState(parsed)) setDemoState(migrateDemoState(parsed));
      }
    } catch (err) {
      console.warn("[demo-wallets] failed to load persisted state:", err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(DEMO_STATE_STORAGE_KEY, JSON.stringify(demoState));
    } catch (err) {
      console.warn("[demo-wallets] failed to persist state:", err);
    }
  }, [demoState, isHydrated]);

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
        className="fixed top-2 right-2 sm:top-3 sm:right-3 z-50 inline-flex items-center justify-center w-10 h-10 rounded-full bg-black/30 border border-white/10 text-white/70 hover:text-white hover:bg-black/40 transition-colors"
        aria-label={t("demo_compare_close", "Retour à l’accueil")}
        title={t("demo_compare_close", "Retour à l’accueil")}
      >
        ✕
      </Link>

      <main className="min-h-screen lg:h-screen bg-xcannes-background px-2 sm:px-3 lg:px-4 py-6 lg:py-4 lg:overflow-hidden">
        <div className="max-w-[1560px] min-[1600px]:max-w-none mx-auto h-full min-h-0">

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px_minmax(0,1fr)] min-[1600px]:grid-cols-[minmax(0,620px)_minmax(320px,1fr)_minmax(0,620px)] gap-4 pb-10 lg:pb-0 h-full min-h-0">
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden h-full min-h-0">
              <DemoWalletDashboard
                defaultWalletId="A"
                theme="home"
                showWalletSwitcher={false}
                showCompareLink={false}
                demoState={demoState}
                setDemoState={setDemoState}
              />
            </div>
            <div className="hidden lg:block h-full min-h-0 w-full">
              <WalletEssentialsCards variant="compare" />
            </div>
            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden h-full min-h-0">
              <DemoWalletDashboard
                defaultWalletId="B"
                theme="dex"
                showWalletSwitcher={false}
                showCompareLink={false}
                demoState={demoState}
                setDemoState={setDemoState}
              />
            </div>
          </div>
        </div>
      </main>

      <SupportAssistantWidget />
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
