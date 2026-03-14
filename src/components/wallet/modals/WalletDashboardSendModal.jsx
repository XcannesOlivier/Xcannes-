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
  const [showConfirmation, setShowConfirmation] = useState(false);

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
  const showManualForm = !hasPaymentRequest;
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
        className="inline-flex items-center gap-2 px-3 py-1.5 text-xs rounded-md border border-white/20 bg-white/15 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
      >
        <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/50">
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
      setShowConfirmation(false);
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
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
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
        <div className="text-xs uppercase tracking-wide text-white/50 font-semibold">
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
            noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"
          }
          selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
        />
        {sendFxInfo ? (
          <div className="text-xs text-white/50">
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

  const manualForm = showManualForm ? (
    <div className="space-y-4">
        <div>
            <label
              className="block text-base md:text-lg text-white/60 mb-1.5"
              title={t(
                "ui_send_destination_tip",
                "Adresse XRPL du destinataire.",
              )}
            >
              {t(
                "ui_destination_xrpl_address_9c2b94554c",
                "Destination (XRPL address)",
              )}
            </label>

            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <input
                    type="text"
                    list="saved-addresses"
                    value={sendDestination}
                    onChange={(e) => setSendDestination(e.target.value)}
                    onPaste={handlePastePayload}
                    placeholder={
                      (savedAddresses || []).length > 0
                        ? t(
                            "ui_select_saved_address_60c28f89c1",
                            "Select saved address...",
                          )
                        : t(
                            "ui_rxxxxxxxxxxxxxxxxxxxxxxxxxxx_26c99db80a",
                            "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                          )
                    }
                    className="w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px]"
                  />
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

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setScanActive(true);
                    setScanKey((prev) => prev + 1);
                  }}
                  className="px-4 py-4 rounded-xl border border-white/20 bg-transparent text-white/80 transition-all duration-200 hover:border-white/35 hover:bg-white/5 active:scale-95"
                  title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
                >
                  <svg
                    className="w-5 h-5 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                    />
                  </svg>
                </button>
              </div>

              {saveAddressBlock}
              {scanRequestFooter}
            </div>
          </div>
          <div className={`transition-opacity duration-300 space-y-4 ${hasDestination ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
          <div>
            <label
              className="block text-base md:text-lg text-white/60 mb-1.5"
              title={t(
                "ui_send_asset_tip",
                "Sélectionnez la devise à envoyer.",
              )}
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
                noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"
              }
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
            />
            {selectedSendToken && (
              <p className="mt-1 text-xs text-white/40">
                {t("ui_balance_340cdcff7a", "Balance:")}

                <span className="text-white/70">
                  {formatAmountWithSymbol(
                    locale,
                    selectedSendToken.value,
                    selectedSendToken.currency,
                    { minimumFractionDigits: 0, maximumFractionDigits: 6 },
                  )}
                </span>
              </p>
            )}
          </div>
          {sendPaymentRequest?.beneficiaryLabel ? (
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-xs text-amber-100/90">
              <span className="text-white/70">
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
                title={t(
                  "ui_send_amount_tip",
                  "Saisissez le montant à envoyer.",
                )}
              >
                {t("ui_amount_52cea2dd3d", "Amount")}
              </label>
              {showCalculatedAmountLabel ? (
                <span className="mb-1 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200/90">
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

          {sendFxInfo && (
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-xs font-semibold text-white/80">
                {t(
                  "ui_payment_fx_base_usd_r_gleme_4818b8a6c3",
                  "Paiement FX (base USD · règlement XRPL via USD)",
                )}
              </div>
              <p className="mt-1 text-xs text-white/60">
                ≈{" "}
                <span className="font-mono">
                  {formatAmountWithSymbol(
                    locale,
                    Number(sendFxInfo.paymentRlusd || 0),
                    "USD",
                    { minimumFractionDigits: 0, maximumFractionDigits: 6 },
                  )}
                </span>{" "}
                {t("ui_au_recipient_67dcc85cec", "au destinataire")}
              </p>
              {sendFxInfo.fxSource && (
                <p className="mt-1 text-xs text-white/60">
                  {t("ui_source_507c065942", "source")}{" "}
                  <span className="font-mono">
                    {String(sendFxInfo.fxSource).toUpperCase()}
                  </span>
                </p>
              )}
              <p className="mt-2 text-[11px] text-white/45">
                {t(
                  "ui_signatures_one_5b2c1a7d9f",
                  "1 signature: payment → recipient.",
                )}
              </p>
            </div>
          )}
        </div>
    </div>
  ) : null;

  /* ── Label helpers for confirmation ── */
  const confirmDestinationLabel =
    normalizedDestination.length > 14
      ? `${normalizedDestination.slice(0, 6)}…${normalizedDestination.slice(-4)}`
      : normalizedDestination;
  const confirmCurrencyCode = String(
    selectedSendToken?.currency || "",
  ).trim().toUpperCase();
  const confirmAmountLabel =
    Number.isFinite(normalizedSendAmount) && normalizedSendAmount > 0 && confirmCurrencyCode
      ? formatAmountWithSymbol(locale, normalizedSendAmount, confirmCurrencyCode, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 6,
        })
      : null;

  const confirmationView = showConfirmation ? (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* Summary card */}
      <div className="rounded-xl border border-[#22C55E]/25 bg-[#22C55E]/5 p-4 space-y-3">
        <div className="text-xs uppercase tracking-wide text-[#22C55E]/80 font-semibold">
          {t("ui_send_confirmation_title", "Résumé de l'envoi")}
        </div>
        <div className="space-y-2 text-sm text-white/80">
          {/* Destination */}
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_destination_xrpl_address_9c2b94554c", "Destination")}
            </span>
            <span className="font-mono text-white/80">
              {confirmDestinationLabel}
            </span>
          </div>
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
          {confirmAmountLabel ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60">
                {t("ui_amount_52cea2dd3d", "Amount")}
              </span>
              <span className="font-mono text-white/90">
                {confirmAmountLabel}
              </span>
            </div>
          ) : null}
          {/* FX info */}
          {sendFxInfo ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-white/60">
                {t("ui_fx_settlement", "Règlement XRPL")}
              </span>
              <span className="font-mono text-white/80">
                ≈ {formatAmountWithSymbol(locale, Number(sendFxInfo.paymentRlusd || 0), "USD", { maximumFractionDigits: 6 })}
              </span>
            </div>
          ) : null}
          {/* Balance */}
          {selectedSendToken ? (
            <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
              <span className="text-white/50 text-xs">
                {t("ui_balance_340cdcff7a", "Balance:")}
              </span>
              <span className="font-mono text-white/50 text-xs">
                {formatAmountWithSymbol(locale, selectedSendToken.value, selectedSendToken.currency, { minimumFractionDigits: 0, maximumFractionDigits: 6 })}
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Action buttons */}
      <div className="space-y-2">
        <SwipeConfirmButton
          label={
            sendProcessing
              ? t("ui_sending_3b8c1a7d5e", "Sending...")
              : t("ui_confirm_send", "Confirmer l'envoi")
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
          className={`hidden md:block w-full text-xl py-3.5 ${greenActionBtnBase}`}
        >
          {sendProcessing
            ? t("ui_sending_3b8c1a7d5e", "Sending...")
            : t("ui_confirm_send", "Confirmer l'envoi")}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowConfirmation(false);
          }}
          disabled={sendProcessing}
          className="w-full text-sm py-2 rounded-lg border border-white/15 bg-transparent text-white/70 hover:bg-white/5 hover:text-white transition-all duration-200"
        >
          {t("ui_back_modify", "← Modifier")}
        </button>
      </div>
    </div>
  ) : null;

  const sendActions = (
    <div className="pt-3 border-t border-white/10">
      <SwipeConfirmButton
        label={t("ui_send_504b64a87b", "Send")}
        onConfirm={() => setShowConfirmation(true)}
        disabled={!canManualSend}
        variant="green"
        className="md:hidden"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowConfirmation(true);
        }}
        disabled={!canManualSend}
        className={`hidden md:block w-full text-xl py-3.5 ${greenActionBtnBase}`}
      >
        {t("ui_send_504b64a87b", "Send")}
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
                  <span className="inline-flex items-center text-white/70 text-sm md:text-base font-semibold px-2 py-0.5 leading-none">
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
          <div>
            <div className="flex flex-col gap-4">
              {hasPaymentRequest ? (
                <>
                  {requestDetailsPanel}
                  {payreqCurrencySelectorBlock}
                  {saveAddressBlock}
                  {sendActions}
                </>
              ) : showConfirmation ? (
                <>
                  {confirmationView}
                </>
              ) : (
                <>
                  {manualForm}
                  {sendActions}
                  {scannerModal}
                </>
              )}
            </div>
          </div>
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
