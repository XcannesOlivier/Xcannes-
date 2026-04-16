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
  currentWalletAddress = "",
  renderWalletMeta,
  augmentedTokens,
  selectedSendToken,
  sendFxInfo,
  setSendAssetKey,
  sendAmount,
  setSendAmount,
  sendPaymentRequest,
  moonpaySellRequest,
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
  /* ── Scanner swipe-to-close (mobile) ── */
  const [scanDragging, setScanDragging] = useState(false);
  const [scanTranslateY, setScanTranslateY] = useState(0);
  const scanOverlayRef = useRef(null);
  const scanDragMeta = useRef({ startY: 0, startAt: 0, pointerId: null, lastDelta: 0, pending: false, dragging: false });
  const scanCloseRequested = useRef(false);
  const [showFullRecipientAccount, setShowFullRecipientAccount] =
    useState(false);
  const savedPickerRef = useRef(null);
  const savedMenuRef = useRef(null);
  const destinationInputRef = useRef(null);
  const scrollContainerRef = useRef(null);
  const [savedMenuStyle, setSavedMenuStyle] = useState(null);
  const normalizedCurrentWalletAddress = useMemo(
    () => String(currentWalletAddress || "").trim(),
    [currentWalletAddress],
  );

  const payreqFileInputId = "payreq-qr-file";
  const manualQrReaderIdRef = useRef(
    `manual-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);

  const normalizedDestination = useMemo(
    () => String(sendDestination || "").trim(),
    [sendDestination],
  );
  const hasMoonpaySellRequest = Boolean(moonpaySellRequest?.depositWalletAddress);
  const effectiveDestination = String(
    sendPaymentRequest?.to || normalizedDestination || "",
  ).trim();
  const selfSendBlocked = Boolean(
    normalizedCurrentWalletAddress &&
      effectiveDestination &&
      effectiveDestination === normalizedCurrentWalletAddress,
  );
  const hasDestination =
    Boolean(effectiveDestination) &&
    /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(effectiveDestination);
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
      (addr) => String(addr?.address || "").trim() === effectiveDestination,
    );
  }, [savedAddresses, effectiveDestination]);
  const canSaveDestination =
    !hasMoonpaySellRequest &&
    enableSaveAddress &&
    effectiveDestination &&
    !isSavedDestination;
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

    const requiredAmount = Number(sendAmount || 0);
    if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) return false;

    // Trustline-only tokens (EUR, GBP, etc.) are backed by RLUSD allocation.
    // In payreq mode, we can estimate required RLUSD via sendFxInfo.paymentRlusd.
    if (selectedSendToken.isTrustlineOnly) {
      const code = String(selectedSendToken?.currency || "")
        .trim()
        .toUpperCase();
      const requiredRlusd =
        code === "USD" ? requiredAmount : Number(sendFxInfo?.paymentRlusd);
      const availableAllocatedRlusd = Number(selectedSendToken.allocatedRlusd);
      if (!Number.isFinite(requiredRlusd) || requiredRlusd <= 0) return false;
      if (!Number.isFinite(availableAllocatedRlusd) || availableAllocatedRlusd < 0)
        return false;
      return availableAllocatedRlusd < requiredRlusd;
    }

    const available = Number(selectedSendToken.value || 0);
    if (!Number.isFinite(available)) return false;
    return available < requiredAmount;
  }, [sendPaymentRequest, selectedSendToken, sendAmount, sendFxInfo]);

  // ── Insufficient balance detection (manual send) ──
  const manualInsufficientBalance = useMemo(() => {
    if (sendPaymentRequest || !selectedSendToken) return false;

    const requiredAmount = Number(sendAmount || 0);
    if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) return false;

    const code = String(selectedSendToken?.currency || "")
      .trim()
      .toUpperCase();

    if (selectedSendToken.isTrustlineOnly) {
      const availableAllocatedRlusd = Number(selectedSendToken.allocatedRlusd);
      if (
        !Number.isFinite(availableAllocatedRlusd) ||
        availableAllocatedRlusd < 0
      ) {
        return false;
      }

      // USD "pool non alloué" is a 1:1 RLUSD amount.
      const requiredRlusd =
        code === "USD" ? requiredAmount : Number(sendFxInfo?.paymentRlusd);
      if (!Number.isFinite(requiredRlusd) || requiredRlusd <= 0) return false;
      return availableAllocatedRlusd < requiredRlusd;
    }

    const available = Number(selectedSendToken.value || 0);
    if (!Number.isFinite(available)) return false;
    return available < requiredAmount;
  }, [sendAmount, sendFxInfo, sendPaymentRequest, selectedSendToken]);

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
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
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
        saveNewAddress && shouldShowSaveAddressBlock ? effectiveDestination : "",
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

  /* ── Scanner swipe-to-close reset ── */
  useEffect(() => {
    if (scanActive) {
      scanCloseRequested.current = false;
      setScanDragging(false);
      setScanTranslateY(0);
      scanDragMeta.current = { startY: 0, startAt: 0, pointerId: null, lastDelta: 0, pending: false, dragging: false };
    } else {
      setScanDragging(false);
      if (!scanCloseRequested.current) setScanTranslateY(0);
      scanDragMeta.current = { startY: 0, startAt: 0, pointerId: null, lastDelta: 0, pending: false, dragging: false };
    }
  }, [scanActive]);

  const scanSwipeStart = (event) => {
    if (!event?.isPrimary) return;
    if (event.pointerType === "mouse") return;
    scanDragMeta.current = { startY: event.clientY, startAt: Date.now(), pointerId: event.pointerId, lastDelta: 0, pending: true, dragging: false };
  };
  const scanSwipeMove = (event) => {
    const m = scanDragMeta.current;
    if (!m.pending && !m.dragging) return;
    if (m.pointerId !== event.pointerId) return;
    const delta = event.clientY - m.startY;
    if (delta <= 0) return;
    if (!m.dragging) {
      if (delta < 8) return;
      try { scanOverlayRef.current?.setPointerCapture?.(event.pointerId); } catch { /* */ }
      m.dragging = true;
      setScanDragging(true);
    }
    m.lastDelta = delta;
    setScanTranslateY(delta);
  };
  const scanSwipeEnd = (event) => {
    const m = scanDragMeta.current;
    if (m.pointerId !== event.pointerId) return;
    const delta = m.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (m.startAt || 0));
    const velocity = delta / duration;
    const h = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, h * 0.28));
    const shouldClose = delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);
    m.pending = false;
    m.dragging = false;
    setScanDragging(false);
    if (shouldClose) {
      if (!scanCloseRequested.current) {
        scanCloseRequested.current = true;
        setScanTranslateY(Math.max(delta, h));
        window.setTimeout(() => { setScanActive(false); }, 180);
      }
      return;
    }
    setScanTranslateY(0);
    scanDragMeta.current = { startY: 0, startAt: 0, pointerId: null, lastDelta: 0, pending: false, dragging: false };
  };

  useEffect(() => {
    setShowFullPayreqAddress(false);
  }, [requestDestination]);

  useEffect(() => {
    if (!showSavedPicker) return;
    const handleOutside = (event) => {
      const target = event?.target;
      const container = savedPickerRef.current;
      const menu = savedMenuRef.current;
      if (!target) return;
      if (container && container.contains(target)) return;
      if (menu && menu.contains(target)) return;
      {
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
    // Capture scroll on any ancestor (incl. overlays) to keep anchored.
    window.addEventListener("scroll", update, true);
    return () => {
      scrollContainer?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [inline, showSavedPicker]);

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
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : null;
  const savedDestinationLabel = useMemo(() => {
    if (!effectiveDestination) return "";
    const entry = (savedAddresses || []).find(
      (addr) => String(addr?.address || "").trim() === effectiveDestination,
    );
    const label = String(
      entry?.onChainLabel || entry?.label || "",
    ).trim();
    return label;
  }, [savedAddresses, effectiveDestination]);
  const resolvedDestinationLabel =
    savedDestinationLabel || sendDestinationLabel || remoteDestinationLabel;
  const shouldShowLabelInInput =
    Boolean(resolvedDestinationLabel) &&
    Boolean(useLabelDisplay) &&
    !hasPaymentRequest;
  const destinationDisplayValue = shouldShowLabelInInput
    ? resolvedDestinationLabel
    : sendDestination;

  const payreqSelectorLabel = String(
    requestBeneficiaryLabel || resolvedDestinationLabel || "",
  ).trim();
  const payreqSelectorValue = payreqSelectorLabel || requestDestination;
  const recipientLabelDetected = hasPaymentRequest
    ? Boolean(payreqSelectorLabel)
    : Boolean(String(resolvedDestinationLabel || "").trim());
  const shouldShowSaveAddressBlock =
    canSaveDestination && hasDestination && !recipientLabelDetected;

  useEffect(() => {
    if (!shouldShowSaveAddressBlock) setSaveNewAddress(false);
  }, [shouldShowSaveAddressBlock]);

  const compactDestinationLabel = normalizedDestination
    ? normalizedDestination.length > 14
      ? `${normalizedDestination.slice(0, 6)}…${normalizedDestination.slice(-4)}`
      : normalizedDestination
    : "";

  useEffect(() => {
    setShowFullRecipientAccount(false);
  }, [normalizedDestination]);

  const savedPickerMenu = showSavedPicker ? (
    (() => {
      const filteredSavedAddresses = (savedAddresses || []).filter((entry) => {
        const address = String(entry?.address || "").trim();
        if (!address) return false;
        if (
          normalizedCurrentWalletAddress &&
          address === normalizedCurrentWalletAddress
        ) {
          return false;
        }
        return true;
      });
      return (
	    <div
	      ref={savedMenuRef}
		      className={[
		        "rounded-xl ring-1 ring-white/15 ring-inset overflow-hidden shadow-lg",
		        noticeVariant === "demo" ? "bg-xcannes-surface-demo" : "bg-[#101415]",
		      ].join(" ")}
		      onClick={(e) => e.stopPropagation()}
		    >
      <div className="max-h-56 overflow-y-auto">
        {filteredSavedAddresses.length > 0 ? (
          filteredSavedAddresses.map((addr, idx) => (
            <button
              key={`${addr.address}-${idx}`}
              type="button"
              onClick={() => {
                const value = String(addr?.address || "").trim();
                if (!value) return;
                const label = String(addr?.onChainLabel || addr?.label || "").trim();
                setSendDestination(value);
                setSendDestinationLabel?.(label);
                setUseLabelDisplay(Boolean(label));
                setShowSavedPicker(false);
              }}
              className="w-full text-left px-3 py-2 text-sm text-white/90 hover:bg-white/5 transition-colors"
            >
              <span className="block font-semibold">
                {String(addr?.onChainLabel || addr?.label || "").trim() ||
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
      );
    })()
  ) : null;

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
    if (
      !hasDestination ||
      savedDestinationLabel ||
      sendDestinationLabel ||
      (hasPaymentRequest && String(requestBeneficiaryLabel || "").trim())
    ) {
      setRemoteDestinationLabel("");
      return;
    }

    let cancelled = false;
    const address = effectiveDestination;
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
    effectiveDestination,
    requestBeneficiaryLabel,
    savedDestinationLabel,
    sendDestinationLabel,
    setSendDestinationLabel,
  ]);

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const overlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
    scrollLocked: false,
    lockedOverflowY: "",
  });
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    const resetMeta = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };

    if (open) {
      closeRequestedRef.current = false;
      setOverlayDragging(false);
      setOverlayTranslateY(0);
      overlayDragMetaRef.current = resetMeta;
      return;
    }

    try {
      const listEl = scrollContainerRef.current;
      const meta = overlayDragMetaRef.current;
      if (listEl && meta?.scrollLocked) {
        listEl.style.overflowY = meta.lockedOverflowY;
      }
    } catch {
      // ignore
    }
    setOverlayDragging(false);
    if (!closeRequestedRef.current) setOverlayTranslateY(0);
    overlayDragMetaRef.current = resetMeta;
  }, [open]);

  const releaseOverlayScrollLock = () => {
    const meta = overlayDragMetaRef.current;
    if (meta?.source !== "list") return;
    if (!meta?.scrollLocked) return;
    const listEl = scrollContainerRef.current;
    if (!listEl) return;
    try {
      listEl.style.overflowY = meta.lockedOverflowY;
    } catch {
      // ignore
    }
    meta.scrollLocked = false;
    meta.lockedOverflowY = "";
  };

  const maybeStartOverlayDrag = (event, source) => {
    if (inline) return false;
    if (!event?.isPrimary) return false;
    if (event.pointerType === "mouse") return false;
    if (event.target?.closest?.("input,textarea,select")) return false;

    if (source === "list") {
      const listEl = scrollContainerRef.current;
      if (!listEl) return false;
      if (listEl.scrollTop > 0) return false;
    }

    overlayDragMetaRef.current = {
      startY: event.clientY,
      startAt: Date.now(),
      pointerId: event.pointerId,
      lastDelta: 0,
      pending: true,
      source,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
    return true;
  };

  const handleOverlayPointerMove = (event) => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (!meta?.pending && !meta?.dragging) return;
    if (meta.pointerId !== event.pointerId) return;

    const delta = event.clientY - meta.startY;
    if (delta <= 0) return;

    if (!meta.dragging) {
      if (delta < 8) return;
      try {
        overlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }

      if (meta.source === "list") {
        const listEl = scrollContainerRef.current;
        if (listEl && listEl.scrollTop <= 0) {
          try {
            meta.lockedOverflowY = listEl.style.overflowY;
            meta.scrollLocked = true;
            listEl.style.overflowY = "hidden";
            listEl.scrollTop = 0;
          } catch {
            // ignore
          }
        }
      }

      meta.dragging = true;
      setOverlayDragging(true);
    }

    meta.lastDelta = delta;
    setOverlayTranslateY(delta);
  };

  const handleOverlayPointerEnd = (event) => {
    if (inline) return;
    const meta = overlayDragMetaRef.current;
    if (meta.pointerId !== event.pointerId) return;

    const delta = meta.lastDelta || 0;
    const duration = Math.max(1, Date.now() - (meta.startAt || 0));
    const velocity = delta / duration; // px/ms
    const height = typeof window !== "undefined" ? window.innerHeight : 800;
    const closeDistance = Math.max(220, Math.min(320, height * 0.28));
    const shouldClose =
      delta > closeDistance ||
      (delta > closeDistance * 0.6 && velocity > 1.25);

    overlayDragMetaRef.current.pending = false;
    overlayDragMetaRef.current.dragging = false;
    setOverlayDragging(false);
    releaseOverlayScrollLock();

    if (shouldClose) {
      if (!closeRequestedRef.current) {
        closeRequestedRef.current = true;
        const height = typeof window !== "undefined" ? window.innerHeight : 9999;
        setOverlayTranslateY(Math.max(delta, height));
        window.setTimeout(() => {
          onClose?.();
        }, 180);
      }
      return;
    }

    setOverlayTranslateY(0);
    overlayDragMetaRef.current = {
      startY: 0,
      startAt: 0,
      pointerId: null,
      lastDelta: 0,
      pending: false,
      source: null,
      dragging: false,
      scrollLocked: false,
      lockedOverflowY: "",
    };
  };

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border p-4 md:p-5 space-y-4 flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
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

  const backdropAnimClass = closeRequestedRef.current
    ? ""
    : isClosing
      ? "wallet-modal-backdrop-out"
      : "wallet-modal-backdrop-in";

  const saveAddressBlock = shouldShowSaveAddressBlock ? (
    <div className="rounded-lg bg-gradient-to-b from-white/[0.08] to-white/[0.03] px-3 py-2 space-y-2 ring-1 ring-white/10 ring-inset shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
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
    hasMoonpaySellRequest ? null : (
    <div>
      <label
        className="block text-base md:text-lg text-white/60 mb-1.5"
        title={t("ui_send_destination_tip", "Adresse XRPL du destinataire.")}
      >
        {t("ui_send_to_label", "Destinataire")}
      </label>

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
          placeholder={t("ui_import_or_choose_recipient", "Import or choose address")}
          readOnly={shouldShowLabelInInput}
		          className={`w-full bg-[#101415] ring-1 ring-white/15 ring-inset rounded-xl shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)] ${
		            !hasPaymentRequest ? "pl-8" : "pl-4"
		          } ${hasPaymentRequest ? "pr-4" : "pr-28"} py-3 text-base text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/80`}
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
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
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

        {!inline && savedPickerMenu ? (
          <div className="absolute left-0 right-0 top-full mt-2 z-20">
            {savedPickerMenu}
          </div>
        ) : null}
      </div>

      {selfSendBlocked ? (
        <div className="mt-2 rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90">
          <div className="font-semibold">
            {t("ui_invalid_recipient_title", "Destinataire invalide")}
          </div>
          <div>
            {t(
              "ui_cannot_send_to_self",
              "Vous ne pouvez pas envoyer à votre propre compte.",
            )}
          </div>
        </div>
      ) : null}

      {saveAddressBlock}
    </div>
    )
  ) : null;

  const moonpayDestinationLabel =
    String(moonpaySellRequest?.beneficiaryLabel || "MoonPay").trim() || "MoonPay";
  const moonpayReturnHint = String(moonpaySellRequest?.returnUrl || "").trim()
    ? t(
        "moonpay_sell_sign_return_hint",
        "Après signature, vous serez renvoyé automatiquement vers MoonPay.",
      )
    : t(
        "moonpay_sell_sign_return_manual_hint",
        "Après signature, revenez sur MoonPay pour finaliser la vente.",
      );

  const moonpaySellPreset = hasMoonpaySellRequest ? (
    <div className="space-y-3">
      <div className="rounded-[14px] p-4 space-y-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
          {t("moonpay_sell_signature_title", "Validation MoonPay")}
        </div>
        <div className="space-y-3 text-sm text-white/80">
          <div className="space-y-0.5">
            <div className="text-[11px] text-white/45">
              {t("ui_beneficiary_label", "Destinataire")}
            </div>
            <div className="text-sm font-semibold text-white/90">
              {moonpayDestinationLabel}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-white/45">
              {t("ui_address", "Adresse")}
            </div>
            <button
              type="button"
              onClick={() => setShowFullRecipientAccount((prev) => !prev)}
              className={[
                "font-mono text-xs text-white/80 text-left transition-colors",
                "underline decoration-white/25 underline-offset-2 hover:decoration-white/60",
                showFullRecipientAccount ? "break-all" : "",
              ].join(" ")}
              title={t(
                "ui_toggle_full_account_number",
                "Afficher/masquer l’adresse complète",
              )}
            >
              {showFullRecipientAccount ? normalizedDestination : compactDestinationLabel}
            </button>
          </div>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-0.5">
              <div className="text-[11px] text-white/45">
                {t("ui_currency_label", "Devise")}
              </div>
              <div className="text-sm text-white/90">
                {confirmCurrencyCode || "—"}
              </div>
            </div>
            <div className="text-right space-y-0.5">
              <div className="text-[11px] text-white/45">
                {t("ui_amount_52cea2dd3d", "Montant")}
              </div>
              <div className="text-lg font-semibold text-white/95">
                {confirmAmountLabel || "—"}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="rounded-lg ring-1 ring-sky-400/20 ring-inset bg-sky-400/10 px-3 py-2 text-xs text-sky-100/90">
        {moonpayReturnHint}
      </div>
      {manualInsufficientBalance ? (
        <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90">
          <div className="font-semibold">
            {t("ui_insufficient_balance_title", "Solde insuffisant")}
          </div>
          <div>
            {t(
              "ui_insufficient_balance_manual_detail",
              "Vous n'avez pas assez de {{currency}} pour ce montant.",
              {
                currency: String(
                  selectedSendToken?.currency || "",
                ).toUpperCase(),
              },
            )}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const manualForm = hasMoonpaySellRequest ? (
    moonpaySellPreset
  ) : (
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
		              backdropClassName="bg-black/45 backdrop-blur-[1.5px]"
			              buttonClassName="bg-[#101415] ring-1 ring-white/15 ring-inset rounded-xl px-4 py-[18px] text-2xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/80 appearance-none cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
		              menuClassName={
		                noticeVariant === "demo"
		                  ? "bg-xcannes-surface-demo border-white/15 ring-1 ring-white/10 max-h-[320px]"
		                  : "bg-elevated border-white/15 ring-1 ring-white/10 max-h-[320px]"
		              }
			              selectClassName="xcannes-select w-full bg-[#101415] ring-1 ring-white/15 ring-inset rounded-xl px-4 py-[18px] text-2xl text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/80 appearance-none cursor-pointer shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
			            />
	          </div>
          {sendPaymentRequest?.beneficiaryLabel ? (
            <div className="rounded-lg ring-1 ring-amber-300/20 ring-inset bg-amber-300/10 px-3 py-2 text-xs text-amber-100/90">
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
                <span className="mb-1 inline-flex items-center rounded-full ring-1 ring-amber-300/30 ring-inset bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200/90">
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
	              containerClassName="py-4 rounded-xl bg-black/30 ring-1 ring-white/15 ring-inset focus-within:ring-2 focus-within:ring-xcannes-green/80 transition-colors duration-150 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15)]"
	            />
            {manualInsufficientBalance ? (
              <div className="mt-2 rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90">
                <div className="font-semibold">
                  {t("ui_insufficient_balance_title", "Solde insuffisant")}
                </div>
                <div>
                  {t(
                    "ui_insufficient_balance_manual_detail",
                    "Vous n'avez pas assez de {{currency}} pour ce montant.",
                    {
                      currency: String(
                        selectedSendToken?.currency || "",
                      ).toUpperCase(),
                    },
                  )}
                </div>
              </div>
            ) : null}
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
		      <div className="rounded-[14px] p-4 space-y-4 ring-1 ring-white/10 ring-inset bg-[#101415] shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(0,255,150,0.15),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
	        <div className="text-xs uppercase tracking-wide text-white/60 font-semibold">
	          {t("ui_send_confirmation_title", "Résumé de l'envoi")}
		        </div>
	        <div className="space-y-3 text-sm text-white/80">
	          <div className="grid grid-cols-[auto,1fr] gap-x-3 gap-y-1 items-start">
	            <div className="text-white/60 shrink-0">
	              {t("ui_beneficiary_label", "Destinataire")}
	            </div>
	            <div className="min-w-0 text-right">
	              <div className="font-semibold text-white/90 truncate">
	                {resolvedDestinationLabel ||
	                  t("ui_wallet_unknown", "Unknown wallet")}
	              </div>
	            </div>
	            {normalizedDestination ? (
	              <>
	                <div className="text-white/50 shrink-0 text-[12px]">
	                  {t("ui_account_number_label", "N° de Compte")}:
	                </div>
	                <div className="min-w-0 text-right">
	                  <button
	                    type="button"
	                    onClick={() =>
	                      setShowFullRecipientAccount((prev) => !prev)
	                    }
	                    className={[
		                      "font-mono text-[12px] text-xcannes-green/80 hover:text-xcannes-green/95 transition-colors",
		                      "underline decoration-white/25 underline-offset-2 hover:decoration-white/60",
	                      showFullRecipientAccount
	                        ? "break-all"
	                        : "inline-block truncate max-w-[240px]",
	                    ].join(" ")}
	                    title={t(
	                      "ui_toggle_full_account_number",
	                      "Afficher/masquer l’adresse complète",
	                    )}
	                  >
	                    {showFullRecipientAccount
	                      ? normalizedDestination
	                      : compactDestinationLabel}
	                  </button>
	                </div>
	              </>
	            ) : null}
	          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-white/60">
              {t("ui_amount_52cea2dd3d", "Montant")}
            </span>
            <span className={`font-mono ${summaryAmount > 0 ? 'text-white/90' : 'text-white/40'}`}>
              {confirmAmountLabel || '0'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 pt-2 mt-1 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
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
            value={payreqSelectorValue}
            readOnly
	            className="w-full bg-[#101415] backdrop-blur-sm ring-1 ring-white/15 ring-inset rounded-xl px-4 pr-4 py-3 text-base text-white/90 outline-none truncate focus:outline-none focus:ring-2 focus:ring-xcannes-green/80"
	          />
	        </div>
        {selfSendBlocked ? (
          <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90">
            <div className="font-semibold">
              {t("ui_invalid_recipient_title", "Destinataire invalide")}
            </div>
            <div>
              {t(
                "ui_cannot_send_to_self",
                "Vous ne pouvez pas envoyer à votre propre compte.",
              )}
            </div>
          </div>
        ) : null}
        {saveAddressBlock}
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
	        <div className="rounded-[14px] p-4 space-y-3 ring-1 ring-white/10 ring-inset bg-[#101415] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
	          <div className="space-y-0.5">
	            <div className="text-[11px] text-white/45">
	              {t("ui_beneficiary_label", "Destinataire")}
	            </div>
            <div className="text-sm font-semibold text-white/90">
              {payreqSelectorLabel || t("ui_wallet_unknown", "Unknown wallet")}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-[11px] text-white/45">
              {t("ui_address", "Adresse")}
            </div>
            <button
              type="button"
              onClick={() => setShowFullPayreqAddress((prev) => !prev)}
              className={[
                "font-mono text-xs text-white/80 text-left transition-colors",
                "underline decoration-white/25 underline-offset-2 hover:decoration-white/60",
                showFullPayreqAddress ? "break-all" : "",
              ].join(" ")}
              title={t(
                "ui_toggle_full_account_number",
                "Afficher/masquer l’adresse complète",
              )}
            >
              {showFullPayreqAddress ? requestDestination : requestDestinationLabel}
            </button>
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
        </div>

      </div>

      {/* Insufficient balance warning */}
      {insufficientBalance ? (
        <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90 space-y-1">
          <div className="font-semibold">
            {t("ui_insufficient_balance_title", "Solde insuffisant")}
          </div>
          <div>
            {t(
              "ui_insufficient_balance_detail",
              "Vous n'avez pas assez de {{currency}} pour payer cette demande. Convertissez vos fonds via le bouton Convertir, puis revenez payer.",
              {
                currency: String(requestCurrencyCode || selectedSendToken?.currency || "").toUpperCase(),
              },
            )}
          </div>
        </div>
      ) : null}
    </div>
  ) : null;

  const sendActions = (
    <div className="sticky bottom-0 pt-0 pb-1 -mt-0 space-y-2 bg-inherit z-10 relative before:content-[''] before:absolute before:top-0 before:left-0 before:right-0 before:h-px before:bg-white/10">
      <SwipeConfirmButton
        label={
          sendProcessing
            ? hasMoonpaySellRequest
              ? t("moonpay_sell_signing_action", "Signature en cours...")
              : t("ui_sending_3b8c1a7d5e", "Sending...")
            : hasMoonpaySellRequest
              ? t("moonpay_sell_sign_submit", "Signer et envoyer")
              : t("ui_send_504b64a87b", "Send")
        }
        onConfirm={handleManualSend}
        disabled={
          sendProcessing ||
          !canManualSend ||
          (hasPaymentRequest && insufficientBalance) ||
          (!hasPaymentRequest && manualInsufficientBalance) ||
          selfSendBlocked
        }
        variant="green"
        className="md:hidden"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={
          sendProcessing ||
          !canManualSend ||
          (hasPaymentRequest && insufficientBalance) ||
          (!hasPaymentRequest && manualInsufficientBalance) ||
          selfSendBlocked
        }
        className={`hidden md:block w-full text-xl py-4 ${greenActionBtnBase}`}
      >
        {sendProcessing
          ? hasMoonpaySellRequest
            ? t("moonpay_sell_signing_action", "Signature en cours...")
            : t("ui_sending_3b8c1a7d5e", "Sending...")
          : hasMoonpaySellRequest
            ? t("moonpay_sell_sign_submit", "Signer et envoyer")
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
            style={
              scanTranslateY > 0
                ? { opacity: Math.max(0, Math.min(1, 1 - scanTranslateY / 420)) }
                : undefined
            }
          />
          {/* Swipeable scanner wrapper */}
          <div
            ref={scanOverlayRef}
            className="relative flex-1 flex flex-col items-center justify-center"
            style={{
              transform: `translateY(${Math.max(0, scanTranslateY)}px)`,
              transition: scanDragging ? "none" : "transform 220ms cubic-bezier(0.2,0,0,1)",
              willChange: scanTranslateY ? "transform" : undefined,
            }}
            onPointerDown={scanSwipeStart}
            onPointerMove={scanSwipeMove}
            onPointerUp={scanSwipeEnd}
            onPointerCancel={scanSwipeEnd}
          >
            {/* Swipe bar (mobile only) */}
            <div className="md:hidden flex justify-center pt-3 pb-2" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
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
              <div className="absolute bottom-6 left-4 right-4 rounded-xl ring-1 ring-orange-400/30 ring-inset bg-black/70 px-4 py-3 text-xs text-white/80 shadow-lg backdrop-blur-sm">
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
          className={`fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm ${backdropAnimClass}`}
          onClick={onClose}
          style={
            overlayTranslateY > 0
              ? {
                  opacity: Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)),
                }
              : undefined
          }
        />
      ) : null}

      {/* Modale */}
      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? "w-full h-full flex" : "pointer-events-auto w-full"}
          style={{
            transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
            transition: overlayDragging
              ? "none"
              : "transform 220ms cubic-bezier(0.2,0,0,1)",
            willChange: overlayTranslateY ? "transform" : undefined,
          }}
          onPointerMove={handleOverlayPointerMove}
          onPointerUp={handleOverlayPointerEnd}
          onPointerCancel={handleOverlayPointerEnd}
        >
          <div
            className={panelClass}
            onClick={(e) => {
              if (!inline) e.stopPropagation();
            }}
          >
            {!inline ? (
              <div
                className="md:hidden flex justify-center -mt-1 pt-1 pb-2"
                aria-hidden
                onPointerDown={(event) => {
                  maybeStartOverlayDrag(event, "fixed");
                }}
              >
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}
            <div
              className="flex items-start justify-between gap-3 mb-1"
              onPointerDown={(event) => {
                maybeStartOverlayDrag(event, "fixed");
              }}
            >
              <div className="flex min-w-0 flex-col gap-1.5 w-full">
                <div>
	                  {renderWalletMeta?.({
	                    variant: "pill",
	                    className:
	                      "w-full flex justify-center wallet-meta--plus-4 wallet-meta--desktop-gap",
	                    prefix: `${t("moonpay_from_account", "Depuis le compte")} :`,
	                    labelWrap: true,
	                    pillClassName:
	                      "bg-elevated px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]",
	                    prefixClassName:
	                      "!text-white/70 text-[16px] md:text-[17px] font-semibold tracking-wide",
	                    labelClassName:
	                      "!text-white/95 text-[16px] md:text-[17px] font-semibold",
	                    dotClassName: "!h-3 !w-3 ring-xcannes-green/20",
	                  })}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {noticeVariant === "demo" ? (
                    <span className="inline-flex items-center text-white/80 text-sm md:text-base font-semibold px-2 py-1 leading-none">
                      {t("demo_notice_title", "Mode démo")}
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
            <div
              ref={scrollContainerRef}
              className="flex-1 overflow-y-auto -mx-4 px-4 md:-mx-5 md:px-5"
              onPointerDown={(event) => {
                maybeStartOverlayDrag(event, "list");
              }}
            >
              <div className="flex flex-col gap-3">
                {hasPaymentRequest ? payreqFinalStep : manualForm}
                {!hasPaymentRequest && !hasMoonpaySellRequest ? inlineSummary : null}
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
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
