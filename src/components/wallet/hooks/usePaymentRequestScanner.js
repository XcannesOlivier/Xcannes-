"use client";

import { useCallback, useState } from "react";
import { Buffer } from "buffer";
const PAYREQ_SCHEMA = 'xcannes-payreq';
import { parseRelayChallenge, forwardRelayChallengeToPwa } from "@/utils/relayChallenge";
import { isPwaEmbedded } from "@/context/PwaEmbeddedContext";

const DEBUG_PAYREQ_SCAN = process.env.NEXT_PUBLIC_DEBUG_LOGS === "true";

export function usePaymentRequestScanner({
  augmentedTokens,
  setSendDestination,
  setSendDestinationLabel,
  setSendAmount,
  setSendAssetKey,
  setSendTab,
  setSendPaymentRequest,
  toast,
} = {}) {
  const [qrScannerOpen, setQrScannerOpen] = useState(false);

  const handleAddressScan = useCallback(
    (address) => {
      setSendDestination?.(address);
      setSendDestinationLabel?.("");
      setQrScannerOpen(false);
    },
    [setSendDestination, setSendDestinationLabel],
  );

  const handlePaymentRequestScan = useCallback(
    (data) => {
      const raw = String(data || "").trim();

      if (DEBUG_PAYREQ_SCAN) {
        console.log("[PayreqScan] Raw input:", raw?.substring(0, 100), raw?.length > 100 ? "..." : "");
      }

      // ── Relay challenge detection (wallet connect/sign via PWA) ──
      const relayChallenge = parseRelayChallenge(raw);
      if (relayChallenge && isPwaEmbedded()) {
        forwardRelayChallengeToPwa(raw);
        return { relayChallenge: true };
      }

      // ── Navigation command from desktop (e.g. "Create or import wallet") ──
      try {
        const navAction = JSON.parse(raw);
        if (navAction && navAction.type === "xcannes:navigate") {
          if (DEBUG_PAYREQ_SCAN) {
            console.log("[PayreqScan] Navigate action detected:", navAction.screen);
          }
          if (navAction.screen === "choice" && isPwaEmbedded()) {
            // Send GO_TO_CHOICE to PWA parent
            const appOrigin = process.env.NEXT_PUBLIC_SITE_URL || "https://xcannes.com";
            window.parent?.postMessage({ type: "GO_TO_CHOICE" }, appOrigin);
            setQrScannerOpen(false);
            return { navigate: true };
          }
        }
      } catch {
        // Not JSON or not navigate action — continue
      }

      const decodePrefixedPayreq = (value) => {
        const match = String(value || "").match(
          /^(xcannes-payreq|xcannes-request)(?::\/\/|:)([\s\S]+)$/i,
        );
        if (DEBUG_PAYREQ_SCAN) {
          console.log("[PayreqScan] Prefix match:", match ? "yes" : "no");
        }
        if (!match) return null;
        const payload = String(match[2] || "")
          .replace(/\s+/g, "")
          .trim();
        if (!payload) return null;
        try {
          const padded =
            payload.replace(/-/g, "+").replace(/_/g, "/") +
            "===".slice((payload.length + 3) % 4);
          const decoded = Buffer.from(padded, "base64").toString("utf8");
          if (DEBUG_PAYREQ_SCAN) {
            console.log("[PayreqScan] Decoded JSON:", decoded?.substring(0, 80));
          }
          return decoded;
        } catch {
          return null;
        }
      };
      const normalizePayreqPayload = (request) => {
        if (!request || typeof request !== "object") return request;
        const normalized = { ...request };
        // Schema may be omitted — infer from prefix (xcannes-payreq:)
        if (request.s && !normalized.schema) normalized.schema = request.s;
        if (!normalized.schema) normalized.schema = PAYREQ_SCHEMA;
        if (request.tc && !normalized.targetCurrency)
          normalized.targetCurrency = request.tc;
        if (request.t && !normalized.to) normalized.to = request.t;
        if (request.da != null && normalized.displayAmount == null)
          normalized.displayAmount = request.da;
        // displayCurrency defaults to targetCurrency when omitted
        if (request.dc && !normalized.displayCurrency)
          normalized.displayCurrency = request.dc;
        if (!normalized.displayCurrency && normalized.targetCurrency)
          normalized.displayCurrency = normalized.targetCurrency;
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
          const label =
            params.get("label") ||
            params.get("name") ||
            params.get("beneficiary") ||
            null;
          return { to, amount, currency, label };
        } catch (_) {
          return null;
        }
      };

      const applyPrefill = ({ to, amount, currency, label } = {}) => {
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
        if (setSendDestinationLabel) {
          const nextLabel = String(label || "").trim();
          setSendDestinationLabel(nextLabel);
        }
        setSendPaymentRequest?.(null);
        setSendTab?.("manual");
      };

      try {
        // 1) JSON
        const requestRaw = JSON.parse(payload);
        if (DEBUG_PAYREQ_SCAN) {
          console.log("[PayreqScan] Parsed request:", requestRaw?.to ? "has 'to'" : "no 'to'", requestRaw?.s || requestRaw?.schema || "no schema");
        }
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
            request.label ??
            null;

          if (isXcannesPayReq && targetCurrency) {
            setSendDestinationLabel?.("");
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
              schema: PAYREQ_SCHEMA,
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
            return;
          }

          // Legacy JSON: { amount, currency, to }
          applyPrefill({
            to: request.to,
            amount: request.amount,
            currency: request.currency,
            label: beneficiaryLabel,
          });
          return;
        }
      } catch (_) {
        // ignore json parse
      }

      // 2) XRPL address only
      if (looksLikeXrplAddress) {
        applyPrefill({ to: payload, label: null });
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
          request.label ??
          null;

        if (isXcannesPayReq && targetCurrency) {
          setSendDestinationLabel?.("");
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
            schema: PAYREQ_SCHEMA,
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
          return;
        }

        applyPrefill({
          to: request.to,
          amount: request.amount,
          currency: request.currency,
          label: beneficiaryLabel,
        });
        return;
      }

      if (parsed && parsed.to) {
        applyPrefill(parsed);
        return;
      }

      if (DEBUG_PAYREQ_SCAN) {
        console.log("[PayreqScan] Format not supported. Raw data:", raw?.substring(0, 50));
      }
      toast?.error("QR code scanned, but format is not supported.");
    },
    [
      augmentedTokens,
      setSendAmount,
      setSendAssetKey,
      setSendDestination,
      setSendDestinationLabel,
      setSendPaymentRequest,
      setSendTab,
      toast,
    ],
  );

  return {
    qrScannerOpen,
    setQrScannerOpen,
    handleAddressScan,
    handlePaymentRequestScan,
  };
}
