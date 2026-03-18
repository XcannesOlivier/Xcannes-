"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/runtimeConfig";

const DEFAULT_STORAGE_KEY = "xcannes_saved_addresses";
const normalizeLabel = (value) => String(value || "").trim();

function loadSavedAddressesFromLocalStorage(storageKey) {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    const normalized = Array.isArray(parsed)
      ? parsed
          .map((entry) => {
            const address = String(entry?.address || "").trim();
            if (!address) return null;
            const label = normalizeLabel(entry?.label);
            const onChainLabel = normalizeLabel(entry?.onChainLabel);
            const savedAt = entry?.savedAt || entry?.createdAt || null;
            return {
              address,
              label: label || null,
              onChainLabel: onChainLabel || null,
              savedAt,
            };
          })
          .filter(Boolean)
      : [];
    return normalized;
  } catch (err) {
    console.error("[useSavedAddresses] Error loading saved addresses:", err);
    return [];
  }
}

export function useSavedAddresses({
  storageKey = DEFAULT_STORAGE_KEY,
  walletAddress = "",
} = {}) {
  const [savedAddresses, setSavedAddresses] = useState(() =>
    loadSavedAddressesFromLocalStorage(storageKey),
  );
  const fetchedRef = useRef(new Set());

  useEffect(() => {
    setSavedAddresses(loadSavedAddressesFromLocalStorage(storageKey));
  }, [storageKey]);

  const persist = useCallback(
    (next) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error(
          "[useSavedAddresses] Error persisting saved addresses:",
          err,
        );
      }
    },
    [storageKey],
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    const address = String(walletAddress || "").trim();
    if (!address) return;
    if (fetchedRef.current.has(address)) return;
    fetchedRef.current.add(address);

    let cancelled = false;
    const loadRemote = async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/saved-addresses?address=${encodeURIComponent(address)}`),
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load saved addresses");
        }
        const remote = Array.isArray(data?.savedAddresses)
          ? data.savedAddresses
          : [];
        if (cancelled || remote.length === 0) return;

        setSavedAddresses((prev) => {
          const map = new Map();
          (remote || []).forEach((entry) => {
            const addr = String(entry?.address || "").trim();
            if (!addr) return;
            const remoteLabel = normalizeLabel(entry?.label);
            map.set(addr, {
              address: addr,
              label: remoteLabel || null,
              onChainLabel: remoteLabel || null,
              savedAt: entry?.savedAt || entry?.createdAt || null,
            });
          });
          (prev || []).forEach((entry) => {
            const addr = String(entry?.address || "").trim();
            if (!addr) return;
            const existing = map.get(addr) || {};
            const localLabel = normalizeLabel(entry?.label);
            const onChainLabel = normalizeLabel(
              existing.onChainLabel || existing.label,
            );
            const label = onChainLabel || localLabel || "";
            map.set(addr, {
              address: addr,
              label: label || null,
              onChainLabel: onChainLabel || null,
              savedAt: entry?.savedAt || existing.savedAt || null,
            });
          });
          const merged = Array.from(map.values()).map((entry) => ({
            address: entry.address,
            label:
              entry.label ||
              String(entry.address || "").slice(0, 10) + "...",
            onChainLabel: entry.onChainLabel || null,
            savedAt: entry.savedAt || new Date().toISOString(),
          }));
          persist(merged);
          return merged;
        });
      } catch (err) {
        console.error("[useSavedAddresses] Error loading remote addresses:", err);
      }
    };

    loadRemote();
    return () => {
      cancelled = true;
    };
  }, [walletAddress, persist]);

  const saveAddress = useCallback(
    (address, label) => {
      const newAddress = {
        address,
        label: label || String(address || "").slice(0, 10) + "...",
        onChainLabel: null,
        savedAt: new Date().toISOString(),
      };

      setSavedAddresses((prev) => {
        const next = [...(prev || []), newAddress];
        persist(next);
        return next;
      });
    },
    [persist],
  );

  return { savedAddresses, saveAddress };
}
