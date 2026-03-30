import { useState, useEffect, useMemo, useRef } from "react";
import {
  XCircleIcon,
  CheckCircleIcon,
  ArrowDownIcon,
  BuildingLibraryIcon,
} from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";
import { isIOSDevice } from "@/utils/deviceDetect";
import { greenActionBtnBase } from "./walletModalTokens";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";
const MOONPAY_ACTIVE_STORAGE_KEY = "xcannes_moonpay_active";
const MOONPAY_SELL_RESUME_KEY = "xcannes_moonpay_resume_sell_v1";
const MOONPAY_AUTOOPEN_TAB_KEY = "xcannes_moonpay_autoopen_tab";
const MOONPAY_SELL_FLOW_KEY = "xcannes_moonpay_sell_flow_v1";
const MOONPAY_SELL_SOURCE_KEY = "xcannes_moonpay_sell_source_v1";
const MOONPAY_WALLET_ADDRESS_KEY = "xcannes_moonpay_wallet_address_v1";
const MOONPAY_RESUME_MAX_AGE_MS = 5 * 60 * 1000;
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;

const isTrustedMoonPayOrigin = (origin) => {
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "moonpay.com" || host.endsWith(MOONPAY_ORIGIN_SUFFIX);
  } catch (_) {
    return false;
  }
};

