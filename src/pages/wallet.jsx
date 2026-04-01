import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import WalletDashboard from "@/components/wallet/WalletDashboard";
import WalletConnectScreen from "@/components/wallet/WalletConnectScreen";
import SEOHead from "@/components/layout/SEOHead";
import { useWallet } from "@/context/WalletContext";

const MOONPAY_SELL_FLOW_KEY = "xcannes_moonpay_sell_flow_v1";
const MOONPAY_SELL_RESUME_KEY = "xcannes_moonpay_resume_sell_v1";
const MOONPAY_SELL_SOURCE_KEY = "xcannes_moonpay_sell_source_v1";
const MOONPAY_BUY_FLOW_KEY = "xcannes_moonpay_buy_flow_v1";
const MOONPAY_WALLET_ADDRESS_KEY = "xcannes_moonpay_wallet_address_v1";
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const NATIVE_WALLET_STORAGE_KEY = "xcannes_native_wallet";
const MOONPAY_RESTORE_ATTEMPT_KEY = "xcannes_moonpay_native_restore_attempted_v1";

function isValidXrplAddress(value) {
  const v = String(value || "").trim();
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(v);
}

function isTrustedMoonpayReferrer(referrer) {
  try {
    const url = new URL(referrer);
    if (url.protocol !== "https:") return false;
    const host = String(url.hostname || "").toLowerCase();
    return host === "moonpay.com" || host.endsWith(".moonpay.com");
  } catch {
    return false;
  }
}

function readMoonpaySellSourceState(flowId) {
  if (typeof window === "undefined") return null;
  const expectedFlowId = String(flowId || "").trim();

  const normalizeCandidate = (parsed, { allowResumeFallback = false } = {}) => {
    if (!parsed || parsed.v !== 1) return null;
    const ageMs = Date.now() - Number(parsed?.ts || 0);
    if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > MOONPAY_FLOW_MAX_AGE_MS) {
      return null;
    }

    const parsedFlowId = String(parsed?.flowId || "").trim();
    if (expectedFlowId) {
      if (!parsedFlowId || parsedFlowId !== expectedFlowId) return null;
    }

    const sourceCurrencyCode = String(
      parsed?.sourceCurrencyCode ||
        (allowResumeFallback ? parsed?.currency : "") ||
        "",
    )
      .trim()
      .toUpperCase();
    const sourceAmount = Number.parseFloat(
      parsed?.sourceAmount ?? (allowResumeFallback ? parsed?.amount : ""),
    );

    if (!sourceCurrencyCode || !Number.isFinite(sourceAmount) || sourceAmount <= 0) {
      return null;
    }

    return {
      flowId: parsedFlowId || null,
      sourceCurrencyCode,
      sourceAmount,
      baseCurrencyCode: String(parsed?.baseCurrencyCode || "").trim().toUpperCase() || null,
      baseCurrencyAmount: Number.isFinite(Number(parsed?.baseCurrencyAmount))
        ? Number(parsed.baseCurrencyAmount)
        : null,
    };
  };

  try {
    const raw = window.localStorage?.getItem(MOONPAY_SELL_SOURCE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const match = normalizeCandidate(parsed);
    if (match) return match;
  } catch {
    // ignore
  }

  try {
    const raw = window.sessionStorage?.getItem(MOONPAY_SELL_RESUME_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    const match = normalizeCandidate(parsed, { allowResumeFallback: true });
    if (match) return match;
  } catch {
    // ignore
  }

  return null;
}

/** Detect PWA embedded mode (?embedded=pwa) */
function useIsEmbedded() {
  const [embedded, setEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    setEmbedded(params.get("embedded") === "pwa" || !!window.__XCANNES_PWA_EMBEDDED__);
  }, []);
  return embedded;
}

