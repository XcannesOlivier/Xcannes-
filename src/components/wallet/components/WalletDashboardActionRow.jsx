"use client";
import { useRef, useState } from "react";
import { useTranslation } from "next-i18next";
import { MOONPAY_UI_ENABLED, TOPPER_UI_ENABLED } from "@/utils/featureFlags";

function useTouchHover(delay = 300) {
  const [active, setActive] = useState(false);
  const timerRef = useRef(null);
  return {
    isTouched: active,
    onTouchStart: () => { if (timerRef.current) clearTimeout(timerRef.current); setActive(true); },
    onTouchEnd: () => { timerRef.current = setTimeout(() => setActive(false), delay); },
  };
}

const CARD_CLASS = "rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)]";

export default function WalletDashboardActionRow({ onAction, vertical = false }) {
  const { t } = useTranslation("common");
  const cashEnabled = MOONPAY_UI_ENABLED || TOPPER_UI_ENABLED;

  const sendTouch    = useTouchHover();
  const receiveTouch = useTouchHover();
  const swapTouch    = useTouchHover();
  const cashTouch    = useTouchHover();

  if (vertical) {
    return (
      <div className="flex flex-col gap-4 h-full py-5 px-8">
        <div className={`flex-1 ${CARD_CLASS}`}>
          <button type="button" onClick={() => onAction("sendChoice")} onTouchStart={sendTouch.onTouchStart} onTouchEnd={sendTouch.onTouchEnd} className={`wallet-action-btn wallet-action-send group w-full h-full justify-center${sendTouch.isTouched ? " is-touched" : ""}`}>
            <div className="wallet-action-icon">
              <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-medium">{t("ui_send_bee4f9e2f5", "Envoyer")}</span>
          </button>
        </div>
        <div className={`flex-1 ${CARD_CLASS}`}>
          <button type="button" onClick={() => onAction("receive")} onTouchStart={receiveTouch.onTouchStart} onTouchEnd={receiveTouch.onTouchEnd} className={`wallet-action-btn wallet-action-receive group w-full h-full justify-center${receiveTouch.isTouched ? " is-touched" : ""}`}>
            <div className="wallet-action-icon">
              <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal">{t("ui_receive_127eab0703", "Recevoir")}</span>
          </button>
        </div>
        <div className={`flex-1 ${CARD_CLASS}`}>
          <button type="button" onClick={() => onAction("swap")} onTouchStart={swapTouch.onTouchStart} onTouchEnd={swapTouch.onTouchEnd} className={`wallet-action-btn wallet-action-swap group w-full h-full justify-center${swapTouch.isTouched ? " is-touched" : ""}`}>
            <div className="wallet-action-icon">
              <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" />
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal">{t("ui_convert_e0fbc97f15", "Convertir")}</span>
          </button>
        </div>
        <div className={`flex-1 ${CARD_CLASS}`}>
          <button type="button" onClick={() => { if (!cashEnabled) return; onAction("cashChoice"); }} onTouchStart={cashTouch.onTouchStart} onTouchEnd={cashTouch.onTouchEnd} disabled={!cashEnabled} aria-disabled={!cashEnabled} className={[`wallet-action-btn wallet-action-buysell group w-full h-full justify-center${cashTouch.isTouched ? " is-touched" : ""}`, !cashEnabled ? "opacity-40 cursor-not-allowed" : ""].join(" ")}>
            <div className="wallet-action-icon">
              <svg className="w-[22px] h-[22px]" viewBox="0 0 24 24" fill="none">
                <text x="12" y="17" textAnchor="middle" fill="currentColor" fontSize="18" fontWeight="700" fontFamily="system-ui, sans-serif">+/−</text>
              </svg>
            </div>
            <span className="wallet-action-label !text-[15px] !font-normal !leading-tight -mt-1 text-center"><span className="block">Banque</span></span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative px-3 pt-[24px] pb-0 md:py-2 space-y-2 md:space-y-3"
    >
      <div className="grid grid-cols-4 gap-2 sm:gap-3 relative z-[1]">
        <div className="rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.03),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)] md:shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={() => onAction("sendChoice")}
          onTouchStart={sendTouch.onTouchStart}
          onTouchEnd={sendTouch.onTouchEnd}
          className={`wallet-action-btn wallet-action-send group w-full${sendTouch.isTouched ? " is-touched" : ""}`}
        >
          <div className="wallet-action-icon">
            <svg
              className="w-[22px] h-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="19" x2="12" y2="5"></line>
              <polyline points="5 12 12 5 19 12"></polyline>
            </svg>
	          </div>
	          <span className="wallet-action-label !text-[16px] !font-medium">
	            {t("ui_send_bee4f9e2f5", "Envoyer")}
	          </span>
	        </button>
	        </div>

        <div className="rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.03),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)] md:shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={() => onAction("receive")}
          onTouchStart={receiveTouch.onTouchStart}
          onTouchEnd={receiveTouch.onTouchEnd}
          className={`wallet-action-btn wallet-action-receive group w-full${receiveTouch.isTouched ? " is-touched" : ""}`}
        >
          <div className="wallet-action-icon">
            <svg
              className="w-[22px] h-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <polyline points="19 12 12 19 5 12"></polyline>
            </svg>
	          </div>
	          <span className="wallet-action-label !text-[15px] !font-normal">
	            {t("ui_receive_127eab0703", "Recevoir")}
	          </span>
	        </button>
	        </div>

        <div className="rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.03),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)] md:shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={() => onAction("swap")}
          onTouchStart={swapTouch.onTouchStart}
          onTouchEnd={swapTouch.onTouchEnd}
          className={`wallet-action-btn wallet-action-swap group w-full${swapTouch.isTouched ? " is-touched" : ""}`}
        >
          <div className="wallet-action-icon">
            <svg
              className="w-[22px] h-[22px]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="17 1 21 5 17 9"></polyline>
              <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
              <polyline points="7 23 3 19 7 15"></polyline>
              <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
            </svg>
	          </div>
	          <span className="wallet-action-label !text-[15px] !font-normal">
	            {t("ui_convert_e0fbc97f15", "Convertir")}
	          </span>
	        </button>
	        </div>

        <div className="rounded-[16px] bg-gradient-to-b from-[#101415] to-[#0d1214] ring-1 ring-white/[0.04] ring-inset shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.03),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)] md:shadow-[-3px_3px_10px_2px_rgba(255,255,255,0.06),0_4px_12px_rgba(0,0,0,0.50),inset_0_-12px_18px_rgba(0,0,0,0.75)]">
        <button
          type="button"
          onClick={() => {
            if (!cashEnabled) return;
            onAction("cashChoice");
          }}
          disabled={!cashEnabled}
          aria-disabled={!cashEnabled}
          title={
            cashEnabled
              ? undefined
              : t("ui_funds_disabled", {
                  defaultValue: "Onramp/offramp est temporairement désactivé.",
                })
          }
          onTouchStart={cashTouch.onTouchStart}
          onTouchEnd={cashTouch.onTouchEnd}
          className={[
            `wallet-action-btn wallet-action-buysell group w-full${cashTouch.isTouched ? " is-touched" : ""}`,
            !cashEnabled ? "opacity-40 cursor-not-allowed" : "",
          ].join(" ")}
        >
          <div className="wallet-action-icon">
            <svg
              className="w-[22px] h-[22px]"
              viewBox="0 0 24 24"
              fill="none"
            >
              <text
                x="12"
                y="17"
                textAnchor="middle"
                fill="currentColor"
                fontSize="18"
                fontWeight="700"
                fontFamily="system-ui, sans-serif"
              >
                +/−
              </text>
            </svg>
	          </div>
	          <span className="wallet-action-label !text-[15px] !font-normal !leading-tight -mt-1 text-center"><span className="block">Banque</span></span>
	        </button>
	        </div>
      </div>
    </div>
  );
}
