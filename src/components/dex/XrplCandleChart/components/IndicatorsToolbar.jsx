"use client";

import React from "react";

// Barre verticale d’indicateurs (version existante, extraite)
import { useTranslation } from "next-i18next";export default function IndicatorsToolbar({
  showTooltips,
  setShowTooltips,
  hideAllIndicators,
  setHideAllIndicators,
  showVolume,
  setShowVolume,
  showRSI,
  setShowRSI,
  showMACD,
  setShowMACD,
  showBollinger,
  setShowBollinger,
  showVWAP,
  setShowVWAP,
  showSMA,
  setShowSMA,
  showEMA,
  setShowEMA,
  isFxMode
}) {const { t } = useTranslation("common");
  return (
    <div className="w-12 border-l border-white/10 flex flex-col gap-3 p-1.5">
      {/* Toggle Tooltips */}
      <div className="relative group border-b border-white/10 pb-0 md:pb-3">
        <button
          onClick={() => setShowTooltips(!showTooltips)}
          aria-pressed={showTooltips}
          aria-label={showTooltips ? "Désactiver les infobulles" : "Activer les infobulles"}
          className={`w-full aspect-square transition-all flex items-center justify-center ${
          showTooltips ? "text-white/60 hover:text-white/80" : "text-red-500"}`
          }>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">

            {showTooltips ?
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /> :

            <>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                <line x1="2" y1="2" x2="23" y2="23" />
              </>
            }
          </svg>
        </button>
        {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
            <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_hide_les_tooltips_987307ecea", "Masquer les tooltips")}

          </div>
            <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_d_activate_les_infobulles_778babce4d", "Désactiver les infobulles")}

          </div>
          </div>
        }
      </div>

      {/* Hide/Show All Indicators */}
      <div className="relative group border-b border-white/10 pb-0 md:pb-3">
        <button
          onClick={() => {
            const newState = !hideAllIndicators;
            setHideAllIndicators(newState);
            if (newState) {
              setShowVolume(false);
              setShowRSI(false);
              setShowMACD(false);
              setShowBollinger(false);
              setShowVWAP(false);
              setShowSMA({ sma20: false, sma50: false, sma200: false });
              setShowEMA({ ema20: false, ema50: false, ema200: false });
            } else {
              setShowVolume(true);
            }
          }}
          aria-pressed={hideAllIndicators}
          aria-label={hideAllIndicators ? "Réafficher les indicateurs" : "Masquer tous les indicateurs"}
          className={`w-full aspect-square transition-all flex items-center justify-center ${
          hideAllIndicators ? "text-red-500" : "text-white/60 hover:text-white/80"}`
          }>

          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">

            {hideAllIndicators ?
            <>
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </> :

            <>
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </>
            }
          </svg>
        </button>
        {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
            <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">
              {hideAllIndicators ? "Afficher" : "Masquer"}{t("ui_tout_f1aa36c8e3", "tout")}
          </div>
            <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">
              {hideAllIndicators ? "Réafficher les indicateurs" : "Cacher tous les indicateurs"}
            </div>
          </div>
        }
      </div>

      {/* Volume */}
      {!isFxMode &&
      <div className="relative group">
          <button
          onClick={() => setShowVolume(!showVolume)}
          aria-pressed={showVolume}
          aria-label={showVolume ? "Masquer le volume" : "Afficher le volume"}
          className={`w-full aspect-square transition-all flex items-center justify-center ${
          showVolume ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
          }>

            <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">

              <path d="M3 17v-4" />
              <path d="M7 17v-8" />
              <path d="M11 17V9" />
              <path d="M15 17v-6" />
              <path d="M19 17v-10" />
              <path d="M2 17h20" />
            </svg>
          </button>
          {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
              <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_volume_36828512d7", "Volume")}</div>
              <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_histogramme_des_volumes_3ba39baf94", "Histogramme des volumes")}</div>
            </div>
        }
        </div>
      }

      {/* RSI */}
      {!isFxMode &&
      <div className="relative group">
          <button
          onClick={() => setShowRSI(!showRSI)}
          aria-pressed={showRSI}
          aria-label={showRSI ? "Masquer le RSI" : "Afficher le RSI"}
          className={`w-full aspect-square transition-all flex items-center justify-center ${
          showRSI ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
          }>

            <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round">

              <path d="M3 17c2-3 4-6 7-6s5 3 7 3 4-3 4-3" />
              <path d="M3 21h18" />
              <path d="M3 3h18" />
            </svg>
          </button>
          {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
              <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_rsi_aee5216e2c", "RSI")}</div>
              <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_relative_strength_index_03b135dd75", "Relative Strength Index")}</div>
            </div>
        }
        </div>
      }

      {/* MACD */}
      {!isFxMode &&
      <div className="relative group">
          <button
          onClick={() => setShowMACD(!showMACD)}
          aria-pressed={showMACD}
          aria-label={showMACD ? "Masquer le MACD" : "Afficher le MACD"}
          className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
          showMACD ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
          }>{t("ui_macd_04d227f185", "MACD")}


        </button>
          {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
              <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_macd_04d227f185", "MACD")}</div>
              <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_moving_average_convergence_d_c7d386ca76", "Moving Average Convergence Divergence")}</div>
            </div>
        }
        </div>
      }

      {/* Bollinger Bands */}
      <div className="relative group">
        <button
          onClick={() => setShowBollinger(!showBollinger)}
          aria-pressed={showBollinger}
          aria-label={showBollinger ? "Masquer les bandes de Bollinger" : "Afficher les bandes de Bollinger"}
          className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
          showBollinger ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
          }>{t("ui_bb_5c468c1bf0", "BB")}


        </button>
        {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
            <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_bollinger_bands_6ea612aa19", "Bollinger Bands")}</div>
            <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_bandes_de_volatilit_a531496ff2", "Bandes de volatilité")}</div>
          </div>
        }
      </div>

      {/* SMA */}
      <div className="relative group">
        <button
          aria-pressed={showSMA.sma20 || showSMA.sma50 || showSMA.sma200}
          aria-label={t("ui_show_ou_hide_les_sma_218ea8603f", "Afficher ou masquer les SMA")}
          className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
          showSMA.sma20 || showSMA.sma50 || showSMA.sma200 ?
          "text-xcannes-green" :
          "text-white/60 hover:text-white/80"}`
          }
          title={t("ui_simple_moving_average_c9d1d5de2b", "Simple Moving Average")}>{t("ui_sma_b12342ef30", "SMA")}


        </button>
        {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 min-w-[110px]">
            <button
            onClick={() => setShowSMA({ ...showSMA, sma20: !showSMA.sma20 })}
            aria-pressed={showSMA.sma20}
            aria-label={showSMA.sma20 ? "Masquer SMA 20" : "Afficher SMA 20"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
            showSMA.sma20 ? "bg-blue-500/20 text-blue-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1.5"></span>{t("ui_sma_20_71b3b70782", "SMA 20")}

          </button>
            <button
            onClick={() => setShowSMA({ ...showSMA, sma50: !showSMA.sma50 })}
            aria-pressed={showSMA.sma50}
            aria-label={showSMA.sma50 ? "Masquer SMA 50" : "Afficher SMA 50"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
            showSMA.sma50 ? "bg-orange-500/20 text-orange-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-orange-500 mr-1.5"></span>{t("ui_sma_50_feb2611636", "SMA 50")}

          </button>
            <button
            onClick={() => setShowSMA({ ...showSMA, sma200: !showSMA.sma200 })}
            aria-pressed={showSMA.sma200}
            aria-label={showSMA.sma200 ? "Masquer SMA 200" : "Afficher SMA 200"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all ${
            showSMA.sma200 ? "bg-red-500/20 text-red-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-red-500 mr-1.5"></span>{t("ui_sma_200_a2a85ad033", "SMA 200")}

          </button>
          </div>
        }
      </div>

      {/* EMA */}
      <div className="relative group">
        <button
          aria-pressed={showEMA.ema20 || showEMA.ema50 || showEMA.ema200}
          aria-label={t("ui_show_ou_hide_les_ema_b754ebc2c8", "Afficher ou masquer les EMA")}
          className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
          showEMA.ema20 || showEMA.ema50 || showEMA.ema200 ?
          "text-xcannes-green" :
          "text-white/60 hover:text-white/80"}`
          }
          title={t("ui_exponential_moving_average_70156ca8b0", "Exponential Moving Average")}>{t("ui_ema_0e6795183e", "EMA")}


        </button>
        {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 min-w-[110px]">
            <button
            onClick={() => setShowEMA({ ...showEMA, ema20: !showEMA.ema20 })}
            aria-pressed={showEMA.ema20}
            aria-label={showEMA.ema20 ? "Masquer EMA 20" : "Afficher EMA 20"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
            showEMA.ema20 ? "bg-cyan-500/20 text-cyan-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-cyan-500 mr-1.5"></span>{t("ui_ema_20_258a56d889", "EMA 20")}

          </button>
            <button
            onClick={() => setShowEMA({ ...showEMA, ema50: !showEMA.ema50 })}
            aria-pressed={showEMA.ema50}
            aria-label={showEMA.ema50 ? "Masquer EMA 50" : "Afficher EMA 50"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all mb-1 ${
            showEMA.ema50 ? "bg-purple-500/20 text-purple-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-purple-500 mr-1.5"></span>{t("ui_ema_50_87d20ea71c", "EMA 50")}

          </button>
            <button
            onClick={() => setShowEMA({ ...showEMA, ema200: !showEMA.ema200 })}
            aria-pressed={showEMA.ema200}
            aria-label={showEMA.ema200 ? "Masquer EMA 200" : "Afficher EMA 200"}
            className={`block w-full text-left px-2.5 py-1.5 text-[10px] rounded transition-all ${
            showEMA.ema200 ? "bg-pink-500/20 text-pink-400" : "text-white/60 hover:bg-white/10"}`
            }>

              <span className="inline-block w-2 h-2 rounded-full bg-pink-500 mr-1.5"></span>{t("ui_ema_200_d9c5c416e5", "EMA 200")}

          </button>
          </div>
        }
      </div>

      {/* VWAP */}
      {!isFxMode &&
      <div className="relative group">
          <button
          onClick={() => setShowVWAP(!showVWAP)}
          aria-pressed={showVWAP}
          aria-label={showVWAP ? "Masquer le VWAP" : "Afficher le VWAP"}
          className={`w-full aspect-square text-[10px] font-bold transition-all flex items-center justify-center ${
          showVWAP ? "text-xcannes-green" : "text-white/60 hover:text-white/80"}`
          }>{t("ui_vwap_d0acb01a82", "VWAP")}


        </button>
          {showTooltips &&
        <div className="hidden group-hover:block absolute left-full ml-2 top-0 bg-black/95 border border-white/20 rounded-lg p-2 shadow-xl z-30 whitespace-nowrap">
              <div className="text-[11px] max-sm:text-sm font-semibold text-white/90">{t("ui_vwap_d0acb01a82", "VWAP")}</div>
              <div className="text-[9px] max-sm:text-xs text-white/50 mt-0.5">{t("ui_volume_weighted_average_pric_efd0f4bb24", "Volume Weighted Average Price")}</div>
            </div>
        }
        </div>
      }
    </div>);

}