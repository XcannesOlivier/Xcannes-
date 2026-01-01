"use client";

import { useState } from "react";
import { useTranslation } from "next-i18next";
import { ShieldCheckIcon, ClockIcon, ExclamationCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";

/**
 * Badge de statut KYC à afficher dans le WalletDashboard
 * Compact et cliquable pour ouvrir le modal KYC
 */
export default function KYCStatusBadge({ walletAddress, kycStatus, onClick }) {
  const { t } = useTranslation("common");

  const getStatusConfig = () => {
    switch (kycStatus) {
      case "approved":
        return {
          icon: <CheckCircleIcon className="w-4 h-4" />,
          label: t("kyc_verified", "Vérifié"),
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/40",
          textColor: "text-green-400",
          clickable: false,
        };
      case "pending":
        return {
          icon: <ClockIcon className="w-4 h-4 animate-pulse" />,
          label: t("kyc_pending", "En cours"),
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/40",
          textColor: "text-yellow-400",
          clickable: true,
        };
      case "failed":
        return {
          icon: <ExclamationCircleIcon className="w-4 h-4" />,
          label: t("kyc_failed", "Échoué"),
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/40",
          textColor: "text-red-400",
          clickable: true,
        };
      default: // not_started
        return {
          icon: <ShieldCheckIcon className="w-4 h-4" />,
          label: t("kyc_not_verified", "Non vérifié"),
          bgColor: "bg-white/5",
          borderColor: "border-white/20",
          textColor: "text-white/60",
          clickable: true,
        };
    }
  };

  if (!walletAddress) return null;

  const config = getStatusConfig();

  return (
    <button
      onClick={config.clickable ? onClick : undefined}
      disabled={!config.clickable}
      className={`
        inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium
        ${config.bgColor} ${config.borderColor} ${config.textColor}
        ${config.clickable ? "hover:brightness-110 cursor-pointer transition-all" : "cursor-default"}
      `}
    >
      {config.icon}
      <span>{config.label}</span>
      {config.clickable && (
        <span className="text-xs opacity-60">→</span>
      )}
    </button>
  );
}

/**
 * Panel complet de statut KYC pour le dashboard
 * Plus visible et informatif que le simple badge
 */
export function KYCStatusPanel({ walletAddress, kycStatus, onVerifyClick }) {
  const { t } = useTranslation("common");

  if (kycStatus === "approved") {
    // KYC approuvé - affichage discret
    return (
      <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-xl">
        <CheckCircleIcon className="w-8 h-8 text-green-400 flex-shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-green-400">
            {t("kyc_verified_title", "Identité vérifiée")}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {t("kyc_verified_subtitle", "Vous pouvez acheter des cryptomonnaies")}
          </p>
        </div>
      </div>
    );
  }

  if (kycStatus === "pending") {
    return (
      <div className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
        <ClockIcon className="w-8 h-8 text-yellow-400 flex-shrink-0 animate-pulse" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-yellow-400">
            {t("kyc_pending_title", "Vérification en cours")}
          </p>
          <p className="text-xs text-white/60 mt-0.5">
            {t("kyc_pending_subtitle", "Votre identité est en cours de vérification")}
          </p>
        </div>
      </div>
    );
  }

  // not_started ou failed - incitation à se vérifier
  return (
    <div className="flex items-start gap-3 p-4 bg-purple-500/10 border border-purple-500/30 rounded-xl">
      <ShieldCheckIcon className="w-8 h-8 text-purple-400 flex-shrink-0" />
      <div className="flex-1">
        <p className="text-sm font-semibold text-white">
          {kycStatus === "failed" 
            ? t("kyc_failed_title", "Vérification échouée")
            : t("kyc_required_title", "Vérifiez votre identité")
          }
        </p>
        <p className="text-xs text-white/60 mt-0.5 mb-3">
          {kycStatus === "failed"
            ? t("kyc_failed_description", "La vérification a échoué. Veuillez réessayer.")
            : t("kyc_required_description", "Pour acheter des cryptomonnaies avec votre carte bancaire")
          }
        </p>
        <button
          onClick={onVerifyClick}
          className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          {kycStatus === "failed"
            ? t("kyc_retry_button", "Réessayer")
            : t("kyc_verify_button", "Vérifier maintenant")
          }
        </button>
      </div>
    </div>
  );
}
