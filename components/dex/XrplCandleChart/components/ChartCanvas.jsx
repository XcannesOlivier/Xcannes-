"use client";

import React from "react";

export default function ChartCanvas({
  chartRef,
  statusBar,
  crosshairPoint,
  loading,
  noDataMessage,
  interval,
  watermark,
  noDataContent,
  chartClassName = "",
}) {
  return (
    <div className="flex-1 flex flex-col min-h-0 md:border-l md:border-white/10">
      <div className="relative w-full h-full">
        {/* Status line OHLC en haut du chart */}
        {statusBar && (
          <div className="absolute top-0 left-0 right-0 z-30 flex flex-wrap items-center gap-3 px-3 py-1.5 text-[11px] font-mono">
            <span className="text-white/50">
              {new Date(statusBar.time * 1000).toLocaleString()}
            </span>
            <span className="text-white/60">
              O{" "}
              <span className={statusBar.isUp ? "text-xcannes-green" : "text-red-400"}>
                {statusBar.open.toFixed(5)}
              </span>
            </span>
            <span className="text-white/60">
              H{" "}
              <span className={statusBar.isUp ? "text-xcannes-green" : "text-red-400"}>
                {statusBar.high.toFixed(5)}
              </span>
            </span>
            <span className="text-white/60">
              L{" "}
              <span className={statusBar.isUp ? "text-xcannes-green" : "text-red-400"}>
                {statusBar.low.toFixed(5)}
              </span>
            </span>
            <span className="text-white/60">
              C{" "}
              <span className={statusBar.isUp ? "text-xcannes-green" : "text-red-400"}>
                {statusBar.close.toFixed(5)}
              </span>
            </span>
          </div>
        )}

        {/* Crosshair custom (utile sur mobile où la crosshair native est discrète) */}
        {crosshairPoint && (
          <>
            <div
              className="absolute top-0 bottom-0 w-[1px] bg-xcannes-green/70 pointer-events-none z-20"
              style={{ left: `${crosshairPoint.x}px` }}
            />
            <div
              className="absolute left-0 right-0 h-[1px] bg-xcannes-green/70 pointer-events-none z-20"
              style={{ top: `${crosshairPoint.y}px` }}
            />
          </>
        )}

        {/* Chart container */}
        <div ref={chartRef} className={`absolute inset-0 ${chartClassName}`}>
          {watermark}
        </div>

        {/* Loading overlay */}
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm z-20">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-xcannes-green border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
              <p className="text-white/60 text-sm">Loading chart...</p>
            </div>
          </div>
        )}

        {/* No data overlay */}
        {noDataMessage && !loading && (
          <>
            {noDataContent ? (
              noDataContent
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm z-10">
                <div className="text-center px-4">
                  <p className="text-sm text-white/60 mb-4">{noDataMessage}</p>
                  <div className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white/5 border border-white/10 text-xs text-white/70">
                    <span>Interval: {interval}</span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
