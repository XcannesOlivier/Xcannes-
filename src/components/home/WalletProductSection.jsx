import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "next-i18next";
import DemoWalletDashboard from "@/components/demo-wallet/DemoWalletDashboard";
import { bankButtonClassName } from "@/components/ui/bankButtonClassName";

export default function WalletProductSection() {
  const { t } = useTranslation("common");
  const [demoWalletId, setDemoWalletId] = useState("A");

  const actions = [
    {
      key: "send",
      title: t("home_v2_demo_action_send_title", "ENVOYER"),
      desc: t(
        "home_v2_demo_action_send_desc",
        "Envoyez dans la devise affichée : la valeur reste stable en USD."
      ),
    },
    {
      key: "pay",
      title: t("home_v2_demo_action_pay_title", "PAYER"),
      desc: t(
        "home_v2_demo_action_pay_desc",
        "Demande de paiement (QR) et paiement en quelques secondes."
      ),
    },
    {
      key: "convert",
      title: t("home_v2_demo_action_convert_title", "CONVERTIR"),
      desc: t(
        "home_v2_demo_action_convert_desc",
        "Conversion entre devises avec taux affiché avant validation."
      ),
    },
  ];

  return (
    <section id="demo" className="relative py-24 px-4 sm:px-6 overflow-hidden">
      <div className="relative max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <p className="text-[11px] uppercase tracking-[0.25em] text-white/60 mb-3 font-light">
            {t("home_v2_demo_badge", "Démo wallet (interface de compte)")}
          </p>
          <h2 className="text-3xl sm:text-4xl font-montserrat font-semibold mb-3 text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.5)]">
            {t(
              "home_v2_demo_title",
              "Une interface de compte, en multi‑devises."
            )}
          </h2>
          <p className="text-base sm:text-lg text-white/80 font-[400] max-w-3xl mx-auto">
            {t(
              "home_v2_demo_subtitle",
              "Vous voyez vos montants en monnaie locale. La valeur reste stable en USD."
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
                  <div className="text-white/80 font-montserrat font-semibold tracking-widest text-xs uppercase">
                    {action.title}
                  </div>
                  <p className="mt-2 text-sm text-white/70 leading-relaxed">
                    {action.desc}
                  </p>
                </div>
              ))}
            </div>

            <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl p-6 shadow-2xl">
              <h3 className="text-lg font-semibold text-white">
                {t("home_v2_demo_try_title", "À essayer dans la démo")}
              </h3>
              <p className="mt-2 text-sm text-white/65 leading-relaxed">
                {t(
                  "home_v2_demo_try_subtitle",
                  "Même logique que l’interface, mais fictif : aucune transaction réelle."
                )}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-white/70">
                <li>
                  {t(
                    "home_v2_demo_try_1",
                    "Relevés : cliquez sur « Voir le relevé », puis choisissez global ou par devise."
                  )}
                </li>
                <li>
                  {t(
                    "home_v2_demo_try_2",
                    "Demande de paiement : cliquez sur « Recevoir » pour générer une demande (QR)."
                  )}
                </li>
                <li>
                  {t(
                    "home_v2_demo_try_3",
                    "Paiement : cliquez sur « Envoyer » puis scannez une demande pour simuler un paiement."
                  )}
                </li>
                <li>
                  {t(
                    "home_v2_demo_try_4",
                    "Conversion : cliquez sur « Convertir » et vérifiez le taux affiché avant confirmation."
                  )}
                </li>
              </ul>
              <p className="mt-4 text-[11px] text-white/50">
                {t("home_v2_demo_try_tip", "Astuce : utilisez « Réinitialiser » pour recommencer.")}
              </p>

              <div className="mt-6">
                <Link
                  href="/wallet"
                  className={bankButtonClassName({ tone: "blue", variant: "soft", size: "md" })}
                >
                  {t("home_v2_demo_cta_primary", "Ouvrir le wallet")}
                </Link>
              </div>
            </div>
          </div>

          <div className="bg-black/20 backdrop-blur-sm border border-white/10 rounded-xl shadow-2xl overflow-hidden">
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
