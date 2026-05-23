"use client";

import { useEffect, useRef, useState } from "react";
import {
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
import { useModalDragToClose } from "../hooks/useModalDragToClose";
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
  walletLabel = "",
  preferredFiatCurrency = "",
  signTransaction = null,
  availableTokens,
  rlusdPerUnitRates,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  walletAddress,
  sellSelectTitleOverride = "",
  sellDestinationMode = "",
  onOpenUsdSwapOut,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const moonpayEnabled = MOONPAY_UI_ENABLED;
  const topperEnabled = TOPPER_UI_ENABLED;
  // Overlay drag system (swipe-to-close)
  const overlayListRef = useRef(null); // alias de cashContentRootRef pour le lock scroll
  const forceSimpleSwapBuy =
    String(buyPrefill?.partnerOverride || "").trim().toLowerCase() === "simpleswap";
  const forceSimpleSwapSell = String(sellDestinationMode || "").trim().toLowerCase() ===
    "other_blockchains";
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
  const cashContentRootRef = useRef(null);
  const panelRef = useRef(null);
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

  const {
    dragging: overlayDragging,
    translateY: overlayTranslateY,
    overlayRef,
    closeRequestedRef,
    maybeStartDrag: maybeStartOverlayDrag,
    handlePointerMove: handleOverlayPointerMove,
    handlePointerEnd: handleOverlayPointerEnd,
  } = useModalDragToClose({
    open,
    inline,
    onClose,
    scrollContainerRef: overlayListRef,
    blockButtons: true,
  });

  if (!shouldRender) return null;

  const forcedProvider = forceSimpleSwapBuy || forceSimpleSwapSell ? "moonpay" : rampProvider;
  const rampActive = forcedProvider === "topper" ? topperActive : moonpayActive;
  const rampEnabled = forcedProvider === "topper" ? topperEnabled : moonpayEnabled;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-cash-modal border-white/10 md:border lg:border-0 overflow-hidden flex flex-col pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-full md:h-auto md:max-w-2xl md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? closeRequestedRef.current
        ? ""
        : isClosing
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
            closeRequestedRef.current
              ? ""
              : isClosing
                ? "wallet-modal-backdrop-out"
                : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? { opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) }
              : closeRequestedRef.current
                ? { opacity: 0 }
                : undefined
          }
        />
      ) : null}

      {/* Modal */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? "w-full h-full flex" : "pointer-events-auto w-full h-full"}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            opacity: overlayTranslateY > 0
              ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420))
              : closeRequestedRef.current ? 0 : undefined,
            transition: overlayDragging
              ? "none"
              : "transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)",
            willChange: overlayTranslateY ? "transform, opacity" : undefined,
          }}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerEnd}
          onPointerCancel={handleOverlayPointerEnd}
        >
	        <div
	          ref={panelRef}
	          className={panelClass}
	          onClick={(e) => {
	            if (!inline) e.stopPropagation();
	          }}
	        >
            {/* Ambient glow — step initial uniquement */}
            {!rampActive ? (
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                {cashModalTab === 'buy' ? (
                  <>
                    <div className="absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(34,154,86,0.07),transparent_60%)]" />
                    <div className="absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(34,154,86,0.07),transparent_60%)]" />
                  </>
                ) : cashModalTab === 'sell' ? (
                  <>
                    <div className="absolute inset-0 md:hidden bg-[radial-gradient(700px_circle_at_100%_50%,rgba(124,58,237,0.07),transparent_60%)]" />
                    <div className="absolute inset-0 hidden md:block bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(124,58,237,0.07),transparent_60%)]" />
                  </>
                ) : null}
              </div>
            ) : null}
            <div className="relative z-[2] flex flex-col flex-1 min-h-0">
		          {/* Header — visible uniquement quand l'iframe est active */}
		          {rampActive ? (
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
	          ) : null}

		          {/* Swipe bar mobile — grande zone tactile au-dessus du contenu scrollable */}
          {!rampActive && (cashModalTab === "buy" || cashModalTab === "sell") ? (
            <div
              className="md:hidden flex justify-center pt-2 pb-3 cursor-grab select-none"
              aria-hidden
              onPointerDown={(e) => maybeStartOverlayDrag(e, 'fixed')}
            >
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}

		          {/* Contenu selon l'onglet actif */}
					          <div
					            ref={(el) => { cashContentRootRef.current = el; overlayListRef.current = el; }}
					            className={`${
					              rampActive ? "px-0 py-0" : "p-4 md:p-5"
				            } relative z-0 overflow-y-auto overscroll-contain flex-1 min-h-0`}
				            style={{ WebkitOverflowScrolling: "touch" }}
				            onPointerDown={(e) => maybeStartOverlayDrag(e, 'list')}
				          >
            <div key={cashModalTab} className="wallet-tab-unfold-in h-full">
              {rampEnabled ? (
                cashModalTab === "buy" ? (
                  forcedProvider === "topper" ? (
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
                        signTransaction={signTransaction}
	                      preferredFiatCurrency={preferredFiatCurrency}
		                    onProceedToUsdSwapOut={onOpenUsdSwapOut}
		                      embedded={true}
		                      embeddedOverlayRootRef={panelRef}
		                      isPreviewMode={isPreviewMode}
		                      demoMode={demoMode}
	                      onDemoSubmit={onDemoBuy}
	                      availableTokens={availableTokens}
	                      rlusdPerUnitRates={rlusdPerUnitRates}
	                      selectLabelByCurrency={selectLabelByCurrency}
	                      selectLabelRightByCurrency={selectLabelRightByCurrency}
	                      selectIconByCurrency={selectIconByCurrency}
	                      selectLabelMobileByCurrency={selectLabelMobileByCurrency}
	                      noticeVariant={noticeVariant}
	                      noticeContextLabel={noticeContextLabel}
	                      prefill={buyPrefill}
	                    />
	                  )
                ) : forcedProvider === "topper" ? (
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
	                    preferredFiatCurrency={preferredFiatCurrency}
	                    selectCryptoTitleOverride={sellSelectTitleOverride}
		                    destinationMode={sellDestinationMode}
	                      onProceedToUsdSwapOut={onOpenUsdSwapOut}
		                    embedded={true}
		                    embeddedOverlayRootRef={panelRef}
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
                  {forcedProvider === "topper"
                    ? t("ui_topper_disabled", {
                        defaultValue: "Topper est temporairement désactivé.",
                      })
                    : t("ui_moonpay_disabled", {
                        defaultValue: "MoonPay est temporairement désactivé.",
                      })}
                </div>
              )}
            </div>
            </div>{/* /z-[2] content wrapper */}
          </div>
        </div>
        </div> {/* /overlayRef */}
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
