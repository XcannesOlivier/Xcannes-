"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import ModalSelect from "@/components/ui/ModalSelect";
import DemoQRScanner from "../components/DemoQRScanner";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../demoWalletDashboardConfig";
import { greenActionBtnBase } from "./demoWalletModalTokens";
import { normalizeQrImageFile } from "../utils/demoQrImage";

const XRPL_ADDRESS_RE = /^(?:xrpl:)?r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const DEMO_ADDRESS_RE = /^[A-Za-z][A-Za-z0-9_]{10,}$/;

export default function DemoWalletDashboardSendModal({
  open,
  onClose,
  isPreviewMode = false,
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
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [saveNewAddress, setSaveNewAddress] = useState(false);
  const [saveNewAddressLabel, setSaveNewAddressLabel] = useState("");
  const [isDesktop, setIsDesktop] = useState(false);
  const [scanActive, setScanActive] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [selectedSavedLabel, setSelectedSavedLabel] = useState("");
  const savedPickerRef = useRef(null);
  const scanQrFileInputId = "send-qr-file";
  const manualQrReaderIdRef = useRef(
    `manual-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);
  const isDemoMode = noticeVariant === "demo";

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination],
  );
  const hasDestination = useMemo(() => {
    if (!normalizedDestination) return false;
    return (
      XRPL_ADDRESS_RE.test(normalizedDestination) ||
      DEMO_ADDRESS_RE.test(normalizedDestination)
    );
  }, [normalizedDestination]);
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

      let decodedText;
      try {
        decodedText = await instance.scanFile(scanFile, true);
      } catch (err) {
        if (scanFile !== file) {
          decodedText = await instance.scanFile(file, true);
        } else {
          throw err;
        }
      }
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
          "Unable to decode this image. Try a clearer screenshot.",
        ),
      );
    }
  };
  const looksLikeXrplAddress = (value) =>
    /^(?:xrpl:)?r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(value);
  const looksLikeDemoAddress = (value) =>
    /^[A-Za-z][A-Za-z0-9_]{10,}$/.test(value);
  const looksLikeQrPayload = (value) => {
    const raw = String(value || "").trim();
    if (!raw) return false;
    if (/^xcannes-demo:/i.test(raw)) return true;
    if (looksLikeXrplAddress(raw)) return true;
    if (looksLikeDemoAddress(raw)) return true;
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
    return false;
  };
  const handleScan = (data) => {
    const result = handlePaymentRequestScan?.(data);
    if (result?.relayChallenge) return; // relay challenge forwarded to PWA — keep scanner active
    setScanActive(false);
  };
  const handleScanQrUpload = () => {
    const input = document.getElementById(scanQrFileInputId);
    input?.click();
  };

  // Close saved picker when clicking outside.
  useEffect(() => {
    if (!showSavedPicker) return;
    const handler = (e) => {
      if (
        savedPickerRef.current &&
        !savedPickerRef.current.contains(e.target)
      ) {
        setShowSavedPicker(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showSavedPicker]);

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setCameraUnavailable(false);
      setShowSavedPicker(false);
      setSelectedSavedLabel("");
    }
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
    if (!open) {
      setScanActive(false);
      return;
    }
    setCameraUnavailable(false);
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

  const manualForm = showManualForm ? (
    <div
      className={`space-y-3 ${inline ? "flex-1 min-h-0 flex flex-col" : ""}`}
    >
      <div
        className={
          inline
            ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(12px,2.2vh,26px)]"
            : "space-y-3"
        }
      >
        <div className={inline ? "space-y-3" : ""}>
          {/* ── Destination (same UX as real wallet) ── */}
          <div>
            <label
              className="block text-base md:text-lg text-white/60 mb-1.5"
              title={t(
                "ui_send_destination_tip",
                "Adresse XRPL du destinataire.",
              )}
            >
              {t("ui_send_to_label", "Envoyer à")}
            </label>
            <div className="relative" ref={savedPickerRef}>
              <input
                type="text"
                value={sendDestination}
                onChange={(e) => {
                  setSendDestination(e.target.value);
                  setSelectedSavedLabel("");
                  setShowSavedPicker(false);
                }}
                onPaste={handlePastePayload}
                placeholder={t(
                  "ui_import_or_choose_recipient",
                  "Import or choose address",
                )}
                className={`w-full bg-black/40 border border-white/15 rounded-xl ${
                  !hasPaymentRequest ? "pl-8" : "pl-4"
                } ${hasPaymentRequest ? "pr-4" : "pr-28"} py-3 text-base text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px]`}
              />

              {!hasPaymentRequest ? (
                <>
                  {/* Saved addresses picker */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSavedPicker((prev) => !prev);
                    }}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                    title={t("ui_saved_addresses_label", "Adresses enregistrées")}
                    aria-expanded={showSavedPicker}
                  >
                    <svg
                      className="w-4 h-4 text-white/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>

                  {/* Upload QR image */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleScanQrUpload();
                    }}
                    className="absolute right-11 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                    title={t(
                      "ui_or_upload_a_qr_image_works_e_df6baa8039",
                      "Charger une image qrcode",
                    )}
                  >
                    <span className="inline-flex h-9 w-9 items-center justify-center text-white/60 text-2xl leading-none">
                      +
                    </span>
                  </button>

                  {/* Scan QR camera */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setScanActive(true);
                      setScanKey((prev) => prev + 1);
                      setCameraUnavailable(false);
                    }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-transparent border-none outline-none cursor-pointer transition-transform duration-200 hover:scale-110 active:scale-95"
                    title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
                  >
                    <svg
                      className="w-7 h-7 text-white/60"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M3 3h6v6H3V3zm12 0h6v6h-6V3zM3 15h6v6H3v-6zm6-8H5m14 0h-2m2 10h-2m-8-2v2m10-2v2M15 15h6v6h-6v-6z"
                      />
                    </svg>
                  </button>
                </>
              ) : null}

              {!hasPaymentRequest && showSavedPicker ? (
                <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-lg border border-white/15 bg-black/90 backdrop-blur-sm overflow-hidden shadow-lg">
                  <div className="max-h-48 overflow-y-auto">
                    {(savedAddresses || []).length > 0 ? (
                      (savedAddresses || []).map((addr, idx) => (
                        <button
                          key={`${addr.address}-${idx}`}
                          type="button"
                          onClick={() => {
                            const value = String(addr?.address || "").trim();
                            if (!value) return;
                            const label = String(addr?.label || "").trim();
                            setSendDestination(value);
                            setSelectedSavedLabel(label);
                            setShowSavedPicker(false);
                          }}
                          className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/10 transition-colors"
                        >
                          <span className="block font-semibold">
                            {String(addr?.label || "").trim() ||
                              t("ui_wallet_unknown", "Unknown wallet")}
                          </span>
                          <span className="block font-mono text-[11px] text-white/60">
                            {addr.address}
                          </span>
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-white/60">
                        {t("ui_no_saved_addresses", "No saved addresses yet")}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>

            {selectedSavedLabel ? (
              <div className="mt-1 text-xs text-white/60">
                {t("ui_selected_wallet_label", "Sélectionné")}:{" "}
                <span className="text-white/80">{selectedSavedLabel}</span>
              </div>
            ) : null}
          </div>

          {/* ── Devise + Montant (same sizing as real wallet) ── */}
          <div
            className={[
              "transition-opacity duration-300 space-y-4",
              hasDestination
                ? "opacity-100"
                : "opacity-30 pointer-events-none select-none",
            ].join(" ")}
          >
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
                buttonClassName="bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer [&_.tabular-nums]:text-lg [&_.tabular-nums]:text-white/35"
                menuClassName={
                  noticeVariant === "demo"
                    ? "bg-xcannes-surface-demo"
                    : "bg-elevated"
                }
                selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-4 py-4 text-2xl text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px] appearance-none cursor-pointer"
              />
            </div>

            <div>
              <label
                className="block text-base md:text-lg text-white/60 mb-1.5"
                title={t(
                  "ui_send_amount_tip",
                  "Saisissez le montant à envoyer.",
                )}
              >
                {t("ui_amount_52cea2dd3d", "Amount")}
              </label>
              <TokenAmountInput
                value={sendAmount}
                onChange={setSendAmount}
                placeholder="0.0000"
                token={
                  selectedSendToken
                    ? selectLabelByAssetKey?.[selectedSendToken.currency] ||
                      selectedSendToken.currency
                    : "RLUSD"
                }
                tokenClassName="text-white/45 text-xl font-semibold"
                containerClassName="focus-within:!border-xcannes-green/80 !rounded-xl !bg-black/40 !border-white/15 py-4"
              />
            </div>

            {sendFxInfo && (
              <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="text-[11px] font-semibold text-white/80">
                  {t(
                    "ui_payment_fx_base_usd_r_gleme_4818b8a6c3",
                    "Paiement FX (base USD · règlement XRPL via USD)",
                  )}
                </div>
                <p className="mt-1 text-[11px] text-white/60">
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
                {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 && (
                  <p className="mt-1 text-[11px] text-white/60">
                    {t(
                      "ui_spread_xcannes_tier_7ad17576d3",
                      "Conversion fee (1%)",
                    )}
                    {sendFxInfo.fxSource ? (
                      <>
                        {" "}
                        · {t("ui_source_507c065942", "source")}{" "}
                        <span className="font-mono">
                          {String(sendFxInfo.fxSource).toUpperCase()}
                        </span>
                      </>
                    ) : (
                      <>
                        {" "}
                        ·{" "}
                        {t(
                          "ui_source_unknown_4c1a7d9b2e",
                          "unknown source",
                        )}
                      </>
                    )}
                    :{" "}
                    <span className="font-mono">
                      {formatAmountWithSymbol(
                        locale,
                        Number(sendFxInfo.spreadFeeRlusd || 0),
                        "USD",
                        { minimumFractionDigits: 0, maximumFractionDigits: 6 },
                      )}
                    </span>
                  </p>
                )}
                <p className="mt-2 text-[10px] text-white/40">
                  {Number(sendFxInfo.spreadFeeRlusd || 0) > 0
                    ? t(
                        "demo_send_flow_with_fee_f4",
                        "Demo: service fee (1%) applied, then payment → recipient.",
                      )
                    : t(
                        "demo_send_flow_simple_f4",
                        "Demo: payment → recipient.",
                      )}
                </p>
              </div>
            )}
          </div>

          {saveAddressBlock ? <div className="pt-1">{saveAddressBlock}</div> : null}
        </div>
      </div>
    </div>
  ) : null;

  const sendActions = (
    <div className={inline ? "mt-auto pt-2 border-t border-white/10" : ""}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={sendProcessing || !canManualSend}
        className={`w-full text-xl py-4 ${greenActionBtnBase}`}
      >
        {sendProcessing
          ? t("ui_sending_3b8c1a7d5e", "Sending...")
          : t("ui_send_504b64a87b", "Send")}
      </button>
    </div>
  );

  const scannerModal =
    scanActive && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[10002] flex flex-col">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-black/90 backdrop-blur-sm"
              onClick={() => {
                setScanActive(false);
                setCameraUnavailable(false);
              }}
            />
            {/* Scanner container */}
            <div className="relative flex-1 flex flex-col items-center justify-center">
              <button
                type="button"
                onClick={() => {
                  setScanActive(false);
                  setCameraUnavailable(false);
                }}
                className="absolute top-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white/80 hover:bg-white/20 hover:text-white transition-colors"
                aria-label={t("close", "Fermer")}
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
              <div className="flex-1 w-full">
                <DemoQRScanner
                  key={scanKey}
                  isOpen={true}
                  onScan={handleScan}
                  embedded={true}
                  edgeToEdge={true}
                  showClose={false}
                  enableCamera={true}
                  hideWhenUnavailable
                  onCameraUnavailableChange={setCameraUnavailable}
                  showFauxQrBackground={false}
                  className="bg-black w-full h-full flex flex-col justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />
              </div>
              {inline && cameraUnavailable ? (
                <div className="absolute bottom-6 left-4 right-4 rounded-xl border border-orange-400/30 bg-black/70 px-4 py-3 text-xs text-white/80 shadow-lg backdrop-blur-sm">
                  <div className="text-sm font-semibold text-white">
                    {t("ui_scanner_unavailable_title", "Scanner indisponible")}
                  </div>
                  <div className="mt-1 text-white/70">
                    {t(
                      "ui_scanner_unavailable_detail",
                      "La caméra n’est pas accessible sur ce poste. Importez un QR via le bouton + ou collez un code.",
                    )}
                  </div>
                </div>
              ) : null}
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
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => {
            if (!inline) e.stopPropagation();
          }}
        >
          <div className="flex items-start justify-between gap-3 mb-1 pr-6">
            <div className="flex min-w-0 flex-col gap-1.5">
              <div>
                {renderWalletMeta?.(
                  "pr-8 wallet-meta--plus-4 wallet-meta--desktop-gap [&_.font-mono]:hidden",
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
              {hasPaymentRequest ? (
                <>
                  {requestDetailsPanel}
                  {saveAddressBlock}
                </>
              ) : (
                <>
                  {manualForm}
                </>
              )}
              {scannerModal}
            </div>
          </div>
          {sendActions}
          <input
            id={scanQrFileInputId}
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
