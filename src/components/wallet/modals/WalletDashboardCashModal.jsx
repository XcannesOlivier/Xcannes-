"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronLeftIcon,
  EllipsisHorizontalIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import MoonPayBuyModal from "./MoonPayBuyModal";
import MoonPaySellModal from "./MoonPaySellModal";
import TopperBuyModal from "./TopperBuyModal";
import TopperSellModal from "./TopperSellModal";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import {
  MOONPAY_UI_ENABLED,
  RAMP_DEFAULT_PROVIDER,
  TOPPER_UI_ENABLED,
} from "@/utils/featureFlags";

export default function WalletDashboardCashModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
  demoMode = false,
  onDemoBuy,
  onDemoSell,
  buyPrefill,
  cashModalTab,
  setCashModalTab: _setCashModalTab,
  renderWalletMeta,
  walletLabel = "",
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  walletAddress,
  resetCashForm: _resetCashForm,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const moonpayEnabled = MOONPAY_UI_ENABLED;
  const topperEnabled = TOPPER_UI_ENABLED;
  const [rampProvider, setRampProvider] = useState(() => {
    const preferred = String(RAMP_DEFAULT_PROVIDER || "moonpay")
      .trim()
      .toLowerCase();
    if (preferred === "topper" && topperEnabled) return "topper";
    if (!moonpayEnabled && topperEnabled) return "topper";
    return "moonpay";
  });
  const [moonpayActive, setMoonpayActive] = useState(false);
  const [topperActive, setTopperActive] = useState(false);
  const [walletMenuOpen, setWalletMenuOpen] = useState(false);
  const walletMenuRef = useRef(null);
  const showWalletMeta = false;
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readActive = () => {
      try {
        const fromGlobal = Boolean(window.__XCANNES_MOONPAY_ACTIVE__);
        const fromSession =
          window.sessionStorage?.getItem("xcannes_moonpay_active") === "1";
        setMoonpayActive(fromGlobal || fromSession);
      } catch {
        setMoonpayActive(false);
      }
    };

    readActive();
    const handler = (e) => setMoonpayActive(Boolean(e?.detail?.active));
    window.addEventListener("xcannes:moonpay-active", handler);
    return () => window.removeEventListener("xcannes:moonpay-active", handler);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const readActive = () => {
      try {
        const fromGlobal = Boolean(window.__XCANNES_TOPPER_ACTIVE__);
        const fromSession =
          window.sessionStorage?.getItem("xcannes_topper_active") === "1";
        setTopperActive(fromGlobal || fromSession);
      } catch {
        setTopperActive(false);
      }
    };

    readActive();
    const handler = (e) => setTopperActive(Boolean(e?.detail?.active));
    window.addEventListener("xcannes:topper-active", handler);
    return () => window.removeEventListener("xcannes:topper-active", handler);
  }, [open]);

  useEffect(() => {
    if (rampProvider === "topper" && !topperEnabled && moonpayEnabled) {
      setRampProvider("moonpay");
      return;
    }
    if (rampProvider === "moonpay" && !moonpayEnabled && topperEnabled) {
      setRampProvider("topper");
    }
  }, [moonpayEnabled, rampProvider, topperEnabled]);

  useEffect(() => {
    setWalletMenuOpen(false);
  }, [cashModalTab, moonpayActive, open, rampProvider, topperActive]);

  useEffect(() => {
    if (!walletMenuOpen) return;
    const handlePointerDown = (event) => {
      const root = walletMenuRef.current;
      if (!root) return;
      if (root.contains(event.target)) return;
      setWalletMenuOpen(false);
    };
    const handleKeyDown = (event) => {
      if (event.key === "Escape") setWalletMenuOpen(false);
    };
    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [walletMenuOpen]);

  if (!shouldRender) return null;

  const rampActive = rampProvider === "topper" ? topperActive : moonpayActive;
  const rampEnabled = rampProvider === "topper" ? topperEnabled : moonpayEnabled;
  const bothProvidersEnabled = moonpayEnabled && topperEnabled;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-cash-modal border-white/10 md:border overflow-hidden flex flex-col pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-full md:h-auto md:max-w-2xl md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const content = (
    <>
      {/* Backdrop */}
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      {/* Modal */}
      <div className={wrapperClass}>
	        <div
	          className={panelClass}
	          onClick={(e) => {
	            if (!inline) e.stopPropagation();
	          }}
	        >
		          {/* Header */}
		          {!rampActive ? (
		            <div className="border-b border-white/10">
		              <div className="flex items-start gap-3 p-4">
				                {cashModalTab === "buy" || cashModalTab === "sell" ? (
				                  <button
			                    type="button"
			                    onClick={onClose}
			                    className="wallet-modal-close -ml-1 w-10 h-10 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
			                    aria-label={t("back", "Back")}
			                  >
			                    <ChevronLeftIcon className="w-6 h-6" aria-hidden="true" />
			                  </button>
			                ) : null}
		                <div className="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
		                  {showWalletMeta ? (
		                    <div>{renderWalletMeta?.("pr-8")}</div>
		                  ) : null}
		                  <div className="flex flex-wrap items-center gap-2">
		                    {noticeVariant === "demo" ? (
	                      <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
	                        {t("demo_notice_title", "Mode démo")}
	                      </span>
		                    ) : null}
		                  </div>
		                </div>

                    {bothProvidersEnabled ? (
                      <div className="flex items-center gap-1 rounded-full bg-white/10 ring-1 ring-white/10 p-1">
                        <button
                          type="button"
                          onClick={() => setRampProvider("moonpay")}
                          className={[
                            "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                            rampProvider === "moonpay"
                              ? "bg-white/20 text-white"
                              : "text-white/70 hover:text-white",
                          ].join(" ")}
                        >
                          MoonPay
                        </button>
                        <button
                          type="button"
                          onClick={() => setRampProvider("topper")}
                          className={[
                            "px-3 py-1 rounded-full text-xs font-semibold transition-colors",
                            rampProvider === "topper"
                              ? "bg-white/20 text-white"
                              : "text-white/70 hover:text-white",
                          ].join(" ")}
                        >
                          Topper
                        </button>
                      </div>
                    ) : null}

		                  {cashModalTab !== "buy" && cashModalTab !== "sell" ? (
		                    <button
		                      type="button"
		                      onClick={onClose}
		                      className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl"
		                      aria-label={t("close", "Close")}
	                    >
	                      ✕
	                    </button>
	                  ) : null}
		              </div>
		            </div>
		          ) : (
		            <div className="relative z-20 border-b border-white/10 bg-black/40 backdrop-blur-md">
		              <div className="flex items-center justify-between px-3 py-2">
		                <div className="flex items-center gap-2 min-w-0">
			                  <div className="relative w-8 h-8 rounded-lg bg-[#6d28d9] ring-1 ring-white/10 flex items-center justify-center flex-shrink-0">
			                    <span className="w-3.5 h-3.5 rounded-full bg-white/90" aria-hidden />
			                    <span
			                      className="absolute left-1/2 top-1/2 translate-x-[7px] translate-y-[-7px] w-1.5 h-1.5 rounded-full bg-white/90"
			                      aria-hidden
			                    />
			                  </div>
		                  <p className="text-white font-semibold truncate">
		                    {rampProvider === "topper"
                          ? cashModalTab === "sell"
                            ? t("topper_header_sell", { defaultValue: "Topper Sell" })
                            : t("topper_header_buy", { defaultValue: "Topper Buy" })
                          : cashModalTab === "sell"
                            ? t("moonpay_header_sell", "MoonPay Sell")
                            : t("moonpay_header_buy", "MoonPay Buy")}
		                  </p>
		                </div>

		                <div className="flex items-center gap-2" ref={walletMenuRef}>
		                  <div className="relative">
		                    <button
		                      type="button"
		                      onClick={() => setWalletMenuOpen((v) => !v)}
		                      className="h-10 px-3.5 rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors flex items-center gap-2.5 text-white/90"
		                      aria-label={t("wallet_menu", "Wallet menu")}
		                      aria-expanded={walletMenuOpen}
		                    >
		                      <span
		                        className="w-2.5 h-2.5 rounded-full bg-[#6d28d9]"
		                        aria-hidden
		                      />
		                      <EllipsisHorizontalIcon className="w-6 h-6" aria-hidden="true" />
		                    </button>

		                    {walletMenuOpen ? (
		                      <div className="absolute right-0 top-full mt-2 w-[min(320px,calc(100vw-24px))] rounded-xl bg-elevated ring-1 ring-white/10 shadow-2xl p-3 z-50">
		                        <p className="text-[11px] tracking-[0.22em] uppercase text-white/50">
		                          {t("current_wallet", "Compte actuel")}
		                        </p>
		                        {String(walletLabel || "").trim() ? (
		                          <p className="mt-2 text-[14px] text-white font-semibold truncate">
		                            {walletLabel}
		                          </p>
		                        ) : null}
		                        <p className="mt-1 text-[12px] text-white/70 font-mono break-all">
		                          {String(walletAddress || "")}
		                        </p>
		                      </div>
		                    ) : null}
		                  </div>

		                  <button
		                    type="button"
		                    onClick={onClose}
		                    className="wallet-modal-close w-10 h-10 flex items-center justify-center rounded-full bg-white/10 ring-1 ring-white/10 hover:bg-white/[0.15] transition-colors text-white"
		                    aria-label={t("close", "Close")}
		                  >
		                    <XMarkIcon className="w-5 h-5" aria-hidden="true" />
		                  </button>
		                </div>
		              </div>
		            </div>
	          )}

		          {/* Contenu selon l'onglet actif */}
				          <div
				            className={`${
				              // MoonPay iframe already has its own margins/padding inside the widget.
				              // Remove horizontal padding here to avoid double side-margins.
				              rampActive ? "px-0 py-0" : "p-4 md:p-5"
				            } relative z-0 overflow-y-auto overscroll-contain flex-1 min-h-0`}
				            style={{ WebkitOverflowScrolling: "touch" }}
				          >
            <div key={cashModalTab} className="wallet-tab-unfold-in h-full">
              {rampEnabled ? (
                cashModalTab === "buy" ? (
                  rampProvider === "topper" ? (
                    <TopperBuyModal
                      isOpen={true}
                      onClose={onClose}
                      walletAddress={walletAddress || ""}
                      walletLabel={walletLabel}
                      embedded={true}
                      isPreviewMode={isPreviewMode}
                      demoMode={demoMode}
                      onDemoSubmit={onDemoBuy}
                      noticeVariant={noticeVariant}
                      noticeContextLabel={noticeContextLabel}
                      prefill={buyPrefill}
                    />
                  ) : (
                    <MoonPayBuyModal
                      isOpen={true}
                      onClose={onClose}
                      walletAddress={walletAddress || ""}
                      walletLabel={walletLabel}
                      embedded={true}
                      isPreviewMode={isPreviewMode}
                      demoMode={demoMode}
                      onDemoSubmit={onDemoBuy}
                      noticeVariant={noticeVariant}
                      noticeContextLabel={noticeContextLabel}
                      prefill={buyPrefill}
                    />
                  )
                ) : rampProvider === "topper" ? (
                  <TopperSellModal
                    isOpen={true}
                    onClose={onClose}
                    walletAddress={walletAddress || ""}
                    walletLabel={walletLabel}
                    embedded={true}
                    isPreviewMode={isPreviewMode}
                    demoMode={demoMode}
                    onDemoSubmit={onDemoSell}
                    noticeVariant={noticeVariant}
                    noticeContextLabel={noticeContextLabel}
                  />
                ) : (
                  <MoonPaySellModal
                    isOpen={true}
                    onClose={onClose}
                    walletAddress={walletAddress || ""}
                    walletLabel={walletLabel}
                    embedded={true}
                    isPreviewMode={isPreviewMode}
                    demoMode={demoMode}
                    onDemoSubmit={onDemoSell}
                    availableTokens={availableTokens}
                    rlusdPerUnitRates={rlusdPerUnitRates}
                    selectLabelByCurrency={selectLabelByCurrency}
                    selectLabelRightByCurrency={selectLabelRightByCurrency}
                    selectIconByCurrency={selectIconByCurrency}
                    selectLabelMobileByCurrency={selectLabelMobileByCurrency}
                    noticeVariant={noticeVariant}
                    noticeContextLabel={noticeContextLabel}
                  />
                )
              ) : (
                <div className="h-full w-full flex items-center justify-center text-sm text-white/60">
                  {rampProvider === "topper"
                    ? t("ui_topper_disabled", {
                        defaultValue: "Topper est temporairement désactivé.",
                      })
                    : t("ui_moonpay_disabled", {
                        defaultValue: "MoonPay est temporairement désactivé.",
                      })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
