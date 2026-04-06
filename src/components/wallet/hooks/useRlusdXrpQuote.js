"use client";

import { useEffect, useMemo, useState } from "react";
import xcannesApi from "@/lib/xcannesApi";

export function useRlusdXrpQuote({
  amountRlusd,
  direction = "XRP_TO_RLUSD",
  enabled = true,
  debounceMs = 250,
} = {}) {
  const amount = Number(amountRlusd);
  const dir = String(direction || "").trim().toUpperCase();

  const requestKey = useMemo(() => {
    if (!enabled) return "";
    if (!Number.isFinite(amount) || amount <= 0) return "";
    const normalizedDir = dir === "RLUSD_TO_XRP" ? "RLUSD_TO_XRP" : "XRP_TO_RLUSD";
    return `${normalizedDir}:${amount.toFixed(6)}`;
  }, [amount, dir, enabled]);

  const [state, setState] = useState({
    status: "idle", // idle | loading | success | error
    data: null,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    let timer = null;

    const load = async () => {
      if (!requestKey) {
        setState({ status: "idle", data: null, error: null });
        return;
      }

      setState((prev) => ({
        status: "loading",
        data: prev.status === "success" ? prev.data : null,
        error: null,
      }));

      try {
        const [normalizedDir, amt] = requestKey.split(":");
        const response = await xcannesApi.getRlusdXrpQuote(Number(amt), normalizedDir);
        if (cancelled) return;
        setState({ status: "success", data: response || null, error: null });
      } catch (error) {
        if (cancelled) return;
        setState({
          status: "error",
          data: null,
          error: error?.message || "Failed to load XRPL quote",
        });
      }
    };

    timer = window.setTimeout(load, Math.max(0, Number(debounceMs) || 0));

    return () => {
      cancelled = true;
      if (timer) window.clearTimeout(timer);
    };
  }, [debounceMs, requestKey]);

  return state;
}

