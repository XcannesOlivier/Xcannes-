"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_STORAGE_KEY = "xcannes_saved_addresses";

export function useSavedAddresses(storageKey = DEFAULT_STORAGE_KEY) {
  const [savedAddresses, setSavedAddresses] = useState([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setSavedAddresses([]);
        return;
      }
      const parsed = JSON.parse(raw);
      setSavedAddresses(Array.isArray(parsed) ? parsed : []);
    } catch (err) {
      console.error("[useSavedAddresses] Error loading saved addresses:", err);
      setSavedAddresses([]);
    }
  }, [storageKey]);

  const persist = useCallback(
    (next) => {
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch (err) {
        console.error("[useSavedAddresses] Error persisting saved addresses:", err);
      }
    },
    [storageKey]
  );

  const saveAddress = useCallback(
    (address, label) => {
      const newAddress = {
        address,
        label: label || String(address || "").slice(0, 10) + "...",
        savedAt: new Date().toISOString(),
      };

      setSavedAddresses((prev) => {
        const next = [...(prev || []), newAddress];
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const deleteAddress = useCallback(
    (address) => {
      setSavedAddresses((prev) => {
        const next = (prev || []).filter((a) => a.address !== address);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return { savedAddresses, saveAddress, deleteAddress };
}

