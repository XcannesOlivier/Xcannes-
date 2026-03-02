"use client";

import { useCallback, useState } from "react";
import { DEMO_PAYREQ_SCHEMA, decodeDemoPayreqQR } from "../utils/demoXrplMemo";

/**
 * useDemoPaymentRequestScanner
 *
 * Handles two input formats only:
 *  1. Demo QR string: "xcannes-demo:<base64url>"  →  { to, ccy, amt, b }
 *  2. Raw XRPL address: r…
 *
 * Real-wallet QR codes ("xcannes-payreq:…") are explicitly rejected.
 */
export function useDemoPaymentRequestScanner({
  augmentedTokens,
  setSendDestination,
  setSendAmount,
  setSendAssetKey,
  setSendTab,
  setSendPaymentRequest,
} = {}) {
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [paymentRequestScannerOpen, setPaymentRequestScannerOpen] =
    useState(false);

  const handleAddressScan = useCallback(
    (address) => {
      setSendDestination?.(address);
      setQrScannerOpen(false);
    },
    [setSendDestination],
  );

  const handlePaymentRequestScan = useCallback(
    (data) => {
      const raw = String(data || "").trim();
      if (!raw) return;

      // ── 1) Demo QR format ──────────────────────────────────────
      const payreq = decodeDemoPayreqQR(raw);
      if (payreq && payreq.to) {
        const currency = String(payreq.ccy || "").toUpperCase();
        const amount = payreq.amt != null ? Number(payreq.amt) : null;
        const beneficiary = payreq.b || null;

        const matchingToken = currency
          ? (augmentedTokens || []).find(
              (t) => String(t.currency || "").toUpperCase() === currency,
            )
          : null;
        const rlusdToken = (augmentedTokens || []).find(
          (t) => String(t.currency || "").toUpperCase() === "RLUSD",
        );

        if (matchingToken && amount != null) {
          setSendAssetKey?.(matchingToken.key);
          setSendAmount?.(String(amount));
        } else if (rlusdToken && amount != null) {
          setSendAssetKey?.(rlusdToken.key);
          setSendAmount?.(String(amount));
        }

        setSendDestination?.(payreq.to);
        setSendPaymentRequest?.({
          schema: DEMO_PAYREQ_SCHEMA,
          to: payreq.to,
          displayCurrency: currency || null,
          targetCurrencyCode: currency || null,
          displayAmount: amount,
          beneficiaryLabel: beneficiary,
        });
        setSendTab?.("manual");
        setPaymentRequestScannerOpen(false);
        return;
      }

      // ── 2) XRPL address (plain or with xrpl: prefix) ─────────
      const addrMatch = raw.match(/^(?:xrpl:)?(r[1-9A-HJ-NP-Za-km-z]{24,34})$/);
      if (addrMatch) {
        setSendDestination?.(addrMatch[1]);
        setSendPaymentRequest?.(null);
        setSendTab?.("manual");
        setPaymentRequestScannerOpen(false);
        return;
      }

      // ── 3) Anything else (including real-wallet QR) → rejected ─
      alert("This QR code format is not supported in demo mode.");
    },
    [
      augmentedTokens,
      setSendAmount,
      setSendAssetKey,
      setSendDestination,
      setSendPaymentRequest,
      setSendTab,
    ],
  );

  return {
    qrScannerOpen,
    setQrScannerOpen,
    paymentRequestScannerOpen,
    setPaymentRequestScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
  };
}
