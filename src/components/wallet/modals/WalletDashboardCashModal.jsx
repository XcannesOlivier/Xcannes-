"use client";

import { useEffect, useRef, useState } from "react";
import MoonPayBuyModal from "./MoonPayBuyModal";
import MoonPaySellModal from "./MoonPaySellModal";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { MOONPAY_UI_ENABLED } from "@/utils/featureFlags";

const MOONPAY_NAV_EVENT = "xcannes:moonpay-nav";

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
  const [moonpayActive, setMoonpayActive] = useState(false);
  const [moonpayAtEntry, setMoonpayAtEntry] = useState(true);
  const lastMoonpayKindRef = useRef(null);
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
    if (!open) return;
    if (!moonpayActive) {
      lastMoonpayKindRef.current = null;
      setMoonpayAtEntry(true);
      return;
    }
    lastMoonpayKindRef.current =
      cashModalTab === "sell" ? "sell" : cashModalTab === "buy" ? "buy" : null;
    setMoonpayAtEntry(true);
  }, [cashModalTab, moonpayActive, open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!open) return;

    const handler = (e) => {
      const detail = e?.detail || {};
      const kind = typeof detail.kind === "string" ? detail.kind : null;
      if (kind && lastMoonpayKindRef.current && kind !== lastMoonpayKindRef.current) {
        return;
      }
      if (!moonpayActive) return;

      if (typeof detail.atEntry === "boolean") {
        setMoonpayAtEntry(detail.atEntry);
        return;
      }
      if (typeof detail.canGoBack === "boolean") {
        setMoonpayAtEntry(!detail.canGoBack);
        return;
      }
      const loadCount = Number(detail.loadCount);
      if (Number.isFinite(loadCount) && loadCount > 1) {
        setMoonpayAtEntry(false);
      }
    };

    window.addEventListener(MOONPAY_NAV_EVENT, handler);
    return () => window.removeEventListener(MOONPAY_NAV_EVENT, handler);
  }, [moonpayActive, open]);

  if (!shouldRender) return null;

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
  const showCloseButton = inline || !moonpayActive || moonpayAtEntry;

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
	          <div className="border-b border-white/10">
	            <div className="flex items-start justify-between p-4 gap-3">
	              <div className="flex min-w-0 flex-col gap-1.5 md:flex-row md:items-center md:gap-2">
	                {showWalletMeta ? <div>{renderWalletMeta?.("pr-8")}</div> : null}
	                <div className="flex flex-wrap items-center gap-2">
	                  {noticeVariant === "demo" ? (
	                    <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
	                      {t("demo_notice_title", "Mode démo")}
	                    </span>
	                  ) : null}

	                </div>
	              </div>
	              {showCloseButton ? (
	                <button
	                  type="button"
	                  onClick={onClose}
	                  className="wallet-modal-close text-white/60 hover:text-white transition-colors text-xl"
	                >
	                  ✕
	                </button>
	              ) : null}
	            </div>
	          </div>

          {/* Contenu selon l'onglet actif */}
          <div
            className={`${
              // MoonPay iframe already has its own margins/padding inside the widget.
              // Remove horizontal padding here to avoid double side-margins.
              moonpayActive ? "px-0 py-4 md:py-5" : "p-4 md:p-5"
            } overflow-y-auto overscroll-contain flex-1 min-h-0`}
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            <div key={cashModalTab} className="wallet-tab-unfold-in h-full">
              {moonpayEnabled ? (
                cashModalTab === "buy" ? (
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
                  {t("ui_moonpay_disabled", {
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
