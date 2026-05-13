"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { USD_STABLECOINS } from "../walletDashboardConfig";
import {
  normalizeMovementKind as normalizeKind,
  isVisibleMovement,
  sortMovementsDesc,
} from "../utils/movementUtils";

function isXrplAddress(value) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim());
}

function rlusdToUnits(rlusdAmount, currencyCode, { rlusdPerUnitRates }) {
  const amount = Number(rlusdAmount);
  if (!Number.isFinite(amount)) return 0;
  const code = String(currencyCode || "").toUpperCase();
  if (!code || USD_STABLECOINS.includes(code)) return amount;
  const rate = Number(rlusdPerUnitRates?.[code]);
  if (!Number.isFinite(rate) || rate <= 0) return amount;
  return amount / rate;
}

function formatUnits(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return "0";
  return v.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

/**
 * useWalletRecentActivityBanner
 * Polls `/wallet/statement` to detect new movements (incoming/outgoing/conversion)
 * and calls `onActivity({ movement, message })` once per new movement.
 */
export function useWalletRecentActivityBanner({
  backendWalletAddress,
  rlusdPerUnitRates,
  savedAddresses = [],
  onActivity,
  pollIntervalMs = 12000,
}) {
  const mountedAtRef = useRef(Date.now());
  const lastSeenIdRef = useRef(null);
  const initialLoadDoneRef = useRef(false);
  const labelCacheRef = useRef(new Map());
  const rateLimitedUntilRef = useRef(0);

  useEffect(() => {
    mountedAtRef.current = Date.now();
    lastSeenIdRef.current = null;
    initialLoadDoneRef.current = false;
    labelCacheRef.current = new Map();
  }, [backendWalletAddress]);

  const savedAddressLabelByAddress = useMemo(() => {
    const map = new Map();
    (savedAddresses || []).forEach((entry) => {
      const address = String(entry?.address || "").trim();
      if (!address) return;
      const label = String(entry?.label || entry?.onChainLabel || "").trim();
      if (!label) return;
      map.set(address, label);
    });
    return map;
  }, [savedAddresses]);

  const resolveCounterpartyLabel = useCallback(
    async (address) => {
      const addr = String(address || "").trim();
      if (!addr || !isXrplAddress(addr)) return "";

      const saved = String(savedAddressLabelByAddress.get(addr) || "").trim();
      if (saved) return saved;

      const cached = labelCacheRef.current.get(addr);
      if (cached != null) return String(cached || "").trim();

      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(addr)}`),
        );
        const data = await res.json().catch(() => ({}));
        const label = String(data?.label || "").trim();
        labelCacheRef.current.set(addr, label);
        return label;
      } catch {
        labelCacheRef.current.set(addr, "");
        return "";
      }
    },
    [savedAddressLabelByAddress],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!backendWalletAddress) return;
    if (typeof onActivity !== "function") return;

    const storageKey = `xcannes_wallet_last_activity_banner:${backendWalletAddress}`;

    let cancelled = false;

    const fetchLatest = async () => {
      if (cancelled) return;
      if (Date.now() < rateLimitedUntilRef.current) return;
      try {
        const params = new URLSearchParams();
        params.set("address", backendWalletAddress);
        params.set("limit", "10");
        params.set("source", "onchain");
        const res = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const header = Number(res.headers?.get("Retry-After"));
          const retryAfter = Number.isFinite(header)
            ? header
            : Number(data?.retryAfter);
          const waitSec = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 10;
          rateLimitedUntilRef.current = Date.now() + waitSec * 1000;
          return;
        }
        if (!res.ok) return;

        const movements = Array.isArray(data?.movements) ? data.movements : [];
        const visible = movements.filter(isVisibleMovement);
        const latest = sortMovementsDesc(visible)[0] || null;
        if (!latest) return;

        const movementId = String(latest?.movementId || latest?._id || "");
        if (!movementId) return;
        if (lastSeenIdRef.current === movementId) return;

        const createdAt = latest?.createdAt ? new Date(latest.createdAt) : null;
        const createdAtMs =
          createdAt && Number.isFinite(createdAt.getTime())
            ? createdAt.getTime()
            : null;

        // Au premier chargement, on affiche la dernière transaction existante
        // sans la marquer comme "déjà vue", pour qu'elle s'affiche en permanence.
        // Pour les polls suivants, on ignore les transactions antérieures au montage.
        const isInitialLoad = !initialLoadDoneRef.current;
        initialLoadDoneRef.current = true;

        if (!isInitialLoad && createdAtMs != null && createdAtMs < mountedAtRef.current) {
          lastSeenIdRef.current = movementId;
          try {
            window.sessionStorage.setItem(storageKey, movementId);
          } catch {
            // ignore
          }
          return;
        }

        const kind = normalizeKind(latest?.kind);
        const from = String(latest?.fromCurrencyCode || "").toUpperCase();
        const to = String(latest?.toCurrencyCode || "").toUpperCase();
        const amountRlusd = Number(latest?.amountRlusd ?? 0);
        const fxRate = Number(latest?.fxRate ?? 0);

        let message = "";
        if (kind === "CONVERSION") {
          const gross = Number(latest?.amountRlusdGross);
          const baseRlusd = Number.isFinite(gross) && gross > 0 ? gross : amountRlusd;
          const baseUnits = rlusdToUnits(baseRlusd, from, { rlusdPerUnitRates });
          const quoteUnits = rlusdToUnits(amountRlusd, to, { rlusdPerUnitRates });
          message = `Vous avez converti ${formatUnits(baseUnits)} ${from || "—"} → ${formatUnits(
            quoteUnits,
          )} ${to || "—"}`;
        } else if (kind === "PAYMENT_IN" || kind === "XRPL_PAYMENT_IN") {
          const currency = to || from || "—";
          const units =
            Number.isFinite(amountRlusd) && amountRlusd > 0
              ? Number.isFinite(fxRate) && fxRate > 0
                ? amountRlusd / fxRate
                : rlusdToUnits(amountRlusd, currency, { rlusdPerUnitRates })
              : 0;
          const counterparty = String(latest?.counterparty || "").trim();
          const label = counterparty ? await resolveCounterpartyLabel(counterparty) : "";
          const who = label || (isXrplAddress(counterparty) ? `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}` : "");
          message = `Vous avez reçu ${formatUnits(units)} ${currency}${who ? ` de ${who}` : ""}`;
        } else if (kind === "PAYMENT_OUT" || kind === "XRPL_PAYMENT_OUT") {
          const currency = from || to || "—";
          const units =
            Number.isFinite(amountRlusd) && amountRlusd > 0
              ? Number.isFinite(fxRate) && fxRate > 0
                ? amountRlusd / fxRate
                : rlusdToUnits(amountRlusd, currency, { rlusdPerUnitRates })
              : 0;
          const counterparty = String(latest?.counterparty || "").trim();
          const label = counterparty ? await resolveCounterpartyLabel(counterparty) : "";
          const who = label || (isXrplAddress(counterparty) ? `${counterparty.slice(0, 6)}…${counterparty.slice(-4)}` : "");
          message = `Vous avez envoyé ${formatUnits(units)} ${currency}${who ? ` à ${who}` : ""}`;
        } else {
          message = "Nouvelle transaction";
        }

        if (message) {
          onActivity({ movement: latest, message });
        }

        lastSeenIdRef.current = movementId;
        try {
          window.sessionStorage.setItem(storageKey, movementId);
        } catch {
          // ignore
        }
      } catch {
        // Best effort only.
      }
    };

    fetchLatest();
    const interval = window.setInterval(fetchLatest, pollIntervalMs);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [
    backendWalletAddress,
    onActivity,
    pollIntervalMs,
    resolveCounterpartyLabel,
    rlusdPerUnitRates,
  ]);
}
