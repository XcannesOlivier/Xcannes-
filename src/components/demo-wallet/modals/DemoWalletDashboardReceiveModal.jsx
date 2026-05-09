"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useIsDesktop from "../hooks/useIsDesktop";
import { QRCodeCanvas } from "qrcode.react";
import ModalSelect from "@/components/ui/ModalSelect";
import TokenAmountInput from "@/components/ui/TokenAmountInput";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { getCurrencySymbol } from "../demoWalletDashboardConfig";
import { buildDemoPayreq, encodeDemoPayreqQR } from "../utils/demoXrplMemo";
import { useModalTransition } from "@/hooks/useModalTransition";
import {
  modalSelectButtonCls,
  modalSelectListCls,
} from "./demoWalletModalTokens";

const ShareIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

const ChevronRightIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ShareAddressIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 512 512"
    fill="none"
    stroke="currentColor"
    className={className}
    aria-hidden="true"
  >
    <path
      d="m 111.4077,90.352932 h 210 q 30,0 30,29.999998 v 70"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m 111.4077,90.352932 q -30,0 -30,29.999998 v 270 q 0,30 30,30 h 190"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="211.4077"
      cy="180.35294"
      r="40"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m 161.4077,270.35293 q 0,-50 50,-50 50,0 50,50 z"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="151.4077"
      y1="320.35294"
      x2="261.40771"
      y2="320.35294"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="151.4077"
      y1="360.35294"
      x2="231.4077"
      y2="360.35294"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m 331.4077,230.35293 a 110,110 0 0 1 150,40"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="m 482.23792,248.22696 -1.2558,23.90549 -18.84109,-8.17252"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="380.40771"
      cy="340.35294"
      r="95"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="332.08789"
      cy="337.79172"
      r="16"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="412.25491"
      cy="299.17853"
      r="16"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <circle
      cx="416.71741"
      cy="382.14252"
      r="16"
      strokeWidth="14"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <line
      x1="346.5"
      y1="330.8"
      x2="397.8"
      y2="306.1"
      strokeWidth="14"
      strokeLinecap="round"
    />
    <line
      x1="346.3"
      y1="345.2"
      x2="402.5"
      y2="374.7"
      strokeWidth="14"
      strokeLinecap="round"
    />
  </svg>
);

