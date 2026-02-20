"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import QRScanner from "../components/QRScanner";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { QRCodeCanvas } from "qrcode.react";
import { useModalTransition } from "@/utils/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";
import { normalizeQrImageFile } from "@/utils/qrImage";

export default function WalletDashboardSendModal({
  open,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  qrSizingVariant = "default",
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
  setQrScannerOpen,
  handlePaymentRequestScan,
  handleSendSubmit,
  sendProcessing,
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
  const [requestText, setRequestText] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const payreqFileInputId = "payreq-qr-file";
  const manualQrFileInputId = "manual-qr-file";
  const manualQrReaderIdRef = useRef(
    `manual-qr-reader-${Math.random().toString(36).slice(2, 10)}`
  );
  const manualQrScannerRef = useRef(null);
  const manualQrDecor =
    "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240' viewBox='0 0 24 24' shape-rendering='crispEdges'%3E%3Crect width='24' height='24' fill='none'/%3E%3Crect x='0' y='0' width='7' height='7' fill='%23fff'/%3E%3Crect x='1' y='1' width='5' height='5' fill='%23000'/%3E%3Crect x='2' y='2' width='3' height='3' fill='%23fff'/%3E%3Crect x='17' y='0' width='7' height='7' fill='%23fff'/%3E%3Crect x='18' y='1' width='5' height='5' fill='%23000'/%3E%3Crect x='19' y='2' width='3' height='3' fill='%23fff'/%3E%3Crect x='0' y='17' width='7' height='7' fill='%23fff'/%3E%3Crect x='1' y='18' width='5' height='5' fill='%23000'/%3E%3Crect x='2' y='19' width='3' height='3' fill='%23fff'/%3E%3Crect x='9' y='3' width='1' height='1' fill='%23fff'/%3E%3Crect x='11' y='3' width='1' height='1' fill='%23fff'/%3E%3Crect x='13' y='4' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='6' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='6' width='1' height='1' fill='%23fff'/%3E%3Crect x='15' y='8' width='1' height='1' fill='%23fff'/%3E%3Crect x='8' y='9' width='1' height='1' fill='%23fff'/%3E%3Crect x='10' y='10' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='11' width='1' height='1' fill='%23fff'/%3E%3Crect x='14' y='12' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='13' width='1' height='1' fill='%23fff'/%3E%3Crect x='11' y='14' width='1' height='1' fill='%23fff'/%3E%3Crect x='13' y='15' width='1' height='1' fill='%23fff'/%3E%3Crect x='16' y='16' width='1' height='1' fill='%23fff'/%3E%3Crect x='18' y='17' width='1' height='1' fill='%23fff'/%3E%3Crect x='20' y='18' width='1' height='1' fill='%23fff'/%3E%3Crect x='12' y='18' width='1' height='1' fill='%23fff'/%3E%3Crect x='9' y='18' width='1' height='1' fill='%23fff'/%3E%3C/svg%3E";
  const isDemoMode = noticeVariant === "demo";
  const useDemoQrDecor = isDemoMode && isDesktop;
  const manualQrDecorSize = useDemoQrDecor ? "170px" : inline && isDesktop ? "120px" : "130px";
  const manualQrDecorOpacity = useDemoQrDecor ? 1 : 0.08;
  const fauxPayreqExample =
    '{"schema":"xcannes-payreq-v1","to":"rDEMO_WALLET_A_xxxxxxxxxxxxxxxxxxxxxxxx","targetCurrency":"RLUSD","displayAmount":10,"displayCurrency":"USD","amountRlusd":10,"fxRate":1,"fxSource":"PYTH","issuer":"rMxCKbEDwqr76QuheSUMdEGf4B9xJ8m5De","memo":"XCANNES","beneficiaryLabel":null,"createdAt":"2026-02-07T15:16:38.139Z"}';
  const showFauxPayreq = false;
  const useDexStyleLayout = isDesktop && (noticeVariant !== "demo" || !inline);
  const showManualQrUpload = useDexStyleLayout;
  const showRealDesktopQrImage = !isDemoMode && isDesktop;
  const showManualStaticQr = isDesktop;
  const useDexSizing = inline || qrSizingVariant === "dex";
  const fauxPayreqTextClass = isDemoMode && isDesktop
    ? "text-[11px] text-white/70"
    : isDemoMode
      ? "text-[10px] text-white/70"
      : showFauxPayreq && !inline
        ? "text-[9px] text-white/10"
        : "text-[10px] text-white/15";
  const fauxPayreqOverlay = showFauxPayreq ? (
    <div className={`h-full w-full overflow-y-auto pr-2 leading-snug font-mono whitespace-pre-wrap break-words ${fauxPayreqTextClass}`}>
      {fauxPayreqExample}
    </div>
  ) : null;
  const fauxQrSize = inline ? (isDesktop ? "120px" : "200px") : "160px";
  const fauxQrOpacity = inline ? 0.08 : 0.06;
  const demoQrSize = useDexSizing ? 200 : 160;

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination]
  );
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
  const hasPaymentRequest = Boolean(sendPaymentRequest);
  const showManualForm = !hasPaymentRequest;
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
      const instance =
        manualQrScannerRef.current || new Html5Qrcode(readerId);
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
      alert(
        t(
          "ui_qr_decode_failed_3b5d7f9a2c",
          "Unable to decode this image. Try a clearer screenshot."
        )
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
    if (raw.startsWith("{") && /"to"|"targetCurrency"|"schema"|"payreq"/i.test(raw)) {
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
    const text = clipboard.getData("text") || "";
    if (looksLikeQrPayload(text)) {
      event.preventDefault();
      handlePaymentRequestScan?.(text);
      setScanActive(false);
      return true;
    }
    const items = clipboard.items || [];
    for (const item of items) {
      if (item.kind === "file" && String(item.type || "").startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          event.preventDefault();
          void handleManualQrFile(file);
          return true;
        }
      }
    }
    return false;
  };
  const handleScan = (data) => {
    handlePaymentRequestScan?.(data);
    setScanActive(false);
  };
  const handleScanAgain = () => {
    setScanActive(true);
    setScanKey((prev) => prev + 1);
    setCameraUnavailable(false);
  };
  const handleScanQrUpload = () => {
    const input = document.getElementById(payreqFileInputId);
    input?.click();
  };
  const scanRequestFooter = (
    <div className={inline ? "space-y-6 mt-auto pt-2 border-t border-white/10" : "space-y-6"}>
      {!cameraUnavailable ? (
        <div className="flex items-center gap-3 text-xs md:text-sm text-white/35">
          <span className="h-px flex-1 bg-white/10" />
          <span className="text-base md:text-lg font-semibold text-white/60">
            {t("ui_or_8a4c1f83bd", "ou")}
          </span>
          <span className="h-px flex-1 bg-white/10" />
        </div>
      ) : null}

      <div
        className={`rounded-lg border border-white/5 bg-white/5 p-3 space-y-2 md:rounded-xl md:border-white/10 md:bg-black/30 md:p-4 md:space-y-3 ${
          inline ? "flex-1 min-h-0 flex flex-col" : ""
        }`}
      >
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between md:gap-3">
          <div className="text-[11px] text-white/45 md:text-xs md:text-white/60">
            {t("demo_payreq_token", "Enter your QR code")}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleScanQrUpload();
            }}
            className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-md border border-white/20 bg-white/15 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
          >
            <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/50">
              +
            </span>
            {t(
              "ui_or_upload_a_qr_image_works_e_df6baa8039",
              "Charger une image qrcode"
            )}
          </button>
        </div>
        <div className="relative">
          {showFauxPayreq ? (
            <div
              aria-hidden="true"
              className="absolute inset-0 p-3 pointer-events-none"
            >
              {fauxPayreqOverlay}
            </div>
          ) : null}
          <textarea
            value={requestText}
            onChange={(e) => setRequestText(e.target.value)}
            onPaste={handlePastePayload}
            className={`relative w-full min-h-[110px] overflow-y-auto rounded-md bg-black/40 border border-white/10 px-3 py-2 text-xs text-white/80 placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-xcannes-green/30 font-mono md:min-h-[140px] md:border-white/15 md:bg-black/50 ${
              inline ? "flex-1 min-h-[160px]" : ""
            }`}
            placeholder={t(
              "ui_payreq_placeholder_3a9c1b7d2e",
              "xcannes-payreq:... / JSON"
            )}
          />
        </div>
      </div>
    </div>
  );

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setRequestText("");
      setCameraUnavailable(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) {
      setScanActive(false);
      return;
    }
    setScanActive(true);
    setScanKey((prev) => prev + 1);
    setCameraUnavailable(false);
  }, [open]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const media = window.matchMedia("(min-width: 768px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    if (media.addEventListener) {
      media.addEventListener("change", handleChange);
      return () => media.removeEventListener("change", handleChange);
    }
    media.addListener(handleChange);
    return () => media.removeListener(handleChange);
  }, []);

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
    "relative w-full wallet-modal-panel wallet-send-modal border border-white/10 p-4 md:p-5 space-y-3 md:space-y-4 overflow-y-auto flex flex-col min-h-0 overscroll-contain pointer-events-auto",
    inline ? "h-full max-h-none rounded-xl" : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline ? (isClosing ? "wallet-modal-lift-out" : "wallet-modal-lift-in") : "",
  ].join(" ");

  const requestDetailsPanel = hasPaymentRequest ? (
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
      {saveNewAddress ?
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
        </div> :
        null}
    </div>
  ) : null;

  const manualForm = showManualForm ? (
    <div className={`space-y-3 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}>
      <div className={inline ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(12px,2.2vh,26px)]" : "space-y-3"}>
        <div className={inline ? "space-y-3" : ""}>
          <div>
            <label
              className="block text-[11px] md:text-xs text-white/60 mb-1"
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
              buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
              menuClassName={noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated"}
              selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
            />
            {selectedSendToken &&
              <p className="mt-1 text-[11px] text-white/40">{t("ui_balance_340cdcff7a", "Balance:")}

                <span className="text-white/70">
                  {formatAmountWithSymbol(
                    locale,
                    selectedSendToken.value,
                    selectedSendToken.currency,
                    { minimumFractionDigits: 0, maximumFractionDigits: 6 }
                  )}
                </span>
              </p>
            }
          </div>
          {sendPaymentRequest?.beneficiaryLabel ?
            <div className="rounded-lg border border-amber-300/20 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100/90">
              <span className="text-white/70">{t("ui_beneficiary_label", "Bénéficiaire")}:</span>{" "}
              <span className="font-semibold">{String(sendPaymentRequest.beneficiaryLabel)}</span>
            </div> :
            null}
          <div>
            <div className="flex items-center justify-between">
              <label
                className="block text-[11px] md:text-xs text-white/60 mb-1"
                title={t("ui_send_amount_tip", "Saisissez le montant à envoyer.")}
              >
                {t("ui_amount_52cea2dd3d", "Amount")}

              </label>
              {showCalculatedAmountLabel ?
                <span className="mb-1 inline-flex items-center rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-0.5 text-[10px] text-amber-200/90">
                  {t("ui_calculated_amount_label", "Montant calculé")}
                </span> :
                null}
            </div>
            <TokenAmountInput
              value={sendAmount}
              onChange={setSendAmount}
              max={sendFxInfo ? undefined : selectedSendToken ? selectedSendToken.value : undefined}
              placeholder="0.0000"
              token={
                selectedSendToken
                  ? selectLabelByAssetKey?.[selectedSendToken.currency] || selectedSendToken.currency
                  : "RLUSD"
              }
              tokenClassName="text-white"
              containerClassName="focus-within:!border-xcannes-green/80" />

          </div>

          {sendFxInfo &&
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="text-[11px] font-semibold text-white/80">{t("ui_payment_fx_base_usd_r_gleme_4818b8a6c3", "Paiement FX (base USD · règlement XRPL via USD)")}

              </div>
              <p className="mt-1 text-[11px] text-white/60">
                ≈{" "}
                <span className="font-mono">
                  {formatAmountWithSymbol(
                    locale,
                    Number(sendFxInfo.paymentRlusd || 0),
                    "USD",
                    { minimumFractionDigits: 0, maximumFractionDigits: 6 }
                  )}

                </span>{" "}{t("ui_au_recipient_67dcc85cec", "au destinataire")}

              </p>
              {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 &&
                <p className="mt-1 text-[11px] text-white/60">
                  {t("ui_spread_xcannes_tier_7ad17576d3", "Conversion fee (1%)")}
                  {sendFxInfo.fxSource ? (
                    <>
                      {" "}· {t("ui_source_507c065942", "source")}{" "}
                      <span className="font-mono">{String(sendFxInfo.fxSource).toUpperCase()}</span>
                    </>
                  ) : (
                    <>{" "}· {t("ui_source_unknown_4c1a7d9b2e", "unknown source")}</>
                  )}
                  :{" "}
                  <span className="font-mono">
                    {formatAmountWithSymbol(
                      locale,
                      Number(sendFxInfo.spreadFeeRlusd || 0),
                      "USD",
                      { minimumFractionDigits: 0, maximumFractionDigits: 6 }
                    )}
                  </span>
                </p>
              }
              <p className="mt-2 text-[10px] text-white/45">
                {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 ?
                  t(
                    "ui_xumm_signatures_two_8d1c7a2b9e",
                    "2 Xumm signatures: conversion fee (1%) → XCANNES, then payment → recipient."
                  ) :
                  t(
                    "ui_xumm_signatures_one_5b2c1a7d9f",
                    "1 Xumm signature: payment → recipient."
                  )}
              </p>
            </div>
          }
        </div>
        <div className={inline ? "space-y-2" : ""}>
          {showManualQrUpload ?
            <div className="space-y-3">
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const input = document.getElementById(manualQrFileInputId);
                    input?.click();
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-[11px] rounded-md border border-white/20 bg-white/15 text-white/90 transition-colors hover:bg-white/20 hover:text-white"
                >
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded border border-white/10 text-white/50">
                    +
                  </span>
                  {t(
                    "ui_upload_recipient_qr_code_1e7c2d9a5b",
                    "Charger le QR code de l'adresse du destinataire"
                  )}
                </button>
              </div>
              <div className="relative w-full rounded-xl border border-white/10 bg-black/30 p-3 space-y-3 overflow-hidden md:p-6 md:space-y-4 md:min-h-[180px]">
                <div
                  aria-hidden="true"
                  className="absolute inset-0 pointer-events-none bg-center bg-no-repeat"
                  style={{
                    backgroundImage: showManualStaticQr ? "none" : `url("${manualQrDecor}")`,
                    backgroundSize: `${manualQrDecorSize} ${manualQrDecorSize}`,
                    opacity: manualQrDecorOpacity,
                  }}
                />
                {showManualStaticQr ? (
                  <div className="relative z-10 flex items-center justify-center">
                    <div className="rounded-lg border border-white/10 bg-black/60 p-2">
                      <div
                        className={showRealDesktopQrImage ? "opacity-90" : ""}
                        style={showRealDesktopQrImage ? { filter: "brightness(0.15)" } : undefined}
                      >
                        <QRCodeCanvas
                          value={fauxPayreqExample}
                          size={demoQrSize}
                          bgColor="#000000"
                          fgColor="#ffffff"
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
                <input
                  id={manualQrFileInputId}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    e.target.value = "";
                    handleManualQrFile(file);
                  }} />
              </div>
            </div> :
            null}
          <div>
            <label
              className="block text-[11px] md:text-xs text-white/60 mb-1"
              title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
            >
              {t("ui_destination_xrpl_address_9c2b94554c", "Destination (XRPL address)")}

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
                    placeholder={(savedAddresses || []).length > 0 ?
                      t("ui_select_saved_address_60c28f89c1", "Select saved address...") :
                      t("ui_rxxxxxxxxxxxxxxxxxxxxxxxxxxx_26c99db80a", "rXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")}
                    className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px]" />
                  <datalist id="saved-addresses">
                    {(savedAddresses || []).map((addr, idx) =>
                      <option
                        key={idx}
                        value={addr.address}
                        label={`${addr.label} (${addr.address.slice(0, 8)}...${addr.address.slice(-6)})`} />
                    )}
                  </datalist>
                </div>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setQrScannerOpen(true);
                  }}
                  className="md:hidden px-3 py-2.5 rounded-lg border border-white/20 bg-transparent text-white/80 transition-all duration-200 hover:border-white/35 hover:bg-white/5 active:scale-95"
                  title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}>

                  <svg
                    className="w-5 h-5 text-white/80"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24">

                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />

                  </svg>
                </button>
              </div>

              {saveAddressBlock}
            </div>
          </div>
        </div>
      </div>
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

  const scannerPanel = (
    <div className={`space-y-2 ${inline ? "" : "-mx-4 md:-mx-5"}`}>
      {scanActive ? (
        <QRScanner
          key={scanKey}
          isOpen={true}
          onScan={handleScan}
          embedded={true}
          showClose={false}
          fileInputId={payreqFileInputId}
          enableCamera={true}
          hideWhenUnavailable={isDesktop}
          onCameraUnavailableChange={setCameraUnavailable}
          showFauxQrBackground={showFauxPayreq}
          fauxQrBackgroundSize={fauxQrSize}
          fauxQrBackgroundOpacity={fauxQrOpacity}
          className="bg-black/30 border-white/10"
        />
      ) : (
        <div className={`rounded-xl border border-white/10 bg-black/30 px-3 py-2 flex items-center justify-between ${inline ? "" : "mx-4 md:mx-5"}`}>
          <span className="text-xs text-white/60">
            {t("ui_scan_qr_code_481606b590", "Scan QR Code")}
          </span>
          <button
            type="button"
            onClick={handleScanAgain}
            className="text-[11px] px-2.5 py-1 rounded-md border border-white/20 bg-white/10 text-white/80 hover:bg-white/15"
          >
            {t("ui_scan_again", "Scanner")}
          </button>
        </div>
      )}
    </div>
  );

  const content =
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
            <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
              {t("ui_send_assets_title_2c9b1a7d5e", "Send assets")}
            </h3>
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
              {hasPaymentRequest ? (
                <>
                  {requestDetailsPanel}
                  {saveAddressBlock}
                  {sendActions}
                </>
              ) : (
                <>
                  {scannerPanel}
                  {scanActive ? scanRequestFooter : null}
                  {!scanActive ? (
                    <>
                      {manualForm}
                      {sendActions}
                    </>
                  ) : null}
                </>
              )}
            </div>
          </div>
          <div id={manualQrReaderIdRef.current} className="hidden" aria-hidden />

        </div>
      </div>
    </>;


  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
