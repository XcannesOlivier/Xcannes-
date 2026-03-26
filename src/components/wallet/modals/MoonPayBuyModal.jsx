import { useMemo, useState, useEffect, useRef } from "react";
import { XCircleIcon, CheckCircleIcon } from "@heroicons/react/24/outline";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { useTranslation } from "next-i18next";
import { CRYPTO_ICONS } from "@/utils/marketConstants";
import { useModalTransition } from "@/hooks/useModalTransition";
import { isIOSDevice } from "@/utils/deviceDetect";

const DEBUG_LOGS = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";
const MOONPAY_ORIGIN_SUFFIX = ".moonpay.com";
const MOONPAY_ACTIVE_STORAGE_KEY = "xcannes_moonpay_active";
const MOONPAY_BUY_RESUME_KEY = "xcannes_moonpay_resume_buy_v1";
const MOONPAY_AUTOOPEN_TAB_KEY = "xcannes_moonpay_autoopen_tab";
const MOONPAY_TAG_XRP = Number.parseInt(
  process.env.NEXT_PUBLIC_MOONPAY_TAG_XRP || "589",
  10,
);
const MOONPAY_TAG_RLUSD = Number.parseInt(
  process.env.NEXT_PUBLIC_MOONPAY_TAG_RLUSD || "590",
  10,
);

const resolveMoonpayTag = (currencyCode) => {
  const code = String(currencyCode || "")
    .trim()
    .toUpperCase();
  if (code === "XRP")
    return Number.isFinite(MOONPAY_TAG_XRP) ? MOONPAY_TAG_XRP : null;
  if (code === "RLUSD")
    return Number.isFinite(MOONPAY_TAG_RLUSD) ? MOONPAY_TAG_RLUSD : null;
  return null;
};

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
 * MoonPayBuyModal - Modal pour acheter des cryptos avec MoonPay
 *
 * @param {boolean} isOpen - Modal ouverte ou fermée
 * @param {function} onClose - Callback de fermeture
 * @param {string} walletAddress - Adresse XRPL de destination
 * @param {boolean} embedded - Mode embedded (sans backdrop/header)
 */
