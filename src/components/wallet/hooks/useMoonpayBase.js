import { useEffect, useMemo, useRef, useState } from "react";
import { isIOSDevice } from "@/utils/deviceDetect";
import {
  MOONPAY_ACTIVE_STORAGE_KEY,
  MOONPAY_AUTOOPEN_TAB_KEY,
  MOONPAY_WALLET_ADDRESS_KEY,
  MOONPAY_FLOW_MAX_AGE_MS,
  notifyPwaMoonpayActive,
} from "../modals/walletModalShared";

/**
 * useMoonpayBase — états et helpers storage communs aux modaux MoonPay Buy et Sell.
 *
 * @param {object} params
 * @param {"buy"|"sell"} params.tab       Onglet actif (pour les clés sessionStorage)
 * @param {string} params.resumeKey       Clé sessionStorage du resume state
 * @param {string} params.flowKey         Clé sessionStorage du flow id
 * @param {boolean} params.isOpen         Modal ouvert ?
 * @param {string} params.walletAddress   Adresse XRPL de l'utilisateur
 */
export function useMoonpayBase({ tab, resumeKey, flowKey, isOpen, walletAddress }) {
  // ─── États de base ────────────────────────────────────────────────────────
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form");

  // Masquer les erreurs de sandbox MoonPay (non-pertinentes pour l'utilisateur)
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;

  // Chaîne allow pour l'iframe MoonPay (dépend de l'OS)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const moonpayIframeAllow = useMemo(() => {
    const isIOS = isIOSDevice();
    return isIOS
      ? "camera *; microphone *; clipboard-write"
      : "camera https://moonpay.com https://buy.moonpay.com https://buy-sandbox.moonpay.com https://sell.moonpay.com https://sell-sandbox.moonpay.com https://wallet.moonpay.com https://*.moonpay.com; clipboard-write";
  }, []);

  // ─── Refs ─────────────────────────────────────────────────────────────────
  const latestStepRef = useRef(step);
  const latestIframeUrlRef = useRef(iframeUrl);
  const pendingAutoStartRef = useRef(false);
  const moonpayActiveRef = useRef(false);

  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  // ─── Effect : marquer le flow MoonPay comme actif ─────────────────────────
  // (empêche le wallet de se déconnecter pendant que l'utilisateur est dans l'iframe)
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = Boolean(isOpen && step === "iframe" && iframeUrl);
    if (active === moonpayActiveRef.current) return;
    moonpayActiveRef.current = active;
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, "1");
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, tab);
        window.__XCANNES_MOONPAY_ACTIVE__ = true;
        try {
          window.localStorage?.setItem(
            MOONPAY_WALLET_ADDRESS_KEY,
            JSON.stringify({ v: 1, ts: Date.now(), address: String(walletAddress || "") }),
          );
        } catch {
          // ignore
        }
      } else {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
      }
      window.dispatchEvent(
        new CustomEvent("xcannes:moonpay-active", { detail: { active } }),
      );
      notifyPwaMoonpayActive(active, tab);
    } catch {
      // Ignore storage errors
    }
  }, [iframeUrl, isOpen, step, tab, walletAddress]);

  // ─── Helpers storage ──────────────────────────────────────────────────────

  const getOrCreateFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(flowKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          const ageMs = Date.now() - Number(parsed?.ts || 0);
          if (
            parsed?.v === 1 &&
            typeof parsed?.id === "string" &&
            parsed.id &&
            Number.isFinite(ageMs) &&
            ageMs >= 0 &&
            ageMs <= MOONPAY_FLOW_MAX_AGE_MS
          ) {
            return parsed.id;
          }
        }
      } catch {
        // ignore
      }
      try {
        const id =
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}_${Math.random()}`;
        window.sessionStorage?.setItem(
          flowKey,
          JSON.stringify({ v: 1, kind: tab, ts: Date.now(), id }),
        );
        return id;
      } catch {
        return null;
      }
    };
  }, [flowKey, tab]);

  const clearFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(flowKey);
      } catch {
        // Ignore
      }
    };
  }, [flowKey]);

  const clearMoonpayWalletAddress = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.removeItem(MOONPAY_WALLET_ADDRESS_KEY);
      } catch {
        // ignore
      }
    };
  }, []);

  const readResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(resumeKey);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== tab) return null;
        return parsed;
      } catch {
        return null;
      }
    };
  }, [resumeKey, tab]);

  const clearResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(resumeKey);
      } catch {
        // Ignore
      }
    };
  }, [resumeKey]);

  const clearAutoOpen = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_AUTOOPEN_TAB_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const deactivateMoonpayActive = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
        window.dispatchEvent(
          new CustomEvent("xcannes:moonpay-active", { detail: { active: false } }),
        );
      } catch {
        // Ignore
      }
    };
  }, []);

  return {
    // états
    iframeUrl,
    setIframeUrl,
    loading,
    setLoading,
    error,
    setError,
    step,
    setStep,
    displayError,
    moonpayIframeAllow,
    // refs
    latestStepRef,
    latestIframeUrlRef,
    pendingAutoStartRef,
    moonpayActiveRef,
    // helpers storage
    getOrCreateFlowId,
    clearFlowId,
    clearMoonpayWalletAddress,
    readResumeState,
    clearResumeState,
    clearAutoOpen,
    deactivateMoonpayActive,
  };
}
