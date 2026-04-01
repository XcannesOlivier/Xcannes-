import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeftIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "next-i18next";
import { isIOSDevice } from "@/utils/deviceDetect";
import { greenActionBtnBase } from "./walletModalTokens";

const TOPPER_ACTIVE_STORAGE_KEY = "xcannes_topper_active";

const setTopperActive = (active) => {
  if (typeof window === "undefined") return;
  try {
    window.__XCANNES_TOPPER_ACTIVE__ = Boolean(active);
    if (active) {
      window.sessionStorage?.setItem(TOPPER_ACTIVE_STORAGE_KEY, "1");
    } else {
      window.sessionStorage?.removeItem(TOPPER_ACTIVE_STORAGE_KEY);
    }
    window.dispatchEvent(
      new CustomEvent("xcannes:topper-active", { detail: { active: Boolean(active) } }),
    );
  } catch {
    // ignore storage errors
  }
};

const TopperBuyModal = ({
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
  const [step, setStep] = useState("form"); // 'form' | 'loading' | 'iframe' | 'error'

  const isIOS = isIOSDevice();
  const topperIframeAllow = isIOS
    ? "camera *; microphone *; clipboard-write"
    : "camera *; microphone *; clipboard-write; payment *";

  const [fiatCurrency, setFiatCurrency] = useState(
    String(prefill?.baseCurrencyCode || "EUR").toUpperCase(),
  );
  const [cryptoCurrency, setCryptoCurrency] = useState(
    String(prefill?.currencyCode || "XRP").toUpperCase(),
  );
  const [amount, setAmount] = useState(
    prefill?.amount != null ? String(prefill.amount) : "",
  );

  const latestStepRef = useRef(step);
  const latestIframeUrlRef = useRef(iframeUrl);
  useEffect(() => {
    latestStepRef.current = step;
    latestIframeUrlRef.current = iframeUrl;
  }, [iframeUrl, step]);

  useEffect(() => {
    if (!isOpen) {
      setTopperActive(false);
      return;
    }
    setTopperActive(step === "iframe" && Boolean(iframeUrl));
    return () => setTopperActive(false);
  }, [iframeUrl, isOpen, step]);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
  }, [amount, cryptoCurrency, fiatCurrency, isOpen]);

  const parsedAmount = useMemo(() => {
    const value = Number.parseFloat(String(amount || ""));
    return Number.isFinite(value) && value > 0 ? value : null;
  }, [amount]);

  const canContinue = Boolean(walletAddress) && Boolean(parsedAmount) && Boolean(fiatCurrency);

  const handleBack = () => {
    setIframeUrl(null);
    setStep("form");
  };

  const handleSubmit = async () => {
    if (!canContinue) return;

    setLoading(true);
    setError(null);
    try {
      if (demoMode) {
        const res = await Promise.resolve(
          onDemoSubmit?.({
            currencyCode: cryptoCurrency,
            baseCurrencyCode: fiatCurrency,
            amount: parsedAmount,
          }),
        );
        if (res?.error) throw new Error(res.error);
        onClose?.();
        return;
      }

      setStep("loading");

      const response = await fetch("/api/topper/generate-buy-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress,
          walletLabel,
          currencyCode: cryptoCurrency,
          baseCurrencyCode: fiatCurrency,
          baseCurrencyAmount: parsedAmount,
          options: {
            // Default behaviour: keep recipient fixed but allow address edits server-side
            // (can be overridden later if needed).
            recipientEditMode: "only-address-and-tag",
          },
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data?.error?.message ||
            data?.message ||
            t("topper_error_generate_buy_url", {
              defaultValue: "Failed to generate Topper buy URL.",
            }),
        );
      }

      if (data?.success && data?.url) {
        setIframeUrl(data.url);
        setStep("iframe");
      } else {
        throw new Error(
          t("topper_error_invalid_response", {
            defaultValue: "Invalid response from server.",
          }),
        );
      }
    } catch (err) {
      console.error("Error generating Topper buy URL:", err);
      setError(
        err?.message ||
          t("topper_error_load_widget", {
            defaultValue: "Failed to load Topper widget.",
          }),
      );
      setStep("error");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="h-full flex flex-col">
      {embedded ? null : (
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold text-white">
            {t("topper_buy_title", { defaultValue: "Acheter (Topper)" })}
          </h3>
          <button type="button" onClick={onClose} className="text-white/60 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {step === "iframe" && iframeUrl ? (
        <div
          className="relative"
          style={{
            height: "calc(100vh - 40px)",
            minHeight: "600px",
            maxHeight: "760px",
          }}
        >
          <div className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              onClick={handleBack}
              className="text-white/60 hover:text-white flex items-center gap-2 text-sm"
            >
              <ChevronLeftIcon className="w-4 h-4" aria-hidden="true" />
              {t("back", "Back")}
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={onClose}
              className="text-white/60 hover:text-white text-sm"
            >
              {t("close", "Close")}
            </button>
          </div>

          <iframe
            src={iframeUrl}
            className="w-full h-full rounded-lg"
            allow={topperIframeAllow}
            allowFullScreen
            title={t("topper_widget_title_buy", { defaultValue: "Topper Widget" })}
          />
        </div>
      ) : step === "loading" ? (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-xcannes-green mb-4" />
          <p className="text-white/80">
            {t("topper_loading_widget", { defaultValue: "Loading Topper widget..." })}
          </p>
        </div>
      ) : step === "error" ? (
        <div className="flex flex-col items-center justify-center py-10">
          <XCircleIcon className="w-14 h-14 text-red-400 mb-4" />
          <h4 className="text-lg font-bold text-white mb-2">
            {t("topper_error_title", { defaultValue: "Something went wrong" })}
          </h4>
          <p className="text-white/60 text-center mb-5 max-w-md">{error}</p>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleBack}
              className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15 transition-colors"
            >
              {t("back", "Back")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className={`${greenActionBtnBase} px-4 py-2`}
              disabled={!canContinue || loading}
            >
              {t("retry", { defaultValue: "Try again" })}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0">
          <div className="text-sm text-white/70 mb-4">
            {t("topper_buy_subtitle", {
              defaultValue: "Achetez des cryptos par carte avec Topper (Uphold).",
            })}
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs text-white/60 mb-1">
                {t("topper_fiat_currency", { defaultValue: "Fiat" })}
              </label>
              <input
                value={fiatCurrency}
                onChange={(e) => setFiatCurrency(String(e.target.value || "").toUpperCase())}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-white/20"
                placeholder="EUR"
                inputMode="text"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">
                {t("topper_amount_fiat", { defaultValue: "Montant (fiat)" })}
              </label>
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-white/20"
                placeholder="100"
                inputMode="decimal"
                autoComplete="off"
              />
            </div>

            <div>
              <label className="block text-xs text-white/60 mb-1">
                {t("topper_crypto_asset", { defaultValue: "Crypto" })}
              </label>
              <select
                value={cryptoCurrency}
                onChange={(e) => setCryptoCurrency(String(e.target.value || "").toUpperCase())}
                className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white outline-none focus:border-white/20"
              >
                <option value="XRP">XRP</option>
                <option value="RLUSD">RLUSD</option>
              </select>
            </div>

            {noticeVariant === "demo" ? (
              <div className="text-xs text-white/60">
                {t("topper_demo_notice", {
                  defaultValue: "Mode démo : la transaction est simulée.",
                })}
              </div>
            ) : null}

            <button
              type="button"
              onClick={handleSubmit}
              className={`${greenActionBtnBase} w-full px-4 py-3`}
              disabled={!canContinue || loading}
            >
              {loading
                ? t("loading", "Loading...")
                : demoMode
                  ? t("topper_action_simulate_buy", { defaultValue: "Simuler l'achat" })
                  : t("topper_action_continue_buy", { defaultValue: "Continuer" })}
            </button>

            {error ? <div className="text-xs text-red-300">{error}</div> : null}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopperBuyModal;

