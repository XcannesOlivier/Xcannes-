"use client";

import { useState, useEffect } from "react";
import { serverSideTranslations } from "next-i18next/serverSideTranslations";
import { useTranslation } from "next-i18next";
import Header from "../components/Header";
import FooterPro from "../components/FooterPro";
import SEOHead from "../components/SEOHead";

export default function StableExchange() {
  const { t } = useTranslation("common");

  // 10 lignes → 10 objets dragState
  const [dragState, setDragState] = useState(
    Array(10).fill({ isDragging: false, startX: 0, currentX: 0 })
  );

  // --- Les paires par région ---
  const pairsByRegion = [
    [
      { base: "XRP", quote: "RLUSD" }, { base: "XCS", quote: "XRP" },
      { base: "EUR", quote: "USD" }, { base: "GBP", quote: "USD" },
      { base: "USD", quote: "JPY" }, { base: "USD", quote: "CHF" },
      { base: "EUR", quote: "GBP" }, { base: "EUR", quote: "JPY" },
      { base: "GBP", quote: "JPY" }, { base: "AUD", quote: "USD" },
      { base: "NZD", quote: "USD" }, { base: "USD", quote: "CAD" },
      { base: "BTC", quote: "USD" }, { base: "ETH", quote: "USD" }
    ],
    [
      { base: "EUR", quote: "CHF" }, { base: "EUR", quote: "GBP" },
      { base: "GBP", quote: "CHF" }, { base: "EUR", quote: "NOK" },
      { base: "EUR", quote: "SEK" }, { base: "EUR", quote: "DKK" },
      { base: "CHF", quote: "NOK" }, { base: "GBP", quote: "NOK" },
      { base: "NOK", quote: "SEK" }
    ],
    [
      { base: "EUR", quote: "PLN" }, { base: "EUR", quote: "CZK" },
      { base: "EUR", quote: "HUF" }, { base: "EUR", quote: "RON" },
      { base: "PLN", quote: "CZK" }, { base: "CZK", quote: "HUF" },
      { base: "USD", quote: "PLN" }, { base: "USD", quote: "CZK" },
      { base: "USD", quote: "HUF" }
    ],
    [
      { base: "USD", quote: "CNY" }, { base: "USD", quote: "JPY" },
      { base: "USD", quote: "KRW" }, { base: "USD", quote: "HKD" },
      { base: "CNY", quote: "JPY" }, { base: "CNY", quote: "KRW" },
      { base: "JPY", quote: "KRW" }, { base: "HKD", quote: "CNY" }
    ],
    [
      { base: "USD", quote: "SGD" }, { base: "USD", quote: "THB" },
      { base: "USD", quote: "PHP" }, { base: "USD", quote: "IDR" },
      { base: "USD", quote: "MYR" }, { base: "USD", quote: "VND" },
      { base: "SGD", quote: "THB" }, { base: "SGD", quote: "MYR" }
    ],
    [
      { base: "USD", quote: "INR" }, { base: "AUD", quote: "NZD" },
      { base: "AUD", quote: "JPY" }, { base: "NZD", quote: "JPY" },
      { base: "AUD", quote: "SGD" }, { base: "INR", quote: "JPY" },
      { base: "EUR", quote: "AUD" }, { base: "GBP", quote: "AUD" }
    ],
    [
      { base: "USD", quote: "BRL" }, { base: "USD", quote: "MXN" },
      { base: "USD", quote: "ARS" }, { base: "USD", quote: "CLP" },
      { base: "USD", quote: "COP" }, { base: "BRL", quote: "MXN" },
      { base: "BRL", quote: "ARS" }, { base: "MXN", quote: "CLP" }
    ],
    [
      { base: "USD", quote: "AED" }, { base: "USD", quote: "SAR" },
      { base: "USD", quote: "ILS" }, { base: "USD", quote: "TRY" },
      { base: "EUR", quote: "TRY" }, { base: "AED", quote: "SAR" },
      { base: "SAR", quote: "TRY" }
    ],
    [
      { base: "USD", quote: "ZAR" }, { base: "EUR", quote: "ZAR" },
      { base: "GBP", quote: "ZAR" }, { base: "ZAR", quote: "JPY" },
      { base: "USD", quote: "NGN" }, { base: "USD", quote: "EGP" },
      { base: "USD", quote: "KES" }
    ],
    [
      { base: "BTC", quote: "EUR" }, { base: "ETH", quote: "EUR" },
      { base: "XRP", quote: "EUR" }, { base: "BTC", quote: "GBP" },
      { base: "USD", quote: "RUB" }, { base: "EUR", quote: "RUB" },
      { base: "XCS", quote: "RLUSD" }
    ]
  ];

  // --- Gestion des événements "drag end" globaux ---
  useEffect(() => {
    const endDrag = () => {
      setDragState((prev) =>
        prev.map(() => ({ isDragging: false, startX: 0, currentX: 0 }))
      );
    };

    window.addEventListener("mouseup", endDrag);
    window.addEventListener("touchend", endDrag);

    return () => {
      window.removeEventListener("mouseup", endDrag);
      window.removeEventListener("touchend", endDrag);
    };
  }, []);

  // --- Drag start ---
  const handleMouseDown = (e, rowIndex) => {
    const x = e.pageX || e.touches?.[0]?.pageX;
    const newState = [...dragState];
    newState[rowIndex] = { isDragging: true, startX: x, currentX: 0 };
    setDragState(newState);
  };

  // --- Drag move ---
  const handleMouseMove = (e, rowIndex) => {
    if (!dragState[rowIndex].isDragging) return;

    const x = e.pageX || e.touches?.[0]?.pageX;
    const diff = x - dragState[rowIndex].startX;

    const newState = [...dragState];
    newState[rowIndex] = { ...dragState[rowIndex], currentX: diff };
    setDragState(newState);
  };

  return (
    <>
      <SEOHead title="Stable Exchange - Xcannes DEX" description="Currency exchange visualization" />

      <div className="min-h-screen bg-gradient-to-br from-xcannes-black via-xcannes-dark to-black">
        <Header />

        <main className="relative overflow-hidden min-h-screen pt-20 pb-0 flex flex-col gap-4">

          {/* --- CSS ANIMATION FIXÉ & OPTIMISÉ --- */}
          <style jsx>{`
            @keyframes scroll-infinite {
              from { transform: translateX(0); }
              to { transform: translateX(-50%); }
            }

            .scroll-row {
              overflow: hidden;
              cursor: grab;
              width: 100%;
            }
            .scroll-row.dragging {
              cursor: grabbing;
            }

            .drag-wrapper {
              will-change: transform;
            }

            .scroll-content {
              display: flex;
              min-width: 200%;
              animation: scroll-infinite 40s linear infinite;
            }
            .scroll-content.reverse {
              animation-direction: reverse;
            }
            .scroll-content.paused {
              animation-play-state: paused !important;
            }
          `}</style>

          {/* --- Génération des lignes animées --- */}
          {pairsByRegion.map((pairs, rowNum) => {
            // Répétition massive pour scroll infini
            const hugePairs = [];
            for (let i = 0; i < 20; i++) hugePairs.push(...pairs);

            const isDragging = dragState[rowNum].isDragging;
            const dragOffset = dragState[rowNum].currentX;

            return (
              <div
                key={rowNum}
                className={`scroll-row ${isDragging ? "dragging" : ""}`}
                onMouseDown={(e) => handleMouseDown(e, rowNum)}
                onMouseMove={(e) => handleMouseMove(e, rowNum)}
                onTouchStart={(e) => handleMouseDown(e, rowNum)}
                onTouchMove={(e) => handleMouseMove(e, rowNum)}
              >
                <div
                  className="drag-wrapper"
                  style={{ transform: `translateX(${dragOffset}px)` }}
                >
                  <div
                    className={`scroll-content ${rowNum % 2 ? "reverse" : ""} ${
                      isDragging ? "paused" : ""
                    }`}
                  >
                    {hugePairs.map((pair, i) => (
                      <div
                        key={`r${rowNum}-${i}`}
                        className="w-20 h-20 bg-white/5 border-r border-white/10 flex items-center justify-center backdrop-blur-sm hover:bg-white/10 transition-colors flex-shrink-0"
                      >
                        <div className="text-center pointer-events-none">
                          <div className="text-xs font-bold text-white">{pair.base}</div>
                          <div className="text-[10px] text-white/30">↔</div>
                          <div className="text-xs font-bold text-white/70">{pair.quote}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </main>

        <FooterPro />
      </div>
    </>
  );
}

// --- i18n ---
export async function getStaticProps({ locale }) {
  return {
    props: {
      ...(await serverSideTranslations(locale, ["common"])),
    },
  };
}
