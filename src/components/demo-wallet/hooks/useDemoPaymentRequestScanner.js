"use client";

import { useCallback, useState } from "react";
import { Buffer } from "buffer";
import { XCANNES_MEMO_SCHEMAS } from "../utils/demoXrplMemo";

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
      const decodePrefixedPayreq = (value) => {
        const match = value.match(
          /^(xcannes-payreq|xcannes-request)(?::\/\/|:)(.+)$/i,
        );
        if (!match) return null;
        const payload = String(match[2] || "").trim();
        if (!payload) return null;
        try {
          const padded =
            payload.replace(/-/g, "+").replace(/_/g, "/") +
            "===".slice((payload.length + 3) % 4);
          return Buffer.from(padded, "base64").toString("utf8");
        } catch {
          return null;
        }
      };
      const prefixedDecoded = decodePrefixedPayreq(raw);
      const payload = prefixedDecoded || raw;

      const looksLikeXrplAddress = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(
        payload,
      );

      const tryParseUri = (value) => {
        try {
          // Accept xrpl:..., xrpl://..., https://...?... etc.
          const cleaned = value
            .replace(/^xrpl:\/\//i, "xrpl://")
            .replace(/^xrpl:/i, "xrpl://");
          const url = new URL(cleaned);
          const reqParam =
            url.searchParams.get("req") ||
            url.searchParams.get("payreq") ||
            url.searchParams.get("xcannes_payreq") ||
            null;

          if (reqParam) {
            try {
              const raw = String(reqParam || "").trim();
              const padded =
                raw.replace(/-/g, "+").replace(/_/g, "/") +
                "===".slice((raw.length + 3) % 4);
              const json = Buffer.from(padded, "base64").toString("utf8");
              const parsed = JSON.parse(json);
              return parsed && typeof parsed === "object"
                ? { request: parsed }
                : null;
            } catch {
              // fallthrough
            }
          }

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
            (t) => String(t.currency || "").toUpperCase() === upper,
          );
          if (matchingToken) {
            setSendAssetKey?.(matchingToken.key);
          }
        }
        setSendPaymentRequest?.(null);
        setSendTab?.("manual");
        setPaymentRequestScannerOpen(false);
      };

      const normalizePayreqPayload = (request) => {
        if (!request || typeof request !== "object") return request;
        const normalized = { ...request };
        if (request.s && !normalized.schema) normalized.schema = request.s;
        if (request.tc && !normalized.targetCurrency)
          normalized.targetCurrency = request.tc;
        if (request.t && !normalized.to) normalized.to = request.t;
        if (request.da != null && normalized.displayAmount == null)
          normalized.displayAmount = request.da;
        if (request.dc && !normalized.displayCurrency)
          normalized.displayCurrency = request.dc;
        if (request.ar != null && normalized.amountRlusd == null)
          normalized.amountRlusd = request.ar;
        if (request.fr != null && normalized.fxRate == null)
          normalized.fxRate = request.fr;
        if (request.fs && !normalized.fxSource)
          normalized.fxSource = request.fs;
        if (request.i && !normalized.issuer) normalized.issuer = request.i;
        if (request.m && !normalized.memo) normalized.memo = request.m;
        if (request.b && !normalized.beneficiaryLabel)
          normalized.beneficiaryLabel = request.b;
        if (request.c && !normalized.createdAt)
          normalized.createdAt = request.c;
        return normalized;
      };

      try {
        // 1) JSON
        const requestRaw = JSON.parse(payload);
        const request = normalizePayreqPayload(requestRaw);
        if (request && request.to) {
          const schema = String(
            request.schema || request.kind || "",
          ).toLowerCase();
          const isXcannesPayReq =
            schema.includes("xcannes") ||
            schema.includes("payreq") ||
            Boolean(request.targetCurrency);

          const targetCurrency = String(
            request.targetCurrency ||
              request.targetCurrencyCode ||
              request.currency ||
              "",
          )
            .trim()
            .toUpperCase();

          const displayAmount = request.displayAmount ?? request.amount ?? null;
          let amountRlusd = request.amountRlusd ?? request.rlusd ?? null;
          if (
            (amountRlusd == null || Number.isNaN(Number(amountRlusd))) &&
            targetCurrency === "RLUSD"
          ) {
            amountRlusd = displayAmount;
          }
          const fxRate = request.fxRate ?? null;
          const fxSource = request.fxSource ?? null;
          const memo = request.memo ?? null;
          const beneficiaryLabel =
            request.beneficiaryLabel ??
            request.beneficiaryName ??
            request.beneficiary ??
            request.walletLabel ??
            null;

          if (isXcannesPayReq && targetCurrency) {
            const matchingToken = (augmentedTokens || []).find(
              (t) => String(t.currency || "").toUpperCase() === targetCurrency,
            );
            const rlusdToken = (augmentedTokens || []).find(
              (t) => String(t.currency || "").toUpperCase() === "RLUSD",
            );

            // Prefer paying from the requested currency allocation when available, otherwise pay directly in RLUSD.
            if (matchingToken && displayAmount != null) {
              setSendAssetKey?.(matchingToken.key);
              setSendAmount?.(String(displayAmount));
            } else if (rlusdToken && amountRlusd != null) {
              setSendAssetKey?.(rlusdToken.key);
              setSendAmount?.(String(amountRlusd));
            } else {
              // fallback to previous behavior
              applyPrefill({
                to: request.to,
                amount: request.amount,
                currency: request.currency,
              });
              return;
            }

            setSendDestination?.(request.to);
            setSendPaymentRequest?.({
              schema: XCANNES_MEMO_SCHEMAS.payreq.schema,
              to: request.to,
              targetCurrencyCode: targetCurrency || null,
              displayAmount:
                displayAmount != null ? Number(displayAmount) : null,
              displayCurrency: targetCurrency || null,
              amountRlusd: amountRlusd != null ? Number(amountRlusd) : null,
              fxRate: fxRate != null ? Number(fxRate) : null,
              fxSource: fxSource != null ? String(fxSource) : null,
              memo: memo != null ? String(memo) : null,
              beneficiaryLabel:
                beneficiaryLabel != null ? String(beneficiaryLabel) : null,
            });
            setSendTab?.("manual");
            setPaymentRequestScannerOpen(false);
            return;
          }

          // Legacy JSON: { amount, currency, to }
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
        applyPrefill({ to: payload });
        return;
      }

      // 3) URI/URL formats (xrpl://..., xrpl:..., https://...?to=... etc.)
      const parsed = tryParseUri(payload);
      if (parsed?.request?.to) {
        const request = normalizePayreqPayload(parsed.request);
        const schema = String(
          request.schema || request.kind || "",
        ).toLowerCase();
        const isXcannesPayReq =
          schema.includes("xcannes") ||
          schema.includes("payreq") ||
          Boolean(request.targetCurrency);

        const targetCurrency = String(
          request.targetCurrency ||
            request.targetCurrencyCode ||
            request.currency ||
            "",
        )
          .trim()
          .toUpperCase();

        const displayAmount = request.displayAmount ?? request.amount ?? null;
        let amountRlusd = request.amountRlusd ?? request.rlusd ?? null;
        if (
          (amountRlusd == null || Number.isNaN(Number(amountRlusd))) &&
          targetCurrency === "RLUSD"
        ) {
          amountRlusd = displayAmount;
        }
        const fxRate = request.fxRate ?? null;
        const fxSource = request.fxSource ?? null;
        const memo = request.memo ?? null;
        const beneficiaryLabel =
          request.beneficiaryLabel ??
          request.beneficiaryName ??
          request.beneficiary ??
          request.walletLabel ??
          null;

        if (isXcannesPayReq && targetCurrency) {
          const matchingToken = (augmentedTokens || []).find(
            (t) => String(t.currency || "").toUpperCase() === targetCurrency,
          );
          const rlusdToken = (augmentedTokens || []).find(
            (t) => String(t.currency || "").toUpperCase() === "RLUSD",
          );

          if (matchingToken && displayAmount != null) {
            setSendAssetKey?.(matchingToken.key);
            setSendAmount?.(String(displayAmount));
          } else if (rlusdToken && amountRlusd != null) {
            setSendAssetKey?.(rlusdToken.key);
            setSendAmount?.(String(amountRlusd));
          } else {
            applyPrefill({
              to: request.to,
              amount: request.amount,
              currency: request.currency,
            });
            return;
          }

          setSendDestination?.(request.to);
          setSendPaymentRequest?.({
            schema: XCANNES_MEMO_SCHEMAS.payreq.schema,
            to: request.to,
            targetCurrencyCode: targetCurrency || null,
            displayAmount: displayAmount != null ? Number(displayAmount) : null,
            displayCurrency: targetCurrency || null,
            amountRlusd: amountRlusd != null ? Number(amountRlusd) : null,
            fxRate: fxRate != null ? Number(fxRate) : null,
            fxSource: fxSource != null ? String(fxSource) : null,
            memo: memo != null ? String(memo) : null,
            beneficiaryLabel:
              beneficiaryLabel != null ? String(beneficiaryLabel) : null,
          });
          setSendTab?.("manual");
          setPaymentRequestScannerOpen(false);
          return;
        }

        applyPrefill({
          to: request.to,
          amount: request.amount,
          currency: request.currency,
        });
        return;
      }

      if (parsed && parsed.to) {
        applyPrefill(parsed);
        return;
      }

      // 4) Xumm/Xaman payload links: open directly
      if (/xumm\.app|xaman|xumm:\/\//i.test(payload)) {
        const ok = confirm(
          "This looks like a Xumm/Xaman request link. Open it now?",
        );
        if (ok && typeof window !== "undefined") {
          window.location.href = payload;
        }
        setPaymentRequestScannerOpen(false);
        return;
      }

      alert("QR code scanned, but format is not supported.");
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