/**
 * MoonPaySellModal - Modal pour vendre des cryptos contre fiat
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL source
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPaySellModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  embedded = false,
  noticeVariant = "preview",
  demoMode = false,
  onDemoSubmit,
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
}) => {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";

  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
  const pendingAutoStartRef = useRef(false);
  const isEmbeddedPwa =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "pwa";
  const isIOS = isIOSDevice();
  const showIOSKycFallback = isEmbeddedPwa && isIOS;
  const moonpayIframeAllow = isIOS
    ? "camera *; microphone *; clipboard-write"
    : "camera https://moonpay.com https://buy.moonpay.com https://buy-sandbox.moonpay.com https://sell.moonpay.com https://sell-sandbox.moonpay.com https://wallet.moonpay.com https://*.moonpay.com; clipboard-write";
  const latestStepRef = useRef(step);
  const latestIframeUrlRef = useRef(iframeUrl);

  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  // Keep MoonPay flow "active" to prevent wallet-level auto-lock disconnects
  // while user interacts with MoonPay (KYC/Apple flows).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = Boolean(isOpen && step === "iframe" && iframeUrl);
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, "1");
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, "sell");
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
    } catch {
      // Ignore
    }
  }, [iframeUrl, isOpen, step, walletAddress]);

  // Options de vente (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [amount, setAmount] = useState("");
  const [quoteCurrency, setQuoteCurrency] = useState("USD"); // Fiat code
  const [fiatCurrencies, setFiatCurrencies] = useState([]);
  const [fiatLoading, setFiatLoading] = useState(false);
  const [fiatError, setFiatError] = useState(null);
  const resolveFiatErrorMessage = (data) => {
    if (!data) return "Failed to load fiat currencies";
    if (typeof data === "string") return data;
    if (typeof data?.error === "string") return data.error;
    if (data?.error?.message) return data.error.message;
    if (data?.message) return data.message;
    return "Failed to load fiat currencies";
  };

  const saveResumeState = useMemo(() => {
    return (extra = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.setItem(
          MOONPAY_SELL_RESUME_KEY,
          JSON.stringify({
            v: 1,
            kind: "sell",
            ts: Date.now(),
            walletAddress: String(walletAddress || ""),
            currency: String(currency || "").toUpperCase(),
            amount: String(amount || ""),
            quoteCurrency: String(quoteCurrency || "").toUpperCase(),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, currency, quoteCurrency, walletAddress]);

  const getOrCreateFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_SELL_FLOW_KEY);
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
        const id = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
        window.sessionStorage?.setItem(
          MOONPAY_SELL_FLOW_KEY,
          JSON.stringify({ v: 1, kind: "sell", ts: Date.now(), id }),
        );
        return id;
      } catch {
        return null;
      }
    };
  }, []);

  const clearFlowId = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

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
        const raw = window.sessionStorage?.getItem(MOONPAY_SELL_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== "sell") return null;
        return parsed;
      } catch {
        return null;
      }
    };
  }, []);

  const clearResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.removeItem(MOONPAY_SELL_RESUME_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

  const saveSellSourceState = useMemo(() => {
    return (data = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.setItem(
          MOONPAY_SELL_SOURCE_KEY,
          JSON.stringify({
            v: 1,
            kind: "sell",
            ts: Date.now(),
            flowId: String(data?.flowId || "").trim() || null,
            walletAddress: String(walletAddress || "").trim() || null,
            sourceCurrencyCode:
              String(data?.sourceCurrencyCode || "").trim().toUpperCase() || null,
            sourceAmount:
              Number.isFinite(Number(data?.sourceAmount)) && Number(data?.sourceAmount) > 0
                ? Number(data.sourceAmount)
                : null,
            baseCurrencyCode:
              String(data?.baseCurrencyCode || "").trim().toUpperCase() || null,
            baseCurrencyAmount:
              Number.isFinite(Number(data?.baseCurrencyAmount)) &&
              Number(data?.baseCurrencyAmount) > 0
                ? Number(data.baseCurrencyAmount)
                : null,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [walletAddress]);

  const clearSellSourceState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage?.removeItem(MOONPAY_SELL_SOURCE_KEY);
      } catch {
        // Ignore
      }
    };
  }, []);

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

  const handleUserClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep("form");
      onClose?.();
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    onClose,
  ]);

  const handleWidgetClose = useMemo(() => {
    return () => {
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
      setIframeUrl(null);
      setError(null);
      setStep("form");
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
  ]);

  // If the user closes the Cash modal while the MoonPay widget is open,
  // don't keep the resume cache around.
  useEffect(() => {
    return () => {
      if (latestStepRef.current !== "iframe" || !latestIframeUrlRef.current) return;
      clearResumeState();
      clearSellSourceState();
      clearAutoOpen();
      clearFlowId();
      clearMoonpayWalletAddress();
      deactivateMoonpayActive();
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
  ]);

  const supportedCurrencies = useMemo(() => {
    const seen = new Set();
    const orderedTokens = [
      ...(availableTokens || []).filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code === "XRP" || code === "RLUSD";
      }),
      ...(availableTokens || []).filter((token) => {
        const code = String(token?.currency || "").toUpperCase();
        return code !== "XRP" && code !== "RLUSD";
      }),
    ];

    return orderedTokens
      .map((token) => {
        const currencyRaw = token?.currency;
        const currency = String(currencyRaw || "").toUpperCase();
        if (!currency || seen.has(currency)) return null;
        seen.add(currency);

        const labelLeft =
          selectLabelByCurrency?.[currencyRaw] ||
          selectLabelByCurrency?.[currency] ||
          currency;
        const balanceLabel = t("ui_balance_label_4db9aa0c31", "Balance").replace(
          /:\s*$/,
          "",
        );
        const amountValue = Number(token?.value || 0);
        const amountLabel = Number.isFinite(amountValue)
          ? formatAmountWithSymbol(locale, amountValue, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })
          : formatAmountWithSymbol(locale, 0, currency, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            });
        const fallbackRight = `${balanceLabel} = ${amountLabel}`;
        const labelRight =
          selectLabelRightByCurrency?.[currencyRaw] ||
          selectLabelRightByCurrency?.[currency] ||
          fallbackRight;
        const labelMobile =
          selectLabelMobileByCurrency?.[currencyRaw] ||
          selectLabelMobileByCurrency?.[currency] ||
          labelLeft;
        return {
          code: currency,
          label: labelLeft,
          labelLeft,
          labelRight,
          labelMobile,
          icon:
            selectIconByCurrency?.[currencyRaw] ||
            selectIconByCurrency?.[currency] ||
            null,
        };
      })
      .filter(Boolean);
  }, [
    availableTokens,
    selectLabelByCurrency,
    selectLabelRightByCurrency,
    selectIconByCurrency,
    selectLabelMobileByCurrency,
    locale,
    t,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!supportedCurrencies.length) return;
    setCurrency((prev) => {
      const current = String(prev || "").toUpperCase();
      if (supportedCurrencies.some((curr) => curr.code === current)) {
        return current;
      }
      return supportedCurrencies[0].code;
    });
  }, [isOpen, supportedCurrencies]);

  // Resume sell flow after iOS background / reconnect.
  useEffect(() => {
    if (!isOpen) return;
    if (!walletAddress) return;
    if (demoMode) return;
    if (step !== "form" || iframeUrl) return;
    if (fiatLoading) return;
    if (!quoteCurrency) return;

    const resume = readResumeState();
    if (!resume) return;
    if (String(resume.walletAddress || "") !== String(walletAddress || "")) return;
    const ageMs = Date.now() - Number(resume.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_RESUME_MAX_AGE_MS) return;

    if (resume.lastIframeUrl) {
      setIframeUrl(String(resume.lastIframeUrl));
      setStep("iframe");
      return;
    }

    const nextCurrency = String(resume.currency || "").toUpperCase();
    if (nextCurrency) setCurrency(nextCurrency);
    if (resume.amount != null) setAmount(String(resume.amount));
    if (resume.quoteCurrency) setQuoteCurrency(String(resume.quoteCurrency).toUpperCase());

    pendingAutoStartRef.current = true;
  }, [
    demoMode,
    fiatLoading,
    iframeUrl,
    isOpen,
    quoteCurrency,
    readResumeState,
    step,
    walletAddress,
  ]);

  useEffect(() => {
    if (!isOpen) return;
    if (!pendingAutoStartRef.current) return;
    if (demoMode) return;
    pendingAutoStartRef.current = false;
    const id = window.setTimeout(() => {
      generateSellUrl();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, isOpen]);

  const selectedToken = useMemo(() => {
    const current = String(currency || "").toUpperCase();
    if (!current) return null;
    return (
      (availableTokens || []).find(
        (token) => String(token?.currency || "").toUpperCase() === current,
      ) || null
    );
  }, [availableTokens, currency]);

  const amountValue = Number.parseFloat(amount || "");
  const currencyUpper = String(currency || "").toUpperCase();
  const isCurrencyLine = Boolean(selectedToken?.isTrustlineOnly);
  const rlusdRate = isCurrencyLine
    ? currencyUpper === "RLUSD" || currencyUpper === "USD"
      ? 1
      : Number(rlusdPerUnitRates?.[currencyUpper])
    : Number.NaN;
  const allocatedRlusdBalance = Number.parseFloat(
    selectedToken?.allocatedRlusd ?? Number.NaN,
  );
  const availableBalance = (() => {
    const directBalance = Number.parseFloat(selectedToken?.value ?? 0);
    if (!isCurrencyLine) return directBalance;
    if (
      Number.isFinite(allocatedRlusdBalance) &&
      allocatedRlusdBalance > 0 &&
      Number.isFinite(rlusdRate) &&
      rlusdRate > 0
    ) {
      return allocatedRlusdBalance / rlusdRate;
    }
    return directBalance;
  })();
  const hasValidAmount = Number.isFinite(amountValue) && amountValue > 0;
  const conversionMissing =
    isCurrencyLine &&
    hasValidAmount &&
    (!Number.isFinite(rlusdRate) || rlusdRate <= 0);
  const rlusdEquivalent =
    isCurrencyLine && hasValidAmount && !conversionMissing
      ? amountValue * rlusdRate
      : null;
  const rlusdEquivalentLabel =
    Number.isFinite(Number(rlusdEquivalent)) && Number(rlusdEquivalent) > 0
      ? formatAmountWithSymbol(locale, Number(rlusdEquivalent), "RLUSD", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : null;
  const balanceLabel = Number.isFinite(availableBalance)
    ? formatAmountWithSymbol(locale, availableBalance, currencyUpper || "XRP", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;
  const baseCurrencyCode = isCurrencyLine ? "RLUSD" : currencyUpper;
  const baseCurrencyAmount = isCurrencyLine
    ? Number.isFinite(rlusdEquivalent)
      ? Number(rlusdEquivalent.toFixed(6))
      : Number.NaN
    : hasValidAmount
      ? amountValue
      : Number.NaN;

  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    const loadFiatCurrencies = async () => {
      setFiatLoading(true);
      setFiatError(null);
      try {
        const response = await fetch("/api/moonpay/fiat-currencies");
        const data = await response.json();
        if (!response.ok) {
          throw new Error(resolveFiatErrorMessage(data));
        }
        const list = data?.currencies || data?.data || data || [];
        const normalized = Array.isArray(list)
          ? list
              .map((fiat) => ({
                ...fiat,
                code: String(fiat?.code || "").toUpperCase(),
              }))
              .filter((fiat) => fiat.code)
          : [];

        if (!active) return;
        setFiatCurrencies(normalized);
        setQuoteCurrency((prev) => {
          if (normalized.some((fiat) => fiat.code === prev)) {
            return prev;
          }
          const usd = normalized.find((fiat) => fiat.code === "USD");
          return usd?.code || normalized[0]?.code || "USD";
        });
      } catch (error) {
        if (!active) return;
        setFiatError(error?.message || "Failed to load fiat currencies");
        setFiatCurrencies([]);
      } finally {
        if (active) setFiatLoading(false);
      }
    };

    loadFiatCurrencies();

    return () => {
      active = false;
    };
  }, [isOpen]);

  // Générer l'URL MoonPay pour la vente
  const generateSellUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    if (!hasValidAmount) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }
    if (conversionMissing) {
      setError(
        t(
          "ui_rate_unavailable_base_5c1a9b7d2e",
          "Rate unavailable for base currency.",
        ),
      );
      return;
    }
    if (!Number.isFinite(baseCurrencyAmount) || baseCurrencyAmount <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    // Persist inputs so we can resume after iOS Apple flows / reconnect.
    const flowId = getOrCreateFlowId();
    saveResumeState({
      flowId,
      sourceCurrencyCode: currencyUpper,
      sourceAmount: amountValue,
      baseCurrencyCode,
      baseCurrencyAmount,
    });
    saveSellSourceState({
      flowId,
      sourceCurrencyCode: currencyUpper,
      sourceAmount: amountValue,
      baseCurrencyCode,
      baseCurrencyAmount,
    });

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(baseCurrencyCode || "RLUSD").toUpperCase(),
            quoteCurrencyCode: String(quoteCurrency || "USD").toUpperCase(),
            amount: baseCurrencyAmount,
          }),
        );
        if (res?.error) {
          throw new Error(res.error);
        }
        setIframeUrl(null);
        setStep("success");
        setTimeout(() => {
          onClose?.();
        }, 1200);
        return;
      }

      setStep("loading");

      const response = await fetch("/api/moonpay/generate-sell-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          baseCurrencyCode, // Crypto à vendre
          quoteCurrencyCode: quoteCurrency, // Fiat à recevoir
          baseCurrencyAmount,
          options: flowId ? { xcannesFlowId: flowId } : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_sell_url_9b2c7a1d5e",
              "Failed to generate sell URL.",
            ),
        );
      }

      if (data.success && data.url) {
        setIframeUrl(data.url);
        saveResumeState({ lastIframeUrl: data.url });
        setStep("iframe");
      } else {
        throw new Error(
          t(
            "moonpay_error_invalid_response_6b2d8c1a9f",
            "Invalid response from server.",
          ),
        );
      }
    } catch (err) {
      console.error("Error generating sell URL:", err);
      setError(
        err.message ||
          t(
            "moonpay_error_load_widget_3c1a7d8b2e",
            "Failed to load MoonPay widget.",
          ),
      );
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  // Écouter les messages du widget MoonPay
  useEffect(() => {
    const handleMessage = (event) => {
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;
      if (DEBUG_LOGS) {
        console.log("MoonPay sell message received:", event.data);
      }

      if (type === "transaction_completed" || status === "completed") {
        clearResumeState();
        clearSellSourceState();
        clearAutoOpen();
        clearFlowId();
        clearMoonpayWalletAddress();
        setStep("success");
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      if (type === "transaction_failed" || status === "failed") {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again.",
          ),
        );
        setStep("error");
      }

      if (type === "close" || type === "widget_closed") {
        handleWidgetClose();
      }
    };

    if (isOpen) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    clearAutoOpen,
    clearFlowId,
    clearMoonpayWalletAddress,
    clearResumeState,
    clearSellSourceState,
    deactivateMoonpayActive,
    handleWidgetClose,
    isOpen,
    onClose,
    t,
  ]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, quoteCurrency]);

  const continueLabel = loading
    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
    : demoMode
      ? t("moonpay_action_simulate_sell_4d1a9c7b2e", "Simulate sell")
      : t("moonpay_action_continue_sell_2c8a1d6b4f", "Retirer");
  const continueDisabled =
    loading ||
    !hasValidAmount ||
    !selectedToken ||
    fiatCurrencies.length === 0 ||
    conversionMissing;
  const fiatPlaceholder = t("moonpay_fiat_currency_label", "Fiat currency");
  const fiatUnavailable = !fiatLoading && fiatCurrencies.length === 0;
  const showFiatError = fiatError && !fiatLoading;
  const fiatOptions = fiatCurrencies.map((fiat) => ({
    value: fiat.code,
    label: `${fiat.name || fiat.code} (${fiat.code})`,
  }));
  const fiatSelectValue = fiatCurrencies.length === 0 ? "" : quoteCurrency;

  const shouldAnimate = !embedded;
  const { shouldRender, isClosing } = useModalTransition(isOpen, {
    enabled: shouldAnimate,
  });

  if (embedded) {
    if (!isOpen) return null;
  } else if (!shouldRender) {
    return null;
  }

  // Mode embedded: retourner seulement le contenu
  const renderContent = () => (
    <div className={embedded ? "" : "p-4 md:p-5"}>
      {/* Form */}
      {step === "form" && (
        <div className="space-y-5">
          {/* From wallet display */}
          <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
            <p className="text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_from_account", "Depuis le compte")}
            </p>
            {String(walletLabel || "").trim() ? (
              <div className="flex items-center gap-2 mb-1">
                <span
                  className="h-1.5 w-1.5 rounded-full bg-xcannes-green/80 shrink-0"
                  aria-hidden
                />
                <p className="min-w-0 text-[16px] md:text-[17px] text-white font-semibold truncate">
                  {walletLabel}
                </p>
              </div>
            ) : null}
            <p className="text-[10px] md:text-[11px] text-white/60 font-mono break-all">
              {walletAddress}
            </p>
          </div>

          {/* Currency selector */}
          <div>
            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t(
                "moonpay_select_crypto_to_sell",
                "Vous vendez",
              )}
            </label>
            <ModalSelect
              value={currency}
              onChange={setCurrency}
              options={supportedCurrencies.map((curr) => ({
                value: curr.code,
                label: curr.label || curr.name || curr.code,
                labelLeft:
                  curr.labelLeft || curr.label || curr.name || curr.code,
                labelRight: curr.labelRight || null,
                labelMobile:
                  curr.labelMobile ||
                  curr.labelLeft ||
                  curr.label ||
                  curr.name ||
                  curr.code,
                icon: curr.icon || null,
              }))}
              useNativeSelect={false}
              showMobileOptionRight={true}
              buttonClassName="w-full bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer hover:ring-white/25 transition-all duration-150"
              menuClassName={`${
                noticeVariant === "demo"
                  ? "bg-xcannes-surface-demo"
                  : "bg-elevated"
              } ring-1 ring-white/10`}
              selectClassName="xcannes-select w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60"
            />
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_amount_to_sell", "Amount to sell")}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                step="0.01"
                min="0"
                className="w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 pr-16 transition-all duration-150"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                {currency}
              </span>
            </div>
            {balanceLabel ? (
              <p className="mt-2 text-[11px] text-white/55">
                {t(
                  "moonpay_sell_balance_available",
                  "Disponible: {{amount}}",
                  { amount: balanceLabel },
                )}
              </p>
            ) : null}
            {isCurrencyLine && hasValidAmount ? (
              <p
                className={`mt-2 text-[11px] ${
                  conversionMissing ? "text-red-300" : "text-white/60"
                }`}
              >
                {conversionMissing
                  ? t(
                      "ui_rate_unavailable_base_5c1a9b7d2e",
                      "Rate unavailable for base currency.",
                    )
                  : t(
                      "moonpay_sell_rlusd_equivalent_sentence",
                      "{{amount}} seront envoyés à MoonPay en RLUSD pour ce retrait.",
                      { amount: rlusdEquivalentLabel || "0 RLUSD" },
                    )}
              </p>
            ) : null}
          </div>

          {/* Arrow down */}
          <div className="flex justify-center">
            <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center">
              <ArrowDownIcon className="w-5 h-5 text-xcannes-green" />
            </div>
          </div>

          {/* Fiat currency selector */}
          <div>
            <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
              {t("moonpay_receive_in", "Receive in")}
            </label>
            <ModalSelect
              value={fiatSelectValue}
              onChange={setQuoteCurrency}
              options={fiatOptions}
              placeholder={fiatPlaceholder}
              disabled={fiatLoading || fiatCurrencies.length === 0}
              buttonClassName="w-full bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl px-4 py-4 text-base text-white/90 focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 cursor-pointer disabled:opacity-60 hover:ring-white/25 transition-all duration-150"
              menuClassName={
                noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full px-4 py-4 bg-black/30 ring-1 ring-white/15 ring-inset rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-xcannes-green/60 disabled:opacity-60"
            />
            {showFiatError && (
              <p className="text-xs text-red-400 mt-1">{fiatError}</p>
            )}
            {!fiatLoading && !fiatError && fiatUnavailable && (
              <p className="text-[11px] text-white/55 mt-2">
                {t("moonpay_fiat_unavailable", "Fiat currencies unavailable")}
              </p>
            )}
          </div>

          {/* Destination display */}
          <div className="rounded-[14px] px-4 py-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-white/5 ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                <BuildingLibraryIcon className="w-5 h-5 text-white/70" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                  {t("moonpay_sell_destination_prefix", "Vers :")}
                </p>
                <p className="text-[16px] md:text-[17px] text-white font-semibold truncate mt-1">
                  {t("moonpay_sell_destination_bank_account", "Compte bancaire")}
                </p>
	                <p className="text-[13px] md:text-sm leading-snug text-white/55 mt-2">
	                  {t(
	                    "moonpay_sell_destination_helper",
	                    "Vous renseignerez votre compte bancaire sur la page du partenaire (IBAN, etc.).",
	                  )}
	                </p>
              </div>
            </div>
          </div>

          {demoMode ? (
            <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-white/[0.03] px-3 py-2 text-[11px] text-white/60">
              {t(
                "moonpay_info_sell_demo_6d1a9c2b7e",
                "Mode démo : la vente est simulée (pas de virement bancaire).",
              )}
            </div>
          ) : null}

          {/* Error message */}
          {displayError && (
            <div className="flex items-start gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
              <XCircleIcon className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Continue button */}
          <SwipeConfirmButton
            label={continueLabel}
            onConfirm={generateSellUrl}
            disabled={continueDisabled}
            variant="xcannesGreen"
            className="md:hidden"
          />
          <button
            type="button"
            onClick={generateSellUrl}
            disabled={continueDisabled}
            className={`hidden md:block w-full text-xl py-4 ${greenActionBtnBase}`}
          >
            {continueLabel}
          </button>
          <p className="mt-2 text-[11px] md:text-xs text-white/60 text-center">
            {t(
              "moonpay_sell_secure_bank_transfer_note",
              "Virement sécurisé vers votre banque",
            )}
          </p>
        </div>
      )}

      {/* Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mb-4"></div>
          <p className="text-white/80">
            {t("moonpay_loading_widget", "Loading MoonPay widget...")}
          </p>
        </div>
      )}

      {/* MoonPay iframe */}
      {step === "iframe" && iframeUrl && (
        <div
          className="relative"
          style={{ height: "calc(100vh - 40px)", minHeight: "600px", maxHeight: "760px" }}
        >
          <iframe
            src={iframeUrl}
            className="w-full h-full rounded-lg"
            allow={moonpayIframeAllow}
            allowFullScreen
            title={t("moonpay_widget_title_sell", "MoonPay Sell Widget")}
          />
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_sell_success_title", "Sale Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_sell_success_body",
              "Your funds will be transferred to your bank account.",
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
          >
            {t("close", "Close")}
          </button>
        </div>
      )}

      {/* Error */}
      {step === "error" && (
        <div className="flex flex-col items-center justify-center py-12">
          <XCircleIcon className="w-16 h-16 text-red-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_error_title", "Something went wrong")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {displayError ||
              t(
                "moonpay_error_try_again_later_6f2b1c9d8a",
                "Please try again later.",
              )}
          </p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => {
                setStep("form");
                setError(null);
                setIframeUrl(null);
              }}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
            >
              {t("try_again", "Try Again")}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white font-semibold rounded-lg transition-all"
            >
              {t("close", "Close")}
            </button>
          </div>
        </div>
      )}
    </div>
  );

  // Mode embedded: retourner seulement le contenu
  if (embedded) {
    return renderContent();
  }

  // Mode standalone: retourner le modal complet
  return (
    <>
      {/* Backdrop */}
	      <div
	        className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
	          isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
	        }`}
	        onClick={step === "iframe" ? null : handleUserClose}
	      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
	        <div
	          className={`relative w-full wallet-modal-panel max-w-2xl border rounded-2xl overflow-hidden pointer-events-auto shadow-2xl ${
	            noticeVariant === "demo"
	              ? "bg-xcannes-surface-demo border-white/10"
	              : "bg-elevated border-subtle"
	          } ${isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in"}`}
	          onClick={(e) => e.stopPropagation()}
	        >
	          <button
	            type="button"
	            onClick={handleUserClose}
	            className="absolute top-4 right-4 z-20 wallet-modal-close text-white/70 hover:text-white transition-colors text-xl bg-transparent rounded-full w-10 h-10 flex items-center justify-center"
	          >
	            ✕
	          </button>

	          {/* Content */}
	          {renderContent()}
	        </div>
	      </div>
    </>
  );
};

export default MoonPaySellModal;
