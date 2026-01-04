"use client";

import { useMemo } from "react";

export function useXrplConnectionIndicator({
  isPreviewMode,
  isConnecting,
  isConnected,
} = {}) {
  return useMemo(() => {
    if (isPreviewMode) {
      return {
        label: "Preview mode",
        dotClass: "bg-white/30",
        ringClass: "ring-white/10",
        pulse: false,
      };
    }

    if (isConnecting) {
      return {
        label: "Connecting…",
        dotClass: "bg-amber-400",
        ringClass: "ring-amber-400/20",
        pulse: true,
      };
    }

    if (isConnected) {
      return {
        label: "XRPL connected",
        dotClass: "bg-xcannes-green",
        ringClass: "ring-xcannes-green/25",
        pulse: true,
      };
    }

    return {
      label: "Not connected",
      dotClass: "bg-white/20",
      ringClass: "ring-white/10",
      pulse: false,
    };
  }, [isConnected, isConnecting, isPreviewMode]);
}

