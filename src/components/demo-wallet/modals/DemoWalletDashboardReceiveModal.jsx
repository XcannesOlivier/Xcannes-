"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import useIsDesktop from "@/components/wallet/hooks/useIsDesktop";
import { QRCodeCanvas } from "qrcode.react";
import ModalSelect from "@/components/ui/ModalSelect";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { getCurrencySymbol } from "../demoWalletDashboardConfig";
import { buildDemoPayreq, encodeDemoPayreqQR } from "../utils/demoXrplMemo";
import { useModalTransition } from "@/hooks/useModalTransition";

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
  }, [wallet, requestAmount, requestCurrency, requestMemo]);

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
  // Public address QR should be visually smaller than the request QR preview.
  const qrDisplaySize = inline ? 240 : 190;
  const qrPixelSize = inline ? 360 : 380;
  const requestQrPixelSize = inline ? 360 : 520;
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

  const shortWalletAddress = useMemo(() => {
    const addr = String(wallet || "").trim();
    if (!addr) return "";
    if (addr.length <= 10) return addr;
    return `${addr.slice(0, 4)}...${addr.slice(-3)}`;
  }, [wallet]);

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

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end md:items-center justify-center md:px-4 pointer-events-none";
  const panelClass = [
    "relative w-full wallet-modal-panel wallet-receive-modal border-white/10 md:border p-4 md:p-5 space-y-4 flex flex-col min-h-0 overflow-y-auto overscroll-contain pointer-events-auto pb-[env(safe-area-inset-bottom)]",
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
          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 flex flex-col gap-5">
              {/* SECTION 1 — RECEIVE FUNDS */}
              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-semibold text-white/90">
                  {t("ui_receive_funds_title", "Recevoir des fonds")}
                </h2>
                <div className="rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)]">
                  <div className="flex flex-col items-center">
                    <div
                      ref={receiveQrContainerRef}
                      className="rounded-xl border border-white/10 bg-white p-3"
                    >
                      <QRCodeCanvas
                        value={receiveQrValue || ""}
                        size={qrPixelSize}
                        style={{ width: qrDisplaySize, height: qrDisplaySize }}
                        bgColor="#ffffff"
                        fgColor="#000000"
                        includeMargin={true}
                        level="M"
                      />
                    </div>

                    <div className="mt-3 text-[11px] tracking-[0.22em] uppercase text-white/45">
                      {t("ui_public_address_label", "Adresse publique")}
                    </div>
                    <div className="mt-1 text-sm font-mono text-white/80">
                      {shortWalletAddress || "—"}
                    </div>

                    <div className="mt-4 w-full grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleCopyQr(false);
                        }}
                        className="w-full px-3 py-2.5 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white/85 text-sm font-medium transition-colors duration-150"
                      >
                        {t("ui_copy", "Copier")}
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleShareQr(false);
                        }}
                        className="w-full px-3 py-2.5 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white/85 text-sm font-medium transition-colors duration-150"
                      >
                        {t("ui_download", "Télécharger")}
                      </button>
                    </div>

                    {copyToast ? (
                      <div className="mt-3 text-[11px] text-xcannes-green/90">
                        {copyToast}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* SECTION 2 — CREATE REQUEST */}
              <div className="space-y-2">
                <h2 className="text-base md:text-lg font-semibold text-white/90">
                  {t("ui_create_request_title", "Créer une demande")}
                </h2>
                <div className="rounded-[14px] border border-white/10 bg-white/5 p-4 space-y-4">
                  {/* Amount */}
                  <div>
                    <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                      {t("ui_amount_7668986206", "Amount")}
                    </label>
                    <input
                      type="number"
                      value={requestAmount}
                      onChange={(e) => setRequestAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-3 text-lg font-semibold text-white outline-none focus:border-xcannes-green/80 transition-colors duration-150"
                    />
                  </div>

                  {/* Currency */}
                  <div>
                    <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
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
                        const baseLabelRight =
                          selectLabelRightByCurrency?.[token.currency] ||
                          selectLabelRightByCurrency?.[currencyUpper] ||
                          null;
                        const labelRight =
                          currencyUpper === "RLUSD" &&
                          unallocatedUsdValue !== null
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
	                      buttonClassName="bg-black/40 border border-white/15 rounded-xl px-3.5 py-3 text-base text-white outline-none focus:border-xcannes-green/80 cursor-pointer transition-colors duration-150"
	                      menuClassName={
	                        noticeVariant === "demo"
	                          ? "bg-xcannes-surface-demo max-h-40 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10"
	                          : "bg-elevated max-h-40 overflow-y-auto overscroll-contain touch-pan-y border-white/15 ring-1 ring-white/10"
	                      }
	                      selectClassName="xcannes-select w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-3 text-base text-white outline-none focus:border-xcannes-green/80 transition-colors duration-150"
	                    />
                  </div>

                  {/* Memo (optional) */}
                  <div>
                    <label className="block text-[11px] tracking-[0.22em] uppercase text-white/45 mb-2">
                      {t("ui_memo_optional_d9594474c7", "Memo (optional)")}
                    </label>
                    <input
                      type="text"
                      value={requestMemo}
                      onChange={(e) => setRequestMemo(e.target.value)}
                      placeholder={t(
                        "ui_payment_memo_placeholder",
                        "Objet du paiement (optionnel)",
                      )}
                      className="w-full bg-black/40 border border-white/15 rounded-xl px-3.5 py-3 text-base text-white outline-none focus:border-xcannes-green/80 transition-colors duration-150"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateRequest();
                    }}
                    className="w-full h-12 rounded-xl bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold transition-colors duration-150"
                  >
                    {t("ui_generate_request_fr", "Générer la demande")}
                  </button>

                  {generateError ? (
                    <div className="text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
                      {generateError}
                    </div>
                  ) : null}

                  {hasGeneratedRequest ? (
                    <div
                      ref={requestPreviewRef}
                      className="pt-2 rounded-[14px] p-4 ring-1 ring-white/10 ring-inset bg-gradient-to-b from-white/[0.08] to-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-18px_28px_rgba(0,0,0,0.55)] space-y-3"
                    >
                      <div className="text-[11px] tracking-[0.22em] uppercase text-white/45">
                        {t("ui_request_generated_label", "Demande générée")}
                      </div>
                      <div className="flex items-center justify-center">
                        <div
                          ref={requestQrContainerRef}
                          className="rounded-xl border border-white/10 bg-white p-3"
                        >
                          <QRCodeCanvas
                            value={requestQrValue}
                            size={requestQrPixelSize}
                            style={{ width: 200, height: 200 }}
                            bgColor="#ffffff"
                            fgColor="#000000"
                            includeMargin={true}
                            level="M"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleCopyQr(true);
                          }}
                          className="w-full px-3 py-2.5 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white/85 text-sm font-medium transition-colors duration-150"
                        >
                          {t("ui_copy", "Copier")}
                        </button>
                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleShareQr(true);
                          }}
                          className="w-full px-3 py-2.5 rounded-[10px] bg-white/5 border border-white/10 hover:bg-white/10 text-white/85 text-sm font-medium transition-colors duration-150"
                        >
                          {t("ui_download", "Télécharger")}
                        </button>
                      </div>
                      <div className="text-[11px] text-white/50 text-center">
                        {requestDisplayAmountLabel}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
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
