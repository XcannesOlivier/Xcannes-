"use client";

import { useState } from "react";
import Image from "next/image";
import { useTranslation } from "next-i18next";
import { useXumm } from "../context/XummContext";
import { stripePromise } from "../lib/stripe";
import WalletDashboard from "./WalletDashboard";
import TradingPanel from "./TradingPanel";

const API_BASE = (process.env.NEXT_PUBLIC_XCANNES_API_URL || "").replace(
  /\/$/,
  ""
);
const apiUrl = (path) => `${API_BASE}${path}`;

const TRUSTLINE_DATA = {
  issuer: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
  currency: "XCS",
  limit: "2006400",
};

const paymentMethods = [
  { name: "Visa", logo: "/images/visa.png" },
  { name: "MasterCard", logo: "/images/mastercard.png" },
  { name: "Apple Pay", logo: "/images/applepay.png" },
];

function SidebarSection({
  title,
  subtitle,
  isOpen,
  onToggle,
  children,
  disabled = false,
}) {
  return (
    <div className="border-b border-white/10 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={`w-full flex items-center justify-between px-4 py-3 bg-black/40 hover:bg-black/60 transition-colors ${
          disabled ? "opacity-60" : ""
        }`}
      >
        <div className="flex flex-col items-start">
          <span className="text-xs font-semibold uppercase tracking-[0.12em] text-white/60">
            {title}
          </span>
          {subtitle && (
            <span className="text-[11px] text-white/40 mt-0.5">
              {subtitle}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {disabled && (
            <span className="text-[11px] text-white/40">Locked</span>
          )}
          <span
            className={`transition-transform ${
              isOpen ? "rotate-180" : "rotate-0"
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-white/60"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </span>
        </div>
      </button>
      {isOpen && (
        <div className="px-4 pb-4 pt-3 bg-black/30">{children}</div>
      )}
    </div>
  );
}

export default function DexSidebar({ pair }) {
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const [sectionsOpen, setSectionsOpen] = useState({
    stripe: true,
    wallet: isConnected,
    trading: true,
  });

  const toggleSection = (key) => {
    setSectionsOpen((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const trustlineURL = `https://xrpl.services?issuer=${TRUSTLINE_DATA.issuer}&currency=${TRUSTLINE_DATA.currency}&limit=${TRUSTLINE_DATA.limit}`;

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Erreur copie:", err);
    }
  };

  const handleCheckout = async () => {
    setIsProcessing(true);
    try {
      const stripe = await stripePromise;
      if (!stripe) {
        alert("⚠️ Stripe is not configured. Please contact support.");
        console.error("Stripe not loaded - check NEXT_PUBLIC_STRIPE_PK");
        setIsProcessing(false);
        return;
      }

      const res = await fetch(apiUrl("/stripe/checkout-session"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        console.error("API Error:", data.error);
        alert(`❌ Payment setup failed: ${data.error || "Unknown error"}`);
        setIsProcessing(false);
        return;
      }

      if (!data.id) {
        console.error("No session ID returned:", data);
        alert("❌ Payment setup failed: No session ID");
        setIsProcessing(false);
        return;
      }

      const result = await stripe.redirectToCheckout({ sessionId: data.id });

      if (result.error) {
        console.error("Stripe Redirect Error:", result.error.message);
        alert("❌ Payment error: " + result.error.message);
      }
    } catch (error) {
      console.error("Checkout error:", error);
      alert("❌ An error occurred. Please check console and try again.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="bg-black/40 backdrop-blur-sm border border-white/10 rounded-l-xl rounded-r-none overflow-hidden flex flex-col h-full">
      {/* Section 1 : Abonnement & Stripe */}
      <SidebarSection
        title={t("setup_buy_title")}
        subtitle={t("setup_payment_methods")}
        isOpen={sectionsOpen.stripe}
        onToggle={() => toggleSection("stripe")}
      >
        <div className="space-y-4">
          {/* Payment Methods */}
          <div>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="group bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-center h-10">
                    <Image
                      src={method.logo}
                      alt={method.name}
                      width={80}
                      height={40}
                      className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA Stripe */}
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-2.5 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span>{t("setup_processing")}</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span>{t("setup_buy_button")}</span>
              </>
            )}
          </button>

          <p className="text-[11px] text-white/40 text-center">
            {t("setup_powered_by")}
          </p>
        </div>
      </SidebarSection>

      {/* Section 2 : Wallet XRPL (uniquement si connecté) */}
      {isConnected && (
        <SidebarSection
          title="Wallet XRPL"
          subtitle="Solde, trustlines et XCS"
          isOpen={sectionsOpen.wallet}
          onToggle={() => toggleSection("wallet")}
        >
          <div className="space-y-4">
            {/* Trustline rapide */}
            <div className="flex gap-2">
              <a
                href={trustlineURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold px-4 py-2 rounded-lg transition-all text-xs"
              >
                <span>🔗</span>
                <span>{t("setup_trustline_button")}</span>
              </a>

              <button
                onClick={() => handleCopy(trustlineURL)}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-3 py-2 rounded-lg transition-all text-xs"
                title="Copy trustline URL"
              >
                <span>{copied ? "✓" : "📋"}</span>
              </button>
            </div>

            {/* Dashboard */}
            <div className="mt-2">
              <WalletDashboard />
            </div>
          </div>
        </SidebarSection>
      )}

      {/* Section 3 : Trading Panel (toujours visible, même sans wallet) */}
      <SidebarSection
        title={t("trading_title")}
        subtitle={t("trading_subtitle")}
        isOpen={sectionsOpen.trading}
        onToggle={() => toggleSection("trading")}
      >
        {!isConnected && (
          <div className="mb-3 rounded-lg border border-yellow-500/30 bg-yellow-500/5 px-3 py-2 text-[11px] text-yellow-100">
            <p className="font-semibold mb-0.5">
              🔌 {t("setup_wallet_not_connected")}
            </p>
            <p className="text-[10px] text-yellow-100/80">
              {t("setup_wallet_connect_to_view")}
            </p>
          </div>
        )}
        <TradingPanel pair={pair} variant="sidebar" />
      </SidebarSection>
    </div>
  );
}
