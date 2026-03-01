"use client";

import { Buffer } from "buffer";
import { useEffect, useMemo, useRef, useState } from "react";
import { QRCodeCanvas } from "qrcode.react";
import SwipeConfirmButton from "@/components/ui/SwipeConfirmButton";
import ModalSelect from "@/components/ui/ModalSelect";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { XRPL_KNOWN_ISSUERS } from "@/utils/xrpl";
import { XCANNES_MEMO_SCHEMAS } from "@/utils/xrplMemo";
import { useModalTransition } from "@/utils/useModalTransition";
import { formatAmountWithSymbol } from "../walletDashboardConfig";

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

export default function WalletDashboardReceiveModal({
  open,
  onClose,
  isPreviewMode = false,
  isWalletActivated = null,
  hasRlusdTrustline = null,
  noticeVariant = "preview",
  noticeContextLabel = "",
  walletId = "",
  dashboardVariant = "default",
  renderWalletMeta,
  wallet,
  requestAmount,
  setRequestAmount,
  requestCurrency,
  setRequestCurrency,
  selectLabelByCurrency,
  selectLabelRightByCurrency,
  selectIconByCurrency,
  selectLabelMobileByCurrency,
  augmentedTokens,
  requestMemo,
  setRequestMemo,
  rlusdPerUnitRates,
  rlusdPerUnitSources,
  walletLabel,
  onRequestGenerated,
  inline = false,
}) {
  const { t, i18n } = useTranslation("common");
  const locale = i18n?.language || "en";
  const showNotConnectedNotice = isPreviewMode && noticeVariant !== "demo";
  const showNotActivatedNotice =
    !isPreviewMode && noticeVariant !== "demo" && isWalletActivated === false;
  const showRlusdNotActivatedNotice =
    !isPreviewMode &&
    noticeVariant !== "demo" &&
    isWalletActivated === true &&
    hasRlusdTrustline === false;
  const greenActionBtnBase =
    "rounded-lg border border-[#22C55E]/40 bg-[#22C55E]/80 text-black font-semibold transition-all duration-200 hover:bg-[#22C55E] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed";
  const greenActionBtnMuted =
    "rounded-lg border border-[#22C55E]/30 bg-[#22C55E]/10 text-white/85 font-semibold transition-all duration-200 hover:bg-[#22C55E]/20 hover:text-white/95 hover:scale-105 active:scale-95";
  const [generatedRequest, setGeneratedRequest] = useState(null);
  const [generateError, setGenerateError] = useState(null);
  const [isDesktop, setIsDesktop] = useState(false);
  const [copyToast, setCopyToast] = useState("");
  const copyToastTimerRef = useRef(null);
  const qrContainerRef = useRef(null);
  const [isRequestOpen, setIsRequestOpen] = useState(false);

  const requestCurrencyCode = useMemo(
    () =>
      String(requestCurrency || "")
        .trim()
        .toUpperCase(),
    [requestCurrency],
  );

  const selectedRequestToken = useMemo(() => {
    return (
      (augmentedTokens || []).find(
        (t) => String(t?.currency || "").toUpperCase() === requestCurrencyCode,
      ) || null
    );
  }, [augmentedTokens, requestCurrencyCode]);

  useEffect(() => {
    if (!open) {
      setGeneratedRequest(null);
      setGenerateError(null);
      setIsRequestOpen(false);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (copyToastTimerRef.current) {
        window.clearTimeout(copyToastTimerRef.current);
        copyToastTimerRef.current = null;
      }
    };
  }, []);

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
    setGeneratedRequest(null);
    setGenerateError(null);
  }, [wallet, requestAmount, requestCurrency, requestMemo]);

  const isFxRequest = useMemo(() => {
    if (!selectedRequestToken?.isTrustlineOnly) return false;
    if (!requestCurrencyCode) return false;
    return (
      requestCurrencyCode !== "XRP" &&
      requestCurrencyCode !== "RLUSD" &&
      requestCurrencyCode !== "USD"
    );
  }, [requestCurrencyCode, selectedRequestToken?.isTrustlineOnly]);

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

    const targetCurrencyCode = requestCurrencyCode || "USD";
    const targetCurrencyUpper = String(targetCurrencyCode || "").toUpperCase();
    const displayCurrencyUpper =
      targetCurrencyUpper === "RLUSD" ? "USD" : targetCurrencyUpper;
    let amountRlusd = null;
    let fxRate = null;
    let fxSource = null;

    if (targetCurrencyUpper === "RLUSD" || targetCurrencyUpper === "USD") {
      amountRlusd = amount;
      fxRate = 1;
      fxSource = "FAWAZ";
    } else {
      const rate = Number(rlusdPerUnitRates?.[targetCurrencyUpper]);
      if (!Number.isFinite(rate) || rate <= 0) {
        setGenerateError(
          t("ui_request_error_rate_unavailable_8c2e1a7b5d", {
            defaultValue: "Rate unavailable for {{currency}}.",
            currency: targetCurrencyUpper,
          }),
        );
        return;
      }
      fxRate = rate;
      fxSource = rlusdPerUnitSources?.[targetCurrencyUpper] || null;
      amountRlusd = amount * rate;
    }

    const issuerCandidate = String(selectedRequestToken?.issuer || "").trim();
    const issuerLooksValid = /^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(
      issuerCandidate,
    );
    // USD et RLUSD utilisent le même issuer on-chain (RLUSD)
    const knownIssuer =
      targetCurrencyUpper === "RLUSD" || targetCurrencyUpper === "USD"
        ? XRPL_KNOWN_ISSUERS.RLUSD
        : null;
    const issuer = isFxRequest
      ? null
      : knownIssuer || (issuerLooksValid ? issuerCandidate : null);

    const beneficiaryLabel = String(walletLabel || "").trim() || null;
    const req = {
      schema: XCANNES_MEMO_SCHEMAS.payreq.schema,
      to: wallet,
      targetCurrency: targetCurrencyUpper,
      displayAmount: amount,
      displayCurrency: displayCurrencyUpper,
      amountRlusd: Number.isFinite(amountRlusd) ? amountRlusd : null,
      fxRate,
      fxSource,
      issuer,
      memo: requestMemo || "",
      beneficiaryLabel,
      createdAt: new Date().toISOString(),
    };

    setGeneratedRequest(req);
    onRequestGenerated?.(req);
    setIsRequestOpen(false);
  };

  const flashCopyToast = (message) => {
    const text = String(message || "").trim();
    if (!text) return;
    setCopyToast(text);
    if (copyToastTimerRef.current) {
      window.clearTimeout(copyToastTimerRef.current);
    }
    copyToastTimerRef.current = window.setTimeout(() => {
      setCopyToast("");
      copyToastTimerRef.current = null;
    }, 1300);
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
    const canvas = qrContainerRef.current?.querySelector?.("canvas");
    if (!canvas) return null;
    const srcWidth = canvas.width;
    const srcHeight = canvas.height;
    const scale = useRequest ? 4 : 3;
    const marginRatio = useRequest ? 0.12 : 0.1;
    const margin = Math.max(24, Math.round(srcWidth * marginRatio));
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
    try {
      const srcCtx = canvas.getContext("2d");
      const srcPixel = srcCtx?.getImageData(0, 0, 1, 1)?.data;
      const isDarkBg =
        srcPixel && srcPixel.length >= 3
          ? srcPixel[0] + srcPixel[1] + srcPixel[2] < 128 * 3
          : false;
      if (isDarkBg) {
        const imageData = ctx.getImageData(
          offset,
          offset,
          srcWidth * scale,
          srcHeight * scale,
        );
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
          data[i] = 255 - data[i];
          data[i + 1] = 255 - data[i + 1];
          data[i + 2] = 255 - data[i + 2];
        }
        ctx.putImageData(imageData, offset, offset);
      }
    } catch {
      // fallback to raw canvas if pixel access fails
      ctx.drawImage(
        canvas,
        offset,
        offset,
        srcWidth * scale,
        srcHeight * scale,
      );
    }
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
          flashCopyToast(t("ui_qr_copied_7b1a9c", "QR copié"));
          return;
        }
      } catch {
        // fall through to text copy
      }
    }

    if (navigator?.clipboard?.writeText && fallbackText) {
      try {
        await navigator.clipboard.writeText(fallbackText);
        flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"));
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
          flashCopyToast(t("ui_qr_code_copied_5c1d2e", "Code copié"));
          return;
        }
      } catch {
        // fall through
      }
    }

    flashCopyToast(t("ui_qr_copy_failed_a1b2c3", "Impossible de copier le QR"));
  };

  const handleShareQr = async (useRequest = hasGeneratedRequest) => {
    const fallbackText = useRequest ? requestQrValue : receiveQrValue;
    const blob = buildQrBlob(useRequest);

    if (isDesktop || !navigator?.share) {
      if (blob) {
        downloadBlob(blob, "xcannes-qr.png");
        flashCopyToast(t("ui_qr_downloaded_2f1a7c9d5e", "QR téléchargé"));
        return;
      }
      if (fallbackText) {
        downloadBlob(
          new Blob([fallbackText], { type: "text/plain" }),
          "xcannes-qr.txt",
        );
        flashCopyToast(t("ui_code_downloaded_5c1d2e7f9a", "Code téléchargé"));
        return;
      }
      flashCopyToast(
        t("ui_share_unavailable_3b7c1a9d5e", "Partager indisponible"),
      );
      return;
    }

    const shareData = {};
    if (fallbackText) shareData.text = fallbackText;
    shareData.title = t("ui_share_qr_title_7f2a1b9c5e", "XCANNES QR");

    if (blob && typeof File !== "undefined") {
      const file = new File([blob], "xcannes-qr.png", {
        type: blob.type || "image/png",
      });
      if (!navigator.canShare || navigator.canShare({ files: [file] })) {
        shareData.files = [file];
      }
    }

    try {
      await navigator.share(shareData);
      flashCopyToast(t("ui_shared_ok_5c1d2e7f9a", "Partagé"));
    } catch (err) {
      if (err?.name === "AbortError") return;
      flashCopyToast(t("ui_share_failed_1a2b3c", "Partage impossible"));
    }
  };

  const requestValue = useMemo(() => {
    if (!generatedRequest) return "";
    try {
      const compact = {
        s: generatedRequest.schema,
        to: generatedRequest.to,
        tc:
          generatedRequest.targetCurrency ||
          generatedRequest.targetCurrencyCode,
        da: generatedRequest.displayAmount ?? generatedRequest.amount ?? null,
        dc: generatedRequest.displayCurrency || null,
        ar: generatedRequest.amountRlusd ?? null,
        fr: generatedRequest.fxRate ?? null,
        fs: generatedRequest.fxSource ?? null,
        i: generatedRequest.issuer ?? null,
        m: generatedRequest.memo ?? null,
        b: generatedRequest.beneficiaryLabel ?? null,
      };
      Object.keys(compact).forEach((key) => {
        if (compact[key] == null || compact[key] === "") delete compact[key];
      });
      return JSON.stringify(compact);
    } catch {
      return "";
    }
  }, [generatedRequest]);
  const requestQrValue = useMemo(() => {
    if (!requestValue) return "";
    try {
      const base64 = Buffer.from(requestValue, "utf8").toString("base64");
      const base64Url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/g, "");
      return `xcannes-payreq:${base64Url}`;
    } catch {
      return "";
    }
  }, [requestValue]);
  const hasGeneratedRequest = Boolean(generatedRequest && requestQrValue);
  const showRequestPreview = hasGeneratedRequest;
  const requestDisplayCurrency = String(
    generatedRequest?.displayCurrency || requestCurrencyCode || "USD",
  )
    .trim()
    .toUpperCase();
  const requestDisplayAmount =
    generatedRequest?.displayAmount ?? Number.parseFloat(requestAmount || "0");
  const requestDisplayAmountLabel = Number.isFinite(
    Number(requestDisplayAmount),
  )
    ? formatAmountWithSymbol(
        locale,
        Number(requestDisplayAmount),
        requestDisplayCurrency,
        { minimumFractionDigits: 0, maximumFractionDigits: 2 },
      )
    : formatAmountWithSymbol(locale, 0, requestDisplayCurrency, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
  const receiveQrValue = wallet ? `xrpl:${wallet}` : "";
  const qrDisplaySize = inline ? 240 : 220;
  const qrPixelSize = inline ? 360 : hasGeneratedRequest ? 520 : 420;

  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });

  if (!shouldRender) return null;

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-receive-modal border border-white/10 p-4 md:p-5 space-y-3 overflow-y-auto flex flex-col min-h-0 overscroll-contain pointer-events-auto",
    inline
      ? "h-full max-h-none rounded-xl"
      : "max-w-md md:max-w-lg max-h-[92vh] rounded-2xl",
    noticeVariant === "demo" ? "bg-[#0b0f10]" : "bg-elevated",
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
                  "pr-8 wallet-meta--plus-4 wallet-meta--desktop-gap",
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
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
                {showNotActivatedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                    {t(
                      "wallet_not_activated_title",
                      "Wallet not activated: a minimum reserve of 1 XRP is required.",
                    )}
                  </span>
                ) : null}
                {showRlusdNotActivatedNotice ? (
                  <span className="inline-flex items-center text-amber-300 text-sm md:text-sm font-semibold leading-none w-full md:w-auto mt-1 md:mt-0">
                    {t(
                      "wallet_rlusd_not_activated_title",
                      "USD not activated. Authorize USD on your wallet.",
                    )}
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
          <div className={inline ? "flex-1 min-h-0 flex flex-col" : ""}>
            <div className="wallet-tab-unfold-in">
              <p className="text-xs md:text-sm text-white/50 mb-3">
                {t(
                  "ui_receive_and_request_desc_2f1a7c9d5e",
                  "Share this XRPL address to receive funds, or create a payment request to send to another wallet.",
                )}
              </p>

              {wallet ? (
                <div
                  className={`flex flex-col items-center gap-3 ${
                    inline ? "flex-1 min-h-0 justify-center" : ""
                  }`}
                >
                  <div
                    ref={qrContainerRef}
                    className="bg-black/60 border border-white/10 rounded-xl p-3 text-[0px]"
                  >
                    <QRCodeCanvas
                      value={
                        showRequestPreview ? requestQrValue : receiveQrValue
                      }
                      size={qrPixelSize}
                      style={{ width: qrDisplaySize, height: qrDisplaySize }}
                      bgColor="#ffffff"
                      fgColor="#000000"
                      includeMargin={true}
                      level="M"
                    />
                  </div>
                  {showRequestPreview ? (
                    <div className="w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-xs text-white/80 space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/60">
                          {t("ui_amount_7668986206", "Amount")}
                        </span>
                        <span className="font-mono text-white/90">
                          {requestDisplayAmountLabel}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-white/60">
                          {t("ui_currency_1ed55673be", "Currency")}
                        </span>
                        <span className="font-semibold text-white/90">
                          {requestDisplayCurrency}
                        </span>
                      </div>
                    </div>
                  ) : null}
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await handleCopyQr(showRequestPreview);
                        } catch {
                          // ignore
                        }
                      }}
                      className="px-4 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white/90 font-semibold transition-colors"
                    >
                      {showRequestPreview
                        ? t("ui_copy_request_32a3f4409b", "Copy request")
                        : t("ui_copy_address_779691d570", "Copy address")}
                    </button>
                    <button
                      type="button"
                      onClick={async (e) => {
                        e.stopPropagation();
                        try {
                          await handleShareQr(showRequestPreview);
                        } catch {
                          // ignore
                        }
                      }}
                      className="px-4 py-2 text-xs rounded-lg bg-white/10 hover:bg-white/15 text-white/90 font-semibold transition-colors inline-flex items-center justify-center"
                    >
                      {isDesktop ? (
                        t("ui_download_qr_5c1d2e7f9a", "Télécharger")
                      ) : (
                        <>
                          <ShareIcon className="w-5 h-5" />
                          <span className="sr-only">
                            {t("ui_share_qr_9b5c1a2d7e", "Partager")}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                  {copyToast ? (
                    <div className="text-[10px] text-xcannes-green/90">
                      {copyToast}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {wallet ? (
                <div className="mt-2 flex justify-center">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsRequestOpen((prev) => !prev);
                    }}
                    className={`px-4 py-2 text-xs md:text-sm ${greenActionBtnMuted}`}
                  >
                    {isRequestOpen
                      ? t("ui_hide_request_payment", "Masquer la demande")
                      : t("ui_request_payment_c62b99fb16", "Créer une demande")}
                  </button>
                </div>
              ) : null}

              {wallet && isRequestOpen ? (
                <div
                  className={`space-y-4 ${
                    inline ? "flex-1 min-h-0 flex flex-col" : ""
                  }`}
                >
                  <div
                    className={
                      inline
                        ? "flex-1 min-h-0 overflow-y-auto pr-1 flex flex-col justify-between gap-[clamp(12px,2.2vh,26px)]"
                        : "space-y-4"
                    }
                  >
                    <div className="space-y-4">
                      {/* Amount & Currency */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                            {t("ui_amount_7668986206", "Amount")}
                          </label>
                          <input
                            type="number"
                            value={requestAmount}
                            onChange={(e) => setRequestAmount(e.target.value)}
                            placeholder="0.00"
                            className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-base md:text-sm text-white outline-none focus:border-xcannes-green/80"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                            {t("ui_currency_1ed55673be", "Currency")}
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
                              const labelRight =
                                selectLabelRightByCurrency?.[token.currency] ||
                                selectLabelRightByCurrency?.[currencyUpper] ||
                                null;
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
                                  selectLabelMobileByCurrency?.[
                                    token.currency
                                  ] ||
                                  selectLabelMobileByCurrency?.[
                                    currencyUpper
                                  ] ||
                                  labelLeft,
                              };
                            })}
                            useNativeSelect={false}
                            buttonClassName="bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80 cursor-pointer"
                            menuClassName={
                              noticeVariant === "demo"
                                ? "bg-[#0b0f10]"
                                : "bg-elevated"
                            }
                            selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                          />
                        </div>
                      </div>

                      {/* Memo (optional) */}
                      <div>
                        <label className="block text-[11px] md:text-xs text-white/60 mb-1">
                          {t("ui_memo_optional_d9594474c7", "Memo (optional)")}
                        </label>
                        <input
                          type="text"
                          value={requestMemo}
                          onChange={(e) => setRequestMemo(e.target.value)}
                          placeholder={t(
                            "ui_payment_for_82ec86ac25",
                            "Payment for...",
                          )}
                          className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2.5 text-sm text-white outline-none focus:border-xcannes-green/80"
                        />
                      </div>

                      {/* Generate Button */}
                      <SwipeConfirmButton
                        label={t(
                          "ui_generate_request_58584f23a2",
                          "Generate Request",
                        )}
                        onConfirm={handleGenerateRequest}
                        variant="green"
                        className="mt-2 md:hidden"
                      />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGenerateRequest();
                        }}
                        className={`hidden md:block w-full mt-2 text-sm py-2.5 ${greenActionBtnMuted}`}
                      >
                        {t(
                          "ui_generate_request_58584f23a2",
                          "Generate Request",
                        )}
                      </button>

                      {generateError ? (
                        <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                          {generateError}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
