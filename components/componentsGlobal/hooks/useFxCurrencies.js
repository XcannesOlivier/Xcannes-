"use client";

import { useEffect, useState } from "react";

export function useFxCurrencies({ activeAction, getFxCurrencies } = {}) {
  const [fxCurrencies, setFxCurrencies] = useState([]);
  const [fxCurrenciesLoading, setFxCurrenciesLoading] = useState(false);

  useEffect(() => {
    if (activeAction !== "swap") return;
    if (typeof getFxCurrencies !== "function") return;

    let cancelled = false;
    const loadFxCurrencies = async () => {
      try {
        setFxCurrenciesLoading(true);
        const list = await getFxCurrencies();
        if (!cancelled && Array.isArray(list)) {
          setFxCurrencies(list);
        }
      } catch (_) {
        if (!cancelled) {
          setFxCurrencies([]);
        }
      } finally {
        if (!cancelled) {
          setFxCurrenciesLoading(false);
        }
      }
    };

    loadFxCurrencies();
    return () => {
      cancelled = true;
    };
  }, [activeAction, getFxCurrencies]);

  return { fxCurrencies, fxCurrenciesLoading };
}

