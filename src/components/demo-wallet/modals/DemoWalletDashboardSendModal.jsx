"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import ModalSelect from "@/components/ui/ModalSelect";
import DemoQRScanner from "../components/DemoQRScanner";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { formatAmountWithSymbol } from "../demoWalletDashboardConfig";
import {
  greenActionBtnBase,
  modalSelectButtonCls,
  modalSelectListCls,
} from "./demoWalletModalTokens";
import { normalizeQrImageFile } from "../utils/demoQrImage";

const XRPL_ADDRESS_RE = /^(?:xrpl:)?r[1-9A-HJ-NP-Za-km-z]{24,34}$/;
const DEMO_ADDRESS_RE = /^[A-Za-z][A-Za-z0-9_]{10,}$/;

const fmtAmountRight = (raw) => {
  if (!raw) return null;
  const str = String(raw);
  const i = str.lastIndexOf(" ");
  if (i < 0) return <span>{str}</span>;
  return (
    <span className="inline-flex items-baseline gap-[3px]">
      {str.slice(0, i)}
      <span className="text-[0.78em]">{str.slice(i + 1)}</span>
    </span>
  );
};

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
  const [showFullRecipientAccount, setShowFullRecipientAccount] = useState(false);
  const [submitStatus, setSubmitStatus] = useState("idle"); // idle | processing | success | error
  const [submitError, setSubmitError] = useState("");
  const [scanActive, setScanActive] = useState(false);
  const [scanKey, setScanKey] = useState(0);
  const [cameraUnavailable, setCameraUnavailable] = useState(false);
  const [scanDragging, setScanDragging] = useState(false);
  const [scanTranslateY, setScanTranslateY] = useState(0);
  const scanOverlayRef = useRef(null);
  const scanDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    dragging: false,
  });
  const scanCloseRequested = useRef(false);
  const [showSavedPicker, setShowSavedPicker] = useState(false);
  const [selectedSavedLabel, setSelectedSavedLabel] = useState("");
  const [sendAssetDropdownOpen, setSendAssetDropdownOpen] = useState(false);
  const savedPickerRef = useRef(null);
  const savedMenuRef = useRef(null);
  const destinationInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [savedMenuStyle, setSavedMenuStyle] = useState(null);
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
  const compactDestinationLabel = normalizedDestination
    ? normalizedDestination.length > 14
      ? `${normalizedDestination.slice(0, 6)}…${normalizedDestination.slice(-4)}`
      : normalizedDestination
    : "";
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

  const resolvedDestinationLabel = selectedSavedLabel || requestBeneficiaryLabel;
  const confirmCurrencyCode = String(
    selectedSendToken?.currency || requestCurrencyCode || "",
  )
    .trim()
    .toUpperCase();
  const summaryAmount = Number.isFinite(normalizedSendAmount) ? normalizedSendAmount : 0;
  const confirmAmountLabel =
    confirmCurrencyCode
      ? formatAmountWithSymbol(
          locale,
          Number.isFinite(summaryAmount) ? summaryAmount : 0,
          confirmCurrencyCode,
          { minimumFractionDigits: 0, maximumFractionDigits: 6 },
        )
      : null;
  const handleManualSend = async () => {
    if (submitStatus === "processing") return;
    setSubmitStatus("processing");
    setSubmitError("");
    const result = await handleSendSubmit?.({
      saveDestination:
        saveNewAddress && canSaveDestination ? normalizedDestination : "",
      saveLabel: saveNewAddressLabel,
      closeOnSuccess: false,
    });
    if (result?.ok) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setSubmitStatus("success");
      window.setTimeout(() => {
        onClose?.();
      }, 650);
      return;
    }
    if (result?.error) {
      setSubmitError(String(result.error));
    } else {
      setSubmitError(t("demo_error_generic", "Action impossible (démo)."));
    }
    setSubmitStatus("error");
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
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      handlePaymentRequestScan?.(text);
      setScanActive(false);
    } catch {
      // Clipboard permissions can be denied; ignore silently.
    }
  };

  const scanSwipeStart = (event) => {
    if (!scanActive) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    scanDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      dragging: false,
    };
    try {
      scanOverlayRef.current?.setPointerCapture?.(event.pointerId);
    } catch {
      // ignore
    }
  };

  const scanSwipeMove = (event) => {
    const meta = scanDragMetaRef.current;
    if (!meta?.pending) return;
    const delta = Math.max(0, event.clientY - meta.startY);
    meta.lastDelta = delta;
    if (!meta.dragging) {
      if (delta < 8) return;
      meta.dragging = true;
      setScanDragging(true);
    }
    setScanTranslateY(delta);
  };

  const scanSwipeEnd = () => {
    const meta = scanDragMetaRef.current;
    if (!meta?.pending) return;
    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration;
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, height * 0.28));
    const shouldClose =
      delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);

    scanDragMetaRef.current.pending = false;
    scanDragMetaRef.current.dragging = false;
    setScanDragging(false);

    if (shouldClose) {
      if (!scanCloseRequested.current) {
        scanCloseRequested.current = true;
        setScanTranslateY(Math.max(delta, height));
        window.setTimeout(() => {
          setScanActive(false);
          setCameraUnavailable(false);
        }, 180);
      }
      return;
    }
    setScanTranslateY(0);
    scanDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      dragging: false,
    };
  };

  // Close saved picker when clicking outside.
  useEffect(() => {
    if (!showSavedPicker) return;
    const handler = (e) => {
      const target = e?.target;
      const container = savedPickerRef.current;
      const menu = savedMenuRef.current;
      if (!target) return;
      if (container && container.contains(target)) return;
      if (menu && menu.contains(target)) return;
      setShowSavedPicker(false);
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("touchstart", handler, { passive: true });
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("touchstart", handler);
    };
  }, [showSavedPicker]);

  useEffect(() => {
    if (!inline || !showSavedPicker) {
      setSavedMenuStyle(null);
      return;
    }

    const update = () => {
      const input = destinationInputRef.current;
      if (!input) return;
      const rect = input.getBoundingClientRect();
      setSavedMenuStyle({
        left: rect.left,
        top: rect.bottom + 8,
        width: rect.width,
      });
    };

    update();
    const scrollContainer = scrollContainerRef.current;
    scrollContainer?.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      scrollContainer?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [inline, showSavedPicker]);

  useEffect(() => {
    if (!open) {
      setSaveNewAddress(false);
      setSaveNewAddressLabel("");
      setCameraUnavailable(false);
      setShowSavedPicker(false);
      setSelectedSavedLabel("");
      setSendAssetDropdownOpen(false);
      setShowFullRecipientAccount(false);
      setSubmitStatus("idle");
      setSubmitError("");
    }
  }, [open]);

  useEffect(() => {
    if (!normalizedDestination) {
      setSelectedSavedLabel("");
      return;
    }
    const matched = (savedAddresses || []).find(
      (addr) => String(addr?.address || "").trim() === normalizedDestination,
    );
    const label = String(matched?.label || "").trim();
    setSelectedSavedLabel(label);
  }, [normalizedDestination, savedAddresses]);

  useEffect(() => {
    if (!open) {
      setScanActive(false);
      return;
    }
    setCameraUnavailable(false);
  }, [open]);

  useEffect(() => {
    setShowFullRecipientAccount(false);
  }, [normalizedDestination]);

  useEffect(() => {
    setShowFullRecipientAccount(false);
  }, [normalizedDestination]);

  useEffect(() => {
    if (scanActive) {
      scanCloseRequested.current = false;
      setScanDragging(false);
      setScanTranslateY(0);
      scanDragMetaRef.current = {
        startY: 0,
        startAt: 0,
        pointerId: null,
        lastDelta: 0,
        pending: false,
        dragging: false,
      };
    } else {
      setScanDragging(false);
      if (!scanCloseRequested.current) setScanTranslateY(0);
    }
  }, [scanActive]);

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
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal wallet-modal-no-top-highlight-mobile p-4 pt-0 space-y-4 flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
    inline
      ? "h-full max-h-none rounded-xl"
      : "h-screen rounded-none",
    noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-elevated",
    noticeVariant === "demo" ? "demo-wallet-tooltip-scope" : "",
    inline ? "wallet-inline-zoom-in" : "",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const payreqFinalStep = hasPaymentRequest ? (
    <div className="space-y-4">
      {/* 1) Recipient input */}
      <div className="space-y-2">
        <label className="block text-base text-white/60">
          {t("ui_send_to_label", "Destinataire")}
        </label>
        <div className="relative">
          <input
            type="text"
            value={requestDestination}
            readOnly
            className="w-full bg-[#101415] ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] px-4 pr-24 py-3 text-base text-white/90 outline-none truncate focus:outline-none"
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
                setCameraUnavailable(false);
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
        <div className="rounded-[14px] p-4 space-y-3 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
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
                {requestCurrencyCode || "—"}
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
        </div>
        {canSaveDestination ? (
          <div className="rounded-lg ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
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
    </div>
  ) : null;

  const saveAddressBlock = canSaveDestination ? (
    <div className="rounded-lg bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-3 py-2 space-y-2 ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
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
            className="w-full bg-black/40 ring-1 ring-white/15 ring-inset rounded-lg px-3 py-2 text-xs text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/80"
          />
        </div>
      ) : null}
    </div>
  ) : null;

  const savedPickerMenu = showSavedPicker ? (
    <div
      ref={savedMenuRef}
      className={[
        "rounded-xl ring-1 ring-white/15 ring-inset overflow-hidden shadow-lg",
        noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-[#101415]",
      ].join(" ")}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="max-h-56 overflow-y-auto">
        {(savedAddresses || []).filter((entry) =>
          Boolean(String(entry?.address || "").trim()),
        ).length > 0 ? (
          (savedAddresses || [])
            .filter((entry) => Boolean(String(entry?.address || "").trim()))
            .map((addr, idx) => (
              <button
                key={`${addr.address}-${idx}`}
                type="button"
                onClick={() => {
                  const value = String(addr?.address || "").trim();
                  if (!value) return;
                  setSendDestination(value);
                  setShowSavedPicker(false);
                }}
                className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 transition-colors border-b border-white/10 last:border-b-0"
              >
                <span className="block font-semibold">
                  {String(addr?.label || "").trim() ||
                    t("ui_wallet_unknown", "Unknown wallet")}
                </span>
                <span className="block font-mono text-xs text-white/60 truncate">
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
  ) : null;

  const recipientCard = !hasPaymentRequest ? (
    <div className="space-y-2">
      <label
        className="block text-base text-white/60 mb-1.5"
        title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
      >
        {t("ui_send_to_label", "Destinataire")}
      </label>

      <div className="relative" ref={savedPickerRef}>
        <input
          ref={destinationInputRef}
          type="text"
          value={sendDestination}
          onChange={(e) => {
            setSendDestination(e.target.value);
            setShowSavedPicker(false);
          }}
          onPaste={handlePastePayload}
          placeholder={t(
            "ui_import_or_choose_recipient",
            "Import or choose address",
          )}
          className="w-full bg-[#101415] ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] pl-8 pr-28 py-3 text-base text-white outline-none focus:outline-none"
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
            setCameraUnavailable(false);
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

        {!inline && savedPickerMenu ? (
          <div className="absolute left-0 right-0 top-full mt-2 z-20">
            {savedPickerMenu}
          </div>
        ) : null}
      </div>

      {hasDestination ? saveAddressBlock : null}
    </div>
  ) : null;

  const inlineSummary = hasDestination ? (
    <div className="space-y-3 transition-all duration-200">
      <div className="rounded-[16px] overflow-hidden">
        <div className="flex flex-col gap-1 px-6 pt-3 pb-2">
          <span className="text-[13px] text-white/45 font-normal">
            {t("ui_beneficiary_label", "Destinataire")} —{" "}
            <span className="text-white/85 font-semibold">
              {resolvedDestinationLabel ||
                t("ui_wallet_unknown", "Unknown wallet")}
            </span>
          </span>
          {normalizedDestination ? (
            <span className="text-[13px] text-white/45 font-normal tabular-nums">
              {t("ui_account_number_label", "N° de compte")} —{" "}
              <button
                type="button"
                onClick={() => setShowFullRecipientAccount((prev) => !prev)}
                className="font-mono text-xcannes-green/80 hover:text-xcannes-green/95 transition-colors underline decoration-white/25 underline-offset-2 hover:decoration-white/60"
                title={t(
                  "ui_toggle_full_account_number",
                  "Afficher/masquer l'adresse complète",
                )}
              >
                {showFullRecipientAccount
                  ? normalizedDestination
                  : compactDestinationLabel}
              </button>
            </span>
          ) : null}
        </div>
        <div className="px-3 mt-3 mb-0">
          <div className="h-px bg-white/45 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pt-4 pb-4 mt-0.5 mx-1 mb-1 rounded-[12px]">
          <span className="text-[15px] text-white/45 font-normal tracking-[0.02em]">
            {t("ui_total_to_send_label", "Total à envoyer")}
          </span>
          <span
            className={
              "text-3xl font-bold tracking-tight " +
              (summaryAmount > 0 ? "text-white" : "text-white/75")
            }
          >
            {confirmAmountLabel || "0"}
          </span>
        </div>
      </div>
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
          {recipientCard}

          {/* ── Devise + Montant (same sizing as real wallet) ── */}
          <div
            className={[
              "transition-opacity duration-300 space-y-4",
              hasDestination
                ? "opacity-100"
                : "opacity-30 pointer-events-none select-none",
            ].join(" ")}
          >
            <h3 className="relative z-[50] text-[30px] font-bold text-white/95 tracking-tight text-center leading-snug">
              {t("ui_send_modal_title", "Montant à envoyer")}
            </h3>
            <p className="relative z-[50] text-[14px] text-white/55 text-center leading-relaxed -mt-2">
              {t(
                "ui_send_devise_hint",
                "Choisissez la devise, saisissez le montant, puis vérifiez avant l’envoi.",
              )}
            </p>
            <div className="flex justify-center relative z-[65]">
              <div
                className={[
                  "rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-4 py-3",
                  sendAssetDropdownOpen
                    ? "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_10px_rgba(255,255,255,0.16)]"
                    : "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]",
                ].join(" ")}
              >
                <div className="text-[11px] text-white/45 text-center">
                  {t("moonpay_from_account", "Compte source")}
                </div>
                <div className="mt-1 flex justify-center">
                  {renderWalletMeta?.("text-center [&_.font-mono]:hidden")}
                </div>
              </div>
            </div>
            <div>
              <label
                className="block text-base text-white/60 mb-1.5"
                title={t(
                  "ui_send_asset_tip",
                  "Sélectionnez la devise à envoyer.",
                )}
              >
                {t("ui_asset_e5170a7a06", "Devise")}
              </label>
              <ModalSelect
                value={selectedSendToken ? selectedSendToken.key : ""}
                onChange={setSendAssetKey}
                onOpenChange={setSendAssetDropdownOpen}
                hideSelected
                options={(augmentedTokens || []).map((token) => {
                  const currency = String(token?.currency || "").toUpperCase();
                  const fullName =
                    selectLabelByAssetKey?.[token.key] ||
                    selectLabelByAssetKey?.[currency] ||
                    token.currency;
                  const labelLeftText =
                    String(fullName || "").length > 15
                      ? String(fullName || "").slice(0, 15) + "…"
                      : String(fullName || "");
                  const labelLeft = (
                    <span className="text-[1.12em]">{labelLeftText}</span>
                  );
                  const labelRightRaw =
                    selectLabelRightByAssetKey?.[token.key] ||
                    selectLabelRightByAssetKey?.[currency] ||
                    null;
                  const isSelected =
                    String(token.key) === String(selectedSendToken?.key || "");
                  const labelRight =
                    !sendAssetDropdownOpen && isSelected
                      ? (
                          <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
                            <svg
                              width="11"
                              height="11"
                              viewBox="0 0 24 24"
                              fill="none"
                              aria-hidden="true"
                              className="opacity-50 shrink-0"
                            >
                              <path
                                d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                              />
                            </svg>
                            <span>
                              {t(
                                "ui_balances_short_label_aa12",
                                "Solde disponible",
                              )}
                            </span>
                          </span>
                        )
                      : fmtAmountRight(labelRightRaw);
                  return {
                    value: token.key,
                    icon:
                      selectIconByAssetKey?.[token.key] ||
                      selectIconByAssetKey?.[token.currency] ||
                      null,
                    label: labelLeftText,
                    labelLeft,
                    labelRight,
                    labelMobile:
                      selectLabelMobileByAssetKey?.[token.key] ||
                      selectLabelMobileByAssetKey?.[token.currency] ||
                      labelLeftText,
                  };
                })}
                useNativeSelect={false}
                showMobileOptionRight={true}
                iconClassName="text-3xl leading-none"
                optionIconClassName="text-2xl leading-none opacity-60"
                optionClassName="py-2 !text-base !text-white/60"
                menuHeader={t("ui_your_balances_header", "Vos soldes")}
                backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[45]"
                buttonClassName={modalSelectButtonCls}
                openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                menuClassName={
                  noticeVariant === "demo"
                    ? "bg-xcannes-surface-demo !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[420px]"
                    : "bg-[#101415] !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px] max-h-[420px]"
                }
                selectClassName={modalSelectListCls}
	              />
            </div>

            <div>
              <label
                className="block text-base text-white/60 mb-1.5"
                title={t(
                  "ui_send_amount_tip",
                  "Saisissez le montant à envoyer.",
                )}
              >
                {t("ui_amount_52cea2dd3d", "Montant")}
              </label>
              <div className="bg-[#111518] rounded-[18px]">
                <TokenAmountInput
                  value={sendAmount}
                  onChange={setSendAmount}
                  placeholder="0.00"
                  token={
                    selectedSendToken
                      ? selectLabelByAssetKey?.[selectedSendToken.currency] ||
                        selectedSendToken.currency
                      : "RLUSD"
                  }
                  tokenClassName="text-white/70 drop-shadow-sm text-2xl font-semibold"
                  containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-amount-shimmer [&_input]:!text-4xl [&_input]:font-bold [&_input]:placeholder:text-white/35"
                />
              </div>
            </div>

            {sendFxInfo && (
              <div className="rounded-[20px] p-4 space-y-3 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
                <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
                  {t(
                    "ui_payment_fx_base_usd_r_gleme_4818b8a6c3",
                    "Paiement FX (base USD · règlement XRPL via USD)",
                  )}
                </div>
                <p className="text-[13px] text-white/70">
                  <span className="text-white/50">≈ </span>
                  <span className="font-mono text-white/85">
                    {formatAmountWithSymbol(
                      locale,
                      Number(sendFxInfo.paymentRlusd || 0),
                      "USD",
                      { minimumFractionDigits: 0, maximumFractionDigits: 6 },
                    )}
                  </span>{" "}
                  <span className="text-white/55">
                    {t("ui_au_recipient_67dcc85cec", "au destinataire")}
                  </span>
                </p>
                {Number(sendFxInfo.spreadFeeRlusd || 0) > 0 && (
                  <p className="text-[13px] text-white/70">
                    {t(
                      "ui_spread_xcannes_tier_7ad17576d3",
                      "Frais de conversion (1%)",
                    )}
                    {sendFxInfo.fxSource ? (
                      <>
                        {" "}
                        · {t("ui_source_507c065942", "source")}{" "}
                        <span className="font-mono text-white/80">
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
                    <span className="font-mono text-white/85">
                      {formatAmountWithSymbol(
                        locale,
                        Number(sendFxInfo.spreadFeeRlusd || 0),
                        "USD",
                        { minimumFractionDigits: 0, maximumFractionDigits: 6 },
                      )}
                    </span>
                  </p>
                )}
                <p className="text-[11px] text-white/40">
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

        </div>
      </div>
    </div>
  ) : null;

  const sendButtonDisabled = sendProcessing || !canManualSend;
  const sendButtonLabel = sendProcessing
    ? t("ui_sending_3b8c1a7d5e", "Sending...")
    : t("ui_send_504b64a87b", "Envoyer");

  const sendActions = (
    <div className="sticky bottom-0 pt-8 pb-3 mt-auto space-y-2 bg-inherit z-10 relative">
      {submitStatus === "error" && submitError ? (
        <div className="rounded-[16px] ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-4 py-3 text-xs text-orange-200/90">
          <div className="font-semibold">
            {t("ui_send_failed", "Envoi impossible")}
          </div>
          <div className="mt-1 text-orange-200/80">{submitError}</div>
        </div>
      ) : null}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={
          sendButtonDisabled ||
          submitStatus === "processing" ||
          submitStatus === "success"
        }
        className={[
          "w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
          sendButtonDisabled
            ? sendProcessing
              ? "opacity-45 cursor-not-allowed"
              : "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
            : "text-white hover:scale-[1.01] active:scale-[0.98]",
        ].join(" ")}
        style={
          sendButtonDisabled
            ? sendProcessing
              ? {
                  background:
                    "linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)",
                  color: "rgba(255,255,255,0.4)",
                }
              : undefined
            : {
                background:
                  "linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)",
                boxShadow:
                  "0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)",
              }
        }
      >
        {submitStatus === "success" ? (
          <span className="inline-flex items-center justify-center gap-2 text-white/90">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 ring-inset">
              <svg
                className="w-3.5 h-3.5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </span>
            {t("ui_done", "Terminé")}
          </span>
        ) : sendButtonDisabled && !sendProcessing ? (
          <span className="inline-flex items-center gap-1.5 text-white/20">
            <span className="text-xs">
              {t("ui_send_fill_cta", "Choisissez la devise et le montant")}
            </span>
            <span className="inline-flex items-end gap-[3px] mb-[-1px]">
              <span className="send-modal-dot" style={{ animationDelay: "0s" }}>
                ·
              </span>
              <span
                className="send-modal-dot"
                style={{ animationDelay: "0.6s" }}
              >
                ·
              </span>
              <span
                className="send-modal-dot"
                style={{ animationDelay: "1.2s" }}
              >
                ·
              </span>
            </span>
          </span>
        ) : (
          sendButtonLabel
        )}
      </button>
      <style>{`
        @keyframes sendModalDotBlink {
          0%, 100% { opacity: 0.18; }
          50% { opacity: 0.7; }
        }
        .send-modal-dot {
          animation: sendModalDotBlink 2.4s ease-in-out infinite;
          font-size: 1.3em;
          line-height: 1;
        }
      `}</style>
    </div>
  );

  const scannerModal =
    scanActive && typeof document !== "undefined"
      ? createPortal(
          <div className="fixed inset-0 z-[10002] flex flex-col">
            {/* Backdrop */}
            <div
              className="absolute inset-0 bg-[#101415] backdrop-blur-sm"
              onClick={() => {
                setScanActive(false);
                setCameraUnavailable(false);
              }}
              style={
                scanTranslateY > 0
                  ? {
                      opacity: Math.max(
                        0,
                        Math.min(1, 1 - scanTranslateY / 420),
                      ),
                    }
                  : undefined
              }
            />
            {/* Swipeable scanner wrapper */}
            <div
              ref={scanOverlayRef}
              className="relative flex-1 flex flex-col items-center justify-center"
              style={{
                transform: `translateY(${Math.max(0, scanTranslateY)}px)`,
                transition: scanDragging
                  ? "none"
                  : "transform 220ms cubic-bezier(0.2,0,0,1)",
                willChange: scanTranslateY ? "transform" : undefined,
                touchAction: "none",
              }}
              onPointerDown={scanSwipeStart}
              onPointerMove={scanSwipeMove}
              onPointerUp={scanSwipeEnd}
              onPointerCancel={scanSwipeEnd}
            >
              {/* Swipe bar */}
              <div className="flex justify-center pt-3 pb-0" aria-hidden>
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
              {/* Scanner */}
              <div className="flex-1 w-full">
                <DemoQRScanner
                  key={scanKey}
                  isOpen={true}
                  onScan={handleScan}
                  embedded={true}
                  edgeToEdge={true}
                  showClose={false}
                  hideTitle={true}
                  enableCamera={true}
                  hideWhenUnavailable
                  onCameraUnavailableChange={setCameraUnavailable}
                  showFauxQrBackground={false}
                  className="bg-[#101415] w-full h-full flex flex-col justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
                />
              </div>
              {inline && cameraUnavailable ? (
                <div className="absolute bottom-6 left-4 right-4 rounded-xl ring-1 ring-orange-400/30 ring-inset bg-black/70 px-4 py-3 text-xs text-white/80 shadow-lg backdrop-blur-sm">
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
          className={`fixed inset-0 z-[10000] bg-black/80 ${
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
          {!inline ? (
            <div className="flex justify-center pt-0 pb-0 touch-none" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}
          <div
            className={`flex items-start justify-between gap-3 relative z-[65] touch-none ${
              hasPaymentRequest ? "mb-[110px]" : "mb-[54px]"
            }`}
          >
            <div className="flex min-w-0 flex-col gap-1.5 w-full">
              <div className="flex flex-wrap items-center gap-2">
                {noticeVariant === "demo" ? (
                  <span className="inline-flex items-center text-white/80 text-sm font-semibold px-2 py-1 leading-none">
                    {t("demo_notice_title", "Mode démo")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto -mx-4 px-4"
          >
            <div className="flex flex-col gap-3">
              {hasPaymentRequest ? (
                payreqFinalStep
              ) : (
                <>
                  {manualForm}
                  {inlineSummary}
                </>
              )}
              {scannerModal}
            </div>
          </div>
          {inline &&
          savedPickerMenu &&
          savedMenuStyle &&
          typeof document !== "undefined"
            ? createPortal(
                <div
                  style={{
                    position: "fixed",
                    left: savedMenuStyle.left,
                    top: savedMenuStyle.top,
                    width: savedMenuStyle.width,
                    zIndex: 12050,
                  }}
                >
                  {savedPickerMenu}
                </div>,
                document.body,
              )
            : null}
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
