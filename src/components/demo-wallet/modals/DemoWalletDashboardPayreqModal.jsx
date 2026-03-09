"use client";

import { useEffect, useMemo, useState } from "react";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../demoWalletDashboardConfig";

export default function DemoWalletDashboardPayreqModal({
  open,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  renderWalletMeta,
  selectedSendToken,
  sendPaymentRequest,
  sendDestination,
  sendAmount,
  sendProcessing,
  handleSendSubmit,
  savedAddresses,
  enableSaveAddress = false,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:border-[#22C55E]/30 disabled:bg-[#22C55E]/25 disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-[#22C55E]/25";

  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [saveNewAddressLabel, setSaveNewAddressLabel] = useState("");

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination],
  );
  const isSavedDestination = useMemo(() => {
    return (savedAddresses || []).some(
      (addr) => addr.address === normalizedDestination,
    );
  }, [savedAddresses, normalizedDestination]);
  const canSaveDestination =
    enableSaveAddress && normalizedDestination && !isSavedDestination;
  const normalizedSendAmount = Number(String(sendAmount || "").trim());
  const canManualSend =
    Boolean(selectedSendToken) &&
    Boolean(normalizedDestination) &&
    Number.isFinite(normalizedSendAmount) &&
    normalizedSendAmount > 0;

  const requestCurrencyCode = String(
    sendPaymentRequest?.displayCurrency ||
      sendPaymentRequest?.targetCurrencyCode ||
      selectedSendToken?.currency ||
      "",
  )
    .trim()
    .toUpperCase();
  const requestAmountValue =
    sendPaymentRequest?.displayAmount ??
    sendPaymentRequest?.amountRlusd ??
    (Number.isFinite(normalizedSendAmount) && normalizedSendAmount > 0
      ? normalizedSendAmount
      : null);
  const requestAmountLabel =
    requestAmountValue != null && requestCurrencyCode
      ? formatAmountWithSymbol(
          locale,
          Number(requestAmountValue),
          requestCurrencyCode,
          {
            minimumFractionDigits: 0,
            maximumFractionDigits: 6,
          },
        )
      : null;
  const requestBeneficiaryLabel = sendPaymentRequest?.beneficiaryLabel
    ? String(sendPaymentRequest.beneficiaryLabel)
    : "";
  const requestDestination = String(
    sendPaymentRequest?.to || normalizedDestination || "",
  ).trim();
  const requestDestinationLabel =
    requestDestination.length > 14
      ? `${requestDestination.slice(0, 6)}...${requestDestination.slice(-4)}`
      : requestDestination;

  const handleManualSend = async () => {
    const result = await handleSendSubmit?.({
      saveDestination:
        saveNewAddress && canSaveDestination ? normalizedDestination : "",
      saveLabel: saveNewAddressLabel,
    });
    if (result?.ok) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
    }
  };

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
    }
  }, [open]);

  useEffect(() => {
    if (!canSaveDestination) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
    }
  }, [canSaveDestination]);

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal wallet-payreq-modal border border-white/10 p-4 md:p-5 space-y-3 md:space-y-4 overflow-y-auto flex flex-col min-h-0 overscroll-contain pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const requestDetailsPanel = sendPaymentRequest ? (
    <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-amber-200/70 font-semibold">
        {t("ui_payment_request_details", "Payment request")}
      </div>
      <div className="space-y-1 text-xs text-white/80">
        <div className="flex items-center justify-between gap-3">
          <span className="text-white/60">
            {t("ui_beneficiary_label", "Bénéficiaire")}
          </span>
          <span className="font-semibold text-white/90">
            {requestBeneficiaryLabel ||
              t("ui_wallet_unknown", "Unknown wallet")}
          </span>
        </div>
        {requestAmountLabel ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_amount_52cea2dd3d", "Amount")}
            </span>
            <span className="font-mono text-white/90">
              {requestAmountLabel}
            </span>
          </div>
        ) : null}
        {requestCurrencyCode ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_currency_label", "Currency")}
            </span>
            <span className="font-semibold text-white/90">
              {requestCurrencyCode}
            </span>
          </div>
        ) : null}
        {requestDestination ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_destination_xrpl_address_9c2b94554c", "Vers le compte")}
            </span>
            <span className="font-mono text-white/80">
              {requestDestinationLabel || requestDestination}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  ) : null;

  const saveAddressBlock = canSaveDestination ? (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 space-y-2">
      <label className="flex items-center gap-2 text-[11px] text-white/60">
        <input
          type="checkbox"
          checked={saveNewAddress}
          onChange={(e) => setSaveNewAddress(e.target.checked)}
          className="accent-xcannes-green"
        />
        {t("ui_save_this_address_7ef65aa11c", "Save this address?")}
      </label>
      {saveNewAddress ? (
        <div className="space-y-1">
          <div className="text-[11px] text-white/60">
            {t("ui_label_optional_3b6a3c454c", "Label (optional)")}
          </div>
          <input
            type="text"
            value={saveNewAddressLabel}
            onChange={(e) => setSaveNewAddressLabel(e.target.value)}
            placeholder={t(
              "ui_e_g_exchange_friend_11008b5e9e",
              "e.g., Exchange, Friend, ...",
            )}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/80"
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const sendActions = (
    <div className={inline ? "mt-auto pt-2 border-t border-white/10" : ""}>
      <SwipeConfirmButton
        label={
          sendProcessing
            ? t("ui_sending_3b8c1a7d5e", "Sending...")
            : t("ui_send_504b64a87b", "Send")
        }
        onConfirm={handleManualSend}
        disabled={sendProcessing || !canManualSend}
        variant="green"
        className="mt-2 md:hidden"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={sendProcessing || !canManualSend}
        className={`hidden md:block w-full mt-2 text-sm py-2.5 ${greenActionBtnBase}`}
      >
        {sendProcessing
          ? t("ui_sending_3b8c1a7d5e", "Sending...")
          : t("ui_send_504b64a87b", "Send")}
      </button>
    </div>
  );

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          className={panelClass}
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
          >
            ✕
          </button>
          <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}

          </div>
          {renderWalletMeta?.("mb-2")}

          <div className={inline ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div className="space-y-4">
              {requestDetailsPanel}
              {saveAddressBlock}
              {sendActions}
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
