"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { apiUrl } from "@/lib/runtimeConfig";
import { USD_STABLECOINS } from "../walletDashboardConfig";

function isXrplAddress(value) {
  return /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim());
}

function normalizeKind(value) {
  return String(value || "").trim().toUpperCase();
}

function sortMovementsDesc(list) {
  const sorted = Array.isArray(list) ? list.slice() : [];
  sorted.sort((a, b) => {
    const left = Number.isFinite(Number(a?.ledgerIndex))
      ? Number(a.ledgerIndex)
      : -Infinity;
    const right = Number.isFinite(Number(b?.ledgerIndex))
      ? Number(b.ledgerIndex)
      : -Infinity;
    if (left !== right) return right - left;
    const leftDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
    const rightDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (leftDate !== rightDate) return rightDate - leftDate;
    return String(b?.txHash || "").localeCompare(String(a?.txHash || ""));
  });
  return sorted;
}

function isVisibleMovement(movement) {
  const kind = normalizeKind(movement?.kind);
  if (!kind) return false;
  if (
    kind === "ALLOCATE" ||
    kind.startsWith("ALLOCATE_") ||
    kind === "DEALLOCATE" ||
    kind.startsWith("DEALLOCATE_")
  ) {
    return false;
  }
  if (kind === "XRPL_TRUSTLINE_ADD" || kind === "XRPL_TRUSTLINE_REMOVE") {
    return false;
  }
  if (kind === "WALLET_LABEL") return false;
  return true;
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
  const labelCacheRef = useRef(new Map());

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
    try {
      lastSeenIdRef.current = window.sessionStorage.getItem(storageKey);
    } catch {
      // ignore
    }

    let cancelled = false;

    const fetchLatest = async () => {
      if (cancelled) return;
      try {
        const params = new URLSearchParams();
        params.set("address", backendWalletAddress);
        params.set("limit", "10");
        params.set("source", "onchain");
        const res = await fetch(apiUrl(`/wallet/statement?${params.toString()}`));
        const data = await res.json().catch(() => ({}));
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

        // Ignore older transactions on initial mount.
        if (createdAtMs != null && createdAtMs < mountedAtRef.current) {
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

