"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Buffer } from "buffer";
import SEOHead from "@/components/layout/SEOHead";
import { buildRlusdPaymentTxjson, normalizeXrplIouValue } from "@/utils/walletSpread";
import { buildXrplJsonMemo } from "@/utils/xrplMemo";
import { encodeXrplCurrencyCode, XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { apiUrl } from "@/lib/runtimeConfig";
import { useTranslation } from "next-i18next";
import { getPageTranslations } from "@/i18n/getPageTranslations";

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

const XRPL_ADDRESS_REGEX = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/;

function normalizeIssuer(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  return XRPL_ADDRESS_REGEX.test(raw) ? raw : null;
}

export default function PayRequestPage() {
  const router = useRouter();
  const { t } = useTranslation("common");
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
      request.targetCurrency ||
        request.targetCurrencyCode ||
        request.displayCurrency ||
        request.currency ||
        ""
    )
      .trim()
      .toUpperCase();
    const displayAmountRaw = request.displayAmount ?? request.amount ?? null;
    const displayAmount =
      displayAmountRaw != null ? Number(displayAmountRaw) : null;
    const displayCurrency = String(
      request.displayCurrency ||
        request.displayCurrencyCode ||
        targetCurrency ||
        ""
    )
      .trim()
      .toUpperCase();
    const fxRate = request.fxRate != null ? Number(request.fxRate) : null;
    const fxSource = request.fxSource != null ? String(request.fxSource) : null;
    const memo = request.memo != null ? String(request.memo) : "";
    const issuer = normalizeIssuer(
      request.issuer ||
        request.targetIssuer ||
        request.settlementIssuer ||
        request.paymentIssuer ||
        ""
    );
    const settlementCurrency = String(
      request.settlementCurrency || request.paymentCurrency || ""
    )
      .trim()
      .toUpperCase();
    const settlementIssuer = normalizeIssuer(
      request.settlementIssuer || request.paymentIssuer || ""
    );

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
      displayCurrency: displayCurrency || targetCurrency || null,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate: Number.isFinite(fxRate) ? fxRate : null,
      fxSource,
      memo,
      issuer,
      settlementCurrency: settlementCurrency || null,
      settlementIssuer,
    };
  }, [request]);

  const settlement = useMemo(() => {
    if (!normalizedRequest) return null;
    const target = String(normalizedRequest.targetCurrency || "").toUpperCase();
    const explicitCurrency = String(normalizedRequest.settlementCurrency || "").toUpperCase();
    const explicitIssuer = normalizeIssuer(normalizedRequest.settlementIssuer);
    const issuer = normalizeIssuer(normalizedRequest.issuer);
    let currency = null;
    let issuerAddress = null;

    const pickIssuer = (code) => {
      if (explicitIssuer) return explicitIssuer;
      if (code === "RLUSD") return XRPL_KNOWN_ISSUERS.RLUSD || issuer || null;
      if (code === "XCS") return XRPL_KNOWN_ISSUERS.XCS || issuer || null;
      return issuer || null;
    };

    if (explicitCurrency) {
      currency = explicitCurrency;
      if (currency !== "XRP") {
        issuerAddress = pickIssuer(currency);
      }
    } else if (target === "XRP") {
      currency = "XRP";
    } else if (target === "XCS") {
      currency = "XCS";
      issuerAddress = pickIssuer("XCS");
    } else if (target === "RLUSD") {
      currency = "RLUSD";
      issuerAddress = pickIssuer("RLUSD");
    } else if (issuer) {
      currency = target || null;
      issuerAddress = issuer;
    } else if (
      (Number.isFinite(normalizedRequest.amountRlusd) && normalizedRequest.amountRlusd > 0) ||
      (Number.isFinite(normalizedRequest.fxRate) && normalizedRequest.fxRate > 0)
    ) {
      currency = "RLUSD";
      issuerAddress = pickIssuer("RLUSD");
    }

    const kind = currency === "RLUSD" ? "rlusd" : currency ? "asset" : "unknown";
    let amount = null;
    if (kind === "rlusd") {
      amount = normalizedRequest.amountRlusd;
      if (!Number.isFinite(amount) || amount <= 0) {
        const displayAmount = normalizedRequest.displayAmount;
        if (target === "RLUSD" && Number.isFinite(displayAmount) && displayAmount > 0) {
          amount = displayAmount;
        } else if (Number.isFinite(displayAmount) && displayAmount > 0 && Number.isFinite(normalizedRequest.fxRate) && normalizedRequest.fxRate > 0) {
          amount = displayAmount * normalizedRequest.fxRate;
        }
      }
    } else if (kind === "asset") {
      amount = Number.isFinite(normalizedRequest.displayAmount)
        ? normalizedRequest.displayAmount
        : null;
    }

    return {
      currency,
      issuer: issuerAddress || null,
      amount,
      kind,
    };
  }, [normalizedRequest]);

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
        throw new Error(
          data?.error ||
            t("pay_error_create_connection", "Failed to create Xumm connection")
        );
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
      setError(
        e?.message ||
          t("pay_error_create_connection", "Failed to create Xumm connection")
      );
    }
  }, [normalizedRequest, pollXumm, t]);

  const startPay = useCallback(async () => {
    if (!normalizedRequest) return;
    setError(null);

    if (!payerAddress) {
      await startConnect();
      return;
    }

    if (!normalizedRequest.to || !normalizedRequest.to.startsWith("r")) {
      setError(
        t("pay_error_invalid_destination", "Invalid destination address.")
      );
      return;
    }
    if (!settlement || settlement.kind === "unknown" || !settlement.currency) {
      setError(
        t("pay_error_invalid_request", "Unsupported payment request.")
      );
      return;
    }
    if (!Number.isFinite(settlement.amount) || settlement.amount <= 0) {
      setError(t("pay_error_invalid_amount", "Invalid amount."));
      return;
    }

    let txjson;
    if (settlement.currency === "RLUSD") {
      txjson = buildRlusdPaymentTxjson({
        account: payerAddress,
        destination: normalizedRequest.to,
        amountRlusd: settlement.amount,
      });
      if (!txjson) {
        setError(
          t("pay_error_build_payment", "Unable to build RLUSD payment.")
        );
        return;
      }
      const memoPayload = {
        xcannes: "payreq",
        schema: "xcannes-payreq-v1",
        v: 1,
        targetCurrencyCode: normalizedRequest.targetCurrency || null,
        displayAmount: normalizedRequest.displayAmount,
        displayCurrencyCode: normalizedRequest.displayCurrency,
        amountRlusd: settlement.amount,
        fxRate: normalizedRequest.fxRate,
        fxSource: normalizedRequest.fxSource,
        note: normalizedRequest.memo || null,
      };
      const memos = buildXrplJsonMemo(memoPayload);
      if (memos) txjson.Memos = memos;
    } else if (settlement.currency === "XRP") {
      const drops = Math.round(settlement.amount * 1_000_000).toString();
      txjson = {
        TransactionType: "Payment",
        Account: payerAddress,
        Destination: normalizedRequest.to,
        Amount: drops,
      };
    } else {
      if (!settlement.issuer) {
        setError(
          t("pay_error_invalid_request", "Missing issuer for requested asset.")
        );
        return;
      }
      const value = normalizeXrplIouValue(settlement.amount);
      if (!value) {
        setError(t("pay_error_invalid_amount", "Invalid amount."));
        return;
      }
      txjson = {
        TransactionType: "Payment",
        Account: payerAddress,
        Destination: normalizedRequest.to,
        Amount: {
          currency: encodeXrplCurrencyCode(settlement.currency),
          issuer: settlement.issuer,
          value,
        },
      };
    }

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
        throw new Error(
          data?.error ||
            t("pay_error_create_payment", "Failed to create Xumm payment")
        );
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
      setError(e?.message || t("pay_error_payment_failed", "Payment failed."));
    }
  }, [normalizedRequest, payerAddress, pollXumm, settlement, startConnect, t]);

  return (
    <>
      <SEOHead
        title={t("pay_seo_title", "Payment request - XCANNES")}
        description={t("pay_seo_description", "XCANNES payment request")}
        canonical="/pay"
      />
      <main className="min-h-screen bg-elevated text-white font-montserrat px-4 py-10">
        <div className="max-w-xl mx-auto bg-black/40 border border-white/10 rounded-2xl p-5">
          <h1 className="text-xl font-orbitron font-bold">
            {t("pay_page_title", "XCANNES payment request")}
          </h1>

          {!normalizedRequest ? (
            <p className="mt-4 text-sm text-white/60">
              {t("pay_invalid_request", "Invalid or missing request.")}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-white/70">
                {t("pay_to_label", "To:")}{" "}
                <span className="font-mono">{normalizedRequest.to}</span>
              </div>
              <div className="text-sm text-white/70">
                {t("pay_amount_label", "Amount:")}{" "}
                <span className="font-mono">
                  {normalizedRequest.displayAmount} {normalizedRequest.displayCurrency}
                </span>
              </div>
              {settlement?.currency === "RLUSD" && settlement.amount != null && (
                <div className="text-[11px] text-white/50">
                  {t(
                    "pay_settles_rlusd_label",
                    "Settles on-chain in RLUSD:"
                  )}{" "}
                  <span className="font-mono">{settlement.amount}</span>
                </div>
              )}
              {normalizedRequest.memo ? (
                <div className="text-[11px] text-white/50">
                  {t("pay_note_label", "Note:")} {normalizedRequest.memo}
                </div>
              ) : null}

              {settlement?.currency === "RLUSD" ? (
                <div className="mt-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/60">
                  {t(
                    "pay_settlement_info_prefix",
                    "This payment will settle on-chain in RLUSD. The receiver will be credited in"
                  )}{" "}
                  <span className="font-semibold text-xcannes-green/90">
                    {normalizedRequest.targetCurrency || "RLUSD"}
                  </span>
                  .
                </div>
              ) : null}

              {payerAddress ? (
                <div className="text-[11px] text-white/50">
                  {t("pay_connected_wallet_label", "Connected wallet:")}{" "}
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
                      alt={t("pay_qr_alt", "Xumm QR")}
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
                      {t("pay_open_in_xumm", "Open in Xumm")}
                    </button>
                  ) : null}

                  <div className="text-[11px] text-white/45">
                    {activePayload.kind === "connect"
                      ? t("pay_scan_connect", "Scan to connect your wallet")
                      : t("pay_scan_approve", "Scan to approve the payment")}
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
                  {t("pay_success_banner", "✅ Payment submitted via Xumm.")}
                </div>
              ) : null}

              {phase === "expired" ? (
                <div className="mt-2 rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
                  {t("pay_expired_banner", "⏳ Request expired. Please retry.")}
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
                    ? t("pay_waiting_connection", "Waiting for connection…")
                    : phase === "pay_poll" || phase === "pay_qr"
                      ? t("pay_waiting_approval", "Waiting for approval…")
                      : payerAddress
                        ? t("pay_pay_with_xumm", "Pay with Xumm")
                        : t(
                            "pay_connect_and_pay",
                            "Connect & pay with Xumm"
                          )}
                </button>

                {!payerAddress ? (
                  <button
                    type="button"
                    onClick={() => startConnect()}
                    disabled={phase === "connect_poll" || phase === "connect_qr"}
                    className="w-full px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {t("pay_connect_only", "Connect only")}
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
                  {t("pay_reset", "Reset")}
                </button>
              </div>
            </div>
          )}
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
