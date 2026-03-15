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
import { apiUrl } from "@/lib/runtimeConfig";

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
  setSendDestinationLabel,
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
  const [scanActive, setScanActive] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [remoteDestinationLabel, setRemoteDestinationLabel] = useState("");
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const savedPickerRef = useRef(null);

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
      saveLabel: resolvedDestinationLabel,
    });
    if (result?.ok) {
      setSaveNewAddress(false);
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
    const text = (
      clipboard.getData("text") ||
      clipboard.getData("text/plain") ||
      ""
    ).trim();
    if (text) {
      event.preventDefault();
      if (looksLikeQrPayload(text)) {
        handlePaymentRequestScan?.(text);
        setScanActive(false);
        setShowSavedPicker(false);
        return true;
      }
      setSendDestination(text);
      setSendDestinationLabel?.("");
      setShowSavedPicker(false);
      return true;
    }

    const imageFromFiles = Array.from(clipboard.files || []).find(
      (file) => file?.type && file.type.startsWith("image/"),
    );
    if (imageFromFiles) {
      event.preventDefault();
      handleManualQrFile(imageFromFiles);
      setScanActive(false);
      setShowSavedPicker(false);
      return true;
    }

    const imageItem = Array.from(clipboard.items || []).find(
      (item) => item?.kind === "file" && item.type?.startsWith("image/"),
    );
    const imageFromItems = imageItem?.getAsFile();
    if (imageFromItems) {
      event.preventDefault();
      handleManualQrFile(imageFromItems);
      setScanActive(false);
      setShowSavedPicker(false);
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
      setScanActive(false);
      setShowSavedPicker(false);
    }
  }, [open]);

  useEffect(() => {
    if (!showSavedPicker) return;
    const handleOutside = (event) => {
      const target = event?.target;
      const container = savedPickerRef.current;
      if (!container || !target) return;
      if (!container.contains(target)) {
        setShowSavedPicker(false);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("touchstart", handleOutside, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("touchstart", handleOutside);
    };
  }, [showSavedPicker]);

  useEffect(() => {
    if (!canSaveDestination) {
      setSaveNewAddress(false);
    }
  }, [canSaveDestination]);

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
  const savedDestinationLabel = useMemo(() => {
    if (!normalizedDestination) return "";
    const entry = (savedAddresses || []).find(
      (addr) => String(addr?.address || "").trim() === normalizedDestination,
    );
    return entry?.label ? String(entry.label).trim() : "";
  }, [savedAddresses, normalizedDestination]);
  const resolvedDestinationLabel =
    savedDestinationLabel || sendDestinationLabel || remoteDestinationLabel;

  useEffect(() => {
    if (!hasDestination || hasPaymentRequest || savedDestinationLabel || sendDestinationLabel) {
      setRemoteDestinationLabel("");
      return;
    }

    let cancelled = false;
    const address = normalizedDestination;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          apiUrl(`/wallet/label?address=${encodeURIComponent(address)}`),
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || "Failed to load wallet label");
        }
        const label = String(data?.label || "").trim();
        if (!cancelled) setRemoteDestinationLabel(label);
      } catch {
        if (!cancelled) setRemoteDestinationLabel("");
      }
    }, 450);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    hasDestination,
    hasPaymentRequest,
    normalizedDestination,
    savedDestinationLabel,
    sendDestinationLabel,
  ]);

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
    </div>
  ) : null;

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
            <div className="relative" ref={savedPickerRef}>
              <input
                type="text"
                value={sendDestination}
                onChange={(e) => {
                  setSendDestination(e.target.value);
                  setSendDestinationLabel?.("");
                  setShowSavedPicker(false);
                }}
                onPaste={handlePastePayload}
                placeholder={t("ui_import_or_choose_recipient", "Import or choose your destinataire")}
                className={`w-full bg-black/40 border border-white/15 rounded-xl pl-4 ${hasPaymentRequest ? 'pr-4' : 'pr-28'} py-3 text-base text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px]`}
              />
              {!hasPaymentRequest && (
                <>
                  {(savedAddresses || []).length > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowSavedPicker((prev) => !prev);
                      }}
                      className="absolute right-20 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                      title={t("ui_saved_addresses_label", "Adresses enregistrées")}
                      aria-expanded={showSavedPicker}
                    >
                      <svg className="w-7 h-7 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                      </svg>
                    </button>
                  )}
                  {/* ── + upload QR image ── */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScanQrUpload();
                    }}
                    className="absolute right-11 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
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
              {!hasPaymentRequest && showSavedPicker && (savedAddresses || []).length > 0 ? (
                <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-white/15 bg-black/90 backdrop-blur-sm overflow-hidden shadow-lg">
                  <div className="max-h-48 overflow-y-auto">
                    {(savedAddresses || []).map((addr, idx) => (
                      <button
                        key={`${addr.address}-${idx}`}
                        type="button"
                        onClick={() => {
                          const value = String(addr?.address || "").trim();
                          if (!value) return;
                          setSendDestination(value);
                          setSendDestinationLabel?.(String(addr?.label || "").trim());
                          setShowSavedPicker(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10 transition-colors"
                      >
                        <span className="block font-semibold">
                          {addr.label || t("ui_wallet_unknown", "Unknown wallet")}
                        </span>
                        <span className="block font-mono text-[11px] text-white/60">
                          {addr.address}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
            {resolvedDestinationLabel ? (
              <div className="mt-1 text-xs text-white/60">
                {t("ui_selected_wallet_label", "Sélectionné")}:{' '}
                <span className="text-white/80">{resolvedDestinationLabel}</span>
              </div>
            ) : null}
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
              {resolvedDestinationLabel || t("ui_wallet_unknown", "Unknown wallet")}
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
