"use client";

import { useEffect, useMemo, useState } from "react";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/utils/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";

export default function WalletDashboardPayreqModal({
  open,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  renderWalletMeta,
  augmentedTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  setSendAmount,
  sendPaymentRequest,
  sendDestination,
  sendAmount,
  sendProcessing,
  handleSendSubmit,
  savedAddresses,
  selectLabelByAssetKey,
  selectLabelRightByAssetKey,
  selectIconByAssetKey,
  selectLabelMobileByAssetKey,
  enableSaveAddress = false,
  inline = false
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:border-[#22C55E]/30 disabled:bg-[#22C55E]/25 disabled:text-white/70 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:bg-[#22C55E]/25";

  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [saveNewAddressLabel, setSaveNewAddressLabel] = useState("");

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination]
  );
  const isSavedDestination = useMemo(() => {
    return (savedAddresses || []).some(
      (addr) => addr.address === normalizedDestination
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
      ""
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
      ? formatAmountWithSymbol(locale, Number(requestAmountValue), requestCurrencyCode, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6
        })
      : null;
  const requestBeneficiaryLabel = sendPaymentRequest?.beneficiaryLabel
    ? String(sendPaymentRequest.beneficiaryLabel)
    : "";
  const requestDestination = String(
    sendPaymentRequest?.to || normalizedDestination || ""
  ).trim();
  const requestDestinationLabel =
    requestDestination.length > 14
      ? `${requestDestination.slice(0, 6)}...${requestDestination.slice(-4)}`
      : requestDestination;

  const payingCurrency = String(selectedSendToken?.currency || "").toUpperCase();
  const targetCurrency = String(
    sendPaymentRequest?.targetCurrencyCode || ""
  ).trim().toUpperCase();
  const isAlternateCurrency =
    Boolean(sendPaymentRequest) &&
    Boolean(targetCurrency) &&
    Boolean(payingCurrency) &&
    targetCurrency !== payingCurrency;

  const handleManualSend = async () => {
    const result = await handleSendSubmit?.({
      saveDestination:
        saveNewAddress && canSaveDestination ? normalizedDestination : "",
      saveLabel: saveNewAddressLabel
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
    inline ? "h-full max-h-none rounded-xl" : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline ? (isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in") : "",
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
            {requestBeneficiaryLabel || t("ui_wallet_unknown", "Unknown wallet")}
          </span>
        </div>
        {requestAmountLabel ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_amount_52cea2dd3d", "Amount")}
            </span>
            <span className="font-mono text-white/90">{requestAmountLabel}</span>
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

  const currencySelectorBlock = sendPaymentRequest && augmentedTokens && setSendAssetKey ? (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
      <div className="text-[11px] uppercase tracking-wide text-white/50 font-semibold">
        {t("ui_pay_with_currency", "Payer avec")}
      </div>
      <ModalSelect
        value={selectedSendToken ? selectedSendToken.key : ""}
        onChange={setSendAssetKey}
        options={(augmentedTokens || []).map((token) => {
          const labelLeft =
            selectLabelByAssetKey?.[token.key] ||
            selectLabelByAssetKey?.[token.currency] ||
            token.currency;
          const labelRight =
            selectLabelRightByAssetKey?.[token.key] ||
            selectLabelRightByAssetKey?.[token.currency] ||
            null;
          return {
            value: token.key,
            icon:
              selectIconByAssetKey?.[token.key] ||
              selectIconByAssetKey?.[token.currency] ||
              null,
            label: labelLeft,
            labelLeft,
            labelRight,
            labelMobile:
              selectLabelMobileByAssetKey?.[token.key] ||
              selectLabelMobileByAssetKey?.[token.currency] ||
              labelLeft,
          };
        })}
        useNativeSelect={false}
        showMobileOptionRight={true}
        buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
        menuClassName="bg-elevated"
        selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
      />
      {sendFxInfo ? (
        <div className="text-[11px] text-white/50">
          ≈ {formatAmountWithSymbol(locale, Number(sendFxInfo.paymentRlusd || 0), "USD", { maximumFractionDigits: 6 })}
          {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 ? (
            <> + {formatAmountWithSymbol(locale, Number(sendFxInfo.spreadFeeRlusd), "USD", { maximumFractionDigits: 6 })} {t("ui_conversion_fee_short", "frais")}</>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : null;

  const alternateCurrencyBanner = isAlternateCurrency ? (
    <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-[11px] text-orange-200/90 space-y-1">
      <div className="font-semibold">
        {t("ui_currency_change_notice", "Changement de devise")}
      </div>
      <div>
        {t(
          "ui_currency_change_detail",
          "La demande est en {{requested}} mais vous payez en {{paying}}. Des frais de conversion de 1 % seront appliqués.",
          { requested: targetCurrency, paying: payingCurrency }
        )}
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
          className="accent-xcannes-green" />
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
            placeholder={t("ui_e_g_exchange_friend_11008b5e9e", "e.g., Exchange, Friend, ...")}
            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-xcannes-green/80" />
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

  const content =
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
        }}>

          <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
          className="wallet-modal-close absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10">

            ✕
          </button>
          <div className="flex flex-wrap items-center gap-2 mb-1 pr-6">
            {noticeVariant === "demo" ? (
              <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
                {t("demo_notice_title", "Mode démo")}
              </span>
            ) : null}
            {showNotConnectedNotice ? (
              <span className="inline-flex items-center text-xcannes-yellow text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                {t("wallet_not_connected_title", "Wallet not connected")}
              </span>
            ) : null}
            {showRlusdNotActivatedNotice ? (
              <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                {t(
                  "wallet_rlusd_not_activated_title",
                  "USD not activated. Authorize USD on your wallet."
                )}
              </span>
            ) : null}
          </div>
          {renderWalletMeta?.("mb-2")}

          <div className={inline ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div className="space-y-4">
              {requestDetailsPanel}
              {currencySelectorBlock}
              {alternateCurrencyBanner}
              {saveAddressBlock}
              {sendActions}
            </div>
          </div>
        </div>
      </div>
    </>;

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
