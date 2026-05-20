"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import ModalSelect from "@/components/ui/ModalSelect";
import QRScanner from "../components/QRScanner";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { useModalDragToClose } from "../hooks/useModalDragToClose";
import { formatAmountWithSymbol } from "../walletDashboardConfig";
import { getCurrencyDescription } from "@/utils/currencyDescriptions";
import { modalSelectButtonCls, modalSelectListCls } from "./walletModalTokens";
import { fmtAmountRight } from "./walletModalShared";

import { normalizeQrImageFile } from "@/utils/qrImage";
import { apiUrl } from "@/lib/runtimeConfig";

export default function WalletDashboardSendModal({
  open,
  onClose,
  onBack,
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
  const [amountFocused, setAmountFocused] = useState(false);
  const [autoShowLabelOnce, setAutoShowLabelOnce] = useState(false);
  const [showFullPayreqAddress, setShowFullPayreqAddress] = useState(false);
  const [scanUnavailable, setScanUnavailable] = useState(false);
  /* ── Scanner swipe-to-close (mobile) ── */
  const [sendAssetDropdownOpen, setSendAssetDropdownOpen] = useState(false);
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

  // ── Insufficient balance detection (shared logic, payreq + manual) ──
  const { insufficientBalance, manualInsufficientBalance } = useMemo(() => {
    const check = (requiresPayreq) => {
      const hasPayreq = Boolean(sendPaymentRequest);
      if (requiresPayreq ? !hasPayreq : hasPayreq) return false;
      if (!selectedSendToken) return false;
      const requiredAmount = Number(sendAmount || 0);
      if (!Number.isFinite(requiredAmount) || requiredAmount <= 0) return false;
      // Trustline-only tokens (EUR, GBP, etc.) are backed by RLUSD allocation.
      // In payreq mode, sendFxInfo.paymentRlusd provides the RLUSD estimate.
      if (selectedSendToken.isTrustlineOnly) {
        const code = String(selectedSendToken?.currency || "").trim().toUpperCase();
        const requiredRlusd =
          code === "USD" ? requiredAmount : Number(sendFxInfo?.paymentRlusd);
        const availableAllocatedRlusd = Number(selectedSendToken.allocatedRlusd);
        if (!Number.isFinite(requiredRlusd) || requiredRlusd <= 0) return false;
        if (!Number.isFinite(availableAllocatedRlusd) || availableAllocatedRlusd < 0) return false;
        return availableAllocatedRlusd < requiredRlusd;
      }
      const available = Number(selectedSendToken.value || 0);
      if (!Number.isFinite(available)) return false;
      return available < requiredAmount;
    };
    return {
      insufficientBalance: check(true),
      manualInsufficientBalance: check(false),
    };
  }, [sendPaymentRequest, selectedSendToken, sendAmount, sendFxInfo]);

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
  const requestMemo = sendPaymentRequest?.memo
    ? String(sendPaymentRequest.memo).trim()
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

  const copyRecipientAddress = async () => {
    const value = String(normalizedDestination || "").trim();
    if (!value || typeof navigator === "undefined") return;
    try {
      await navigator.clipboard.writeText(value);
      toast?.success?.(t("ui_address_copied", "Adresse copiée"));
    } catch {
      // ignore
    }
  };
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

  /* ── Scanner swipe-to-close (hook) ── */
  const {
    dragging: scanDragging,
    translateY: scanTranslateY,
    overlayRef: scanOverlayRef,
    maybeStartDrag: _scanStartDrag,
    handlePointerMove: scanSwipeMove,
    handlePointerEnd: scanSwipeEnd,
  } = useModalDragToClose({
    open: scanActive,
    inline: false,
    onClose: () => setScanActive(false),
    scrollContainerRef: null,
  });
  const scanSwipeStart = (e) => _scanStartDrag(e, 'fixed');

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

  const {
    dragging: overlayDragging,
    translateY: overlayTranslateY,
    overlayRef,
    closeRequestedRef,
    maybeStartDrag: maybeStartOverlayDrag,
    handlePointerMove: handleOverlayPointerMove,
    handlePointerEnd: handleOverlayPointerEnd,
  } = useModalDragToClose({
    open,
    inline,
    onClose,
    scrollContainerRef: scrollContainerRef,
    extraGuard: () => scanActive || (!hasPaymentRequest && (sendAssetDropdownOpen || amountFocused)),
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-send-modal wallet-modal-no-top-highlight-mobile border-white/10 md:border lg:border-0 p-4 md:p-5 pt-0 md:pt-0 space-y-4 flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)]",
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
		          className={`w-full bg-[#101415] ring-1 ring-white/15 ring-inset rounded-[20px] shadow-[0_4px_12px_rgba(0,0,0,0.4)] ${
		            !hasPaymentRequest ? "pl-8" : "pl-4"
		          } ${hasPaymentRequest ? "pr-4" : "pr-28"} py-3 text-base text-white outline-none focus:outline-none`}
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
      <div className="rounded-[20px] p-4 space-y-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
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
              onClick={copyRecipientAddress}
              className={[
                "font-mono text-xs text-white/80 text-left transition-colors",
                "underline decoration-white/25 underline-offset-2 hover:decoration-white/60",
              ].join(" ")}
              title={t("ui_copy_address", "Copier l’adresse")}
            >
              {compactDestinationLabel}
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
        {/* ── Destination (hidden when pre-filled from SendChoice) ── */}
        {!sendDestination ? recipientCard : null}

        {/* ── Devise + Montant (séparés) – masqués en mode payreq ── */}
        {!hasPaymentRequest && (
        <div className={`transition-opacity duration-300 space-y-4 ${hasDestination ? 'opacity-100' : 'opacity-30 pointer-events-none select-none'}`}>
          <h3 className="relative z-[50] text-[30px] md:text-[34px] font-bold text-white/95 tracking-tight text-center leading-snug">
            {t("ui_send_modal_title", "Montant à envoyer")}
          </h3>
          <p className="relative z-[50] text-[14px] md:text-[15px] text-white/55 text-center leading-relaxed -mt-2">
            {t("ui_send_devise_hint", "Choisissez la devise, saisissez le montant, puis vérifiez avant l’envoi.")}
          </p>
          <div className="flex justify-center relative z-[65]">
            {renderWalletMeta?.({
              variant: "pill-column",
              className: "flex justify-center relative z-[85]",
	            prefix: t("moonpay_from_account", "Compte source"),
              pillClassName: `bg-elevated ${sendAssetDropdownOpen
                ? "ring-1 ring-white/15 ring-inset shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_10px_rgba(255,255,255,0.16)]"
                : "shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]"} rounded-[20px]`,
            })}
          </div>
          <div>
            <div className="flex items-baseline justify-between mb-1.5 relative z-[65]">
              <label
                className="text-base md:text-lg text-white/60"
                title={t("ui_send_asset_tip", "Sélectionnez la devise à envoyer.")}
              >
                {t("ui_asset_e5170a7a06", "Devise")}
              </label>
            </div>
	            <ModalSelect
	              value={selectedSendToken ? selectedSendToken.key : ""}
	              onChange={setSendAssetKey}
                onOpenChange={setSendAssetDropdownOpen}
              hideSelected
              options={(augmentedTokens || []).map((token) => {
                const _currency = String(token?.currency || '').toUpperCase();
                const _fullName = getCurrencyDescription(_currency) || selectLabelByAssetKey?.[token.key] || selectLabelByAssetKey?.[token.currency] || token.currency;
                const labelLeftText = _fullName.length > 15 ? _fullName.slice(0, 15) + '…' : _fullName;
                const labelLeft = <span className="md:text-[1.12em]">{labelLeftText}</span>;
                const labelRightRaw =
                  selectLabelRightByAssetKey?.[token.key] ||
                  selectLabelRightByAssetKey?.[token.currency] ||
                  null;
                const isSelected = String(token.key) === String(selectedSendToken?.key || "");
                const labelRight =
                  !sendAssetDropdownOpen && isSelected
                    ? (
                      <span className="inline-flex items-center gap-[3px] text-[10px] text-white/30 tracking-normal font-normal">
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="opacity-50 shrink-0">
                          <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" stroke="currentColor" strokeWidth="1.5"/>
                          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/>
                        </svg>
                        <span>{t("ui_balances_short_label_aa12", "Solde disponible")}</span>
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
	              optionClassName="py-2 md:py-2.5 !text-base md:!text-lg !text-white/60"
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
          <div className="relative z-[2]">
            <div className="flex items-baseline justify-between mb-1.5 relative z-[65]">
              <label
                className="text-base md:text-lg text-white/60"
                title={t("ui_send_amount_tip", "Saisissez le montant à envoyer.")}
              >
                {t("ui_amount_52cea2dd3d", "Montant")}
              </label>
              {showCalculatedAmountLabel ? (
                <span className="inline-flex items-center rounded-full ring-1 ring-amber-300/30 ring-inset bg-amber-300/10 px-2 py-1 text-[10px] text-amber-200/90">
                  {t("ui_calculated_amount_label", "Montant calculé")}
                </span>
              ) : null}
            </div>
            <div
              className="bg-[#111518] rounded-[18px]"
              onFocus={() => setAmountFocused(true)}
              onBlur={() => setAmountFocused(false)}
            >
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
              placeholder="0.00"
              token={
                selectedSendToken
                  ? selectLabelByAssetKey?.[selectedSendToken.currency] ||
                    selectedSendToken.currency
                  : "USD"
              }
              tokenClassName="text-white/70 drop-shadow-sm text-2xl md:text-3xl font-semibold"
              containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-amount-shimmer [&_input]:!text-4xl [&_input]:md:!text-5xl [&_input]:font-bold [&_input]:placeholder:text-white/35"
            />
            </div>
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
      <div className="rounded-[16px] overflow-hidden">
        <div className="flex flex-col gap-1 px-6 pt-3 pb-2">
          <span className="text-[13px] md:text-[14px] text-white/45 font-normal">
            {t("ui_beneficiary_label", "Destinataire")} —{" "}
            <span className="text-white/85 font-semibold">
              {resolvedDestinationLabel || t("ui_wallet_unknown", "Unknown wallet")}
            </span>
          </span>
          {normalizedDestination ? (
            <span className="text-[13px] md:text-[14px] text-white/45 font-normal tabular-nums">
              {t("ui_account_number_label", "N° de compte")} —{" "}
              <button
                type="button"
                onClick={copyRecipientAddress}
                className="font-mono text-xcannes-green/80 hover:text-xcannes-green/95 transition-colors underline decoration-white/25 underline-offset-2 hover:decoration-white/60"
                title={t("ui_copy_address", "Copier l’adresse")}
              >
                {compactDestinationLabel}
              </button>
            </span>
          ) : null}
        </div>
        <div className="px-3 mt-3 mb-0">
          <div className="h-px bg-white/45 rounded-full" />
        </div>
        <div className="flex items-center justify-between px-4 pt-4 pb-4 mt-0.5 mx-1 mb-1 rounded-[12px]">
	          <span className="text-[15px] md:text-[16px] text-white/45 font-normal tracking-[0.02em]">
	            {t("ui_total_to_send_label", "Total à envoyer")}
	          </span>
          <span className={"text-3xl md:text-4xl font-bold tracking-tight " + (summaryAmount > 0 ? "text-white" : "text-white/75")}>
            {confirmAmountLabel || '0'}
          </span>
        </div>
      </div>
    </div>
  ) : null;

  /* ── Payreq final step – shown when a payment request was scanned ── */
  const payreqFinalStep = hasPaymentRequest ? (
    <div className="space-y-6">
      {/* Title + subtitle */}
      <div className="text-center space-y-2 pt-1">
        <h3 className="text-[26px] md:text-[28px] font-semibold text-white/95 tracking-tight">
	          {t("ui_payreq_summary_title", "Résumé de la demande")}
        </h3>
        <p className="text-[14px] md:text-[15px] text-white/60 max-w-[34ch] mx-auto leading-relaxed">
	          {t("ui_payreq_summary_subtitle", "Vérifiez les détails avant de confirmer le paiement.")}
        </p>
        <div className="mt-[40px] flex justify-center">
          {renderWalletMeta?.({
            variant: "pill-column",
            className: "flex justify-center",
            prefix: t("moonpay_from_account", "Compte source"),
            pillClassName: "bg-elevated shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)] rounded-[20px]",
          })}
        </div>
      </div>

      {/* Summary lines – flat, no box */}
      <div className="space-y-4">
        <div className="flex items-baseline justify-between gap-4">
	          <span className="text-[15px] text-white/50">{t("ui_payreq_requested_by_label", "Demandé par")}</span>
          <span className="text-[22px] font-semibold text-white truncate text-right">
            {payreqSelectorLabel || t("ui_wallet_unknown", "Unknown wallet")}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] text-white/50">{t("ui_address", "Adresse")}</span>
          <button
            type="button"
            onClick={() => setShowFullPayreqAddress((prev) => !prev)}
            className="font-mono text-[15px] text-white/70 text-right underline decoration-white/25 underline-offset-2 hover:decoration-white/60 transition-colors truncate max-w-[60%]"
            title={t("ui_toggle_full_account_number", "Afficher/masquer l'adresse complète")}
          >
            {showFullPayreqAddress ? requestDestination : requestDestinationLabel}
          </button>
        </div>
        <div className="flex items-baseline justify-between gap-4">
          <span className="text-[15px] text-white/50">{t("ui_currency_label", "Devise")}</span>
          <span className="text-[17px] text-white/90">{requestCurrencyCode || confirmCurrencyCode || "—"}</span>
        </div>
        {requestMemo ? (
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[15px] text-white/50">{t("ui_memo_label", "Motif")}</span>
            <span className="text-[15px] text-white/80 text-right max-w-[60%] break-words">{requestMemo}</span>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-4">
	          <span className="text-[20px] text-white/90">{t("ui_total_to_send_label", "Total à envoyer")}</span>
          <span className="text-3xl font-semibold text-white">{requestAmountLabel || "—"}</span>
        </div>
      </div>

      {selfSendBlocked ? (
        <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2 text-xs text-orange-200/90">
          <div className="font-semibold">
            {t("ui_invalid_recipient_title", "Destinataire invalide")}
          </div>
          <div>
            {t("ui_cannot_send_to_self", "Vous ne pouvez pas envoyer à votre propre compte.")}
          </div>
        </div>
      ) : null}
      {saveAddressBlock}

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

  const sendButtonDisabled = sendProcessing ||
    !canManualSend ||
    (hasPaymentRequest && insufficientBalance) ||
    (!hasPaymentRequest && manualInsufficientBalance) ||
    selfSendBlocked;

	  const sendButtonLabel = sendProcessing
	    ? hasMoonpaySellRequest
	      ? t("moonpay_sell_signing_action", "Signature en cours...")
	      : t("ui_sending_3b8c1a7d5e", "Sending...")
	    : hasMoonpaySellRequest
	      ? t("moonpay_sell_sign_submit", "Signer et envoyer")
	      : hasPaymentRequest
	        ? t("ui_confirm_payment_button", "Confirmer le paiement")
	        : t("ui_send_504b64a87b", "Envoyer");

  const sendActions = (
    <div className="sticky bottom-0 pt-8 pb-3 mt-auto space-y-2 bg-inherit z-10 relative">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={sendButtonDisabled}
        className={[
          "md:hidden w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
          sendButtonDisabled
            ? sendProcessing ? "opacity-45 cursor-not-allowed" : "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
            : "text-white hover:scale-[1.01] active:scale-[0.98]",
        ].join(" ")}
        style={sendButtonDisabled
          ? sendProcessing ? { background: 'linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)', color: 'rgba(255,255,255,0.4)' } : undefined
          : { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
        }
      >
        {sendButtonDisabled && !sendProcessing
          ? <span className="inline-flex items-center gap-1.5 text-white/20">
              <span className="text-[14px]">{t('ui_send_fill_cta', 'Choisissez la devise et le montant')}</span>
              <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                <span className="send-modal-dot" style={{ animationDelay: '0s' }}>·</span>
                <span className="send-modal-dot" style={{ animationDelay: '0.6s' }}>·</span>
                <span className="send-modal-dot" style={{ animationDelay: '1.2s' }}>·</span>
              </span>
            </span>
          : sendButtonLabel}
      </button>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleManualSend();
        }}
        disabled={sendButtonDisabled}
        className={[
          "hidden md:flex items-center justify-center w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
          sendButtonDisabled
            ? sendProcessing ? "opacity-45 cursor-not-allowed" : "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
            : "text-white hover:scale-[1.01] active:scale-[0.98]",
        ].join(" ")}
        style={sendButtonDisabled
          ? sendProcessing ? { background: 'linear-gradient(180deg, rgba(34,154,86,0.65) 0%, rgba(14,103,58,0.65) 100%)', color: 'rgba(255,255,255,0.4)' } : undefined
          : { background: 'linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)', boxShadow: '0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)' }
        }
      >
        {sendButtonDisabled && !sendProcessing
          ? <span className="inline-flex items-center gap-1.5 text-white/20">
              <span className="text-[16px]">{t('ui_send_fill_cta', 'Choisissez la devise et le montant')}</span>
              <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                <span className="send-modal-dot" style={{ animationDelay: '0s' }}>·</span>
                <span className="send-modal-dot" style={{ animationDelay: '0.6s' }}>·</span>
                <span className="send-modal-dot" style={{ animationDelay: '1.2s' }}>·</span>
              </span>
            </span>
          : sendButtonLabel}
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

  const scannerModal = scanActive
    ? createPortal(
        <div className="fixed inset-0 z-[10002] flex flex-col">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-[#101415] backdrop-blur-sm"
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
            className="relative flex-1 flex flex-col items-center justify-center bg-elevated"
            style={{
              transform: `translateY(${Math.max(0, scanTranslateY)}px)`,
              opacity: scanTranslateY > 0 ? Math.max(0, Math.min(1, 1 - scanTranslateY / 420)) : undefined,
              transition: scanDragging ? "none" : "transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)",
              willChange: scanTranslateY ? "transform" : undefined,
              touchAction: "none",
            }}
            onPointerDown={scanSwipeStart}
            onPointerMove={scanSwipeMove}
            onPointerUp={scanSwipeEnd}
            onPointerCancel={scanSwipeEnd}
          >
            {/* Swipe bar (mobile only) */}
            <div className="md:hidden flex justify-center pt-3 pb-0" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
            {/* Titre */}
            <p className="w-full text-center text-sm text-white/45 px-6 pt-4 pb-0">
              Scannez une adresse, une demande de paiement ou un QR de connexion.
            </p>
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
                className="bg-elevated w-full h-full flex flex-col justify-center [&_video]:w-full [&_video]:h-full [&_video]:object-cover"
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
            opacity: overlayTranslateY > 0 ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420)) : undefined,
            willChange: overlayTranslateY ? "transform" : undefined,
            touchAction: inline ? undefined : "none",
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
            onPointerDown={(event) => {
              if (inline) return;
              // Skip if the event originates from inside the scroll container
              // (it has its own handler with scroll-aware source)
              if (scrollContainerRef.current?.contains(event.target)) return;
              maybeStartOverlayDrag(event, "fixed");
            }}
          >
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className={`absolute inset-0 md:hidden ${hasPaymentRequest ? 'bg-[radial-gradient(700px_circle_at_100%_50%,rgba(245,166,35,0.07),transparent_60%)]' : 'bg-[radial-gradient(700px_circle_at_100%_50%,rgba(0,255,150,0.07),transparent_60%)]'}`} />
              <div className={`absolute inset-0 hidden md:block ${hasPaymentRequest ? 'bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(245,166,35,0.07),transparent_60%)]' : 'bg-[radial-gradient(1000px_circle_at_100%_50%,rgba(0,255,150,0.07),transparent_60%)]'}`} />
            </div>
            <div className="relative z-10 flex flex-col flex-1 min-h-0">
            {!inline ? (
              <div
                className="md:hidden flex justify-center pt-0 pb-0 touch-none"
                aria-hidden
                onPointerDown={(event) => {
                  maybeStartOverlayDrag(event, "fixed");
                }}
              >
                <span className="block w-12 h-1.5 rounded-full bg-white/20" />
              </div>
            ) : null}
            <div
              className={`flex items-start justify-between gap-3 relative z-[65] touch-none ${hasPaymentRequest ? 'mb-[110px] md:mb-[140px]' : 'mb-[54px] md:mb-[60px]'}`}
              onPointerDown={(event) => {
                maybeStartOverlayDrag(event, "fixed");
              }}
            >
              <div className="flex min-w-0 flex-col gap-1.5 w-full">
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
              style={{ touchAction: 'pan-y' }}
              onPointerDown={(event) => {
                // payreq: contenu court, pas de scroll → source fixe (pas de garde scrollTop)
                // manual: source list → se déclenche uniquement en haut de liste
                maybeStartOverlayDrag(event, hasPaymentRequest ? "fixed" : "list");
              }}
            >
              <div className="flex flex-col gap-3">
                {hasPaymentRequest ? payreqFinalStep : manualForm}
                {!hasPaymentRequest && !hasMoonpaySellRequest ? inlineSummary : null}
                {scannerModal}
                {sendActions}
              </div>
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
