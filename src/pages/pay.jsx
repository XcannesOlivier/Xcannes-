"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Buffer } from "buffer";
import SEOHead from "@/components/layout/SEOHead";
import { buildRlusdPaymentTxjson } from "@/utils/walletSpread";
import { buildXrplJsonMemo } from "@/utils/xrplMemo";
import { apiUrl } from "@/lib/runtimeConfig";

function decodePayReq(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((raw.length + 3) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    const parsed = JSON.parse(json);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

export default function PayRequestPage() {
  const router = useRouter();
  const reqParam = router?.query?.req;

  const [error, setError] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | connect_qr | connect_poll | pay_qr | pay_poll | success | expired
  const [payerAddress, setPayerAddress] = useState("");
  const [activePayload, setActivePayload] = useState(null); // { uuid, qrUrl, deepLink, kind }
  const pollTimerRef = useRef(null);

  const request = useMemo(() => {
    if (Array.isArray(reqParam)) return decodePayReq(reqParam[0]);
    return decodePayReq(reqParam);
  }, [reqParam]);

  const normalizedRequest = useMemo(() => {
    if (!request) return null;
    const to = String(request.to || "").trim();
    const targetCurrency = String(
      request.targetCurrency || request.targetCurrencyCode || request.displayCurrency || ""
    )
      .trim()
      .toUpperCase();
    const displayAmount = Number(request.displayAmount ?? request.amount ?? 0);
    const fxRate = request.fxRate != null ? Number(request.fxRate) : null;
    const fxSource = request.fxSource != null ? String(request.fxSource) : null;
    const memo = request.memo != null ? String(request.memo) : "";

    let amountRlusd = request.amountRlusd != null ? Number(request.amountRlusd) : null;
    if (!Number.isFinite(amountRlusd) || amountRlusd <= 0) {
      if (targetCurrency === "RLUSD" && Number.isFinite(displayAmount) && displayAmount > 0) {
        amountRlusd = displayAmount;
      } else if (Number.isFinite(displayAmount) && displayAmount > 0 && Number.isFinite(fxRate) && fxRate > 0) {
        amountRlusd = displayAmount * fxRate;
      } else {
        amountRlusd = null;
      }
    }

    return {
      to,
      targetCurrency: targetCurrency || null,
      displayAmount: Number.isFinite(displayAmount) ? displayAmount : null,
      displayCurrency: targetCurrency || null,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate: Number.isFinite(fxRate) ? fxRate : null,
      fxSource,
      memo,
    };
  }, [request]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  const pollXumm = useCallback(
    ({ uuid, onSigned, onExpired }) => {
      stopPolling();
      pollTimerRef.current = window.setInterval(async () => {
        try {
          const res = await fetch(
            apiUrl(`/xumm/check?uuid=${encodeURIComponent(uuid)}`)
          );
          const data = await res.json().catch(() => ({}));
          if (!res.ok) return;
          if (data?.expired) {
            stopPolling();
            onExpired?.();
            return;
          }
          if (data?.signed) {
            stopPolling();
            onSigned?.(data);
          }
        } catch {
          // ignore transient errors
        }
      }, 1500);
    },
    [stopPolling]
  );

  const startConnect = useCallback(async () => {
    if (!normalizedRequest) return;
    setError(null);
    setPhase("connect_poll");
    setActivePayload(null);

    try {
      const res = await fetch(apiUrl("/xumm/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create Xumm connection");
      }

      const payload = {
        kind: "connect",
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
      };
      setActivePayload(payload);
      setPhase("connect_qr");

      pollXumm({
        uuid: data.uuid,
        onSigned: (check) => {
          const addr = String(check?.wallet || "").trim();
          if (addr) setPayerAddress(addr);
          setPhase("idle");
          setActivePayload(null);
        },
        onExpired: () => {
          setPhase("expired");
        },
      });
    } catch (e) {
      setPhase("idle");
      setError(e?.message || "Failed to create Xumm connection");
    }
  }, [normalizedRequest, pollXumm]);

  const startPay = useCallback(async () => {
    if (!normalizedRequest) return;
    setError(null);

    if (!payerAddress) {
      await startConnect();
      return;
    }

    if (!normalizedRequest.to || !normalizedRequest.to.startsWith("r")) {
      setError("Invalid destination address.");
      return;
    }
    if (
      !Number.isFinite(normalizedRequest.amountRlusd) ||
      normalizedRequest.amountRlusd <= 0
    ) {
      setError("Invalid amount.");
      return;
    }

    const txjson = buildRlusdPaymentTxjson({
      account: payerAddress,
      destination: normalizedRequest.to,
      amountRlusd: normalizedRequest.amountRlusd,
    });
    if (!txjson) {
      setError("Unable to build RLUSD payment.");
      return;
    }

    const memoPayload = {
      xcannes: "payreq",
      schema: "xcannes-payreq-v1",
      v: 1,
      targetCurrencyCode: normalizedRequest.targetCurrency || null,
      displayAmount: normalizedRequest.displayAmount,
      displayCurrencyCode: normalizedRequest.displayCurrency,
      amountRlusd: normalizedRequest.amountRlusd,
      fxRate: normalizedRequest.fxRate,
      fxSource: normalizedRequest.fxSource,
      note: normalizedRequest.memo || null,
    };
    const memos = buildXrplJsonMemo(memoPayload);
    if (memos) txjson.Memos = memos;

    setPhase("pay_poll");
    setActivePayload(null);

    try {
      const res = await fetch(apiUrl("/xumm/sign"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ txjson, returnUrl: window.location.href }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create Xumm payment");
      }

      const payload = {
        kind: "pay",
        uuid: data.uuid,
        qrUrl: data.qrUrl,
        deepLink: data.deepLink,
      };
      setActivePayload(payload);
      setPhase("pay_qr");

      pollXumm({
        uuid: data.uuid,
        onSigned: () => {
          setPhase("success");
          setActivePayload(null);
        },
        onExpired: () => {
          setPhase("expired");
        },
      });
    } catch (e) {
      setPhase("idle");
      setError(e?.message || "Payment failed.");
    }
  }, [normalizedRequest, payerAddress, pollXumm, startConnect]);

  return (
    <>
      <SEOHead
        title="Payment request - XCANNES"
        description="XCANNES payment request"
        canonical="/pay"
      />
      <main className="min-h-screen bg-elevated text-white font-montserrat px-4 py-10">
        <div className="max-w-xl mx-auto bg-black/40 border border-white/10 rounded-2xl p-5">
          <h1 className="text-xl font-orbitron font-bold">XCANNES payment request</h1>

          {!normalizedRequest ? (
            <p className="mt-4 text-sm text-white/60">
              Invalid or missing request.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-white/70">
                To: <span className="font-mono">{normalizedRequest.to}</span>
              </div>
              <div className="text-sm text-white/70">
                Amount:{" "}
                <span className="font-mono">
                  {normalizedRequest.displayAmount} {normalizedRequest.displayCurrency}
                </span>
              </div>
              {normalizedRequest.amountRlusd != null && (
                <div className="text-[11px] text-white/50">
                  Settles on-chain in RLUSD:{" "}
                  <span className="font-mono">{normalizedRequest.amountRlusd}</span>
                </div>
              )}
              {normalizedRequest.memo ? (
                <div className="text-[11px] text-white/50">
                  Note: {normalizedRequest.memo}
                </div>
              ) : null}

              <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
                This payment will settle on-chain in RLUSD. The receiver will be credited in{" "}
                <span className="font-semibold text-xcannes-green/90">
                  {normalizedRequest.targetCurrency || "RLUSD"}
                </span>
                .
              </div>

              {payerAddress ? (
                <div className="text-[11px] text-white/50">
                  Connected wallet:{" "}
                  <span className="font-mono">
                    {payerAddress.slice(0, 10)}…{payerAddress.slice(-8)}
                  </span>
                </div>
              ) : null}

              {activePayload?.qrUrl ? (
                <div className="mt-2 flex flex-col items-center gap-3">
                  <div className="bg-black/60 border border-white/10 rounded-xl p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={activePayload.qrUrl}
                      alt="Xumm QR"
                      className="w-[220px] h-[220px] object-contain"
                    />
                  </div>
                  {activePayload.deepLink ? (
                    <button
                      type="button"
                      onClick={() => {
                        window.location.href = activePayload.deepLink;
                      }}
                      className="px-4 py-2 rounded-lg bg-[#0f7fe1]/20 hover:bg-[#0f7fe1]/30 text-[#78b8ff] border border-[#0f7fe1]/30 text-sm font-semibold"
                    >
                      Open in Xumm
                    </button>
                  ) : null}

                  <div className="text-[11px] text-white/45">
                    {activePayload.kind === "connect"
                      ? "Scan to connect your wallet"
                      : "Scan to approve the payment"}
                  </div>
                </div>
              ) : null}

              {error ? (
                <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </div>
              ) : null}

              {phase === "success" ? (
                <div className="mt-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-[12px] text-emerald-200">
                  ✅ Payment submitted via Xumm.
                </div>
              ) : null}

              {phase === "expired" ? (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                  ⏳ Request expired. Please retry.
                </div>
              ) : null}

              <div className="pt-2 flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => startPay()}
                  disabled={phase === "pay_poll" || phase === "connect_poll"}
                  className="w-full px-4 py-2.5 rounded-lg bg-xcannes-green/90 hover:bg-xcannes-green text-black font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {phase === "connect_poll" || phase === "connect_qr"
                    ? "Waiting for connection…"
                    : phase === "pay_poll" || phase === "pay_qr"
                      ? "Waiting for approval…"
                      : payerAddress
                        ? "Pay with Xumm"
                        : "Connect & pay with Xumm"}
                </button>

                {!payerAddress ? (
                  <button
                    type="button"
                    onClick={() => startConnect()}
                    disabled={phase === "connect_poll" || phase === "connect_qr"}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    Connect only
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => {
                    stopPolling();
                    setError(null);
                    setPhase("idle");
                    setActivePayload(null);
                    setPayerAddress("");
                  }}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 font-semibold transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </>
  );
}
