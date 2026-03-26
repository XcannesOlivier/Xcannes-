import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";
import WalletDashboard from "@/components/wallet/WalletDashboard";
import WalletConnectScreen from "@/components/wallet/WalletConnectScreen";
import SEOHead from "@/components/layout/SEOHead";
import { useWallet } from "@/context/WalletContext";
import { buildMoonpayMemo, buildXrplJsonMemo } from "@/utils/xrplMemo";
import { apiUrl } from "@/lib/runtimeConfig";

const MOONPAY_SELL_FLOW_KEY = "xcannes_moonpay_sell_flow_v1";
const MOONPAY_BUY_FLOW_KEY = "xcannes_moonpay_buy_flow_v1";
const MOONPAY_FLOW_MAX_AGE_MS = 8 * 60 * 60 * 1000;
const NATIVE_WALLET_STORAGE_KEY = "xcannes_native_wallet";
const MOONPAY_IFRAME_DEPOSIT_KEY = "xcannes_moonpay_iframe_deposit_v1";
const MOONPAY_IFRAME_CONNECT_KEY = "xcannes_moonpay_iframe_connect_v1";
const MOONPAY_IFRAME_SIGN_KEY = "xcannes_moonpay_iframe_sign_v1";

function safeSessionGet(key) {
  try {
    return window.sessionStorage?.getItem(key) || "";
  } catch {
    return "";
  }
}

function safeSessionSet(key, value) {
  try {
    window.sessionStorage?.setItem(key, value);
  } catch {
    // ignore
  }
}

