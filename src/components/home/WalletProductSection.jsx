	import Link from "next/link";
	import { useTranslation } from "next-i18next";
	import WalletDashboard from "@/components/wallet/WalletDashboard";
	import { useXumm } from "@/context/XummContext";
	import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();

  const actions = [
    {
      key: "send",
      title: t("home_action_send_title", "SEND"),
      desc: t(
        "home_action_send_desc",
        "Envoyez dans la devise choisie, XCANNES règle via un stablecoin USD sur le XRPL."
      ),
    },
    {
      key: "pay",
      title: t("home_action_pay_title", "PAY"),
      desc: t(
        "home_action_pay_desc",
        "Payez via QR code (mobile), validation sécurisée via Xumm/Xaman."
      ),
    },
    {
      key: "convert",
      title: t("home_action_convert_title", "CONVERT"),
      desc: t(
        "home_action_convert_desc",
        "Convertissez entre lignes de devises, en temps réel (Pyth) ou journalier."
      ),
    },
  ];

  return (
    <section className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-widest text-xcannes-green mb-3 font-light">
            {t("home_product_badge", "Wallet multi-devises adossé au dollar (USD)")}
          </p>
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(
              "home_product_title",
              "La stabilité d’un dollar, l’expérience d’une monnaie locale."
            )}
          </h2>
          <p className="text-base sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto">
            {t(
              "home_product_subtitle",
              "Vous payez et envoyez en EUR, MXN, ARS… mais la valeur reste adossée au dollar (USD) sur le XRPL."
            )}
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-10 items-start">
          <div className="space-y-8">
            <div className="grid sm:grid-cols-3 gap-4">
              {actions.map((action) => (
                <div
                  key={action.key}
                  className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-5 shadow-2xl"
                >
                  <div className="text-xcannes-green font-montserrat font-semibold tracking-widest text-xs uppercase">
                    {action.title}
                  </div>
                  <p className="mt-2 text-sm text-white/70 leading-relaxed">
                    {action.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-white mb-3">
                {t("home_product_points_title", "Conçu pour l’usage réel")}
              </h3>
              <ul className="space-y-2 text-sm text-white/70">
                <li>
                  {t(
                    "home_product_point1",
                    "Non-custodial : vous détenez vos actifs sur le XRPL."
                  )}
                </li>
                <li>
                  {t(
                    "home_product_point2",
                    "Marchés XRPL + FX (Pyth) : prix en temps réel, transparents."
                  )}
                </li>
                <li>
                  {t(
                    "home_product_point3",
                    "On-ramp/off-ramp : achat/vente via MoonPay (selon disponibilité)."
                  )}
                </li>
                <li>
                  {t(
                    "home_product_point4",
                    "Couche de règlement : stablecoin USD agréé sur XRPL (RLUSD)."
                  )}
                </li>
              </ul>

              <div className="mt-6 flex flex-col sm:flex-row gap-3">
                <Link
                  href="/wallet"
                  className={bankButtonClassName({ tone: "blue", variant: "soft", size: "md" })}
                >
                  {t("home_product_cta_wallet", "Ouvrir le wallet")}
                </Link>
                <Link
                  href="/dex"
                  className={bankButtonClassName({ tone: "green", variant: "soft", size: "md" })}
                >
                  {t("home_product_cta_dex", "Accéder au DEX")}
                  <span className="inline-block ml-2 text-xs">→</span>
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-elevated border border-white/10 rounded-xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10">
              <p className="text-sm text-white/70">
                {t(
                  "home_wallet_preview_title",
                  "Aperçu du wallet XCANNES"
                )}
              </p>
            </div>
            <div className="max-h-[620px] overflow-hidden">
              <WalletDashboard preview={!isConnected} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
