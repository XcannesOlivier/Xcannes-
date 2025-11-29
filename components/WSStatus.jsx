"use client";

import { useMemo } from "react";
import { useXcannesWS } from "../context/XcannesWSContext";

export default function WSStatus() {
  const { connected, tickers, externalPrices, orderbooks } = useXcannesWS();

  const status = useMemo(() => {
    const tickerEntries =
      tickers instanceof Map ? Array.from(tickers.values()) : [];

    const hasXrplTicker = tickerEntries.some(
      (t) => t && t.source && t.source !== "pyth"
    );
    const hasXrplOrderbook =
      orderbooks instanceof Map && orderbooks.size > 0;

    const hasPyth =
      (externalPrices instanceof Map && externalPrices.size > 0) ||
      tickerEntries.some((t) => t && t.source === "pyth");

    return {
      ws: connected,
      xrpl: hasXrplTicker || hasXrplOrderbook,
      pyth: hasPyth,
    };
  }, [connected, tickers, externalPrices, orderbooks]);

  const dot = (ok) =>
    ok ? "bg-xcannes-green" : "bg-red-500";

  return (
    <div className="hidden md:flex items-center gap-3 text-[11px] text-white/60">
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${dot(status.ws)}`} />
        <span>WS</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${dot(status.xrpl)}`} />
        <span>XRPL</span>
      </div>
      <div className="flex items-center gap-1">
        <span className={`w-2 h-2 rounded-full ${dot(status.pyth)}`} />
        <span>PYTH</span>
      </div>
    </div>
  );
}
