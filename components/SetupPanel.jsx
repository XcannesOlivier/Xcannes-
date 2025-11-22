"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/router";
import { stripePromise } from "../lib/stripe";
import { useXumm } from "../context/XummContext";
import { useTranslation } from "next-i18next";
import WalletDashboard from "./WalletDashboard";

export default function SetupPanel() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const { isConnected } = useXumm();
  const [copied, setCopied] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [visible, setVisible] = useState(false);
  const blockRef = useRef();

  const trustlineData = {
    issuer: "rBxQY3dc4mJtcDA5UgmLvtKsdc7vmCGgxx",
    currency: "XCS",
    limit: "2006400",
  };

  const trustlineURL = `https://xrpl.services?issuer=${trustlineData.issuer}&currency=${trustlineData.currency}&limit=${trustlineData.limit}`;

  const paymentMethods = [
    { name: "Visa", logo: "/images/visa.png" },
    { name: "MasterCard", logo: "/images/mastercard.png" },
    { name: "Apple Pay", logo: "/images/applepay.png" },
  ];

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisible(true);
      },
      { threshold: 0.3 }
    );

    if (blockRef.current) observer.observe(blockRef.current);
    return () => observer.disconnect();
  }, []);

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
      // Vérifier que Stripe est chargé
      const stripe = await stripePromise;
      if (!stripe) {
        alert("⚠️ Stripe is not configured. Please contact support.");
        console.error("Stripe not loaded - check NEXT_PUBLIC_STRIPE_PK");
        setIsProcessing(false);
        return;
      }

      // Créer la session de paiement
      const res = await fetch("/api/create-checkout-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await res.json();
      
      // Gérer les erreurs de l'API
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

      // Rediriger vers Stripe Checkout
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
    <div
      ref={blockRef}
      className={`bg-black/40 backdrop-blur-sm border border-white/10 rounded-xl overflow-hidden transition-all duration-500 ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
      }`}
    >
      {/* Header */}
      <div className="p-6 border-b border-white/10">
        <h2 className="text-2xl font-orbitron font-bold text-white mb-2 text-center">
          {t("setup_title")}
        </h2>
        <p className="text-sm text-white/60 text-center">
          {t("setup_subtitle")}
        </p>
      </div>

      {/* Content Grid: 2 colonnes */}
      <div className="grid md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-white/10">
        {/* COLONNE 1 : Fiat Purchase */}
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-white/60"></div>
            <h3 className="text-lg font-orbitron font-bold text-white">
              {t("setup_buy_title")}
            </h3>
          </div>

          {/* Payment Methods */}
          <div>
            <p className="text-xs uppercase tracking-wider text-white/40 mb-3">
              {t("setup_payment_methods")}
            </p>
            <div className="grid grid-cols-3 gap-2">
              {paymentMethods.map((method) => (
                <div
                  key={method.name}
                  className="group bg-white/5 rounded-lg p-3 border border-white/10 hover:border-white/20 hover:bg-white/10 transition-all"
                >
                  <div className="flex items-center justify-center h-12">
                    <img
                      src={method.logo}
                      alt={method.name}
                      className="w-full h-full object-contain opacity-80 group-hover:opacity-100 transition-all"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Wallet Status */}
          {isConnected ? (
            <div className="bg-xcannes-green/10 border border-xcannes-green/20 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-lg">✓</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-xcannes-green mb-1">
                    {t("setup_wallet_connected_title")}
                  </p>
                  <p className="text-xs text-white/60">
                    {t("setup_wallet_connected_text")}
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white/5 border border-white/10 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span className="text-2xl">ⓘ</span>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-white/80 mb-1">
                    {t("setup_wallet_optional_title")}
                  </p>
                  <p className="text-xs text-white/60">
                    {t("setup_wallet_optional_text")}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Purchase Button */}
          <button
            onClick={handleCheckout}
            disabled={isProcessing}
            className="w-full bg-white/10 hover:bg-white/20 border border-white/20 text-white font-semibold py-3 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                <span className="text-sm">{t("setup_processing")}</span>
              </>
            ) : (
              <>
                <span>💳</span>
                <span className="text-sm">{t("setup_buy_button")}</span>
              </>
            )}
          </button>

          {/* Footer */}
          <p className="text-xs text-white/40 text-center">
            {t("setup_powered_by")}
          </p>
        </div>

        {/* COLONNE 2 : Wallet Dashboard */}
        <div className="p-6 space-y-4">
          {/* Header minimaliste avec lien trustline */}
          <div className="space-y-3 pb-4 border-b border-white/10">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-xcannes-green"></div>
              <h3 className="text-lg font-orbitron font-bold text-white">
                {t("setup_trustline_title")}
              </h3>
            </div>

            {/* Trustline rapide */}
            <div className="flex gap-2">
              <a
                href={trustlineURL}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold px-4 py-2.5 rounded-lg transition-all text-sm"
              >
                <span>🔗</span>
                <span>{t("setup_trustline_button")}</span>
              </a>

              <button
                onClick={() => handleCopy(trustlineURL)}
                className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 text-white border border-white/10 px-4 py-2.5 rounded-lg transition-all text-sm"
                title="Copy trustline URL"
              >
                <span>{copied ? "✓" : "📋"}</span>
              </button>
            </div>
          </div>

          {/* Dashboard ou message d'attente */}
          {isConnected ? (
            <WalletDashboard />
          ) : (
            <div className="flex flex-col items-center justify-center py-12 space-y-4">
              <div className="w-16 h-16 rounded-full bg-white/5 border-2 border-white/10 flex items-center justify-center">
                <span className="text-3xl">🔌</span>
              </div>
              <div className="text-center space-y-2">
                <p className="text-sm font-semibold text-white/80">
                  {t("setup_wallet_not_connected")}
                </p>
                <p className="text-xs text-white/50 max-w-xs">
                  {t("setup_wallet_connect_to_view")}
                </p>
              </div>
              <div className="w-full max-w-xs bg-white/5 border border-white/10 rounded-lg p-4 space-y-2">
                <p className="text-xs text-white/60 text-center">
                  💡 {t("setup_wallet_dashboard_preview")}
                </p>
                <ul className="text-xs text-white/40 space-y-1">
                  <li>• View XRP & token balances</li>
                  <li>• Manage all trustlines</li>
                  <li>• Real-time updates</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
