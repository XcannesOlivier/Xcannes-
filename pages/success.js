import { useTranslation } from "next-i18next";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useXumm } from "../context/XummContext";
import XummConnectButton from "../components/XummConnectButton";
import Header from "../components/Header";
import FooterPro from "../components/FooterPro";
import SEOHead from "../components/SEOHead";

export default function SuccessPage() {
  const { t } = useTranslation("common");
  const { isConnected, wallet } = useXumm();

  return (
    <>
      <SEOHead
        title="Transaction Confirmée - XCANNES"
        description="Votre transaction a été validée avec succès. Vos tokens XCS seront transférés sur votre wallet XRPL."
        canonical="https://xcannes.com/success"
      />

      <div className="min-h-screen bg-gradient-to-br from-black via-gray-900 to-black">
        <Header />

        <main className="container mx-auto px-4 py-20 max-w-4xl">
          {/* Success Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-xcannes-green/20 rounded-full mb-6">
              <svg
                className="w-12 h-12 text-xcannes-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              {t("success_title")}
            </h1>
            <p className="text-xl text-white/70">{t("success_subtitle")}</p>
          </div>

          {/* Main Content Card */}
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-8 mb-8">
            <div className="space-y-6">
              {/* Transaction Status */}
              <div className="flex items-start gap-4 pb-6 border-b border-white/10">
                <div className="flex-shrink-0 w-10 h-10 bg-xcannes-green/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-xcannes-green"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {t("success_payment_title")}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {t("success_payment_text")}
                  </p>
                </div>
              </div>

              {/* Wallet Connection Status */}
              {!isConnected && (
                <div className="flex items-start gap-4 pb-6 border-b border-white/10">
                  <div className="flex-shrink-0 w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-yellow-500"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {t("success_wallet_required_title")}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-4">
                      {t("success_wallet_required_text")}
                    </p>
                    <XummConnectButton />
                  </div>
                </div>
              )}

              {isConnected && (
                <div className="flex items-start gap-4 pb-6 border-b border-white/10">
                  <div className="flex-shrink-0 w-10 h-10 bg-xcannes-green/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-xcannes-green"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-white mb-2">
                      {t("success_wallet_connected_title")}
                    </h3>
                    <p className="text-white/60 text-sm leading-relaxed mb-2">
                      {t("success_wallet_connected_text")}
                    </p>
                    <div className="bg-black/40 border border-xcannes-green/30 rounded-lg p-3 font-mono text-xs text-xcannes-green break-all">
                      {wallet}
                    </div>
                  </div>
                </div>
              )}

              {/* Trustline Information */}
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white mb-2">
                    {t("success_trustline_title")}
                  </h3>
                  <p className="text-white/60 text-sm leading-relaxed mb-4">
                    {t("success_trustline_text")}
                  </p>
                  <div className="bg-black/60 border border-white/10 rounded-lg p-4 space-y-3 text-sm">
                    <div className="flex items-start gap-3">
                      <span className="text-xcannes-green">✓</span>
                      <span className="text-white/70">
                        {t("success_trustline_check1")}
                      </span>
                    </div>
                    <div className="flex items-start gap-3">
                      <span className="text-blue-400">→</span>
                      <span className="text-white/70">
                        {t("success_trustline_check2")}
                      </span>
                    </div>
                  </div>
                  <a
                    href="https://xumm.app/detect/xapp:trustset?issuer=rYourIssuerAddress&currency=XCS"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 mt-4 px-6 py-3 bg-xcannes-green text-black font-semibold rounded-lg hover:bg-xcannes-green/90 transition-all duration-300 shadow-lg shadow-xcannes-green/20"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                      />
                    </svg>
                    {t("success_trustline_button")}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Next Steps Card */}
          <div className="bg-gradient-to-br from-xcannes-green/10 to-xcannes-green/5 border border-xcannes-green/20 rounded-2xl p-6 mb-8">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <svg
                className="w-5 h-5 text-xcannes-green"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
              {t("success_next_steps_title")}
            </h3>
            <ul className="space-y-3 text-sm text-white/70">
              <li className="flex items-start gap-3">
                <span className="text-xcannes-green font-bold">1.</span>
                <span>{t("success_step1")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xcannes-green font-bold">2.</span>
                <span>{t("success_step2")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xcannes-green font-bold">3.</span>
                <span>{t("success_step3")}</span>
              </li>
              <li className="flex items-start gap-3">
                <span className="text-xcannes-green font-bold">4.</span>
                <span>{t("success_step4")}</span>
              </li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-xcannes-green text-black font-semibold rounded-lg hover:bg-xcannes-green/90 transition-all duration-300 shadow-lg shadow-xcannes-green/20"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              {t("success_home_button")}
            </a>
            <a
              href="/dex"
              className="inline-flex items-center justify-center gap-2 px-8 py-3 bg-white/5 text-white font-semibold rounded-lg border border-white/10 hover:bg-white/10 hover:border-white/20 transition-all duration-300"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              {t("success_dex_button")}
            </a>
          </div>

          {/* Support Section */}
          <div className="mt-12 text-center">
            <p className="text-white/50 text-sm mb-2">
              {t("success_support_text")}
            </p>
            <a
              href="mailto:xcannesdao@gmail.com"
              className="text-xcannes-green hover:text-xcannes-green/80 font-medium text-sm transition-colors"
            >
              xcannesdao@gmail.com
            </a>
          </div>
        </main>

        <FooterPro />
      </div>
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
