"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import QRScanner from "../components/QRScanner";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";
import { greenActionBtnBase } from "./walletModalTokens";
import { normalizeQrImageFile } from "@/utils/qrImage";

export default function WalletDashboardSendModal({
  open,
  onClose,
  noticeVariant = "preview",
  renderWalletMeta,
  augmentedTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  sendAmount,
  setSendAmount,
  sendPaymentRequest,
  selectLabelByAssetKey,
  selectLabelRightByAssetKey,
  selectIconByAssetKey,
  selectLabelMobileByAssetKey,
  savedAddresses,
  sendDestination,
  setSendDestination,
  sendDestinationLabel,
  handlePaymentRequestScan,
  handleSendSubmit,
  sendProcessing,
  enableSaveAddress = false,
  inline = false,
  resetSendForm,
  toast,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [saveNewAddressLabel, setSaveNewAddressLabel] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [scanKey, setScanKey] = useState(0);

  const payreqFileInputId = "payreq-qr-file";
  const manualQrReaderIdRef = useRef(
    `manual-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination],
  );
  const hasDestination = Boolean(normalizedDestination) && /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(normalizedDestination);
  const showCalculatedAmountLabel = useMemo(() => {
    if (!sendPaymentRequest || !selectedSendToken) return false;
    const target = String(sendPaymentRequest?.targetCurrencyCode || "")
      .trim()
      .toUpperCase();
    const selectedCurrency = String(selectedSendToken?.currency || "")
      .trim()
      .toUpperCase();
    if (!target || !selectedCurrency) return false;
    return target !== selectedCurrency;
  }, [sendPaymentRequest, selectedSendToken]);
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
  const hasPaymentRequest = Boolean(sendPaymentRequest);

  // ── Insufficient balance detection (payreq mode) ──
  const insufficientBalance = useMemo(() => {
    if (!sendPaymentRequest || !selectedSendToken) return false;
    // Trustline-only tokens (EUR, GBP, etc.) are backed by RLUSD allocation —
    // the real balance isn't in `value`, so skip this check for them.
    if (selectedSendToken.isTrustlineOnly) return false;
    const requiredAmount = Number(sendAmount || 0);
    const available = Number(selectedSendToken.value || 0);
    return requiredAmount > 0 && available < requiredAmount;
  }, [sendPaymentRequest, selectedSendToken, sendAmount]);

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
  const handleManualQrFile = async (file) => {
    if (!file) return;
    try {
      let scanFile = file;
      try {
        scanFile = await normalizeQrImageFile(file, { maxDimension: 1600 });
      } catch {
        scanFile = file;
      }
      const { Html5Qrcode } = await import("html5-qrcode");
      const readerId = manualQrReaderIdRef.current;
      const instance = manualQrScannerRef.current || new Html5Qrcode(readerId);
      manualQrScannerRef.current = instance;

      const decodedText = await instance.scanFile(scanFile, true);
      try {
        await instance.clear();
      } catch (err) {
        // ignore cleanup errors
      }
      if (decodedText) {
        handlePaymentRequestScan?.(decodedText);
        setScanActive(false);
      }
    } catch (err) {
      console.error("QR scanFile error:", err);
      toast?.error(
        t(
          "ui_qr_decode_failed_3b5d7f9a2c",
          "Unable to decode this image. Try a clearer screenshot.",
        ),
      );
    }
  };
  const looksLikeXrplAddress = (value) =>
    /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
  const looksLikeQrPayload = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^(xcannes-payreq|xcannes-request)(?::\/\/|:)/i.test(raw)) return true;
    if (/^xrpl:/i.test(raw)) return true;
    if (looksLikeXrplAddress(raw)) return true;
    if (
      raw.startsWith("{") &&
      /"to"|"targetCurrency"|"schema"|"payreq"/i.test(raw)
    ) {
      return true;
    }
    if (/^https?:/i.test(raw)) {
      try {
        const url = new URL(raw);
        const req =
          url.searchParams.get("req") ||
          url.searchParams.get("payreq") ||
          url.searchParams.get("xcannes_payreq");
        if (req) return true;
        const candidate =
          url.searchParams.get("to") ||
          url.searchParams.get("destination") ||
          (url.hostname && url.hostname !== "xrpl" ? url.hostname : "") ||
          (url.pathname || "").replace(/^\/+/, "");
        if (candidate && looksLikeXrplAddress(candidate)) return true;
      } catch {
        return false;
      }
    }
    return false;
  };
  const handlePastePayload = (event) => {
    const clipboard = event.clipboardData;
    if (!clipboard) return false;

    // 1) Try synchronous text from clipboardData (works on desktop)
    const text = (clipboard.getData("text") || clipboard.getData("text/plain") || "").trim();
    if (looksLikeQrPayload(text)) {
      event.preventDefault();
      handlePaymentRequestScan?.(text);
      setScanActive(false);
      return true;
    }

    // 2) Check for image in clipboard items (QR image paste)
    const items = clipboard.items || [];
    for (const item of items) {
      if (
        item.kind === "file" &&
        String(item.type || "").startsWith("image/")
      ) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          void handleManualQrFile(file);
          return true;
        }
      }
    }

    // 3) Async fallback for mobile: clipboardData.getData("text") is often
    //    empty on mobile when the clipboard was written via ClipboardItem API.
    //    Use navigator.clipboard.readText() as async fallback.
    if (!text && navigator?.clipboard?.readText) {
      event.preventDefault();
      navigator.clipboard.readText().then((asyncText) => {
        const trimmed = (asyncText || "").trim();
        if (looksLikeQrPayload(trimmed)) {
          handlePaymentRequestScan?.(trimmed);
          setScanActive(false);
        } else if (trimmed) {
          // Not a QR payload — put it in the destination field
          setSendDestination(trimmed);
        }
      }).catch(() => {
        // Permission denied or unavailable — ignore
      });
      return true;
    }

    return false;
  };
  const handleScan = (data) => {
    const result = handlePaymentRequestScan?.(data);
    if (result?.relayChallenge) {
      // Relay challenge forwarded to PWA — close modal immediately
      onClose?.();
      return;
    }
    setScanActive(false);
  };
  const handleScanQrUpload = () => {
    const input = document.getElementById(payreqFileInputId);
    input?.click();
  };
  const scanRequestFooter = (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleScanQrUpload();
        }}
        className="inline-flex items-center gap-2 px-3 py-2 text-xs rounded-lg border border-white/20 bg-white/15 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/60">
          +
        </span>
        {t(
          "ui_or_upload_a_qr_image_works_e_df6baa8039",
          "Charger une image qrcode",
        )}
      </button>
    </div>
  );

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setScanActive(false);
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
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal border-white/10 md:border p-4 md:p-5 space-y-4 flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen md:h-auto md:max-w-lg md:max-h-[100vh] rounded-none md:rounded-2xl",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const requestDetailsPanel = hasPaymentRequest ? (
    <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 p-3 space-y-2">
      <div className="text-xs uppercase tracking-wide text-amber-200/70 font-semibold">
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

  const payreqCurrencySelectorBlock =
    hasPaymentRequest && augmentedTokens && setSendAssetKey ? (
      <div className="rounded-xl border border-white/10 bg-white/5 p-3 space-y-2">
        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
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
          iconClassName="text-3xl leading-none"
          buttonClassName="bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
          menuClassName={
            noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
          }
          selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
        />
        {sendFxInfo ? (
          <div className="text-xs text-white/60">
            ≈{" "}
            {formatAmountWithSymbol(
              locale,
              Number(sendFxInfo.paymentRlusd || 0),
              "USD",
              { maximumFractionDigits: 6 },
            )}
          </div>
        ) : null}
      </div>
    ) : null;

  const saveAddressBlock = canSaveDestination ? (
    <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 space-y-2">
      <label className="flex items-center gap-2 text-xs text-white/60">
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
          <div className="text-xs text-white/60">
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

  /* ── Label helpers for summary ── */
  const confirmCurrencyCode = String(
    selectedSendToken?.currency || "",
  ).trim().toUpperCase();
  const summaryAmount = Number.isFinite(normalizedSendAmount) ? normalizedSendAmount : 0;
  const confirmAmountLabel = confirmCurrencyCode
    ? formatAmountWithSymbol(locale, summaryAmount, confirmCurrencyCode, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 6,
      })
    : null;

  const manualForm = (
    <div className="space-y-3">
        {/* ── Destination ── */}
        <div>
            <label
              className="block text-sm text-white/50 mb-1"
              title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
            >
              {t("ui_send_to_label", "Envoyer à")}
            </label>
            <div className="relative">
              <input
                type="text"
                list="saved-addresses"
                value={sendDestination}
                onChange={hasPaymentRequest ? undefined : (e) => setSendDestination(e.target.value)}
                onPaste={hasPaymentRequest ? undefined : handlePastePayload}
                readOnly={hasPaymentRequest}
                placeholder={t("ui_select_saved_address_60c28f89c1", "Import or select saved address...")}
                className={`w-full bg-black/40 border border-white/15 rounded-xl pl-4 ${hasPaymentRequest ? 'pr-4' : 'pr-20'} py-3 text-base text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] ${hasPaymentRequest ? 'cursor-default text-white/60' : ''}`}
              />
              {!hasPaymentRequest && (
                <>
                  {/* ── + upload QR image ── */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScanQrUpload();
                    }}
                    className="absolute right-10 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                    title={t("ui_or_upload_a_qr_image_works_e_df6baa8039", "Charger une image qrcode")}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded border border-white/20 text-white/60 text-lg font-bold leading-none">+</span>
                  </button>
                  {/* ── Scan QR camera ── */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScanActive(true);
                      setScanKey((prev) => prev + 1);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                    title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
                  >
                    <svg className="w-7 h-7 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                    </svg>
                  </button>
                </>
              )}
              <datalist id="saved-addresses">
                {(savedAddresses || []).map((addr, idx) => (
                  <option
                    key={idx}
                    value={addr.address}
                    label={`${addr.label} (${addr.address.slice(0, 8)}...${addr.address.slice(-6)})`}
                  />
                ))}
              </datalist>
            </div>
        </div>

        {/* ── Devise + Montant (séparés) – masqués en mode payreq ── */}
        {!hasPaymentRequest && (
        <div className={`transition-opacity duration-300 space-y-4 ${hasDestination ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
          <div>
            <label
              className="block text-base md:text-lg text-white/60 mb-1.5"
              title={t("ui_send_asset_tip", "Sélectionnez la devise à envoyer.")}
            >
              {t("ui_asset_e5170a7a06", "Asset")}
            </label>
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
              iconClassName="text-3xl leading-none"
              buttonClassName="bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
              menuClassName={
                noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
            />
          </div>
          {sendPaymentRequest?.beneficiaryLabel ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/90">
              <span className="text-white/80">
                {t("ui_beneficiary_label", "Bénéficiaire")}:
              </span>{" "}
              <span className="font-semibold">
                {String(sendPaymentRequest.beneficiaryLabel)}
              </span>
            </div>
          ) : null}
          <div>
            <div className="flex items-center justify-between">
              <label
                className="block text-base md:text-lg text-white/60 mb-1.5"
                title={t("ui_send_amount_tip", "Saisissez le montant à envoyer.")}
              >
                {t("ui_amount_52cea2dd3d", "Amount")}
              </label>
              {showCalculatedAmountLabel ? (
                <span className="mb-1 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200/90">
                  {t("ui_calculated_amount_label", "Montant calculé")}
                </span>
              ) : null}
            </div>
            <TokenAmountInput
              value={sendAmount}
              onChange={setSendAmount}
              max={
                sendFxInfo
                  ? undefined
                  : selectedSendToken
                    ? selectedSendToken.value
                    : undefined
              }
              placeholder="0.0000"
              token={
                selectedSendToken
                  ? selectLabelByAssetKey?.[selectedSendToken.currency] ||
                    selectedSendToken.currency
                  : "USD"
              }
              tokenClassName="text-white text-xl"
              containerClassName="focus-within:!border-xcannes-green/80 py-4 rounded-xl"
            />
          </div>
        </div>
        )}
    </div>
  );

  /* ── Dynamic summary – visible as soon as a destination address is set ── */
  const inlineSummary = hasDestination ? (
    <div className="space-y-3 transition-all duration-200">
      <div className="rounded-xl border border-xcannes-accent-green/25 bg-xcannes-accent-green/5 p-4 space-y-3">
        <div className="text-xs uppercase tracking-wide text-xcannes-accent-green/80 font-semibold">
          {t("ui_send_confirmation_title", "Résumé de l'envoi")}
        </div>
        <div className="space-y-2 text-sm text-white/80">
          {/* Beneficiary name */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60 shrink-0">
              {t("ui_beneficiary_label", "Destinataire")}
            </span>
            <span className="font-semibold text-white/90">
              {sendDestinationLabel || "—"}
            </span>
          </div>
          {/* Destination – truncated XRPL address, full on hover */}
          <div className="flex items-center justify-between gap-3" title={normalizedDestination}>
            <span className="text-white/60 shrink-0">
              {t("ui_account_number_label", "N° de compte")}
            </span>
            <span className="font-mono text-white/80 text-right text-xs cursor-default">
              {normalizedDestination.length > 14
                ? `${normalizedDestination.slice(0, 6)}…${normalizedDestination.slice(-4)}`
                : normalizedDestination}
            </span>
          </div>
          {/* Save address option */}
          {saveAddressBlock}
          {/* Asset */}
          {confirmCurrencyCode ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60">
                {t("ui_asset_e5170a7a06", "Asset")}
              </span>
              <span className="font-semibold text-white/90">
                {selectLabelByAssetKey?.[selectedSendToken?.key] ||
                  selectLabelByAssetKey?.[selectedSendToken?.currency] ||
                  confirmCurrencyCode}
              </span>
            </div>
          ) : null}
          {/* Amount */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_amount_52cea2dd3d", "Amount")}
            </span>
            <span className={`font-mono ${summaryAmount > 0 ? 'text-white/90' : 'text-white/40'}`}>
              {confirmAmountLabel || '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  /* ── Payreq inline summary – shown when a payment request was scanned ── */
  const payreqInlineSummary = hasPaymentRequest ? (
    <div className="space-y-3 transition-all duration-200">
      <div className="rounded-xl border border-amber-300/25 bg-amber-300/5 p-4 space-y-3">
        <div className="text-xs uppercase tracking-wide text-amber-200/80 font-semibold">
          {t("ui_payment_request_details", "Demande de paiement")}
        </div>
        <div className="space-y-2 text-sm text-white/80">
          {/* Beneficiary */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60 shrink-0">
              {t("ui_beneficiary_label", "Destinataire")}
            </span>
            <span className="font-semibold text-white/90">
              {requestBeneficiaryLabel || t("ui_wallet_unknown", "Unknown wallet")}
            </span>
          </div>
          {/* N° de compte */}
          <div className="flex items-center justify-between gap-3" title={requestDestination}>
            <span className="text-white/60 shrink-0">
              {t("ui_account_number_label", "N° de compte")}
            </span>
            <span className="font-mono text-white/80 text-right text-xs cursor-default">
              {requestDestinationLabel || requestDestination}
            </span>
          </div>
          {/* Save address option */}
          {saveAddressBlock}
          {/* Asset */}
          {requestCurrencyCode ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60">
                {t("ui_asset_e5170a7a06", "Asset")}
              </span>
              <span className="font-semibold text-white/90">
                {requestCurrencyCode}
              </span>
            </div>
          ) : null}
          {/* Amount */}
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
        </div>
      </div>
      {/* Insufficient balance warning */}
      {insufficientBalance ? (
        <div className="rounded-lg border border-orange-400/30 bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90 space-y-1">
          <div className="font-semibold">
            {t("ui_insufficient_balance_title", "Solde insuffisant")}
          </div>
          <div>
            {t(
              "ui_insufficient_balance_detail",
              "Vous n'avez pas assez de {{currency}} pour payer cette demande. Convertissez vos fonds via le bouton Convertir, puis revenez payer.",
              { currency: String(selectedSendToken?.currency || "").toUpperCase() },
            )}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const sendActions = (
    <div className="sticky bottom-0 pt-0 pb-1 -mt-0 border-t border-white/10 space-y-2 bg-inherit z-10">
      <SwipeConfirmButton
        label={
          sendProcessing
            ? t("ui_sending_3b8c1a7d5e", "Sending...")
            : t("ui_send_504b64a87b", "Send")
        }
        onConfirm={handleManualSend}
        disabled={sendProcessing || !canManualSend}
        variant="green"
        className="md:hidden"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={sendProcessing || !canManualSend}
        className={`hidden md:block w-full text-xl py-4 ${greenActionBtnBase}`}
      >
        {sendProcessing
          ? t("ui_sending_3b8c1a7d5e", "Sending...")
          : t("ui_send_504b64a87b", "Send")}
      </button>
    </div>
  );

  const scannerModal = scanActive
    ? createPortal(
        <div className="fixed inset-0 z-[10002] flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => setScanActive(false)}
          />
          {/* Scanner container */}
          <div className="relative flex-1 flex flex-col items-center justify-center">
            {/* Close button */}
            <button
              type="button"
              onClick={() => setScanActive(false)}
              className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            {/* Scanner */}
            <div className="flex-1 w-full">
              <QRScanner
                key={scanKey}
                isOpen={true}
                onScan={handleScan}
                embedded={true}
                showClose={false}
                hideTitle={true}
                enableCamera={true}
                hideWhenUnavailable
                className="bg-black w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />
            </div>
            {/* Hint */}
            <p className="absolute bottom-6 left-0 right-0 text-xs text-white/40 text-center">
              {t("ui_scan_hint_auto_close", "Le scanner se ferme automatiquement après la lecture.")}
            </p>
          </div>
        </div>,
        document.body,
      )
    : null;

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

      {/* Modale */}
      <div className={wrapperClass}>
        <div
          className={panelClass}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-1 pr-6">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div>
                {renderWalletMeta?.(
                  "pr-8 wallet-meta--plus-4 wallet-meta--desktop-gap",
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}

              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="wallet-modal-close md:absolute md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl z-10"
            >
              ✕
            </button>
          </div>
          <div className="flex-1 overflow-y-auto -mx-4 px-4 md:-mx-5 md:px-5">
            <div className="flex flex-col gap-3">
              {manualForm}
              {hasPaymentRequest ? payreqInlineSummary : inlineSummary}
              {scannerModal}
            </div>
          </div>
          {sendActions}
          <input
            id={payreqFileInputId}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0] || null;
              e.target.value = "";
              handleManualQrFile(file);
            }}
          />
          <div
            id={manualQrReaderIdRef.current}
            className="hidden"
            aria-hidden
          />
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