const MoonPayBuyModal = ({
  isOpen,
  onClose,
  walletAddress,
  walletLabel = "",
  embedded = false,
  noticeVariant = "preview",
  demoMode = false,
  onDemoSubmit,
  prefill = null,
}) => {
  const { t } = useTranslation("common");
  const [iframeUrl, setIframeUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'success' | 'error'
  const displayError =
    error && /api\.sandbox\.moonpay\.com/i.test(error) ? null : error;
  const moonpayActiveRef = useRef(false);
  const pendingAutoStartRef = useRef(false);
  const isEmbeddedPwa =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("embedded") === "pwa";
  const showIOSKycFallback = isEmbeddedPwa && isIOSDevice();

  // Mark MoonPay iframe flow as active so wallet-level auto-lock does not
  // disconnect while the user completes KYC/Apple flows (events inside iframe
  // don't bubble to the parent window).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = Boolean(isOpen && step === "iframe" && iframeUrl);
    if (active === moonpayActiveRef.current) return;
    moonpayActiveRef.current = active;
    try {
      if (active) {
        window.sessionStorage?.setItem(MOONPAY_ACTIVE_STORAGE_KEY, "1");
        window.sessionStorage?.setItem(MOONPAY_AUTOOPEN_TAB_KEY, "buy");
        window.__XCANNES_MOONPAY_ACTIVE__ = true;
      } else {
        window.sessionStorage?.removeItem(MOONPAY_ACTIVE_STORAGE_KEY);
        window.__XCANNES_MOONPAY_ACTIVE__ = false;
      }
      window.dispatchEvent(
        new CustomEvent("xcannes:moonpay-active", { detail: { active } }),
      );
    } catch {
      // Ignore storage errors
    }
  }, [iframeUrl, isOpen, step]);

  // Options d'achat (RLUSD par défaut)
  const [currency, setCurrency] = useState("RLUSD");
  const [amount, setAmount] = useState("");
  const [amountType, setAmountType] = useState("fiat");
  const [fiatCurrency, setFiatCurrency] = useState("USD");
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

  // Cryptos supportées par MoonPay
  const supportedCurrencies = [
    { code: "RLUSD", icon: CRYPTO_ICONS.RLUSD },
    { code: "XRP", icon: CRYPTO_ICONS.XRP },
  ];

  const PRODUCT_MIN_USD = 5;

  const saveResumeState = useMemo(() => {
    return (extra = {}) => {
      if (typeof window === "undefined") return;
      try {
        window.sessionStorage?.setItem(
          MOONPAY_BUY_RESUME_KEY,
          JSON.stringify({
            v: 1,
            kind: "buy",
            ts: Date.now(),
            walletAddress: String(walletAddress || ""),
            currency: String(currency || "").toUpperCase(),
            amountType: amountType === "crypto" ? "crypto" : "fiat",
            amount: String(amount || ""),
            fiatCurrency: String(fiatCurrency || "").toUpperCase(),
            ...extra,
          }),
        );
      } catch {
        // Ignore
      }
    };
  }, [amount, amountType, currency, fiatCurrency, walletAddress]);

  const readResumeState = useMemo(() => {
    return () => {
      if (typeof window === "undefined") return null;
      try {
        const raw = window.sessionStorage?.getItem(MOONPAY_BUY_RESUME_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!parsed || parsed.v !== 1 || parsed.kind !== "buy") return null;
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
        window.sessionStorage?.removeItem(MOONPAY_BUY_RESUME_KEY);
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

  const prefillSignature = useMemo(() => {
    if (!prefill) return "";
    return JSON.stringify({
      currency: prefill.currency || "",
      amount: prefill.amount ?? "",
      amountType: prefill.amountType || "",
      fiatCurrency: prefill.fiatCurrency || "",
    });
  }, [prefill]);
  const lastPrefillRef = useRef(null);

  useEffect(() => {
    if (!isOpen) {
      lastPrefillRef.current = null;
      return;
    }
    if (!prefill || !prefillSignature) return;
    if (lastPrefillRef.current === prefillSignature) return;
    lastPrefillRef.current = prefillSignature;
    if (prefill.currency) {
      setCurrency(String(prefill.currency).toUpperCase());
    }
    if (prefill.amount != null) {
      setAmount(String(prefill.amount));
    }
    if (prefill.amountType) {
      const nextType = prefill.amountType === "crypto" ? "crypto" : "fiat";
      setAmountType(nextType);
    }
    if (prefill.fiatCurrency) {
      setFiatCurrency(String(prefill.fiatCurrency).toUpperCase());
    }
  }, [isOpen, prefill, prefillSignature]);

  // Resume flow after iOS background / reconnect:
  // restore the last inputs and auto-generate the widget URL so the user
  // lands directly back on the MoonPay iframe.
  useEffect(() => {
    if (!isOpen) return;
    if (!walletAddress) return;
    if (demoMode) return;
    if (step !== "form" || iframeUrl) return;
    if (fiatLoading) return;
    if (!fiatCurrency) return;

    const resume = readResumeState();
    if (!resume) return;
    if (String(resume.walletAddress || "") !== String(walletAddress || "")) return;
    const ageMs = Date.now() - Number(resume.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 60 * 60 * 1000) return;

    // Prefer restoring the last widget URL (keeps the same MoonPay session),
    // and only regenerate if missing.
    if (resume.lastIframeUrl) {
      setIframeUrl(String(resume.lastIframeUrl));
      setStep("iframe");
      return;
    }

    const nextCurrency = String(resume.currency || "").toUpperCase();
    if (nextCurrency) setCurrency(nextCurrency);
    if (resume.amountType) setAmountType(resume.amountType === "crypto" ? "crypto" : "fiat");
    if (resume.amount != null) setAmount(String(resume.amount));
    if (resume.fiatCurrency) setFiatCurrency(String(resume.fiatCurrency).toUpperCase());

    pendingAutoStartRef.current = true;
  }, [
    demoMode,
    fiatCurrency,
    fiatLoading,
    iframeUrl,
    isOpen,
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
      generateBuyUrl();
    }, 0);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demoMode, isOpen]);

  const selectedFiat = useMemo(() => {
    return (fiatCurrencies || []).find((fiat) => fiat.code === fiatCurrency);
  }, [fiatCurrencies, fiatCurrency]);

  const minFiatAmount = useMemo(() => {
    const candidate = Number(
      selectedFiat?.minBuyAmount ?? selectedFiat?.minAmount,
    );
    if (Number.isFinite(candidate) && candidate > 0) {
      return candidate;
    }
    if (fiatCurrency === "USD") {
      return PRODUCT_MIN_USD;
    }
    return null;
  }, [PRODUCT_MIN_USD, fiatCurrency, selectedFiat]);

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
        setFiatCurrency((prev) => {
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

  // Générer l'URL MoonPay
  const generateBuyUrl = async () => {
    if (!walletAddress) {
      setError(
        t(
          "moonpay_error_wallet_required_5f2a1c9d3e",
          "Wallet address is required.",
        ),
      );
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      setError(
        t(
          "moonpay_error_invalid_amount_8c3b1a6d2f",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    if (
      amountType === "fiat" &&
      minFiatAmount !== null &&
      parseFloat(amount) < minFiatAmount
    ) {
      setError(
        t("moonpay_error_minimum_fiat", {
          defaultValue: "Minimum amount is {{amount}} {{currency}}.",
          amount: minFiatAmount,
          currency: fiatCurrency,
        }),
      );
      return;
    }

    // Persist inputs so we can resume after iOS Apple flows / reconnect.
    saveResumeState();

    setLoading(true);
    setError(null);

    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: String(currency || "RLUSD").toUpperCase(),
            baseCurrencyCode: String(fiatCurrency || "USD").toUpperCase(),
            amountType,
            amount: parseFloat(amount),
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

      const walletAddressTag = resolveMoonpayTag(currency);
      const response = await fetch("/api/moonpay/generate-buy-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          walletAddress,
          currencyCode: currency,
          baseCurrencyCode: fiatCurrency,
          baseCurrencyAmount:
            amountType === "fiat" ? parseFloat(amount) : undefined,
          quoteCurrencyAmount:
            amountType === "crypto" ? parseFloat(amount) : undefined,
          options: walletAddressTag != null ? { walletAddressTag } : undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message ||
            t(
              "moonpay_error_generate_buy_url_4d2c9a1f7b",
              "Failed to generate buy URL.",
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
      console.error("Error generating buy URL:", err);
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
      // Vérifier l'origine (MoonPay sandbox ou production)
      if (!isTrustedMoonPayOrigin(event.origin)) return;

      const { type, status } = event.data;

      if (DEBUG_LOGS) {
        console.log("MoonPay message received:", event.data);
      }

      // Transaction complétée
      if (type === "transaction_completed" || status === "completed") {
        clearResumeState();
        clearAutoOpen();
        setStep("success");
        setTimeout(() => {
          onClose();
        }, 3000);
      }

      // Transaction échouée
      if (type === "transaction_failed" || status === "failed") {
        setError(
          t(
            "moonpay_error_transaction_failed_9a2c1b7d5e",
            "Transaction failed. Please try again.",
          ),
        );
        setStep("error");
      }

      // Utilisateur a fermé le widget
      if (type === "close" || type === "widget_closed") {
        clearResumeState();
        clearAutoOpen();
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener("message", handleMessage);
    }

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [clearAutoOpen, clearResumeState, isOpen, onClose, t]);

  // Reset au changement de devise
  useEffect(() => {
    setError(null);
  }, [currency, amount, fiatCurrency]);

  const continueLabel = loading
    ? t("moonpay_action_loading_7c2b1d9a3e", "Loading...")
    : demoMode
      ? t("moonpay_action_simulate_buy_5a1c9d7b3e", "Simulate buy")
      : t("moonpay_action_continue_buy_8d2a1c6b9f", "Continuer");
  const continueDisabled = loading || !amount || fiatCurrencies.length === 0;
  const fiatPlaceholder = t("moonpay_fiat_currency_label", "Fiat currency");
  const fiatUnavailable = !fiatLoading && fiatCurrencies.length === 0;
  const showFiatError = fiatError && !fiatLoading;
  const fiatOptions = fiatCurrencies.map((fiat) => ({
    value: fiat.code,
    label: `${fiat.name || fiat.code} (${fiat.code})`,
  }));
  const fiatSelectValue = fiatCurrencies.length === 0 ? "" : fiatCurrency;

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
        <div className="space-y-4">
          {/* Currency selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t(
                "moonpay_select_cryptocurrency",
                "Vous recevrez des dollars numériques (USD)",
              )}
            </label>
            <ModalSelect
              value={currency}
              onChange={setCurrency}
              options={supportedCurrencies.map((curr) => ({
                value: curr.code,
                label: curr.code,
                labelLeft: curr.code,
                labelMobile: curr.code,
                description:
                  curr.code === "XRP"
                    ? t(
                        "moonpay_xrp_network_note",
                        "Utilisé pour les transferts et frais réseau",
                      )
                    : null,
                icon: curr.icon ? { src: curr.icon, alt: curr.code } : null,
              }))}
              useNativeSelect={false}
              buttonClassName="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-xcannes-green focus:outline-none cursor-pointer"
              menuClassName={`${
                noticeVariant === "demo"
                  ? "bg-xcannes-surface-demo"
                  : "bg-elevated"
              } ring-1 ring-white/10`}
              selectClassName="xcannes-select w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none"
            />
          </div>

          {/* Fiat currency selector */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t("moonpay_fiat_currency_label", "Fiat currency")}
            </label>
            <ModalSelect
              value={fiatSelectValue}
              onChange={setFiatCurrency}
              options={fiatOptions}
              placeholder={fiatPlaceholder}
              disabled={fiatLoading || fiatCurrencies.length === 0}
              buttonClassName="bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white focus:border-xcannes-green focus:outline-none cursor-pointer disabled:opacity-60"
              menuClassName={
                noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none disabled:opacity-60"
            />
            {fiatLoading && (
              <p className="text-xs text-white/60 mt-1">
                {t("moonpay_fiat_loading", "Loading fiat currencies...")}
              </p>
            )}
            {showFiatError && (
              <p className="text-xs text-red-400 mt-1">{fiatError}</p>
            )}
            {!fiatLoading && !fiatError && fiatUnavailable && (
              <p className="text-xs text-white/60 mt-1">
                {t("moonpay_fiat_unavailable", "Fiat currencies unavailable")}
              </p>
            )}
          </div>

          {/* Amount input */}
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              {t("moonpay_amount_in_currency_8b1c7d2a9e", {
                defaultValue: "Amount in {{currency}}",
                currency: amountType === "fiat" ? fiatCurrency : currency,
              })}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder={amountType === "fiat" ? "100" : "1.0"}
                step={amountType === "fiat" ? "10" : "0.1"}
                min="0"
                className="w-full px-4 py-3 bg-black/40 border border-white/10 rounded-lg text-white focus:border-xcannes-green focus:outline-none pr-16"
              />

              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 text-sm">
                {amountType === "fiat" ? fiatCurrency : currency}
              </span>
            </div>
            {amountType === "fiat" && minFiatAmount !== null && (
              <p className="text-xs text-white/40 mt-1">
                {t("moonpay_minimum_prefix", "Minimum:")} {minFiatAmount}{" "}
                {fiatCurrency}
              </p>
            )}
          </div>

          {/* Wallet address display */}
          <div className="bg-black/40 border border-white/10 rounded-lg p-3">
            <p className="text-xs text-white/60 mb-1">
              {t("moonpay_destination_wallet", "Destination wallet")}
            </p>
            {String(walletLabel || "").trim() ? (
              <p className="text-[16px] md:text-[17px] text-white/80 font-semibold truncate mb-1">
                {walletLabel}
              </p>
            ) : null}
            <p className="text-[8px] md:text-[10px] text-white/60 font-mono break-all">
              {walletAddress}
            </p>
          </div>

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
            onConfirm={generateBuyUrl}
            disabled={continueDisabled}
            variant="xcannesGreen"
            className="md:hidden"
          />
          <button
            type="button"
            onClick={generateBuyUrl}
            disabled={continueDisabled}
            className="hidden md:block w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 border bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30 hover:scale-[1.02] disabled:bg-xcannes-green/10 disabled:text-xcannes-green/60 disabled:border-xcannes-green/25 disabled:hover:scale-100"
          >
            {continueLabel}
          </button>
          <p className="mt-2 text-[11px] md:text-xs text-white/60 text-center">
            {t(
              "moonpay_buy_secure_partner_note",
              "Fourni par un partenaire sécurisé",
            )}
          </p>
        </div>
      )}

      {/* Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4"></div>
          <p className="text-white/80">
            {t("moonpay_loading_widget", "Loading MoonPay widget...")}
          </p>
        </div>
      )}

	      {/* MoonPay iframe */}
      {step === "iframe" && iframeUrl && (
        <div className="relative" style={{ height: "600px" }}>
          <iframe
            src={iframeUrl}
            className="w-full h-full rounded-lg"
            allow="clipboard-write"
            allowFullScreen
            title={t("moonpay_widget_title_buy", "MoonPay Widget")}
          />

          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 bg-black/80 text-white/80 hover:text-white px-3 py-1 rounded-lg text-sm transition-colors"
          >
            {t("close", "Close")}
          </button>

          {showIOSKycFallback && (
            <a
              href={iframeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-2 left-2 bg-black/80 text-white/80 hover:text-white px-3 py-1 rounded-lg text-xs transition-colors"
            >
              {t(
                "moonpay_open_in_safari_for_kyc",
                "KYC caméra iOS: ouvrir dans Safari",
              )}
            </a>
          )}
        </div>
      )}

      {/* Success */}
      {step === "success" && (
        <div className="flex flex-col items-center justify-center py-12">
          <CheckCircleIcon className="w-16 h-16 text-green-400 mb-4" />
          <h4 className="text-xl font-bold text-white mb-2">
            {t("moonpay_buy_success_title", "Transaction Completed!")}
          </h4>
          <p className="text-white/60 text-center mb-4">
            {t(
              "moonpay_buy_success_body",
              "Your crypto will be sent to your wallet shortly.",
            )}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
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
              className="px-6 py-2 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
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
        onClick={step === "iframe" ? null : onClose}
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
          {/* Header */}
          <div className="flex items-center justify-between p-4 md:p-5 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                  {t(
                    "ui_buy_crypto_with_fiat_f09c7b4228",
                    "Buy Crypto with Fiat",
                  )}
                </h3>
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/80 text-xs md:text-sm font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}

              </div>
              <p className="text-xs text-white/60 mt-1">
                {t(
                  "ui_powered_by_moonpay_secure_ch_0bcfb2aeb5",
                  "Powered by MoonPay • Secure checkout",
                )}
              </p>
            </div>
            {step !== "iframe" && (
              <button
                type="button"
                onClick={onClose}
                className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            )}
          </div>

          {/* Content */}
          {renderContent()}
        </div>
      </div>
    </>
  );
};

export default MoonPayBuyModal;
