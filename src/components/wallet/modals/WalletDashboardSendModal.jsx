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
  const [useLabelDisplay, setUseLabelDisplay] = useState(false);
  const [destinationFocused, setDestinationFocused] = useState(false);
  const [autoShowLabelOnce, setAutoShowLabelOnce] = useState(false);
  const [showFullPayreqAddress, setShowFullPayreqAddress] = useState(false);
  const [scanUnavailable, setScanUnavailable] = useState(false);
  const [editingRecipient, setEditingRecipient] = useState(true);
  const savedPickerRef = useRef(null);
  const destinationInputRef = useRef(null);
  const recipientAutoCollapsedRef = useRef(false);

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
    enableSaveAddress &&
    normalizedDestination &&
    !isSavedDestination &&
    !String(sendDestinationLabel || remoteDestinationLabel || "").trim();
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
        setUseLabelDisplay(false);
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
    const imageFromFiles = Array.from(clipboard.files || []).find(
      (file) => file?.type && file.type.startsWith("image/"),
    );
    const imageItem = Array.from(clipboard.items || []).find(
      (item) => item?.kind === "file" && item.type?.startsWith("image/"),
    );
    const imageFromItems = imageItem?.getAsFile();
    const imageFromClipboard = imageFromFiles || imageFromItems || null;

    const dataUrlToFile = (dataUrl) => {
      const match = String(dataUrl || "").match(
        /^data:image\/([a-z0-9+.-]+);base64,(.+)$/i,
      );
      if (!match) return null;
      try {
        const mime = `image/${match[1].toLowerCase()}`;
        const binary = atob(match[2]);
        const len = binary.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i += 1) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mime });
        return new File([blob], "pasted-qr", { type: mime });
      } catch {
        return null;
      }
    };

    if (text) {
      event.preventDefault();
      setUseLabelDisplay(false);
      if (looksLikeQrPayload(text)) {
        handlePaymentRequestScan?.(text);
        setScanActive(false);
        setShowSavedPicker(false);
        return true;
      }
      const dataUrlFile = dataUrlToFile(text);
      if (dataUrlFile) {
        handleManualQrFile(dataUrlFile);
        setScanActive(false);
        setShowSavedPicker(false);
        return true;
      }
      if (imageFromClipboard) {
        handleManualQrFile(imageFromClipboard);
        setScanActive(false);
        setShowSavedPicker(false);
        return true;
      }
      setSendDestination(text);
      setSendDestinationLabel?.("");
      setShowSavedPicker(false);
      // If the user pasted a raw XRPL address, show its label ASAP once resolved
      // (saved address label or on-chain label lookup).
      if (looksLikeXrplAddress(text)) setAutoShowLabelOnce(true);
      return true;
    }

    if (imageFromClipboard) {
      event.preventDefault();
      setUseLabelDisplay(false);
      handleManualQrFile(imageFromClipboard);
      setScanActive(false);
      setShowSavedPicker(false);
      return true;
    }

    return false;
  };
  const handleScan = (data) => {
    setUseLabelDisplay(false);
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
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      handlePaymentRequestScan?.(text);
    } catch {
      // Clipboard permissions can be denied; ignore silently.
    }
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
      setUseLabelDisplay(false);
      setShowFullPayreqAddress(false);
      setScanUnavailable(false);
    }
  }, [open]);

  useEffect(() => {
    if (!scanActive) {
      setScanUnavailable(false);
    }
  }, [scanActive]);

  useEffect(() => {
    setShowFullPayreqAddress(false);
  }, [requestDestination]);

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

  useEffect(() => {
    if (!open) {
      setEditingRecipient(true);
      recipientAutoCollapsedRef.current = false;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (hasPaymentRequest) return;
    if (!hasDestination) {
      setEditingRecipient(true);
      recipientAutoCollapsedRef.current = false;
      return;
    }
    if (!recipientAutoCollapsedRef.current) {
      setEditingRecipient(false);
      recipientAutoCollapsedRef.current = true;
    }
  }, [open, hasDestination, hasPaymentRequest]);

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
    const label = String(
      entry?.onChainLabel || entry?.label || "",
    ).trim();
    return label;
  }, [savedAddresses, normalizedDestination]);
  const resolvedDestinationLabel =
    savedDestinationLabel || sendDestinationLabel || remoteDestinationLabel;
  const shouldShowLabelInInput =
    Boolean(resolvedDestinationLabel) &&
    Boolean(useLabelDisplay) &&
    !hasPaymentRequest;
  const destinationDisplayValue = shouldShowLabelInInput
    ? resolvedDestinationLabel
    : sendDestination;

  const compactDestinationLabel = normalizedDestination
    ? normalizedDestination.length > 14
      ? `${normalizedDestination.slice(0, 6)}…${normalizedDestination.slice(-4)}`
      : normalizedDestination
    : "";

  // If we resolved a label (saved/on-chain) and the user isn't typing, show it in the input.
  useEffect(() => {
    if (destinationFocused) return;
    if (!hasDestination) return;
    if (hasPaymentRequest) return;
    if (!String(resolvedDestinationLabel || "").trim()) return;
    setUseLabelDisplay(true);
  }, [
    destinationFocused,
    hasDestination,
    hasPaymentRequest,
    resolvedDestinationLabel,
  ]);

  // Special case: after paste, flip to label as soon as it's available (even if still focused).
  useEffect(() => {
    if (!autoShowLabelOnce) return;
    if (hasPaymentRequest) return;
    if (!hasDestination) return;
    if (!String(resolvedDestinationLabel || "").trim()) return;
    setUseLabelDisplay(true);
    setAutoShowLabelOnce(false);
  }, [
    autoShowLabelOnce,
    hasPaymentRequest,
    hasDestination,
    resolvedDestinationLabel,
  ]);

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
        if (!cancelled) {
          setRemoteDestinationLabel(label);
          // Propagate so the send flow can reuse it (progress screen, etc.)
          if (label) setSendDestinationLabel?.(label);
        }
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
    setSendDestinationLabel,
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

  const recipientCard = !hasPaymentRequest ? (
    <div>
      <label
        className="block text-base md:text-lg text-white/60 mb-1.5"
        title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
      >
        {t("ui_send_to_label", "Destinataire")}
      </label>

      {editingRecipient || !hasDestination ? (
        <>
          <div className="relative" ref={savedPickerRef}>
            <input
              ref={destinationInputRef}
              type="text"
              value={destinationDisplayValue}
              onChange={(e) => {
                setAutoShowLabelOnce(false);
                setUseLabelDisplay(false);
                setSendDestination(e.target.value);
                setSendDestinationLabel?.("");
                setShowSavedPicker(false);
              }}
              onFocus={() => {
                setDestinationFocused(true);
                // When focusing, reveal the address so the user can edit/copy it.
                setUseLabelDisplay(false);
              }}
              onBlur={() => {
                setDestinationFocused(false);
              }}
              onClick={() => {
                // If we're showing a label (readOnly), allow a click to reveal the address immediately.
                if (shouldShowLabelInInput) setUseLabelDisplay(false);
              }}
              onPaste={handlePastePayload}
              placeholder={t(
                "ui_import_or_choose_recipient",
                "Import or choose address",
              )}
              readOnly={shouldShowLabelInInput}
              className={`w-full bg-black/40 border border-white/15 rounded-xl ${
                !hasPaymentRequest ? "pl-8" : "pl-4"
              } ${hasPaymentRequest ? "pr-4" : "pr-28"} py-3 text-base text-white outline-none focus:border-xcannes-green/80 focus:border-[0.5px]`}
            />

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowSavedPicker((prev) => !prev);
              }}
              className="absolute left-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t("ui_saved_addresses_label", "Adresses enregistrées")}
              aria-expanded={showSavedPicker}
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleScanQrUpload();
              }}
              className="absolute right-11 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t(
                "ui_or_upload_a_qr_image_works_e_df6baa8039",
                "Charger une image qrcode",
              )}
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScanActive(true);
                setScanKey((prev) => prev + 1);
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </button>

            {showSavedPicker ? (
              <div className="absolute left-0 right-0 top-full mt-2 z-20 rounded-xl border border-white/10 bg-elevated overflow-hidden shadow-lg">
                <div className="max-h-56 overflow-y-auto">
                  {(savedAddresses || []).length > 0 ? (
                    (savedAddresses || []).map((addr, idx) => (
                      <button
                        key={`${addr.address}-${idx}`}
                        type="button"
                        onClick={() => {
                          const value = String(addr?.address || "").trim();
                          if (!value) return;
                          const label = String(
                            addr?.onChainLabel || addr?.label || "",
                          ).trim();
                          setSendDestination(value);
                          setSendDestinationLabel?.(label);
                          setUseLabelDisplay(Boolean(label));
                          setShowSavedPicker(false);
                          setEditingRecipient(false);
                        }}
                        className="w-full text-left px-3 py-2 text-xs text-white/90 hover:bg-white/5 transition-colors"
                      >
                        <span className="block font-semibold">
                          {String(
                            addr?.onChainLabel || addr?.label || "",
                          ).trim() ||
                            t("ui_wallet_unknown", "Unknown wallet")}
                        </span>
                        <span className="block font-mono text-[11px] text-white/60 truncate">
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

          {hasDestination && resolvedDestinationLabel ? (
            <div className="mt-1 text-[11px] text-white/40">
              {t("ui_selected_wallet_label", "Sélectionné")} :{" "}
              <span className="text-white/60">{resolvedDestinationLabel}</span>
            </div>
          ) : null}

          {hasDestination ? saveAddressBlock : null}
        </>
      ) : (
        <div className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-3 hover:bg-white/5 transition-colors flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setEditingRecipient(true);
              setShowSavedPicker(false);
              setUseLabelDisplay(false);
              requestAnimationFrame(() => {
                destinationInputRef.current?.focus?.();
              });
            }}
            className="min-w-0 text-left flex-1"
          >
            <div className="text-sm font-semibold text-white/90 truncate">
              {resolvedDestinationLabel ||
                t("ui_wallet_unknown", "Unknown wallet")}
            </div>
            <div className="mt-0.5 text-[12px] font-mono text-white/50 truncate">
              {compactDestinationLabel}
            </div>
          </button>

          <div className="flex items-center gap-1 text-white/60 shrink-0">
            <button
              type="button"
              onClick={() => {
                setEditingRecipient(true);
                setShowSavedPicker(false);
                setUseLabelDisplay(false);
                requestAnimationFrame(() => {
                  destinationInputRef.current?.focus?.();
                });
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title={t("ui_change_recipient", "Changer le destinataire")}
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
                  d="M15 5l4 4M4 20h4l10.5-10.5a2 2 0 000-2.8l-1.2-1.2a2 2 0 00-2.8 0L4 16v4z"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleScanQrUpload();
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title={t(
                "ui_or_upload_a_qr_image_works_e_df6baa8039",
                "Charger une image qrcode",
              )}
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3"
                />
              </svg>
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setScanActive(true);
                setScanKey((prev) => prev + 1);
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors"
              title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  ) : null;

  const manualForm = (
    <div className="space-y-3">
        {/* ── Destination ── */}
        {recipientCard}

        {/* ── Devise + Montant (séparés) – masqués en mode payreq ── */}
        {!hasPaymentRequest && (
        <div className={`transition-opacity duration-300 space-y-4 ${hasDestination ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
          <div>
            <label
              className="block text-base md:text-lg text-white/60 mb-1.5"
              title={t("ui_send_asset_tip", "Sélectionnez la devise à envoyer.")}
            >
              {t("ui_asset_e5170a7a06", "Devise")}
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
                {t("ui_amount_52cea2dd3d", "Montant")}
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
              tokenClassName="text-white drop-shadow-sm text-xl"
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
      <div className="text-[11px] text-white/45">
        {t(
          "ui_verify_before_sending",
          "Vérifiez les informations avant d’envoyer",
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-4">
        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
          {t("ui_send_confirmation_title", "Résumé de l'envoi")}
        </div>
        <div className="space-y-3 text-sm text-white/80">
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60 shrink-0">
              {t("ui_beneficiary_label", "Destinataire")}
            </span>
            <span className="font-semibold text-white/90">
              {resolvedDestinationLabel || t("ui_wallet_unknown", "Unknown wallet")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_amount_52cea2dd3d", "Montant")}
            </span>
            <span className={`font-mono ${summaryAmount > 0 ? 'text-white/90' : 'text-white/40'}`}>
              {confirmAmountLabel || '0'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">{t("ui_fees", "Frais")}</span>
            <span className="font-mono text-white/70">
              {formatAmountWithSymbol(locale, 0, "USD", {
                minimumFractionDigits: 0,
                maximumFractionDigits: 6,
              })}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-1 border-t border-white/10">
            <span className="text-white/70 font-semibold">
              {t("ui_total", "Total")}
            </span>
            <span className="font-mono text-white/90 font-semibold">
              {confirmAmountLabel || "0"}
            </span>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  /* ── Payreq final step – shown when a payment request was scanned ── */
  const payreqFinalStep = hasPaymentRequest ? (
    <div className="space-y-4">
      {/* 1) Recipient input */}
      <div className="space-y-2">
        <label className="block text-base md:text-lg text-white/60">
          {t("ui_send_to_label", "Destinataire")}
        </label>
        <div className="relative">
          <input
            type="text"
            value={requestDestination}
            readOnly
            className="w-full bg-[#0F141A] border border-white/10 rounded-xl px-4 pr-24 py-3 text-base text-white/90 outline-none truncate focus:border-xcannes-green/80"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
            <button
              type="button"
              onClick={handlePasteFromClipboard}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t("ui_paste", "Coller")}
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
                  d="M9 5h6a2 2 0 012 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3h6v2H9V3z"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={handleScanQrUpload}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t(
                "ui_or_upload_a_qr_image_works_e_df6baa8039",
                "Charger une image qrcode",
              )}
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
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1M12 4v12m0 0l-3-3m3 3l3-3"
                />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setScanActive(true);
                setScanKey((prev) => prev + 1);
              }}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors text-white/60"
              title={t("ui_scan_qr_code_12fa63d927", "Scan QR Code")}
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                />
              </svg>
            </button>
          </div>
        </div>
        <div className="text-xs text-white/45 space-y-0.5">
          <div className="text-white/70 font-semibold">
            {requestBeneficiaryLabel || t("ui_wallet_unknown", "Unknown wallet")}
          </div>
          <div className="font-mono">{requestDestinationLabel}</div>
          <div className="text-white/50">{t("ui_valid_address", "Adresse valide")}</div>
        </div>
      </div>

      {/* 2) Divider */}
      <div className="h-px bg-white/5 my-2" />

      {/* 3) Summary */}
      <div className="space-y-2">
        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
          {t("ui_summary", "Résumé")}
        </div>
        <div className="text-[11px] text-white/45">
          {t(
            "ui_verify_before_sending",
            "Vérifiez les informations avant d’envoyer",
          )}
        </div>
        <div className="rounded-xl border border-white/10 bg-black/20 p-4 space-y-3">
          <div className="space-y-0.5">
            <div className="text-[11px] text-white/45">
              {t("ui_beneficiary_label", "Destinataire")}
            </div>
            <div className="text-sm font-semibold text-white/90">
              {requestBeneficiaryLabel || t("ui_wallet_unknown", "Unknown wallet")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-white/45">
              {t("ui_address", "Adresse")}
            </div>
            <div className="font-mono text-xs text-white/80">
              {requestDestinationLabel}
            </div>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-[11px] text-white/45">
                {t("ui_currency_label", "Devise")}
              </div>
              <div className="text-sm text-white/90">
                {requestCurrencyCode || confirmCurrencyCode || "—"}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[11px] text-white/45">
                {t("ui_amount_52cea2dd3d", "Montant")}
              </div>
              <div className="text-lg font-semibold text-white/95">
                {requestAmountLabel || "—"}
              </div>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 border-t border-white/10">
            <span className="text-[11px] text-white/45">
              {t("ui_fees", "Frais")}
            </span>
            <span className="font-mono text-xs text-white/70">
              {formatAmountWithSymbol(
                locale,
                Number(sendFxInfo?.spreadFeeRlusd || 0),
                "USD",
                { minimumFractionDigits: 0, maximumFractionDigits: 6 },
              )}
            </span>
          </div>
        </div>

        {canSaveDestination ? (
          <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
            <label className="flex items-center gap-2 text-xs text-white/60">
              <input
                type="checkbox"
                checked={saveNewAddress}
                onChange={(e) => setSaveNewAddress(e.target.checked)}
                className="accent-xcannes-green"
              />
              {t(
                "ui_save_this_address_fr",
                "Enregistrer cette adresse",
              )}
            </label>
          </div>
        ) : null}
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
              {
                currency: String(selectedSendToken?.currency || "").toUpperCase(),
              },
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
                onCameraUnavailableChange={setScanUnavailable}
                className="bg-black w-full h-full flex flex-col justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
              />
            </div>
            {inline && scanUnavailable ? (
              <div className="absolute bottom-6 left-4 right-4 rounded-xl border border-orange-400/30 bg-black/70 px-4 py-3 text-xs text-white/80 shadow-lg backdrop-blur-sm">
                <div className="text-sm font-semibold text-white">
                  {t(
                    "ui_scanner_unavailable_title",
                    "Scanner indisponible",
                  )}
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
              {hasPaymentRequest ? payreqFinalStep : manualForm}
              {!hasPaymentRequest ? inlineSummary : null}
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