const RequestIcon = ({ className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="0.9"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    aria-hidden="true"
  >
    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7l-5-5Z" />
    <path d="M15 2v5h5" />
    <path d="M12 10v6" />
    <path d="M10 11.5c0-.83.67-1.5 2-1.5s2 .67 2 1.5-.9 1.3-2 1.5c-1.1.2-2 .67-2 1.5 0 .83.67 1.5 2 1.5s2-.67 2-1.5" />
  </svg>
);

export default function DemoWalletDashboardReceiveModal({
  open,
  onClose,
  noticeVariant = "preview",
  renderWalletMeta,
  wallet,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  unallocatedUsd = null,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  augmentedTokens,
  requestMemo,
  setRequestMemo,
  walletLabel,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const isDesktop = useIsDesktop();
  const [copyToast, setCopyToast] = useState("");
  const copyToastTimerRef = useRef(null);
  const autoCloseTimerRef = useRef(null);
  const receiveQrContainerRef = useRef(null);
  const requestQrContainerRef = useRef(null);
  const requestPreviewRef = useRef(null);
  const [qrZoomValue, setQrZoomValue] = useState(null);
  const [receiveView, setReceiveView] = useState("choice");
  const formatUnits = (value, currencyCode = "USD") => {
    const num = Number(value);
    if (!Number.isFinite(num)) return "0";
    const symbol = getCurrencySymbol(currencyCode, locale);
    try {
      const formatted = new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
      }).format(num);
      return symbol ? `${formatted} ${symbol}` : formatted;
    } catch {
      const formatted = num.toFixed(2);
      return symbol ? `${formatted} ${symbol}` : formatted;
    }
  };
  const unallocatedUsdValue = Number.isFinite(Number(unallocatedUsd))
    ? Number(unallocatedUsd)
    : null;

  const requestCurrencyCode = useMemo(
    () =>
      String(requestCurrency || "")
        .trim()
        .toUpperCase(),
    [requestCurrency],
  );

  useEffect(() => {
    if (!open) {
      setGeneratedRequest(null);
      setGenerateError(null);
      setQrZoomValue(null);
      setCopyToast("");
      setReceiveView("choice");
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        window.clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
      if (autoCloseTimerRef.current) {
        window.clearTimeout(autoCloseTimerRef.current);
        autoCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setGeneratedRequest(null);
    setGenerateError(null);
    setQrZoomValue(null);
    if (receiveView === "request_qr") setReceiveView("request");
  }, [wallet, requestAmount, requestCurrency, requestMemo, receiveView]);

  const switchReceiveView = (nextView) => {
    setGenerateError(null);
    setCopyToast("");
    setQrZoomValue(null);
    setReceiveView(nextView);
  };

  const handleGenerateRequest = () => {
    setGenerateError(null);

    const amount = Number.parseFloat(requestAmount || "0");
    if (!Number.isFinite(amount) || amount <= 0) {
      setGenerateError(
        t(
          "ui_request_error_invalid_amount_5bd214c9a7",
          "Please enter a valid amount.",
        ),
      );
      return;
    }

    if (!wallet) {
      setGenerateError(
        t(
          "ui_request_error_missing_wallet_4f7a2c9b1e",
          "Wallet address is missing.",
        ),
      );
      return;
    }

    const targetCurrencyCode = requestCurrencyCode || "RLUSD";
    const targetCurrencyUpper = String(targetCurrencyCode || "").toUpperCase();
    const displayCurrencyUpper =
      targetCurrencyUpper === "RLUSD" ? "USD" : targetCurrencyUpper;

    const beneficiaryLabel = String(walletLabel || "").trim() || null;
    const req = buildDemoPayreq({
      to: wallet,
      currency: displayCurrencyUpper,
      amount,
      beneficiary: beneficiaryLabel,
    });

    setGeneratedRequest(req);
    setReceiveView("request_qr");
  };

  const flashCopyToast = (message, autoClose = false) => {
    const text = String(message || "").trim();
    if (!text) return;
    setCopyToast(text);
    if (copyToastTimerRef.current) {
      window.clearTimeout(copyToastTimerRef.current);
    }
    if (autoCloseTimerRef.current) {
      window.clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }
    copyToastTimerRef.current = window.setTimeout(() => {
      setCopyToast("");
      copyToastTimerRef.current = null;
    }, 1300);
    if (autoClose) {
      autoCloseTimerRef.current = window.setTimeout(() => {
        autoCloseTimerRef.current = null;
        onClose?.();
      }, 1400);
    }
  };

  const dataUrlToBlob = (url) => {
    const parts = url.split(",");
    if (parts.length !== 2) return null;
    const mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/png";
    const binary = atob(parts[1]);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new Blob([bytes], { type: mime });
  };

  const buildQrBlob = (useRequest = hasGeneratedRequest) => {
    const container = useRequest
      ? requestQrContainerRef.current
      : receiveQrContainerRef.current;
    const canvas = container?.querySelector?.("canvas");
    if (!canvas) return null;
    const srcWidth = canvas.width;
    const srcHeight = canvas.height;
    const baseScale = useRequest ? 4 : 3;
    const marginRatio = useRequest ? 0.12 : 0.1;
    const margin = Math.max(24, Math.round(srcWidth * marginRatio));
    const maxExportWidth = 1600;
    const safeScale = Math.min(
      baseScale,
      maxExportWidth / (srcWidth + margin * 2),
    );
    const scale = Math.max(1.8, safeScale);
    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = (srcWidth + margin * 2) * scale;
    exportCanvas.height = (srcHeight + margin * 2) * scale;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return null;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);
    const offset = margin * scale;
    ctx.drawImage(canvas, offset, offset, srcWidth * scale, srcHeight * scale);
    const dataUrl = exportCanvas.toDataURL("image/png");
    return dataUrlToBlob(dataUrl);
  };

  const downloadBlob = (blob, filename) => {
    if (!blob || !filename) return;
    try {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // noop
    }
  };

  const handleCopyQr = async (useRequest = hasGeneratedRequest) => {
    const fallbackText = useRequest ? requestQrValue : receiveQrValue;
    const blob = buildQrBlob(useRequest);

    if (!isDesktop && fallbackText) {
      if (navigator?.clipboard?.writeText) {
        try {
          await navigator.clipboard.writeText(fallbackText);
          flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"), true);
          return;
        } catch {
          // fall through to execCommand
        }
      }
      try {
        const el = document.createElement("textarea");
        el.value = fallbackText;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) {
          flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"), true);
          return;
        }
      } catch {
        // fall through
      }
    }

    if (typeof ClipboardItem !== "undefined" && navigator?.clipboard?.write) {
      try {
        if (blob) {
          const items = { "image/png": blob };
          if (fallbackText) {
            items["text/plain"] = new Blob([fallbackText], {
              type: "text/plain",
            });
          }
          const item = new ClipboardItem(items);
          await navigator.clipboard.write([item]);
          flashCopyToast(t("ui_qr_copied_7b1a9c", "QR copié"), true);
          return;
        }
      } catch {
        // fall through to text copy
      }
    }

    if (navigator?.clipboard?.writeText && fallbackText) {
      try {
        await navigator.clipboard.writeText(fallbackText);
        flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"), true);
        return;
      } catch {
        // fall through to execCommand
      }
    }

    if (fallbackText) {
      try {
        const el = document.createElement("textarea");
        el.value = fallbackText;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.left = "-9999px";
        document.body.appendChild(el);
        el.focus();
        el.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(el);
        if (ok) {
          flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"), true);
          return;
        }
      } catch {
        // fall through
      }
    }

    flashCopyToast(
      t("ui_qr_copy_failed_a1b2c3", "Impossible de copier le QR"),
    );
  };

  const handleShareQr = async (useRequest = hasGeneratedRequest) => {
    const fallbackText = useRequest ? requestQrValue : receiveQrValue;
    const blob = buildQrBlob(useRequest);

    if (isDesktop || !navigator?.share) {
      if (blob) {
        downloadBlob(blob, "xcannes-qr.png");
        flashCopyToast(t("ui_qr_downloaded_2f1a7c9d5e", "QR téléchargé"), true);
        return;
      }
      if (fallbackText) {
        downloadBlob(
          new Blob([fallbackText], { type: "text/plain" }),
          "xcannes-qr.txt",
        );
        flashCopyToast(t("ui_code_downloaded_5c1d2e7f9a", "Code téléchargé"), true);
        return;
      }
      flashCopyToast(
        t("ui_share_unavailable_3b7c1a9d5e", "Partager indisponible"),
      );
      return;
    }

    const shareData = {};
    shareData.title = t("ui_share_qr_title_7f2a1b9c5e", "XCANNES QR");

    if (blob && typeof File !== "undefined") {
      const file = new File([blob], "xcannes-qr.png", {
        type: blob.type || "image/png",
      });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
    }

    if (!shareData.files && fallbackText) shareData.text = fallbackText;

    try {
      await navigator.share(shareData);
      flashCopyToast(t("ui_shared_ok_5c1d2e7f9a", "Partagé"), true);
    } catch (err) {
      if (err?.name === "AbortError") return;
      flashCopyToast(t("ui_share_failed_1a2b3c", "Partage impossible"));
    }
  };

  const requestQrValue = useMemo(() => {
    return encodeDemoPayreqQR(generatedRequest);
  }, [generatedRequest]);
  const hasGeneratedRequest = Boolean(generatedRequest && requestQrValue);
  const qrPixelSize = inline ? 360 : 560;
  const requestQrPixelSize = inline ? 360 : 560;
  const requestDisplayCurrency = String(
    generatedRequest?.ccy || requestCurrencyCode || "USD",
  )
    .trim()
    .toUpperCase();
  const requestDisplayAmount =
    generatedRequest?.amt ?? Number.parseFloat(requestAmount || "0");
  const requestDisplayAmountLabel = Number.isFinite(
    Number(requestDisplayAmount),
  )
    ? formatUnits(requestDisplayAmount, requestDisplayCurrency)
    : formatUnits(0, requestDisplayCurrency);
  const receiveQrValue = useMemo(() => {
    if (!wallet) return "";
    const label = String(walletLabel || "").trim();
    if (!label) return `xrpl:${wallet}`;
    return `xrpl:${wallet}?label=${encodeURIComponent(label)}`;
  }, [wallet, walletLabel]);

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  // After generating a request, scroll the modal to the generated QR block.
  useEffect(() => {
    if (!shouldRender) return;
    if (!hasGeneratedRequest) return;
    const el = requestPreviewRef.current;
    if (!el) return;
    try {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch {
      // ignore
    }
  }, [hasGeneratedRequest, shouldRender]);

  if (!shouldRender) return null;

  const canNativeShare =
    !isDesktop &&
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function";
  const shareActionLabel = canNativeShare
    ? t("ui_share_qr_cta", "Partager")
    : t("ui_download", "Télécharger");

  const headerTitle =
    receiveView === "choice"
      ? t("ui_receive_title_short", "Recevoir")
      : receiveView === "share"
        ? t("ui_receive_share_header_title", "Votre adresse de compte")
        : receiveView === "request_qr"
          ? t("ui_request_generated_label", "Demande prête")
          : t("ui_receive_choice_request_title", "Demander un paiement");
  const headerSubtitle =
    receiveView === "choice"
      ? t(
          "ui_receive_choice_subtitle",
          "Choisissez comment recevoir un paiement.",
        )
      : receiveView === "share"
        ? t(
            "ui_receive_choice_share_desc",
            "Partagez votre QR code ou votre adresse de réception.",
          )
        : receiveView === "request_qr"
          ? t(
              "ui_request_qr_subtitle",
              "Partagez ce QR code pour recevoir le paiement.",
            )
          : t(
              "ui_receive_choice_request_desc",
              "Créez une demande avec un montant, une devise et un message facultatif.",
            );

  const choiceCardBaseClassName =
    "relative w-full text-left rounded-[20px] px-4 py-[18px] bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-xcannes-green/60";

  const amountNumber = Number.parseFloat(requestAmount || "0");
  const generateButtonDisabled = !Number.isFinite(amountNumber) || amountNumber <= 0;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-receive-modal p-4 space-y-0 flex flex-col min-h-0 overflow-y-auto overscroll-contain pointer-events-auto pb-[env(safe-area-inset-bottom)]",
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

  const content = (
    <>
      {/* ── QR Fullscreen Zoom Overlay ── */}
      {qrZoomValue ? (
        <div
          className="fixed inset-0 z-[10010] flex items-center justify-center bg-black/95 backdrop-blur-md"
          onClick={() => setQrZoomValue(null)}
        >
          <button
            type="button"
            onClick={() => setQrZoomValue(null)}
            className="absolute top-6 right-6 z-10 w-10 h-10 rounded-full bg-white/10 ring-1 ring-white/20 flex items-center justify-center text-white/80 hover:bg-white/20 transition-colors duration-150"
            aria-label={t("ui_close", "Fermer")}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
          <div
            className="w-[80vw] max-w-[360px] aspect-square rounded-none border-[20px] border-black flex items-center justify-center"
            style={{ backgroundColor: "#E8E8E8" }}
            onClick={(e) => e.stopPropagation()}
          >
            <QRCodeCanvas
              value={qrZoomValue}
              size={1024}
              style={{ width: "100%", height: "100%", display: "block" }}
              bgColor="#E8E8E8"
              fgColor="#000000"
              includeMargin={true}
              level="M"
            />
          </div>
        </div>
      ) : null}

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
          <div className="pointer-events-none absolute inset-0" aria-hidden>
            {receiveView === "request_qr" ? (
              <>
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_88%_0%,rgba(255,255,255,0.07),transparent_50%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_100%_75%,rgba(0,255,150,0.06),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_0%_100%,rgba(0,255,150,0.04),transparent_65%)]" />
              </>
            ) : (
              <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_100%_50%,rgba(0,255,150,0.07),transparent_60%)]" />
            )}
          </div>

          {!inline ? (
            <div className="flex justify-center -mt-1 pt-1 pb-2" aria-hidden>
              <span className="block w-12 h-1.5 rounded-full bg-white/20" />
            </div>
          ) : null}

          {receiveView !== "choice" ? (
            <div className="relative z-[66] pt-2 pb-3 flex flex-col items-center text-center">
              <h2 className="mt-[19px] text-[30px] font-bold text-white/95 tracking-tight">
                {headerTitle}
              </h2>

              {noticeVariant === "demo" ? (
                <span className="mt-2 inline-flex items-center text-white/80 text-sm font-semibold px-2 py-1 leading-none">
                  {t("demo_notice_title", "Mode démo")}
                </span>
              ) : null}

              <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] leading-relaxed">
                {headerSubtitle}
              </p>
            </div>
          ) : null}

          <div className="flex-1 min-h-0 flex flex-col">
            {receiveView === "choice" ? (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="pt-[80px] pb-0 flex flex-col items-center text-center">
                  <h3 className="mt-1 text-[30px] font-semibold text-white/95 tracking-tight">
                    {t(
                      "ui_receive_choice_decision_title",
                      "Comment souhaitez-vous recevoir ?",
                    )}
                  </h3>
                  <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t(
                      "ui_receive_choice_decision_subtitle",
                      "Partagez vos coordonnées de réception ou créez une demande de paiement.",
                    )}
                  </p>
                </div>

                <div className="flex-1 min-h-0 flex flex-col justify-center gap-5 pt-[10px] pb-6">
                  <button
                    type="button"
                    className={choiceCardBaseClassName}
                    onClick={(e) => {
                      e.stopPropagation();
                      switchReceiveView("share");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-13 h-13 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 text-white/90">
                        <ShareAddressIcon className="w-12 h-12" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[18px] font-semibold text-white truncate">
                            {t(
                              "ui_receive_choice_share_title",
                              "Partager votre adresse",
                            )}
                          </div>
                          <ChevronRightIcon className="w-5 h-5 text-white/45" />
                        </div>
                        <div className="mt-1 text-[15px] leading-snug text-white/60">
                          {t(
                            "ui_receive_choice_share_desc",
                            "Affichez votre QR code et votre adresse de réception.",
                          )}
                        </div>
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={choiceCardBaseClassName}
                    onClick={(e) => {
                      e.stopPropagation();
                      switchReceiveView("request");
                    }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-[16px] bg-transparent flex items-center justify-center flex-shrink-0 text-white/85">
                        <RequestIcon className="w-11 h-11" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-[18px] font-semibold text-white truncate">
                            {t(
                              "ui_receive_choice_request_title",
                              "Demander un paiement",
                            )}
                          </div>
                          <ChevronRightIcon className="w-5 h-5 text-white/45" />
                        </div>
                        <div className="mt-1 text-[15px] leading-snug text-white/60">
                          {t(
                            "ui_receive_choice_request_desc",
                            "Créez une demande avec un montant, une devise et un message facultatif.",
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            ) : null}

            {receiveView === "share" ? (
              <div className="space-y-5 pt-2 relative z-[2]">
                <div className="flex justify-center pt-1 pb-1">
                  <div className="inline-flex flex-col items-center gap-1 bg-elevated px-6 py-2 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                    <span className="text-white/70 text-[14px] font-medium tracking-wide">
                      {t(
                        "ui_receive_account_info_label",
                        "Choisissez le compte",
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse"
                        aria-hidden
                      />
                      <span className="text-white/95 text-[14px] font-semibold">
                        {String(walletLabel || "").trim() ||
                          t("nav_wallet", "Wallet")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="w-full flex flex-col items-center bg-[#232829] rounded-[20px] pt-10 pb-3 shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_-2px_0_rgba(0,0,0,0.6)_inset,-10px_28px_55px_rgba(0,0,0,0.72),18px_10px_42px_rgba(0,0,0,0.38),2px_60px_36px_-16px_rgba(0,0,0,0.65),-6px_-14px_28px_rgba(0,0,0,0.22)]">
                  <div
                    ref={receiveQrContainerRef}
                    className="w-[280px] aspect-square rounded-none p-3 cursor-pointer border-[20px] border-black"
                    style={{ backgroundColor: "#E8E8E8" }}
                    onClick={() => setQrZoomValue(receiveQrValue)}
                  >
                    <QRCodeCanvas
                      value={receiveQrValue || ""}
                      size={qrPixelSize}
                      style={{ width: "100%", height: "100%" }}
                      bgColor="#E8E8E8"
                      fgColor="#000000"
                      includeMargin={false}
                      level="M"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setQrZoomValue(receiveQrValue)}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[17px] text-white/70 hover:text-white/90 transition-colors duration-150"
                    aria-label={t(
                      "ui_enlarge_qr",
                      "Agrandir le QR code",
                    )}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-7 h-7"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                      />
                    </svg>
                    {t("ui_enlarge_qr_label", "Agrandir le QR code")}
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await handleCopyQr(false);
                    }}
                    className={[
                      "w-full h-11 rounded-[20px] bg-[#101415] ring-1 ring-white/10 ring-inset text-white/85 text-xs font-semibold",
                      "shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]",
                    ].join(" ")}
                    style={{ marginTop: "50px" }}
                  >
                    {t("ui_copy_address", "Copier l’adresse")}
                  </button>
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      await handleShareQr(false);
                    }}
                    className="w-full h-11 rounded-[20px] bg-[#101415] text-white text-[17px] font-bold tracking-wide py-2 px-6 transition-all duration-[140ms] inline-flex items-center justify-center gap-2.5 hover:bg-white/[0.04] scale-[1.04] active:scale-[0.98]"
                    style={{
                      boxShadow:
                        "0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 16px rgba(0,0,0,0.25)",
                      marginTop: "50px",
                    }}
                  >
                    <ShareIcon className="w-5 h-5" />
                    <span>{shareActionLabel}</span>
                  </button>
                </div>
              </div>
            ) : null}

            {receiveView === "request" ? (
              <div className="flex flex-col gap-2 pt-2 flex-1 relative z-[2]">
                <div className="flex justify-center pt-1 pb-1">
                  <div className="inline-flex flex-col items-center gap-1 bg-elevated px-6 py-2 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                    <span className="text-white/70 text-[14px] font-medium tracking-wide">
                      {t(
                        "ui_receive_receiving_account_label",
                        "Compte de réception",
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse"
                        aria-hidden
                      />
                      <span className="text-white/95 text-[14px] font-semibold">
                        {String(walletLabel || "").trim() ||
                          t("nav_wallet", "Wallet")}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="block text-[13px] tracking-normal font-medium text-white/55 mb-2">
                    {t("ui_currency_1ed55673be", "Devise")}
                  </label>
                  <ModalSelect
                    value={requestCurrency}
                    onChange={setRequestCurrency}
                    options={(augmentedTokens || []).map((token) => {
                      const currencyUpper = String(
                        token.currency || "",
                      ).toUpperCase();
                      const labelLeft =
                        selectLabelByCurrency?.[token.currency] ||
                        selectLabelByCurrency?.[currencyUpper] ||
                        token.currency;
                      const baseLabelRight =
                        selectLabelRightByCurrency?.[token.currency] ||
                        selectLabelRightByCurrency?.[currencyUpper] ||
                        null;
                      const labelRight =
                        currencyUpper === "RLUSD" && unallocatedUsdValue !== null
                          ? formatUnits(unallocatedUsdValue, "USD")
                          : baseLabelRight;
                      return {
                        value: token.currency,
                        icon:
                          selectIconByCurrency?.[token.currency] ||
                          selectIconByCurrency?.[currencyUpper] ||
                          null,
                        label: labelLeft,
                        labelLeft,
                        labelRight,
                        labelMobile:
                          selectLabelMobileByCurrency?.[token.currency] ||
                          selectLabelMobileByCurrency?.[currencyUpper] ||
                          labelLeft,
                      };
                    })}
                    useNativeSelect={false}
                    hideSelected
                    showMobileOptionRight={true}
                    backdropClassName="bg-black/80 backdrop-blur-[4px] !z-[65]"
                    iconClassName="text-3xl leading-none"
                    optionIconClassName="text-2xl leading-none opacity-60"
                    optionClassName="py-2 !text-base !text-white/60"
                    menuHeader={t("ui_your_balances_header", "Vos soldes")}
                    menuClassName={
                      noticeVariant === "demo"
                        ? "bg-xcannes-surface-demo max-h-[420px] overflow-y-auto overscroll-contain touch-pan-y !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px]"
                        : "bg-[#101415] max-h-[420px] overflow-y-auto overscroll-contain touch-pan-y !border-white/10 !ring-1 !ring-white/10 ring-inset rounded-b-[14px]"
                    }
                    openButtonClassName="!bg-white/10 !border !border-white/10 !border-b-0 !rounded-b-none !ring-1 !ring-white/10 !shadow-[0_8px_18px_rgba(0,0,0,0.45)]"
                    buttonClassName={modalSelectButtonCls}
                    selectClassName={modalSelectListCls}
                  />
                </div>

                <div className="pt-4">
                  <label className="block text-[13px] tracking-normal font-medium text-white/55 mb-2">
                    {t("ui_amount_7668986206", "Montant")}
                  </label>
                  <div className="relative z-[2] bg-[#111518] rounded-[18px]">
                    <TokenAmountInput
                      value={requestAmount}
                      onChange={setRequestAmount}
                      placeholder="0.00"
                      token={requestCurrencyCode || "USD"}
                      tokenClassName="text-white/70 drop-shadow-sm text-2xl font-semibold"
                      containerClassName="pt-5 pb-5 rounded-[18px] bg-[#111518] ring-1 ring-white/10 ring-inset transition-all duration-200 shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] focus-within:ring-white/25 focus-within:shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30),0_0_0_1px_rgba(255,255,255,0.10),0_0_24px_rgba(255,255,255,0.06)] wallet-amount-shimmer [&_input]:!text-4xl [&_input]:font-bold [&_input]:placeholder:text-white/35"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <label className="block text-[11px] tracking-[0.22em] text-white/45 mb-2">
                    {t("ui_message_optional_label", "Message facultatif")}
                  </label>
                  <div className="relative z-[2] bg-[#101415] rounded-[12px]">
                    <input
                      type="text"
                      value={requestMemo}
                      onChange={(e) => setRequestMemo(e.target.value.slice(0, 40))}
                      maxLength={40}
                      placeholder={t(
                        "ui_request_memo_placeholder",
                        "Motif de la demande",
                      )}
                      className={`w-full ring-1 ring-white/10 ring-inset rounded-[12px] px-3.5 py-2 text-base text-white placeholder:text-white/25 focus:outline-none transition-colors duration-150 ${
                        noticeVariant === "demo"
                          ? "bg-xcannes-surface-demo"
                          : "bg-[#101415]"
                      }`}
                    />
                  </div>
                </div>

                <div className="mt-auto pt-6 pb-[85px]">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateRequest();
                    }}
                    disabled={generateButtonDisabled}
                    className={[
                      "w-full h-14 rounded-[20px] text-lg font-semibold transition-all duration-200 tracking-[-0.01em]",
                      generateButtonDisabled
                        ? "bg-xcannes-green/[0.07] text-xcannes-green/60 cursor-not-allowed ring-[0.5px] ring-xcannes-green/40 ring-inset"
                        : "text-white hover:scale-[1.01] active:scale-[0.98]",
                    ].join(" ")}
                    style={
                      generateButtonDisabled
                        ? undefined
                        : {
                            background:
                              "linear-gradient(180deg, rgba(34,154,86,1) 0%, rgba(14,103,58,1) 100%)",
                            boxShadow:
                              "0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)",
                          }
                    }
                  >
                    {generateButtonDisabled ? (
                      <span className="inline-flex items-center gap-1.5 text-white/20">
                        <span className="text-xs">
                          {t("ui_complete_request_cta", "Compléter votre demande")}
                        </span>
                        <span className="inline-flex items-end gap-[3px] mb-[-1px]">
                          <span
                            className="receive-req-dot"
                            style={{ animationDelay: "0s" }}
                          >
                            ·
                          </span>
                          <span
                            className="receive-req-dot"
                            style={{ animationDelay: "0.6s" }}
                          >
                            ·
                          </span>
                          <span
                            className="receive-req-dot"
                            style={{ animationDelay: "1.2s" }}
                          >
                            ·
                          </span>
                        </span>
                      </span>
                    ) : (
                      t("ui_generate_request_fr", "Créer la demande")
                    )}
                  </button>
                  <style>{`
                    @keyframes receiveReqDotBlink {
                      0%, 100% { opacity: 0.18; }
                      50% { opacity: 0.7; }
                    }
                    .receive-req-dot {
                      animation: receiveReqDotBlink 2.4s ease-in-out infinite;
                      font-size: 1.3em;
                      line-height: 1;
                    }
                  `}</style>

                  {generateError ? (
                    <div className="mt-2 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {generateError}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {receiveView === "request_qr" ? (
              <div className="space-y-5 pt-2 relative z-[2]">
                <div className="flex justify-center pt-1 pb-1">
                  <div className="inline-flex flex-col items-center gap-1 bg-elevated px-6 py-2 rounded-3xl shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                    <span className="text-white/70 text-[14px] font-medium tracking-wide">
                      {t(
                        "ui_receive_receiving_account_label",
                        "Compte de réception",
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse"
                        aria-hidden
                      />
                      <span className="text-white/95 text-[14px] font-semibold">
                        {String(walletLabel || "").trim() ||
                          t("nav_wallet", "Wallet")}
                      </span>
                    </div>
                  </div>
                </div>

                {hasGeneratedRequest ? (
                  <>
                    <div className="w-full flex flex-col items-center bg-[#232829] rounded-[20px] pt-5 pb-2 shadow-[0_2px_0_rgba(255,255,255,0.04)_inset,0_-2px_0_rgba(0,0,0,0.6)_inset,12px_36px_52px_rgba(0,0,0,0.68),-14px_14px_38px_rgba(0,0,0,0.42),0_64px_30px_-20px_rgba(0,0,0,0.6),8px_-10px_22px_rgba(0,0,0,0.28)]">
                      <div
                        ref={requestQrContainerRef}
                        className="w-[240px] aspect-square rounded-none p-3 cursor-pointer border-[20px] border-black"
                        style={{ backgroundColor: "#E8E8E8" }}
                        onClick={() => setQrZoomValue(requestQrValue)}
                      >
                        <QRCodeCanvas
                          value={requestQrValue}
                          size={requestQrPixelSize}
                          style={{ width: "100%", height: "100%" }}
                          bgColor="#E8E8E8"
                          fgColor="#000000"
                          includeMargin={true}
                          level="M"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setQrZoomValue(requestQrValue)}
                        className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[17px] text-white/70 hover:text-white/90 transition-colors duration-150"
                        aria-label={t(
                          "ui_enlarge_qr",
                          "Agrandir le QR code",
                        )}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="w-7 h-7"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          strokeWidth={2}
                          aria-hidden="true"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
                          />
                        </svg>
                        {t("ui_enlarge_qr_label", "Agrandir le QR code")}
                      </button>
                    </div>

                    <div className="text-center">
                      <div className="text-white text-[40px] font-bold tracking-tight leading-none">
                        {requestDisplayAmountLabel}
                      </div>
                    </div>

                    {String(generatedRequest?.b || "").trim() ? (
                      <div className="flex items-center justify-between px-1">
                        <span className="text-[13px] text-white/40 font-medium">
                          {t("ui_beneficiary_label", "Bénéficiaire")}
                        </span>
                        <span className="text-[13px] text-white/60 font-medium">
                          {generatedRequest?.b}
                        </span>
                      </div>
                    ) : null}

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleCopyQr(true);
                        }}
                        className={[
                          "w-full h-11 rounded-[20px] bg-[#101415] ring-1 ring-white/10 ring-inset text-white/85 text-xs font-semibold",
                          "shadow-[0_4px_12px_rgba(0,0,0,0.4)] hover:ring-white/20 hover:bg-white/[0.04] transition-all duration-[140ms] active:scale-[0.99]",
                        ].join(" ")}
                      >
                        {t("ui_copy_request", "Copier la demande")}
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleShareQr(true);
                        }}
                        className="w-full h-11 rounded-[20px] bg-[#101415] text-white text-[17px] font-bold tracking-wide py-2 px-6 transition-all duration-[140ms] inline-flex items-center justify-center gap-2.5 hover:bg-white/[0.04] scale-[1.04] active:scale-[0.98]"
                        style={{
                          boxShadow:
                            "0 4px 12px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(255,255,255,0.10), inset 0 1px 0 rgba(255,255,255,0.06), inset 0 -8px 16px rgba(0,0,0,0.25)",
                        }}
                      >
                        <ShareIcon className="w-5 h-5" />
                        <span>{shareActionLabel}</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-[#101415] text-white/60 text-sm">
                    {t(
                      "ui_request_qr_missing",
                      "Aucune demande n'a encore été générée.",
                    )}
                  </div>
                )}
              </div>
            ) : null}

            {copyToast ? (
              <div className="mt-3 text-[11px] text-xcannes-green/90 text-center">
                {copyToast}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
