import { useEffect, useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import WalletEssentialsCards from "@/components/home/WalletEssentialsCards";

const DEMO_CARD_EVENT = "xcannes:demo-wallet:card";
const DEMO_CARD_CTA_EVENT = "xcannes:demo-wallet:cta";
const DEMO_CARD_KEY_BY_ACTION = {
  send: "pay",
  request: "receive_request",
  convert: "convert",
  buy: "buy",
  sell: "buy",
  statement_global: "statements",
  statement_currency: "statements",
  trustline_add: "lines",
  trustline_remove: "lines",
  trustline_update: "lines"
};

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const [demoWalletId, setDemoWalletId] = useState("A");
  const cardsRef = useRef(null);
  const walletRef = useRef(null);
  const scrollOriginRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const isElementVisible = (element) => {
      if (!element) return false;
      const rect = element.getBoundingClientRect();
      return rect.bottom > 0 && rect.top < window.innerHeight;
    };

    const handleDemoCard = (event) => {
      const cardsEl = cardsRef.current;
      const walletEl = walletRef.current;
      if (!cardsEl || !walletEl) return;

      const isMobile =
        window.matchMedia("(max-width: 1023px)").matches &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (!isMobile) return;
      if (!isElementVisible(walletEl)) {
        scrollOriginRef.current = null;
        return;
      }

      const detail = event?.detail || {};
      const cardKey = detail.cardKey || DEMO_CARD_KEY_BY_ACTION[detail.action];
      const targetEl = cardKey
        ? cardsEl.querySelector(`[data-essentials-card-key="${cardKey}"]`)
        : null;
      const scrollTarget = targetEl || cardsEl;
      if (isElementVisible(scrollTarget)) {
        scrollOriginRef.current = null;
        return;
      }

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const behavior = prefersReducedMotion ? "auto" : "smooth";

      scrollOriginRef.current = window.scrollY;
      scrollTarget.scrollIntoView({ behavior, block: "center" });
    };

    const handleReturnToWallet = (event) => {
      const detail = event?.detail || {};
      if (detail.action !== "return_wallet") return;
      const walletEl = walletRef.current;
      if (!walletEl) return;
      const isMobile =
        window.matchMedia("(max-width: 1023px)").matches &&
        window.matchMedia("(hover: none) and (pointer: coarse)").matches;
      if (!isMobile) return;

      const prefersReducedMotion = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
      ).matches;
      const behavior = prefersReducedMotion ? "auto" : "smooth";
      const origin = scrollOriginRef.current;
      scrollOriginRef.current = null;
      if (origin != null) {
        window.scrollTo({ top: Math.max(0, origin), behavior });
      } else {
        walletEl.scrollIntoView({ behavior, block: "start" });
      }
    };

    window.addEventListener(DEMO_CARD_EVENT, handleDemoCard);
    window.addEventListener(DEMO_CARD_CTA_EVENT, handleReturnToWallet);
    return () => {
      window.removeEventListener(DEMO_CARD_EVENT, handleDemoCard);
      window.removeEventListener(DEMO_CARD_CTA_EVENT, handleReturnToWallet);
    };
  }, []);

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(
              "home_v2_demo_title",
              "Une interface de compte, en multi‑devises."
            )}
          </h2>
          <p className="text-base sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto">
            {t(
              "home_v2_demo_subtitle",
              "Les essentiels, au quotidien."
            )}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="flex flex-col gap-8">
            <div className="order-1 lg:order-2" ref={cardsRef}>
              <WalletEssentialsCards variant="home" />
            </div>

          </div>

          <div
            className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden"
            ref={walletRef}
          >
            <div className="px-5 py-4 border-b border-white/10">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base text-white/70 min-w-0">
                  {t("home_v2_demo_preview_title", "Démo interactive (fictive)")}
                </p>
                <div className="inline-flex rounded-lg bg-black/20 border border-white/10 p-1 flex-shrink-0">
                  {["A", "B"].map((id) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setDemoWalletId(id)}
                      className={[
                        "px-2.5 md:px-3 py-1.5 text-xs rounded-md transition-colors border",
                        demoWalletId === id
                          ? id === "A"
                            ? "bg-xcannes-green/10 border-xcannes-green/30 text-xcannes-green"
                            : "bg-xcannes-blue-light/10 border-xcannes-blue-light/30 text-xcannes-blue-light"
                          : "border-transparent text-white/60 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="md:hidden">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                      <span className="hidden md:inline">
                        {t("demo_wallet_label", "Wallet")} {id}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="h-[680px] md:h-[720px] overflow-hidden">
              <DemoWalletDashboard
                key={demoWalletId}
                defaultWalletId={demoWalletId}
                theme={demoWalletId === "B" ? "dex" : "home"}
                showWalletSwitcher={false}
                showCompareLink={true}
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
