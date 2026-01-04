"use client";

import { useCallback, useState } from "react";

export function usePaymentRequestScanner({
  augmentedTokens,
  setSendDestination,
  setSendAmount,
  setSendAssetKey,
  setSendTab,
} = {}) {
  const [qrScannerOpen, setQrScannerOpen] = useState(false);
  const [paymentRequestScannerOpen, setPaymentRequestScannerOpen] =
    useState(false);

  const handleAddressScan = useCallback(
    (address) => {
      setSendDestination?.(address);
      setQrScannerOpen(false);
    },
    [setSendDestination]
  );

  const handlePaymentRequestScan = useCallback(
    (data) => {
      const raw = String(data || "").trim();

      const looksLikeXrplAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(raw);

      const tryParseUri = (value) => {
        try {
          // Accept xrpl:..., xrpl://..., https://...?... etc.
          const cleaned = value
            .replace(/^xrpl:\/\//i, "xrpl://")
            .replace(/^xrpl:/i, "xrpl://");
          const url = new URL(cleaned);
          const host = url.hostname || "";
          const path = (url.pathname || "").replace(/^\/+/, "");
          const params = url.searchParams;
          const candidateFromUrl =
            params.get("to") || params.get("destination") || null;
          const candidateFromHost = host && host !== "xrpl" ? host : null;
          const candidateFromPath = path && path !== "xrpl:" ? path : null;
          const to = candidateFromUrl || candidateFromHost || candidateFromPath;
          const amount = params.get("amount") || params.get("value") || null;
          const currency = params.get("currency") || params.get("ccy") || null;
          return { to, amount, currency };
        } catch (_) {
          return null;
        }
      };

      const applyPrefill = ({ to, amount, currency } = {}) => {
        if (to) setSendDestination?.(to);
        if (amount) setSendAmount?.(String(amount));
        if (currency) {
          const upper = String(currency).toUpperCase();
          const matchingToken = (augmentedTokens || []).find(
            (t) => String(t.currency || "").toUpperCase() === upper
          );
          if (matchingToken) {
            setSendAssetKey?.(matchingToken.key);
          }
        }
        setSendTab?.("manual");
        setPaymentRequestScannerOpen(false);
      };

      try {
        // 1) JSON: { amount, currency, to }
        const request = JSON.parse(raw);
        if (request && request.to) {
          applyPrefill({
            to: request.to,
            amount: request.amount,
            currency: request.currency,
          });
          return;
        }
      } catch (_) {
        // ignore json parse
      }

      // 2) XRPL address only
      if (looksLikeXrplAddress) {
        applyPrefill({ to: raw });
        return;
      }

      // 3) URI/URL formats (xrpl://..., xrpl:..., https://...?to=... etc.)
      const parsed = tryParseUri(raw);
      if (parsed && parsed.to) {
        applyPrefill(parsed);
        return;
      }

      // 4) Xumm/Xaman payload links: open directly
      if (/xumm\.app|xaman|xumm:\/\//i.test(raw)) {
        const ok = confirm(
          "This looks like a Xumm/Xaman request link. Open it now?"
        );
        if (ok && typeof window !== "undefined") {
          window.location.href = raw;
        }
        setPaymentRequestScannerOpen(false);
        return;
      }

      alert("QR code scanned, but format is not supported.");
    },
    [augmentedTokens, setSendAmount, setSendAssetKey, setSendDestination, setSendTab]
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