export default function Wallet() {
  const { t } = useTranslation("common");
  const { isConnected, isSessionReady, disconnect } = useWallet();
  const isEmbedded = useIsEmbedded();
  const [moonpaySellRequest, setMoonpaySellRequest] = useState(null);
  const [moonpayIframeReturn, setMoonpayIframeReturn] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const inIframe = window.self !== window.top;

      const params = new URLSearchParams(window.location.search);

      const getFirst = (keys) => {
        for (const key of keys) {
          const value = params.get(key);
          if (value != null && String(value).trim() !== "") return value;
        }
        return "";
      };

      const moonpayKind = String(params.get("moonpay") || "").trim().toLowerCase();
      const flowId = String(params.get("flowId") || "").trim();
      const referrer = document.referrer || "";
      const referrerOk = isTrustedMoonpayReferrer(referrer);
      let flowOk = referrerOk;
      if (!flowOk && flowId) {
        try {
          const key =
            moonpayKind === "buy"
              ? MOONPAY_BUY_FLOW_KEY
              : moonpayKind === "sell"
                ? MOONPAY_SELL_FLOW_KEY
                : null;
          const stored = key ? window.sessionStorage?.getItem(key) : null;
          const parsed = stored ? JSON.parse(stored) : null;
          const ageMs = Date.now() - Number(parsed?.ts || 0);
          if (
            parsed?.v === 1 &&
            typeof parsed?.id === "string" &&
            parsed.id === flowId &&
            Number.isFinite(ageMs) &&
            ageMs >= 0 &&
            ageMs <= MOONPAY_FLOW_MAX_AGE_MS
          ) {
            flowOk = true;
          }
        } catch {
          // ignore
        }
      }
      if (!flowOk) return;

      // If MoonPay opened this in a new browsing context (or iOS partitions storage),
      // restore the active wallet address so we can show the XRPL signing UI instead
      // of the onboarding "enter wallet" screen.
      try {
        const attempted = window.sessionStorage?.getItem(MOONPAY_RESTORE_ATTEMPT_KEY) === "1";
        const hasNative = Boolean(window.sessionStorage?.getItem(NATIVE_WALLET_STORAGE_KEY));
        if (!attempted && !hasNative) {
          const raw = window.localStorage?.getItem(MOONPAY_WALLET_ADDRESS_KEY);
          const parsed = raw ? JSON.parse(raw) : null;
          const ageMs = Date.now() - Number(parsed?.ts || 0);
          const addr = String(parsed?.address || "").trim();
          if (
            parsed?.v === 1 &&
            Number.isFinite(ageMs) &&
            ageMs >= 0 &&
            ageMs <= 2 * 60 * 60 * 1000 &&
            isValidXrplAddress(addr)
          ) {
            window.sessionStorage?.setItem(MOONPAY_RESTORE_ATTEMPT_KEY, "1");
            window.sessionStorage?.setItem(NATIVE_WALLET_STORAGE_KEY, addr);
            window.location.replace(window.location.href);
            return;
          }
          window.sessionStorage?.setItem(MOONPAY_RESTORE_ATTEMPT_KEY, "1");
        }
      } catch {
        // ignore
      }

      const depositWalletAddress = getFirst([
        "depositWalletAddress",
        "depositAddress",
        "deposit_address",
      ]);
      const baseCurrencyCode = getFirst(["baseCurrencyCode", "currencyCode"]);
      const baseCurrencyAmount = getFirst(["baseCurrencyAmount", "amount"]);

      // If MoonPay redirected us back into an iframe (success/return) without a deposit request,
      // don't render the whole wallet inside the widget: offer a safe "back to MoonPay" action.
      if (!depositWalletAddress || !baseCurrencyCode || !baseCurrencyAmount) {
        if ((moonpayKind === "sell" || moonpayKind === "buy") && inIframe) {
          setMoonpayIframeReturn({
            kind: moonpayKind || "moonpay",
            returnUrl: referrerOk ? referrer : "",
          });
        }
        return;
      }

      const normalizedCurrency = String(baseCurrencyCode || "").trim().toUpperCase();
      if (moonpayKind !== "sell") return;
      if (normalizedCurrency !== "XRP" && normalizedCurrency !== "RLUSD") return;

      const transactionId = getFirst(["transactionId", "externalTransactionId"]);
      const sellSourceState = readMoonpaySellSourceState(flowId);
      setMoonpaySellRequest({
        depositWalletAddress,
        baseCurrencyCode: normalizedCurrency,
        baseCurrencyAmount: String(baseCurrencyAmount).trim(),
        transactionId: String(transactionId || "").trim() || null,
        returnUrl: referrerOk ? referrer : "",
        flowId: flowId || null,
        sourceCurrencyCode: sellSourceState?.sourceCurrencyCode || null,
        sourceAmount:
          sellSourceState?.sourceAmount != null
            ? String(sellSourceState.sourceAmount)
            : null,
      });
    } catch {
      // ignore
    }
  }, []);

  const readMoonpayActive = () => {
    if (typeof window === "undefined") return false;
    try {
      if (window.__XCANNES_MOONPAY_ACTIVE__) return true;
      return window.sessionStorage?.getItem("xcannes_moonpay_active") === "1";
    } catch {
      return false;
    }
  };

  const readTopperActive = () => {
    if (typeof window === "undefined") return false;
    try {
      if (window.__XCANNES_TOPPER_ACTIVE__) return true;
      return window.sessionStorage?.getItem("xcannes_topper_active") === "1";
    } catch {
      return false;
    }
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.classList.add("wallet-page");
    if (isEmbedded) document.body.classList.add("wallet-embedded");
    return () => {
      document.body.classList.remove("wallet-page");
      document.body.classList.remove("wallet-embedded");
    };
  }, [isEmbedded]);

  // ── Auto-lock: disconnect wallet when leaving this page ────
  // 1) Navigation away (cleanup runs when component unmounts)
  // 2) Tab switch / minimize (visibilitychange → hidden)
  // Embedded PWA mode is excluded — the PWA handles its own lock.
  const disconnectRef = useRef(disconnect);
  disconnectRef.current = disconnect;
  const isConnectedRef = useRef(isConnected);
  isConnectedRef.current = isConnected;
  const moonpayActiveRef = useRef(false);
  moonpayActiveRef.current = readMoonpayActive();
  const topperActiveRef = useRef(false);
  topperActiveRef.current = readTopperActive();
  const moonpayHiddenTimerRef = useRef(null);

  useEffect(() => {
    if (isEmbedded) return;

    // When the user switches tabs or minimizes the browser, disconnect
    const handleVisibility = () => {
      const hidden = document.visibilityState === "hidden";

      // Clear any pending MoonPay grace timer when coming back.
      if (!hidden && moonpayHiddenTimerRef.current) {
        window.clearTimeout(moonpayHiddenTimerRef.current);
        moonpayHiddenTimerRef.current = null;
        return;
      }

      if (!hidden || !isConnectedRef.current) return;

      // Ramp flows can temporarily background the browser (Apple Pay / Apple ID / KYC).
      // Give a short grace period so users can return without losing the widget state.
      if (moonpayActiveRef.current || topperActiveRef.current) {
        if (moonpayHiddenTimerRef.current) return;
        moonpayHiddenTimerRef.current = window.setTimeout(() => {
          moonpayHiddenTimerRef.current = null;
          if (isConnectedRef.current) disconnectRef.current();
        }, 3 * 60 * 1000);
        return;
      }

      disconnectRef.current();
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (moonpayHiddenTimerRef.current) {
        window.clearTimeout(moonpayHiddenTimerRef.current);
        moonpayHiddenTimerRef.current = null;
      }
      // Component unmounting (navigating away) → disconnect
      if (isConnectedRef.current) {
        disconnectRef.current();
      }
    };
  }, [isEmbedded]);

  // ── Inactivity auto-lock: 5 min without interaction → disconnect ──
  useEffect(() => {
    if (isEmbedded) return;

    const INACTIVITY_MS = 5 * 60 * 1000; // 5 minutes
    let timer = null;

    const resetTimer = () => {
      if (timer) clearTimeout(timer);
      if (!isConnectedRef.current) return;
      if (moonpayActiveRef.current || topperActiveRef.current) return;
      timer = setTimeout(() => {
        if (isConnectedRef.current) {
          disconnectRef.current();
        }
      }, INACTIVITY_MS);
    };

    const events = ["click", "scroll", "keydown", "touchstart", "mousemove"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const syncRampActive = () => {
      const active = moonpayActiveRef.current || topperActiveRef.current;
      if (active) {
        if (timer) clearTimeout(timer);
        timer = null;
        return;
      }
      resetTimer();
    };

    const handleMoonpayActive = (event) => {
      moonpayActiveRef.current = Boolean(event?.detail?.active);
      syncRampActive();
    };
    const handleTopperActive = (event) => {
      topperActiveRef.current = Boolean(event?.detail?.active);
      syncRampActive();
    };
    window.addEventListener("xcannes:moonpay-active", handleMoonpayActive);
    window.addEventListener("xcannes:topper-active", handleTopperActive);

    // Start the timer immediately
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      window.removeEventListener("xcannes:moonpay-active", handleMoonpayActive);
      window.removeEventListener("xcannes:topper-active", handleTopperActive);
    };
  }, [isEmbedded, isConnected]);

  // In embedded mode, don't redirect — wait for PWA to provide wallet via postMessage
  // Non-embedded, non-connected: show WalletConnectScreen (no redirect)

  // SEO head (shared across all visible states, hidden in embedded mode)
  const seoHead = !isEmbedded ? (
    <SEOHead
      title={t("wallet_page_title", "Wallet - XCANNES")}
      description={t(
        "wallet_page_description",
        "Manage your XRPL wallet, trustlines, and assets on XCANNES"
      )}
    />
  ) : null;

  if (!isSessionReady) {
    // In embedded mode, show a loading state while waiting for PWA init
    if (isEmbedded) {
      return (
        <main className="min-h-[100svh] flex items-center justify-center bg-xcannes-surface-demo text-white">
          <div className="animate-pulse text-white/40 text-sm">Chargement du wallet…</div>
        </main>
      );
    }
    return null;
  }

  // Not connected: show wallet-app style connect screen with QR code
  if (!isConnected && !isEmbedded) {
    if (moonpaySellRequest) {
      return (
        <main className="min-h-[100svh] flex items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-6">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-lg font-semibold">
              {t("moonpay_deposit_connect_title", "Connexion requise")}
            </h1>
            <p className="text-sm text-white/70">
              {t(
                "moonpay_deposit_connect_body",
                "Pour finaliser votre vente MoonPay, connectez votre wallet puis revenez sur MoonPay.",
              )}
            </p>
            <WalletConnectScreen />
          </div>
        </main>
      );
    }
    return (
      <>
        {seoHead}
        <WalletConnectScreen />
      </>
    );
  }

  if (moonpayIframeReturn && !isEmbedded) {
    const handleBackToMoonpay = () => {
      const returnUrl = moonpayIframeReturn.returnUrl || "";
      try {
        if (moonpayIframeReturn.kind === "buy") {
          window.sessionStorage?.removeItem(MOONPAY_BUY_FLOW_KEY);
        } else if (moonpayIframeReturn.kind === "sell") {
          window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
        }
      } catch {
        // ignore
      }
      if (isTrustedMoonpayReferrer(returnUrl)) {
        window.location.href = returnUrl;
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
      }
    };

    return (
      <>
        {seoHead}
        <main className="min-h-[100svh] flex items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-6">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-lg font-semibold">
              {t("moonpay_return_title", "Retour vers MoonPay")}
            </h1>
            <p className="text-sm text-white/70">
              {t(
                "moonpay_return_desc",
                "Cette page a été ouverte depuis MoonPay. Utilisez le bouton ci‑dessous pour revenir au widget.",
              )}
            </p>
            <button
              type="button"
              onClick={handleBackToMoonpay}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 border bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30"
            >
              {t("moonpay_return_action", "Revenir sur MoonPay")}
            </button>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      {/* Hide SEO head and nav in embedded mode */}
      {!isEmbedded && (
        <>
          {seoHead}

          <div className="hidden md:flex fixed top-5 left-6 z-40">
            <Link href="/" className="header-nav-link header-nav-link-compact text-white/70 group relative">
              <span aria-hidden="true" className="header-nav-arrow wallet-edge-arrow">‹</span>
              <span className="pointer-events-none absolute left-0 top-full mt-2 whitespace-nowrap rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-xs text-white/80 opacity-0 translate-y-1 transition-all duration-150 group-hover:opacity-100 group-hover:translate-y-0">
                {t("nav_home", "Page d'accueil")}
              </span>
            </Link>
          </div>
        </>
      )}

      <main className={`h-[100svh] overflow-hidden md:min-h-screen md:h-screen bg-xcannes-surface-demo text-white font-montserrat${isEmbedded ? " pwa-embedded-main" : ""}`}>
        <div className={`w-full ${isEmbedded ? "" : "md:max-w-5xl lg:max-w-[1600px]"} h-full mx-0 md:mx-auto px-0 md:px-6 py-0 md:py-6`}>
          <div className={`bg-xcannes-surface-demo h-full overflow-hidden ${isEmbedded ? "" : "border-0 rounded-none md:border md:border-white/10 md:rounded-xl lg:shadow-[0_0_28px_rgba(0,0,0,0.35)]"}`}>
            <WalletDashboard
              showDesktopStatement={!isEmbedded}
              qrSizingVariant="dex"
              showMobileHomeLink={!isEmbedded}
              allowBackgroundScrollOnMobile
              initialMoonpaySellRequest={moonpaySellRequest}
            />
          </div>
        </div>
      </main>
    </>
  );
}

export async function getServerSideProps({ locale }) {
  return {
    props: {
      ...(await getPageTranslations(locale, ["common"])),
    },
  };
}
