import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import ReCAPTCHA from "react-google-recaptcha";
import SEOHead from "@/components/layout/SEOHead";

const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY !== "your_recaptcha_site_key_here"
  ? process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
  : null;

export default function Contact() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const from = router.query.from === "dex" ? "dex" : "";
  const locale = router.locale || "en";

  const [form, setForm] = useState({
    name: "",
    email: "",
    message: ""
  });
  const [captchaToken, setCaptchaToken] = useState(null);
  const [status, setStatus] = useState("idle");

  const handleChange = (e) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus("loading");

    const res = await fetch("/api/contact", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...form, captchaToken, locale })
    });

    if (res.ok) {
      setStatus("success");
      setForm({ name: "", email: "", message: "" });
      setCaptchaToken(null);
    } else {
      setStatus("error");
    }
  };

  return (
    <>
      <SEOHead
        title={t("ui_contact_xcannes_0ab0a4c3d1", "Contact - XCANNES")}
        description={t(
          "contact_meta_description",
          "Contact the XCANNES team for any question, suggestion, or partnership. We are listening."
        )}
        canonical="https://xcannes.com/contact" />


      <div className="min-h-screen bg-xcannes-background relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,197,94,0.10),transparent_55%),radial-gradient(ellipse_at_bottom,rgba(255,255,255,0.05),transparent_45%)]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-28 bg-gradient-to-b from-transparent to-xcannes-background md:h-36" />
        <main className="relative container mx-auto px-4 py-12 md:py-16 max-w-4xl">
          <div className="mb-6 flex items-center justify-end">
            <Link href="/" className="header-nav-link header-nav-link-compact text-white/70">
              <span className="header-nav-label">{t("nav_home", "Page d'accueil")}</span>
              <span aria-hidden="true" className="header-nav-arrow">&gt;</span>
            </Link>
          </div>
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 md:w-20 md:h-20 bg-xcannes-green/20 rounded-full mb-4">
              <svg
                className="w-9 h-9 md:w-12 md:h-12 text-xcannes-green"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24">

                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />

              </svg>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-white mb-3">
              {t("contact_title")}
            </h1>
            <p className="text-base md:text-lg text-white/70 max-w-2xl mx-auto">
              {t("contact_subtitle")}
            </p>
          </div>

          <div className="grid md:grid-cols-[minmax(0,1fr)_auto] gap-4 mb-8">
            {/* Contact Form */}
            <div className="bg-elevated border border-white/10 rounded-2xl p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                {t("contact_form_title")}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="name"
                    className="block text-sm font-medium text-white/80 mb-2">

                    {t("contact_form_name")}
                  </label>
                  <input
                    type="text"
                    id="name"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    required
                    placeholder={t("contact_form_name_placeholder")}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-xcannes-green focus:ring-2 focus:ring-xcannes-green/20 transition-all" />

                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="block text-sm font-medium text-white/80 mb-2">

                    {t("contact_form_email")}
                  </label>
                  <input
                    type="email"
                    id="email"
                    name="email"
                    value={form.email}
                    onChange={handleChange}
                    required
                    placeholder={t("contact_form_email_placeholder")}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-xcannes-green focus:ring-2 focus:ring-xcannes-green/20 transition-all" />

                </div>

                <div>
                  <label
                    htmlFor="message"
                    className="block text-sm font-medium text-white/80 mb-2">

                    {t("contact_form_message")}
                  </label>
                  <textarea
                    id="message"
                    name="message"
                    value={form.message}
                    onChange={handleChange}
                    required
                    rows={5}
                    placeholder={t("contact_form_message_placeholder")}
                    className="w-full bg-white/[0.03] border border-white/10 rounded-lg px-4 py-2.5 text-white placeholder-white/40 focus:outline-none focus:border-xcannes-green focus:ring-2 focus:ring-xcannes-green/20 transition-all resize-none" />

                </div>

                <button
                  type="submit"
                  disabled={(!captchaToken && !!RECAPTCHA_SITE_KEY) || status === "loading"}
                  className="w-full inline-flex items-center justify-center gap-2 px-8 py-3 bg-xcannes-green text-black font-semibold rounded-lg hover:bg-xcannes-green/90 transition-all duration-300 shadow-lg shadow-xcannes-green/20 disabled:opacity-50 disabled:cursor-not-allowed">

                  {status === "loading" ?
                  <>
                      <svg
                      className="animate-spin h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24">

                        <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4" />

                        <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />

                      </svg>
                      {t("contact_form_sending")}
                    </> :

                  <>
                      <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24">

                        <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />

                      </svg>
                      {t("contact_form_send")}
                    </>
                  }
                </button>
              </form>

              {/* Status Messages */}
              {status === "success" &&
              <div className="mt-4 bg-xcannes-green/10 border border-xcannes-green/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                    className="w-6 h-6 text-xcannes-green flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20">

                      <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd" />

                    </svg>
                    <div>
                      <h4 className="text-xcannes-green font-semibold mb-1">
                        {t("contact_form_success_title")}
                      </h4>
                      <p className="text-white/70 text-sm">
                        {t("contact_form_success_text")}
                      </p>
                    </div>
                  </div>
                </div>
              }

              {status === "error" &&
              <div className="mt-4 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <svg
                    className="w-6 h-6 text-red-400 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20">

                      <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                      clipRule="evenodd" />

                    </svg>
                    <div>
                      <h4 className="text-red-400 font-semibold mb-1">
                        {t("contact_form_error_title")}
                      </h4>
                      <p className="text-white/70 text-sm">
                        {t("contact_form_error_text")}
                      </p>
                    </div>
                  </div>
                </div>
              }
            </div>
            <div className="bg-elevated border border-white/10 rounded-2xl p-4 flex items-start justify-center md:justify-start">
              {RECAPTCHA_SITE_KEY ? (
                <ReCAPTCHA
                  sitekey={RECAPTCHA_SITE_KEY}
                  onChange={(token) => setCaptchaToken(token)}
                  theme="dark" />
              ) : (
                <p className="text-white/40 text-sm">{t("ui_recaptcha_not_configured", "Protection anti-spam temporairement indisponible.")}</p>
              )}
            </div>
          </div>
        </main>

      </div>
    </>);

}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"]))
    }
  };
}