function safeSessionRemove(key) {
  try {
    window.sessionStorage?.removeItem(key);
  } catch {
    // ignore
  }
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

function xrpToDropsString(xrpAmountRaw) {
  const raw = String(xrpAmountRaw ?? "").trim();
  if (!raw) return null;
  const m = raw.match(/^(\d+)(?:\.(\d{0,6}))?$/);
  if (!m) return null;
  const whole = m[1] || "0";
  const frac = (m[2] || "").padEnd(6, "0");
  try {
    const drops = BigInt(whole) * 1000000n + BigInt(frac || "0");
    return drops > 0n ? drops.toString() : null;
  } catch {
    return null;
  }
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

function isInIframe() {
  if (typeof window === "undefined") return false;
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

async function pollRelayStatus(challengeId, { timeoutMs = 90_000 } = {}) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const res = await fetch(apiUrl(`/wallet-relay/status/${encodeURIComponent(challengeId)}`), {
        method: "GET",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        const status = String(data?.status || "");
        if (status && status !== "pending" && status !== "submitting") {
          return data;
        }
      }
    } catch {
      // ignore transient errors
    }
    // eslint-disable-next-line no-await-in-loop
    await new Promise((r) => setTimeout(r, 1000));
  }
  return { status: "timeout" };
}

function MoonpayIframeDepositFlow({ deposit, t }) {
  const [state, setState] = useState({ step: "init", error: "" });
  const depositRef = useRef(deposit);
  depositRef.current = deposit;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInIframe()) return;
    if (!deposit) return;
    try {
      safeSessionSet(
        MOONPAY_IFRAME_DEPOSIT_KEY,
        JSON.stringify({ v: 1, ts: Date.now(), deposit }),
      );
    } catch {
      // ignore
    }
  }, [deposit]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInIframe()) return;
    if (!deposit) return;

    let cancelled = false;

    const setStep = (step, error = "") => {
      if (cancelled) return;
      setState({ step, error });
    };

    const startConnect = async () => {
      setStep("connect");
      const res = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "connect",
          origin: window.location.origin,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to create connect challenge");
      safeSessionSet(
        MOONPAY_IFRAME_CONNECT_KEY,
        JSON.stringify({ v: 1, ts: Date.now(), id: data.challengeId }),
      );
      window.location.href = `/wallet-app/?connect=${encodeURIComponent(data.challengeId)}`;
    };

    const startSign = async (address) => {
      setStep("sign");

      const d = depositRef.current;
      const currency = String(d?.baseCurrencyCode || "").toUpperCase();
      const amountStr = String(d?.baseCurrencyAmount || "").trim();
      const destination = String(d?.depositWalletAddress || "").trim();
      const destinationTag = d?.depositWalletAddressTag != null ? d.depositWalletAddressTag : null;

      const issuer =
        currency === "RLUSD"
          ? (process.env.NEXT_PUBLIC_RLUSD_ISSUER || "").trim()
          : "";

      const txjson = {
        TransactionType: "Payment",
        Destination: destination,
      };
      if (destinationTag != null) txjson.DestinationTag = destinationTag;

      if (currency === "XRP") {
        const drops = xrpToDropsString(amountStr);
        if (!drops) throw new Error("Invalid XRP amount");
        txjson.Amount = drops;
      } else if (currency === "RLUSD") {
        if (!issuer) throw new Error("Missing RLUSD issuer");
        const num = Number(amountStr);
        if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid RLUSD amount");
        txjson.Amount = { currency: "RLUSD", issuer, value: amountStr };
      } else {
        throw new Error(`Unsupported currency: ${currency}`);
      }

      const memoPayload = buildMoonpayMemo({
        side: "sell",
        provider: "moonpay",
        currencyCode: currency,
        amount: Number.isFinite(Number(amountStr)) ? Number(amountStr) : null,
        amountRlusd: currency === "RLUSD" ? Number(amountStr) : null,
      });
      const memos = memoPayload ? buildXrplJsonMemo(memoPayload) : null;
      if (memos) txjson.Memos = memos;

      // Autofill (Fee, Sequence, LastLedgerSequence) using the connected address.
      const afRes = await fetch(apiUrl("/wallet-relay/autofill"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txjson, address }),
      });
      const afData = afRes.ok ? await afRes.json() : null;
      if (!afRes.ok || !afData?.txjson) {
        throw new Error(afData?.error || "Autofill failed");
      }

      const challengeRes = await fetch(apiUrl("/wallet-relay/challenge"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sign",
          origin: window.location.origin,
          action: "MoonPay • Confirmer la vente",
          txjson: afData.txjson,
          returnAddress: address,
        }),
      });
      const challengeData = await challengeRes.json();
      if (!challengeRes.ok) {
        throw new Error(challengeData?.error || "Failed to create sign challenge");
      }

      safeSessionSet(
        MOONPAY_IFRAME_SIGN_KEY,
        JSON.stringify({ v: 1, ts: Date.now(), id: challengeData.challengeId }),
      );
      window.location.href = `/wallet-app/?sign=${encodeURIComponent(challengeData.challengeId)}`;
    };

    const redirectBackToMoonpay = () => {
      const returnUrl = String(depositRef.current?.returnUrl || "");
      safeSessionRemove(MOONPAY_IFRAME_DEPOSIT_KEY);
      safeSessionRemove(MOONPAY_IFRAME_CONNECT_KEY);
      safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
      safeSessionRemove(MOONPAY_SELL_FLOW_KEY);
      safeSessionRemove(MOONPAY_BUY_FLOW_KEY);

      if (isTrustedMoonpayReferrer(returnUrl)) {
        window.location.href = returnUrl;
        return;
      }
      if (window.history.length > 1) {
        window.history.back();
      }
    };

    (async () => {
      try {
        // 1) If returning from wallet-app after connect/sign, resolve pending steps.
        const pendingConnectRaw = safeSessionGet(MOONPAY_IFRAME_CONNECT_KEY);
        if (pendingConnectRaw) {
          setStep("waiting_connect");
          const pendingConnect = JSON.parse(pendingConnectRaw);
          const id = String(pendingConnect?.id || "");
          if (!id) throw new Error("Invalid connect state");
          const status = await pollRelayStatus(id, { timeoutMs: 90_000 });
          const finalStatus = String(status?.status || "");
          if (finalStatus === "signed" && status?.result?.address) {
            safeSessionSet(NATIVE_WALLET_STORAGE_KEY, String(status.result.address));
            if (status.result.publicKey) {
              safeSessionSet(
                `${NATIVE_WALLET_STORAGE_KEY}_publicKey`,
                String(status.result.publicKey),
              );
            }
            safeSessionRemove(MOONPAY_IFRAME_CONNECT_KEY);
          } else if (finalStatus === "expired") {
            safeSessionRemove(MOONPAY_IFRAME_CONNECT_KEY);
            throw new Error("Connexion expirée");
          } else if (finalStatus === "timeout") {
            throw new Error("Connexion en attente…");
          } else {
            safeSessionRemove(MOONPAY_IFRAME_CONNECT_KEY);
            throw new Error("Connexion refusée");
          }
        }

        const pendingSignRaw = safeSessionGet(MOONPAY_IFRAME_SIGN_KEY);
        if (pendingSignRaw) {
          setStep("waiting_sign");
          const pendingSign = JSON.parse(pendingSignRaw);
          const id = String(pendingSign?.id || "");
          if (!id) throw new Error("Invalid sign state");
          const status = await pollRelayStatus(id, { timeoutMs: 120_000 });
          const finalStatus = String(status?.status || "");
          if (finalStatus === "submitted") {
            safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
            redirectBackToMoonpay();
            return;
          }
          if (finalStatus === "rejected") {
            safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
            throw new Error(status?.result?.engineMessage || "Transaction rejetée");
          }
          if (finalStatus === "expired") {
            safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
            throw new Error("Signature expirée");
          }
          if (finalStatus === "timeout") {
            throw new Error("Signature en attente…");
          }
          safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
          throw new Error("Signature annulée");
        }

        // 2) No pending relay step: connect or sign.
        const addr = safeSessionGet(NATIVE_WALLET_STORAGE_KEY);
        if (!addr) {
          await startConnect();
          return;
        }
        await startSign(addr);
      } catch (err) {
        setStep("error", err?.message || String(err));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [deposit]);

  const title =
    state.step === "waiting_sign" || state.step === "sign"
      ? t("moonpay_iframe_sign_title", "Validation de la transaction")
      : t("moonpay_iframe_connect_title", "Connexion du wallet");

  const desc = (() => {
    if (state.step === "connect") {
      return t(
        "moonpay_iframe_connect_desc",
        "Ouverture de XCANNES Wallet pour confirmer votre identité…",
      );
    }
    if (state.step === "waiting_connect") {
      return t(
        "moonpay_iframe_wait_connect_desc",
        "En attente de confirmation dans XCANNES Wallet…",
      );
    }
    if (state.step === "sign") {
      return t(
        "moonpay_iframe_sign_desc",
        "Préparation de la transaction et ouverture de XCANNES Wallet…",
      );
    }
    if (state.step === "waiting_sign") {
      return t(
        "moonpay_iframe_wait_sign_desc",
        "En attente de signature dans XCANNES Wallet…",
      );
    }
    if (state.step === "error") {
      return state.error || t("moonpay_iframe_error", "Une erreur est survenue.");
    }
    return t(
      "moonpay_iframe_init_desc",
      "Préparation de la confirmation…",
    );
  })();

  const handleRetry = () => {
    safeSessionRemove(MOONPAY_IFRAME_CONNECT_KEY);
    safeSessionRemove(MOONPAY_IFRAME_SIGN_KEY);
    setState({ step: "init", error: "" });
    window.location.reload();
  };

  return (
    <main className="min-h-[100svh] flex items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-6">
      <div className="max-w-md w-full space-y-4">
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="text-sm text-white/70">{desc}</p>
        {state.step === "error" ? (
          <button
            type="button"
            onClick={handleRetry}
            className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 border bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30"
          >
            {t("retry", "Réessayer")}
          </button>
        ) : (
          <div className="text-white/40 text-sm animate-pulse">
            {t("loading", "Chargement…")}
          </div>
        )}
      </div>
    </main>
  );
}

export default function Wallet() {
  const { t } = useTranslation("common");
  const { isConnected, isSessionReady, disconnect, signTransaction } = useWallet();
  const isEmbedded = useIsEmbedded();
  const [moonpayDeposit, setMoonpayDeposit] = useState(null);
  const [depositStatus, setDepositStatus] = useState({ state: "idle", error: "" });
  const [moonpayIframeReturn, setMoonpayIframeReturn] = useState(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (window.self === window.top) return;

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
        if (moonpayKind === "sell" || moonpayKind === "buy") {
          setMoonpayIframeReturn({
            kind: moonpayKind || "moonpay",
            returnUrl: referrerOk ? referrer : "",
          });
        }
        return;
      }

      const depositWalletAddressTagRaw = getFirst([
        "depositWalletAddressTag",
        "depositWalletTag",
        "walletAddressTag",
        "destinationTag",
      ]);
      const depositWalletAddressTag = depositWalletAddressTagRaw
        ? Number.parseInt(depositWalletAddressTagRaw, 10)
        : null;
      const transactionId = getFirst(["transactionId", "externalTransactionId"]);
      setMoonpayDeposit({
        depositWalletAddress,
        depositWalletAddressTag:
          Number.isFinite(depositWalletAddressTag) ? depositWalletAddressTag : null,
        baseCurrencyCode: String(baseCurrencyCode).trim().toUpperCase(),
        baseCurrencyAmount: String(baseCurrencyAmount).trim(),
        transactionId: String(transactionId || "").trim() || null,
        returnUrl: referrerOk ? referrer : "",
        flowId: flowId || null,
      });
      try {
        safeSessionSet(
          MOONPAY_IFRAME_DEPOSIT_KEY,
          JSON.stringify({
            v: 1,
            ts: Date.now(),
            deposit: {
              depositWalletAddress,
              depositWalletAddressTag:
                Number.isFinite(depositWalletAddressTag) ? depositWalletAddressTag : null,
              baseCurrencyCode: String(baseCurrencyCode).trim().toUpperCase(),
              baseCurrencyAmount: String(baseCurrencyAmount).trim(),
              transactionId: String(transactionId || "").trim() || null,
              returnUrl: referrerOk ? referrer : "",
              flowId: flowId || null,
            },
          }),
        );
      } catch {
        // ignore
      }
    } catch {
      // ignore
    }
  }, []);

  // Restore pending MoonPay deposit after /wallet-app/?sign=... redirects back to /wallet
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isInIframe()) return;
    if (moonpayDeposit) return;
    try {
      const raw = safeSessionGet(MOONPAY_IFRAME_DEPOSIT_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!parsed || parsed.v !== 1 || !parsed.deposit) return;
      const ageMs = Date.now() - Number(parsed.ts || 0);
      if (!Number.isFinite(ageMs) || ageMs < 0 || ageMs > 15 * 60 * 1000) {
        safeSessionRemove(MOONPAY_IFRAME_DEPOSIT_KEY);
        return;
      }
      setMoonpayDeposit(parsed.deposit);
    } catch {
      // ignore
    }
  }, [moonpayDeposit]);

  const readMoonpayActive = () => {
    if (typeof window === "undefined") return false;
    try {
      if (window.__XCANNES_MOONPAY_ACTIVE__) return true;
      return window.sessionStorage?.getItem("xcannes_moonpay_active") === "1";
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

      // MoonPay flows can temporarily background the browser (Apple Pay / Apple ID / KYC).
      // Give a short grace period so users can return without losing the widget state.
      if (moonpayActiveRef.current) {
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
      if (moonpayActiveRef.current) return;
      timer = setTimeout(() => {
        if (isConnectedRef.current) {
          disconnectRef.current();
        }
      }, INACTIVITY_MS);
    };

    const events = ["click", "scroll", "keydown", "touchstart", "mousemove"];
    events.forEach((ev) => window.addEventListener(ev, resetTimer, { passive: true }));

    const handleMoonpayActive = (event) => {
      const nextActive = Boolean(event?.detail?.active);
      moonpayActiveRef.current = nextActive;
      if (nextActive) {
        if (timer) clearTimeout(timer);
        timer = null;
        return;
      }
      resetTimer();
    };
    window.addEventListener("xcannes:moonpay-active", handleMoonpayActive);

    // Start the timer immediately
    resetTimer();

    return () => {
      if (timer) clearTimeout(timer);
      events.forEach((ev) => window.removeEventListener(ev, resetTimer));
      window.removeEventListener("xcannes:moonpay-active", handleMoonpayActive);
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

  // When MoonPay opens /wallet inside its own iframe (iOS Safari / ITP),
  // storage may be partitioned, so the regular connect screen (wallet-app onboarding)
  // would "duplicate" the app. Use the relay + wallet-app sign flow instead.
  if (moonpayDeposit && !isEmbedded && isInIframe()) {
    return (
      <>
        {seoHead}
        <MoonpayIframeDepositFlow deposit={moonpayDeposit} t={t} />
      </>
    );
  }

  // Not connected: show wallet-app style connect screen with QR code
  if (!isConnected && !isEmbedded) {
    if (moonpayDeposit) {
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

  if (moonpayDeposit && !isEmbedded) {
    const { depositWalletAddress, depositWalletAddressTag, baseCurrencyCode, baseCurrencyAmount } =
      moonpayDeposit;
    const canSend = Boolean(signTransaction);
    const isBusy = depositStatus.state === "sending";

    const handleDepositSend = async () => {
      if (!canSend) return;
      if (!moonpayDeposit) return;
      if (isBusy) return;

      setDepositStatus({ state: "sending", error: "" });
      try {
        const currency = String(baseCurrencyCode || "").toUpperCase();
        const issuer =
          currency === "RLUSD"
            ? (process.env.NEXT_PUBLIC_RLUSD_ISSUER || "").trim()
            : "";
        const amountStr = String(baseCurrencyAmount || "").trim();

        const txjson = {
          TransactionType: "Payment",
          Destination: depositWalletAddress,
        };
        if (depositWalletAddressTag != null) {
          txjson.DestinationTag = depositWalletAddressTag;
        }

        if (currency === "XRP") {
          const drops = xrpToDropsString(amountStr);
          if (!drops) throw new Error("Invalid XRP amount");
          txjson.Amount = drops;
        } else if (currency === "RLUSD") {
          if (!issuer) throw new Error("Missing RLUSD issuer");
          const num = Number(amountStr);
          if (!Number.isFinite(num) || num <= 0) throw new Error("Invalid RLUSD amount");
          txjson.Amount = { currency: "RLUSD", issuer, value: amountStr };
        } else {
          throw new Error(`Unsupported currency: ${currency}`);
        }

        const memoPayload = buildMoonpayMemo({
          side: "sell",
          provider: "moonpay",
          currencyCode: currency,
          amount: Number.isFinite(Number(amountStr)) ? Number(amountStr) : null,
          amountRlusd: currency === "RLUSD" ? Number(amountStr) : null,
        });
        const memos = memoPayload ? buildXrplJsonMemo(memoPayload) : null;
        if (memos) txjson.Memos = memos;

        const result = await signTransaction(txjson, {
          action: "moonpay:deposit",
          progressDetails: {
            amountLabel: `${amountStr} ${currency}`,
            beneficiaryAddress: depositWalletAddress,
            beneficiaryLabel: "MoonPay",
          },
        });

        if (!result?.signed) {
          throw new Error("Signature cancelled");
        }

        setDepositStatus({ state: "sent", error: "" });

        // Return back to the widget (safe-guarded)
        const returnUrl = moonpayDeposit.returnUrl || "";
        try {
          window.sessionStorage?.removeItem(MOONPAY_SELL_FLOW_KEY);
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
      } catch (err) {
        setDepositStatus({
          state: "error",
          error: err?.message || String(err),
        });
      }
    };

    return (
      <>
        {seoHead}
        <main className="min-h-[100svh] flex items-center justify-center bg-xcannes-surface-demo text-white font-montserrat px-6">
          <div className="max-w-md w-full space-y-4">
            <h1 className="text-lg font-semibold">
              {t("moonpay_deposit_title", "Finaliser la vente MoonPay")}
            </h1>
            <p className="text-sm text-white/70">
              {t(
                "moonpay_deposit_desc",
                "Confirmez l’envoi demandé par MoonPay. Après signature, vous serez renvoyé automatiquement au widget.",
              )}
            </p>
            <div className="rounded-xl border border-white/10 bg-black/30 p-4 text-sm text-white/80 space-y-2">
              <div>
                <span className="text-white/60">{t("asset", "Actif")}:</span>{" "}
                <span className="font-semibold">{baseCurrencyCode}</span>
              </div>
              <div>
                <span className="text-white/60">{t("amount", "Montant")}:</span>{" "}
                <span className="font-semibold">{baseCurrencyAmount}</span>
              </div>
              <div className="break-all">
                <span className="text-white/60">{t("destination", "Destination")}:</span>{" "}
                <span className="font-mono text-xs">{depositWalletAddress}</span>
              </div>
              {depositWalletAddressTag != null ? (
                <div>
                  <span className="text-white/60">{t("tag", "Tag")}:</span>{" "}
                  <span className="font-semibold">{depositWalletAddressTag}</span>
                </div>
              ) : null}
            </div>

            {depositStatus.state === "error" ? (
              <div className="text-sm text-red-300">{depositStatus.error}</div>
            ) : null}

            <button
              type="button"
              onClick={handleDepositSend}
              disabled={isBusy || !canSend}
              className="w-full py-3 rounded-lg font-semibold text-sm transition-all duration-200 border bg-xcannes-green/20 text-xcannes-green border-xcannes-green/40 hover:bg-xcannes-green/30 disabled:opacity-60"
            >
              {isBusy
                ? t("moonpay_deposit_sending", "Signature en cours…")
                : t("moonpay_deposit_confirm", "Signer & envoyer")}
            </button>
          </div>
        </main>
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
