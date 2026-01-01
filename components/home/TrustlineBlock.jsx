import { useState } from "react";
import { useTranslation } from "next-i18next";

export default function TrustlineBlock() {
  const { t } = useTranslation("common");
  const [copied, setCopied] = useState(false);

  const issuer = "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx";
  const currency = "XCS";
  const limit = "2006400";
  const trustlineURL = `https://xrpl.services?issuer=${issuer}&currency=${currency}&limit=${limit}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(issuer);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-3xl mx-auto relative z-10">
        <div className="text-center mb-12">
          <p className="text-sm uppercase tracking-widest text-xcannes-green mb-3 font-light">
            {t("trustline_badge")}
          </p>
          <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white mb-4">
            {t("trustline_title")}
          </h2>
          <p className="text-lg text-white/60 max-w-xl mx-auto">
            {t("trustline_description")}
          </p>
        </div>

        <div className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-2xl p-8">
          <div className="mb-8">
            <h3 className="text-xl font-semibold text-white mb-4">
              {t("trustline_details_title")}
            </h3>
            <div className="space-y-4">
              <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-white/60">
                    {t("trustline_issuer")}
                  </span>
                  <button
                    onClick={handleCopy}
                    className="text-xs px-3 py-1 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded transition-colors"
                  >
                    {copied ? "✓ Copied" : "Copy"}
                  </button>
                </div>
                <p className="text-white font-mono text-sm break-all">
                  {issuer}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                  <span className="text-sm text-white/60 block mb-2">
                    {t("trustline_currency")}
                  </span>
                  <p className="text-white font-semibold text-lg">{currency}</p>
                </div>
                <div className="bg-black/40 rounded-lg p-4 border border-white/5">
                  <span className="text-sm text-white/60 block mb-2">
                    {t("trustline_limit")}
                  </span>
                  <p className="text-white font-semibold text-lg">
                    {limit.toLocaleString()}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <a
              href={trustlineURL}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full px-6 py-4 bg-xcannes-green/80 hover:bg-xcannes-green/90 text-white font-semibold rounded-lg transition-all duration-300 text-center transform hover:scale-[1.02]"
            >
              {t("trustline_button")} →
            </a>

            <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <span className="text-2xl">ⓘ</span>
              <div className="text-sm text-white/70">{t("trustline_info")}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
