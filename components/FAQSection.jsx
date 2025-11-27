import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "next-i18next";

export default function FAQSection() {
  const { t } = useTranslation("common");
  const [openIndex, setOpenIndex] = useState(null);

  const toggle = (index) => {
    setOpenIndex(openIndex === index ? null : index);
  };

  const faqItems = [
    {
      question: t("faq_q1"),
      answer: t("faq_a1"),
    },
    {
      question: t("faq_q2"),
      answer: t("faq_a2"),
    },
    {
      question: t("faq_q3"),
      answer: t("faq_a3"),
    },
    {
      question: t("faq_q4"),
      answer: t("faq_a4"),
    },
    {
      question: t("faq_q5"),
      answer: t("faq_a5"),
    },
  ];

  return (
    <section className="relative py-24 px-6">
      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <p className="text-sm uppercase tracking-widest text-xcannes-green mb-3 font-light">
            {t("faq_badge")}
          </p>
          <h2 className="text-4xl md:text-5xl font-orbitron font-bold text-white mb-4">
            {t("faq_title")}
          </h2>
          <p className="text-lg text-white/60">{t("faq_subtitle")}</p>
        </div>

        <div className="space-y-4">
          {faqItems.map((item, index) => (
            <div
              key={index}
              className="bg-black/30 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden hover:border-white/20 transition-all duration-300"
            >
              <button
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between p-6 text-left hover:bg-white/5 transition-colors"
              >
                <span className="text-lg font-semibold text-white pr-8">
                  {item.question}
                </span>
                <span
                  className={`text-2xl text-xcannes-green transition-transform duration-300 ${
                    openIndex === index ? "rotate-180" : ""
                  }`}
                >
                  {openIndex === index ? "−" : "+"}
                </span>
              </button>

              <div
                className={`overflow-hidden transition-all duration-300 ${
                  openIndex === index ? "max-h-96" : "max-h-0"
                }`}
              >
                <div className="p-6 pt-0 text-white/70 leading-relaxed border-t border-white/5">
                  {item.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <p className="text-white/60 mb-4">{t("faq_contact")}</p>
          <Link
            href="/contact"
            className="inline-block px-6 py-3 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/10 text-white rounded-lg transition-all duration-300"
          >
            {t("faq_contact_button")} →
          </Link>
        </div>
      </div>
    </section>
  );
}
