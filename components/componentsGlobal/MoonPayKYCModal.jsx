"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { XMarkIcon, CheckCircleIcon, ClockIcon, ExclamationCircleIcon } from "@heroicons/react/24/outline";

/**
 * Modal XCannes pour le KYC MoonPay
 * - UI complètement XCannes
 * - Widget MoonPay intégré en iframe transparent
 * - Gestion du statut KYC en temps réel
 */
export default function MoonPayKYCModal({ isOpen, onClose, walletAddress, onKycComplete }) {
  const { t } = useTranslation("common");
  const [kycStatus, setKycStatus] = useState("not_started"); // not_started | in_progress | pending | approved | failed
  const [kycUrl, setKycUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Charger le statut KYC actuel de l'utilisateur
  useEffect(() => {
    if (isOpen && walletAddress) {
      loadKycStatus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, walletAddress]);

  const loadKycStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/moonpay/kyc-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) throw new Error("Failed to load KYC status");

      const data = await response.json();
      setKycStatus(data.status);

      // Si KYC non commencé ou échoué, générer l'URL du widget
      if (data.status === "not_started" || data.status === "failed") {
        await generateKycUrl();
      }
    } catch (err) {
      console.error("Error loading KYC status:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateKycUrl = async () => {
    try {
      const response = await fetch("/api/moonpay/generate-kyc-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress }),
      });

      if (!response.ok) throw new Error("Failed to generate KYC URL");

      const data = await response.json();
      setKycUrl(data.url);
    } catch (err) {
      console.error("Error generating KYC URL:", err);
      setError(err.message);
    }
  };

  // Écouter les messages du widget MoonPay (postMessage)
  useEffect(() => {
    const handleMessage = (event) => {
      // Vérifier l'origine (sécurité)
      if (!event.origin.includes("moonpay.com")) return;

      const { type, data } = event.data;

      if (type === "moonpay_kyc_status_update") {
        setKycStatus(data.status);

        // Si KYC approuvé, notifier le parent
        if (data.status === "approved" && onKycComplete) {
          onKycComplete();
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [onKycComplete]);

  const getStatusConfig = () => {
    switch (kycStatus) {
      case "approved":
        return {
          icon: <CheckCircleIcon className="w-16 h-16 text-green-400" />,
          title: t("kyc_approved_title", "Identité vérifiée"),
          message: t("kyc_approved_message", "Votre identité a été vérifiée avec succès. Vous pouvez maintenant acheter des cryptomonnaies."),
          color: "text-green-400",
        };
      case "pending":
        return {
          icon: <ClockIcon className="w-16 h-16 text-yellow-400" />,
          title: t("kyc_pending_title", "Vérification en cours"),
          message: t("kyc_pending_message", "Votre identité est en cours de vérification. Cela peut prendre quelques minutes."),
          color: "text-yellow-400",
        };
      case "failed":
        return {
          icon: <ExclamationCircleIcon className="w-16 h-16 text-red-400" />,
          title: t("kyc_failed_title", "Vérification échouée"),
          message: t("kyc_failed_message", "La vérification de votre identité a échoué. Veuillez réessayer."),
          color: "text-red-400",
        };
      default:
        return null;
    }
  };

  if (!isOpen) return null;

  const statusConfig = getStatusConfig();

  const modalContent = (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="relative w-full max-w-2xl bg-elevated-dark border border-white/10 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header XCannes */}
        <div className="relative bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-b border-white/10 p-6">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <XMarkIcon className="w-6 h-6 text-white/70 hover:text-white" />
          </button>

          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-blue-500 rounded-xl flex items-center justify-center">
              <span className="text-2xl">🔐</span>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">
                {t("kyc_modal_title", "Vérification d'identité")}
              </h2>
              <p className="text-sm text-white/60">
                {t("kyc_modal_subtitle", "Propulsé par MoonPay")}
              </p>
            </div>
          </div>
        </div>

        {/* Contenu */}
        <div className="p-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="w-12 h-12 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin mb-4"></div>
              <p className="text-white/60">{t("loading", "Chargement...")}</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12">
              <ExclamationCircleIcon className="w-16 h-16 text-red-400 mb-4" />
              <p className="text-red-400 text-center">{error}</p>
              <button
                onClick={loadKycStatus}
                className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
              >
                {t("retry", "Réessayer")}
              </button>
            </div>
          ) : statusConfig ? (
            // Afficher le statut (approuvé/en attente/échoué)
            <div className="flex flex-col items-center justify-center py-12 text-center">
              {statusConfig.icon}
              <h3 className={`text-xl font-bold mt-4 ${statusConfig.color}`}>
                {statusConfig.title}
              </h3>
              <p className="text-white/60 mt-2 max-w-md">{statusConfig.message}</p>

              {kycStatus === "approved" && (
                <button
                  onClick={onClose}
                  className="mt-6 px-8 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors"
                >
                  {t("continue", "Continuer")}
                </button>
              )}

              {kycStatus === "failed" && (
                <button
                  onClick={generateKycUrl}
                  className="mt-6 px-8 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-semibold transition-colors"
                >
                  {t("retry_kyc", "Réessayer la vérification")}
                </button>
              )}
            </div>
          ) : kycUrl ? (
            // Widget MoonPay KYC en iframe
            <div className="relative">
              <iframe
                src={kycUrl}
                className="w-full h-[600px] rounded-lg border border-white/10"
                allow="camera; microphone"
                sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
              />
              
              {/* Instructions */}
              <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                <p className="text-sm text-blue-300">
                  ℹ️ {t("kyc_instructions", "Suivez les étapes pour vérifier votre identité. Vous aurez besoin d'une pièce d'identité et de prendre un selfie.")}
                </p>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer XCannes */}
        <div className="bg-white/5 border-t border-white/10 px-6 py-4">
          <div className="flex items-center justify-between text-xs text-white/40">
            <span>{t("kyc_footer_privacy", "Vos données sont sécurisées et chiffrées")}</span>
            <span>{t("kyc_footer_provider", "KYC géré par MoonPay")}</span>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
