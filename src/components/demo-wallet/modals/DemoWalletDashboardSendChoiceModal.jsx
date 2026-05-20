"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "next-i18next";
import { useModalTransition } from "@/hooks/useModalTransition";
import { normalizeQrImageFile } from "../utils/demoQrImage";

export default function DemoWalletDashboardSendChoiceModal({
  open,
  onClose,
  onChooseSimpleSend,
  onChoosePayRequest,
  renderWalletMeta,
  savedAddresses,
  inline = false,
}) {
  const { t } = useTranslation("common");
  const shouldAnimate = !inline;
  const { shouldRender, isClosing } = useModalTransition(open, {
    enabled: shouldAnimate,
  });
  const [showSteps, setShowSteps] = useState(false);
  const [showPayreqSteps, setShowPayreqSteps] = useState(false);
  const [subModal, setSubModal] = useState(null);
  const [showQuickscanSavedPicker, setShowQuickscanSavedPicker] =
    useState(false);
  const [quickscanRecipient, setQuickscanRecipient] = useState("");
  const [quickscanRecipientLabel, setQuickscanRecipientLabel] = useState("");
  const [payreqPasteValue, setPayreqPasteValue] = useState("");
  const [pendingPayreq, setPendingPayreq] = useState("");
  const [payreqInvalidError, setPayreqInvalidError] = useState(false);
  const [payreqSelfSendError, setPayreqSelfSendError] = useState(false);
  const quickscanFileInputIdRef = useRef(
    `demo-sendchoice-quickscan-file-${Math.random().toString(36).slice(2, 10)}`,
  );
  const payreqFileInputIdRef = useRef(
    `demo-sendchoice-payreq-file-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrReaderIdRef = useRef(
    `demo-sendchoice-manual-qr-reader-${Math.random().toString(36).slice(2, 10)}`,
  );
  const manualQrScannerRef = useRef(null);

  // ── Swipe-to-close (mobile) ────────────────────────────────
  const [overlayDragging, setOverlayDragging] = useState(false);
  const [overlayTranslateY, setOverlayTranslateY] = useState(0);
  const overlayRef = useRef(null);
  const overlayListRef = useRef(null);
  const subSwipeMetaRef = useRef(null);
  const subModalRef = useRef(null);
  const overlayDragMetaRef = useRef({
    startY: 0,
    startAt: 0,
    pointerId: null,
    lastDelta: 0,
    pending: false,
    source: null,
    dragging: false,
  });
  const closeRequestedRef = useRef(false);

  useEffect(() => {
    if (!open) {
      setOverlayTranslateY(0);
      setOverlayDragging(false);
      closeRequestedRef.current = false;
      setSubModal(null);
      setShowQuickscanSavedPicker(false);
      setPayreqPasteValue("");
      setPendingPayreq("");
      setPayreqInvalidError(false);
      setPayreqSelfSendError(false);
      overlayDragMetaRef.current = {
        startY: 0,
        startAt: 0,
        pointerId: null,
        lastDelta: 0,
        pending: false,
        source: null,
        dragging: false,
      };
    }
  }, [open]);

  const maybeStartOverlayDrag = useCallback(
    (event, source) => {
      if (inline) return;
      if (!event?.isPrimary || event.pointerType === "mouse") return;
      if (
        event.target?.closest?.(
          "input,textarea,select,button,a,[role='button']",
        )
      )
        return;

      if (source === "list") {
        const list = overlayListRef.current;
        if (list && list.scrollTop > 0) return;
      }

      const meta = overlayDragMetaRef.current;
      meta.startY = event.clientY;
      meta.startAt = Date.now();
      meta.pointerId = event.pointerId;
      meta.lastDelta = 0;
      meta.pending = true;
      meta.dragging = false;
      meta.source = source;

      try {
        overlayRef.current?.setPointerCapture?.(event.pointerId);
      } catch {
        // ignore
      }
    },
    [inline],
  );

  const handleOverlayPointerMove = useCallback(
    (event) => {
      if (inline) return;
      if (subModal) return;
      const meta = overlayDragMetaRef.current;
      if (!meta.pending || meta.pointerId !== event.pointerId) return;
      const delta = event.clientY - meta.startY;
      if (delta <= 0) {
        meta.lastDelta = 0;
        if (!meta.dragging) return;
      }
      meta.lastDelta = Math.max(0, delta);
      if (!meta.dragging && meta.lastDelta > 2) meta.dragging = true;
      setOverlayDragging(meta.dragging);
      setOverlayTranslateY(meta.lastDelta);
    },
    [inline, subModal],
  );

  const handleOverlayPointerEnd = useCallback(
    (event) => {
      if (inline) return;
      if (subModal) return;
      const meta = overlayDragMetaRef.current;
      if (meta.pointerId !== event.pointerId) return;
      const delta = meta.lastDelta || 0;
      const duration = Math.max(1, Date.now() - (meta.startAt || 0));
      const velocity = delta / duration;
      const height = typeof window !== "undefined" ? window.innerHeight : 800;
      const closeDistance = Math.max(220, Math.min(320, height * 0.28));
      const shouldClose =
        delta > closeDistance || (delta > closeDistance * 0.6 && velocity > 1.25);

      meta.pending = false;
      meta.dragging = false;
      setOverlayDragging(false);

      if (shouldClose) {
        if (!closeRequestedRef.current) {
          closeRequestedRef.current = true;
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
      };
    },
    [inline, onClose, subModal],
  );

  const handleSubModalPillDown = useCallback(
    (event) => {
      if (inline) return;
      if (!event?.isPrimary || event.pointerType === "mouse") return;
      if (
        event.target?.closest?.(
          "input,textarea,select,button,a,[role='button']",
        )
      )
        return;
      subSwipeMetaRef.current = {
        startY: event.clientY,
        startAt: Date.now(),
        pointerId: event.pointerId,
        lastDeltaY: 0,
      };

      const onMove = (e) => {
        const meta = subSwipeMetaRef.current;
        if (!meta || e.pointerId !== meta.pointerId) return;
        const delta = e.clientY - meta.startY;
        if (delta <= 0) return;
        meta.lastDeltaY = delta;
        setOverlayTranslateY(delta);
        setOverlayDragging(true);
      };

      const onEnd = (e) => {
        const meta = subSwipeMetaRef.current;
        if (!meta || e.pointerId !== meta.pointerId) return;
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onEnd);
        window.removeEventListener("pointercancel", onEnd);
        const delta = meta.lastDeltaY || 0;
        const duration = Math.max(1, Date.now() - meta.startAt);
        const velocity = delta / duration;
        const height = typeof window !== "undefined" ? window.innerHeight : 800;
        const closeDistance = Math.max(220, Math.min(320, height * 0.28));
        const shouldClose =
          delta > closeDistance ||
          (delta > closeDistance * 0.6 && velocity > 1.25);
        subSwipeMetaRef.current = null;
        setOverlayDragging(false);
        if (shouldClose) {
          setOverlayTranslateY(Math.max(delta, height));
          closeRequestedRef.current = true;
          window.setTimeout(() => {
            onClose?.();
          }, 180);
        } else {
          setOverlayTranslateY(0);
        }
      };

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onEnd);
      window.addEventListener("pointercancel", onEnd);
    },
    [inline, onClose],
  );

  const handleManualQrFile = useCallback(
    async (file, { isPayreq = false } = {}) => {
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
          if (scanFile !== file) decodedText = await instance.scanFile(file, true);
          else throw err;
        }
        try {
          await instance.clear();
        } catch {
          // ignore cleanup errors
        }
        const decoded = String(decodedText || "").trim();
        if (!decoded) return;

        if (isPayreq) {
          setPayreqPasteValue(decoded);
          setPendingPayreq(decoded);
          setPayreqInvalidError(false);
          setPayreqSelfSendError(false);
          return;
        }
        setQuickscanRecipient(decoded);
        setQuickscanRecipientLabel("");
        setShowQuickscanSavedPicker(false);
      } catch (err) {
        console.error("QR scanFile error:", err);
        alert(
          t(
            "ui_qr_decode_failed_3b5d7f9a2c",
            "Unable to decode this image. Try a clearer screenshot.",
          ),
        );
      }
    },
    [t],
  );

  const triggerFileUpload = useCallback((inputId) => {
    const input = document.getElementById(inputId);
    input?.click();
  }, []);

  if (!shouldRender) return null;

  const QuickScanIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <rect
        x="10"
        y="10"
        width="12"
        height="12"
        rx="2"
        className="stroke-xcannes-green/70"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="13" y="13" width="6" height="6" rx="1" className="fill-xcannes-green/50" />
      <rect
        x="26"
        y="10"
        width="12"
        height="12"
        rx="2"
        className="stroke-white/50"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="29" y="13" width="6" height="6" rx="1" className="fill-white/30" />
      <rect
        x="10"
        y="26"
        width="12"
        height="12"
        rx="2"
        className="stroke-white/50"
        strokeWidth="1.5"
        fill="none"
      />
      <rect x="13" y="29" width="6" height="6" rx="1" className="fill-white/30" />
      <path
        d="M26 30h4m4 0h4"
        className="stroke-xcannes-green/60"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M26 36h12"
        className="stroke-white/30"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );

  const PayRequestIcon = () => (
    <svg viewBox="0 0 48 48" className="w-9 h-9" fill="none" aria-hidden>
      <rect x="10" y="12" width="28" height="24" rx="5" className="fill-white/5 stroke-white/40" strokeWidth="1.5" />
      <path d="M16 22h16" className="stroke-white/50" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M16 28h10" className="stroke-white/35" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="34" cy="30" r="6" className="fill-[#f5a623]/15 stroke-[#f5a623]/60" strokeWidth="1.4" />
      <path
        d="M34 27v6m-2-4c0-.7.9-1.2 2-1.2s2 .5 2 1.2-.9 1.2-2 1.2-2 .5-2 1.2.9 1.2 2 1.2 2-.5 2-1.2"
        className="stroke-[#f5a623]/90"
        strokeWidth="1.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  const wrapperClass = inline
    ? "relative w-full h-full flex"
    : "fixed inset-0 z-[10001] flex items-end justify-center pointer-events-none";

  const panelClass = [
    "relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile overflow-hidden flex flex-col pointer-events-auto pb-[env(safe-area-inset-bottom)]",
    inline ? "h-full max-h-none rounded-xl" : "h-screen rounded-none",
    "bg-xcannes-surface-demo demo-wallet-tooltip-scope",
    !inline
      ? isClosing
        ? "wallet-modal-lift-out"
        : "wallet-modal-lift-in"
      : "",
  ].join(" ");

  const cardClassName =
    "w-full text-left rounded-[20px] px-4 py-4 bg-white/[0.02] hover:bg-white/[0.05] active:bg-white/[0.03] ring-1 ring-white/10 ring-inset shadow-[0_8px_26px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-22px_34px_rgba(0,0,0,0.68)] transition-all duration-[140ms] ease-[cubic-bezier(0.4,0,0.2,1)] hover:ring-white/20 hover:-translate-y-px active:translate-y-0 active:scale-[0.99]";

  const content = (
    <>
      {!inline ? (
        <div
          className={`fixed inset-0 z-[10000] bg-black/80 ${
            isClosing ? "wallet-modal-backdrop-out" : "wallet-modal-backdrop-in"
          }`}
          onClick={onClose}
          style={
            subModal
              ? { opacity: 0 }
              : overlayTranslateY > 0
                ? {
                    opacity: Math.max(
                      0,
                      Math.min(1, 1 - overlayTranslateY / 420),
                    ),
                  }
                : undefined
          }
        />
      ) : null}

      <div className={wrapperClass}>
        <div
          ref={overlayRef}
          className={inline ? "w-full h-full flex" : "pointer-events-auto w-full"}
          style={
            !inline
              ? {
                  transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                  transition: overlayDragging
                    ? "none"
                    : "transform 220ms cubic-bezier(0.2,0,0,1)",
                  opacity:
                    overlayTranslateY > 0
                      ? Math.max(0, Math.min(1, 1 - overlayTranslateY / 420))
                      : undefined,
                  willChange: overlayTranslateY ? "transform" : undefined,
                  visibility: subModal ? "hidden" : undefined,
                }
              : undefined
          }
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
            {/* Ambient glow */}
            <div className="pointer-events-none absolute inset-0" aria-hidden>
              <div className="absolute inset-0 bg-[radial-gradient(900px_circle_at_12%_0%,rgba(255,255,255,0.08),transparent_55%),radial-gradient(600px_circle_at_100%_50%,rgba(0,255,150,0.06),transparent_60%)]" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
            </div>

            <div className="relative z-10 flex flex-col flex-1 min-h-0">
              {!inline ? (
                <div
                  className="flex justify-center pt-3 pb-0"
                  aria-hidden
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "handle");
                  }}
                >
                  <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                </div>
              ) : null}

              <div className="flex-1 min-h-0 flex flex-col">
                <div
                  className="pt-[70px] pb-3 flex flex-col items-center text-center"
                  onPointerDown={(event) => {
                    maybeStartOverlayDrag(event, "fixed");
                  }}
                >
                  <h3 className="mt-1 px-6 text-[30px] font-semibold text-white/95 tracking-tight">
                    {t(
                      "ui_send_choice_subtitle",
                      "Comment souhaitez-vous envoyer de l'argent ?",
                    )}
                  </h3>
                  <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] leading-relaxed">
                    {t(
                      "ui_send_choice_hint",
                      "Choisissez le type d’envoi qui correspond à votre besoin.",
                    )}
                  </p>

                  <div className="mt-[40px] flex justify-center px-4 w-full">
                    <div className="rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-4 py-3 shadow-none">
                      <div className="text-[11px] text-white/45 text-center">
                        {t("moonpay_from_account", "Compte source")}
                      </div>
                      <div className="mt-1 flex justify-center">
                        {renderWalletMeta?.(
                          "text-center [&_.font-mono]:hidden",
                        )}
                      </div>
                    </div>
                  </div>
                </div>

              <div
                ref={overlayListRef}
                className="flex-1 min-h-0 flex flex-col justify-start gap-[32px] mt-8 pt-1 px-4 pb-6 overflow-y-auto"
                onPointerDown={(event) => {
                  maybeStartOverlayDrag(event, "list");
                }}
              >
                {/* Hidden file inputs for QR image import */}
                <input
                  id={quickscanFileInputIdRef.current}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target?.files?.[0];
                    if (file) void handleManualQrFile(file, { isPayreq: false });
                    e.target.value = "";
                  }}
                />
                <input
                  id={payreqFileInputIdRef.current}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target?.files?.[0];
                    if (file) void handleManualQrFile(file, { isPayreq: true });
                    e.target.value = "";
                  }}
                />
                <div id={manualQrReaderIdRef.current} className="hidden" />

                <div className={cardClassName}>
                  <button
                    type="button"
                    onClick={() => setSubModal("quickscan")}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-transparent ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <QuickScanIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[18px] text-white font-semibold truncate">
                            {t("ui_send_simple_title", "Envoi simple")}
                          </p>
                          <svg
                            className="w-5 h-5 text-white/45 flex-shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M9 18L15 12L9 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <p className="mt-1 text-[15px] leading-snug text-white/60">
                          {t(
                            "ui_send_simple_hint_long",
                            "Saisissez une adresse, choisissez la devise et indiquez le montant.",
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowSteps((s) => !s);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white transition-colors duration-150 font-medium self-start text-left"
                  >
                    <span>
                      {showSteps
                        ? t("ui_hide_steps", "Masquer les étapes")
                        : t("ui_show_steps", "Voir les étapes de l'envoi")}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                        showSteps ? "rotate-180" : "rotate-0"
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      maxHeight: showSteps ? "300px" : "0px",
                      opacity: showSteps ? 1 : 0,
                    }}
                  >
                    <ol className="space-y-2 text-[12px] leading-relaxed pt-3 pb-1">
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">
                          1
                        </span>
                        <span className="text-white/60">
                          {t(
                            "ui_step_1",
                            "Renseignez l'adresse du destinataire — scannez, saisissez, importez ou choisissez dans votre liste.",
                          )}
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">
                          2
                        </span>
                        <span className="text-white/60">
                          {t(
                            "ui_step_2",
                            "Sélectionnez la devise parmi celles disponibles sur votre compte.",
                          )}
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">
                          3
                        </span>
                        <span className="text-white/60">
                          {t("ui_step_3", "Indiquez le montant à envoyer.")}
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-xcannes-green/15 text-xcannes-green text-[11px] font-bold flex items-center justify-center">
                          4
                        </span>
                        <span className="text-white/60">
                          {t("ui_step_4", "Vérifiez et validez en toute sécurité.")}
                        </span>
                      </li>
                    </ol>
                  </div>
                </div>

                <div className={cardClassName}>
                  <button
                    type="button"
                    onClick={() => setSubModal("payreq")}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-[16px] bg-transparent ring-1 ring-white/10 ring-inset flex items-center justify-center flex-shrink-0">
                        <PayRequestIcon />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-[18px] text-white font-semibold truncate">
                            {t(
                              "ui_send_choice_pay_request_title",
                              "Payer une demande",
                            )}
                          </p>
                          <svg
                            className="w-5 h-5 text-white/45 flex-shrink-0"
                            viewBox="0 0 24 24"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M9 18L15 12L9 6"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <p className="mt-1 text-[15px] leading-snug text-white/60">
                          {t(
                            "ui_send_choice_pay_request_hint",
                            "Payez une demande en scannant ou saisissant un code (payreq).",
                          )}
                        </p>
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPayreqSteps((s) => !s);
                    }}
                    className="mt-3 inline-flex items-center gap-1 text-[13px] text-white/80 hover:text-white transition-colors duration-150 font-medium self-start text-left"
                  >
                    <span>
                      {showPayreqSteps
                        ? t("ui_hide_steps", "Masquer les étapes")
                        : t("ui_show_steps", "Voir les étapes de paiement")}
                    </span>
                    <svg
                      className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
                        showPayreqSteps ? "rotate-180" : "rotate-0"
                      }`}
                      viewBox="0 0 24 24"
                      fill="none"
                      aria-hidden
                    >
                      <path
                        d="M6 9l6 6 6-6"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </button>
                  <div
                    className="overflow-hidden transition-all duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]"
                    style={{
                      maxHeight: showPayreqSteps ? "200px" : "0px",
                      opacity: showPayreqSteps ? 1 : 0,
                    }}
                  >
                    <ol className="space-y-2 text-[12px] leading-relaxed pt-3 pb-1">
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">
                          1
                        </span>
                        <span className="text-white/60">
                          {t(
                            "ui_payreq_step_1",
                            "Renseignez le code ou QR code — scannez, saisissez, importez.",
                          )}
                        </span>
                      </li>
                      <li className="flex gap-2">
                        <span className="flex-shrink-0 w-5 h-5 rounded-full bg-[#f5a623]/15 text-[#f5a623] text-[11px] font-bold flex items-center justify-center">
                          2
                        </span>
                        <span className="text-white/60">
                          {t(
                            "ui_payreq_step_2",
                            "Vérifiez et validez en toute sécurité.",
                          )}
                        </span>
                      </li>
                    </ol>
                  </div>
                </div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>

      {/* ═══ Sub-modal: Envoi simple (UI) ═══ */}
      {subModal === "quickscan" ? (
        <div
          className={
            inline
              ? "absolute inset-0 z-50 flex"
              : "fixed inset-0 z-[10100] flex items-end justify-center pointer-events-none"
          }
        >
          {!inline ? (
            <div
              className="fixed inset-0 bg-black/70 pointer-events-auto wallet-modal-backdrop-in"
              onClick={() => setSubModal(null)}
              style={
                overlayTranslateY > 0
                  ? { opacity: Math.max(0, 1 - overlayTranslateY / 420) }
                  : undefined
              }
            />
          ) : null}

          <div className={inline ? "w-full h-full" : "relative z-10 pointer-events-auto w-full wallet-modal-lift-in"}>
            <div
              ref={subModalRef}
              className={
                inline
                  ? "relative w-full h-full overflow-hidden flex flex-col bg-xcannes-surface-demo rounded-xl"
                  : "relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile overflow-hidden flex flex-col bg-xcannes-surface-demo h-screen rounded-none pb-[env(safe-area-inset-bottom)]"
              }
              style={
                !inline && overlayTranslateY
                  ? {
                      transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                      transition: overlayDragging
                        ? "none"
                        : "transform 220ms cubic-bezier(0.2,0,0,1)",
                      opacity: Math.max(
                        0,
                        Math.min(1, 1 - overlayTranslateY / 420),
                      ),
                    }
                  : undefined
              }
              onPointerDown={handleSubModalPillDown}
            >
              {/* Glow */}
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_100%_50%,rgba(0,255,150,0.08),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
              </div>

              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {!inline ? (
                  <div className="flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}

                <div className="px-5 pt-[30px] pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col items-center text-center mb-[40px]">
                    <h3 className="mt-1 text-[30px] font-bold text-white/95 tracking-tight">
                      {t(
                        "ui_send_choose_recipient_title",
                        "Envoyer à un destinataire",
                      )}
                    </h3>
                    <p className="mt-2 text-[14px] text-white/60 max-w-[40ch] leading-relaxed">
                      {t(
                        "ui_send_choose_recipient_hint",
                        "Choisissez comment renseigner l’adresse du destinataire.",
                      )}
                    </p>

                    <div className="mt-6 flex justify-center px-4 w-full">
                      <div className="rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-4 py-3 shadow-none">
                        <div className="text-[11px] text-white/45 text-center">
                          {t("moonpay_from_account", "Compte source")}
                        </div>
                        <div className="mt-1 flex justify-center">
                          {renderWalletMeta?.(
                            "text-center [&_.font-mono]:hidden",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3">
                    {/* Choisir un contact */}
                    <div className="relative rounded-[20px] bg-elevated">
                      <button
                        type="button"
                        onClick={() =>
                          setShowQuickscanSavedPicker((prev) => !prev)
                        }
                        className="w-full flex items-center gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 hover:bg-transparent hover:ring-white/15 transition-colors duration-150 text-left"
                      >
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                          <svg
                            className="w-[36px] h-[36px] text-white/90"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth={0.8}
                            stroke="currentColor"
                            aria-hidden
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[14px] font-medium text-white/85">
                            {t("ui_contacts_card_title", "Choisir un contact")}
                          </p>
                          <p className="mt-1 text-[12px] text-white/50 leading-snug">
                            {quickscanRecipientLabel ||
                              t(
                                "ui_contacts_card_hint",
                                "Sélectionner une adresse enregistrée.",
                              )}
                          </p>
                        </div>
                        <svg
                          className={`w-5 h-5 text-white/45 flex-shrink-0 transition-transform duration-200 ${
                            showQuickscanSavedPicker ? "rotate-180" : "rotate-0"
                          }`}
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M6 9l6 6 6-6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>

                      {showQuickscanSavedPicker ? (
                        <div className="mt-2 rounded-[18px] ring-1 ring-white/10 ring-inset overflow-hidden bg-black/20">
                          <div className="max-h-56 overflow-y-auto">
                            {(savedAddresses || []).filter((entry) =>
                              Boolean(String(entry?.address || "").trim()),
                            ).length > 0 ? (
                              (savedAddresses || [])
                                .filter((entry) =>
                                  Boolean(String(entry?.address || "").trim()),
                                )
                                .map((addr, idx) => (
                                  <button
                                    key={`${addr?.address}-${idx}`}
                                    type="button"
                                    onClick={() => {
                                      const value = String(
                                        addr?.address || "",
                                      ).trim();
                                      const label = String(
                                        addr?.label || "",
                                      ).trim();
                                      if (!value) return;
                                      setQuickscanRecipient(value);
                                      setQuickscanRecipientLabel(
                                        label ||
                                          t(
                                            "ui_wallet_unknown",
                                            "Unknown wallet",
                                          ),
                                      );
                                      setShowQuickscanSavedPicker(false);
                                    }}
                                    className="w-full text-left px-4 py-3 flex items-center gap-3 transition-colors hover:bg-white/5 border-b border-white/[0.04] last:border-b-0"
                                  >
                                    <div className="min-w-0 flex-1">
                                      <p className="text-[16px] font-semibold truncate text-white/90">
                                        {String(addr?.label || "").trim() ||
                                          t(
                                            "ui_wallet_unknown",
                                            "Unknown wallet",
                                          )}
                                      </p>
                                      <p className="text-[13px] font-mono font-light text-white/30 mt-0.5 truncate">
                                        {String(addr?.address || "").trim()}
                                      </p>
                                    </div>
                                  </button>
                                ))
                            ) : (
                              <div className="px-4 py-6 text-center">
                                <svg
                                  className="w-8 h-8 text-white/20 mx-auto mb-2"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={1.5}
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0"
                                  />
                                </svg>
                                <p className="text-[13px] text-white/40">
                                  {t(
                                    "ui_no_saved_addresses",
                                    "Aucune adresse enregistrée",
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    {/* Scanner / Importer QR */}
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        className="rounded-[20px] bg-white/5 ring-1 ring-white/10 ring-inset px-4 py-4 text-left hover:bg-white/[0.07] transition-colors"
                        onClick={() => {}}
                      >
                        <p className="text-[14px] font-medium text-white/85">
                          {t("ui_scan_qr", "Scanner")}
                        </p>
                        <p className="mt-1 text-[12px] text-white/50 leading-snug">
                          {t("ui_scan_qr_hint", "Ouvrir la caméra.")}
                        </p>
                      </button>
                      <button
                        type="button"
                        className="rounded-[20px] bg-white/5 ring-1 ring-white/10 ring-inset px-4 py-4 text-left hover:bg-white/[0.07] transition-colors"
                        onClick={() =>
                          triggerFileUpload(quickscanFileInputIdRef.current)
                        }
                      >
                        <p className="text-[14px] font-medium text-white/85">
                          {t("ui_import_qr", "Importer QR")}
                        </p>
                        <p className="mt-1 text-[12px] text-white/50 leading-snug">
                          {t("ui_import_qr_hint", "Depuis une image.")}
                        </p>
                      </button>
                    </div>

                    {/* Entrer une adresse */}
                    <div className="rounded-[20px] bg-white/5 ring-1 ring-white/10 ring-inset px-4 py-4">
                      <p className="text-[14px] font-medium text-white/85">
                        {t(
                          "ui_manual_address_title",
                          "Entrer manuellement une adresse",
                        )}
                      </p>
                      <p className="mt-1 text-[12px] text-white/50 leading-snug">
                        {t(
                          "ui_manual_address_hint",
                          "Collez une adresse ou un identifiant.",
                        )}
                      </p>
                      <div className="mt-3 flex items-center gap-2">
                        <input
                          value={quickscanRecipient}
                          onChange={(e) => setQuickscanRecipient(e.target.value)}
                          placeholder={t(
                            "ui_destination_placeholder",
                            "Adresse du destinataire…",
                          )}
                          className="flex-1 bg-black/40 ring-1 ring-white/15 ring-inset rounded-[14px] px-3 py-2.5 text-[13px] text-white outline-none focus:outline-none focus:ring-2 focus:ring-xcannes-green/80"
                        />
                        <button
                          type="button"
                          className="shrink-0 rounded-[14px] px-3 py-2.5 bg-xcannes-green/15 text-xcannes-green ring-1 ring-xcannes-green/30 hover:bg-xcannes-green/20 transition-colors text-[13px] font-semibold"
                          onClick={() => {}}
                        >
                          {t("ui_validate", "Valider")}
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setSubModal(null);
                        onChooseSimpleSend?.();
                      }}
                      className="mt-1 w-full rounded-[20px] bg-xcannes-green text-black font-semibold text-[15px] py-3.5 shadow-[0_14px_40px_rgba(0,255,150,0.12)] active:scale-[0.99] transition-transform"
                    >
                      {t("ui_continue", "Continuer")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ═══ Sub-modal: Payer une demande (UI) ═══ */}
      {subModal === "payreq" ? (
        <div
          className={
            inline
              ? "absolute inset-0 z-50 flex"
              : "fixed inset-0 z-[10100] flex items-end justify-center pointer-events-none"
          }
        >
          {!inline ? (
            <div
              className="fixed inset-0 bg-black/70 pointer-events-auto wallet-modal-backdrop-in"
              onClick={() => setSubModal(null)}
              style={
                overlayTranslateY > 0
                  ? { opacity: Math.max(0, 1 - overlayTranslateY / 420) }
                  : undefined
              }
            />
          ) : null}

          <div
            className={
              inline
                ? "w-full h-full"
                : "relative z-10 pointer-events-auto w-full wallet-modal-lift-in"
            }
          >
            <div
              className={
                inline
                  ? "relative w-full h-full overflow-hidden flex flex-col bg-xcannes-surface-demo rounded-xl"
                  : "relative w-full wallet-modal-panel wallet-modal-no-top-highlight-mobile overflow-hidden flex flex-col bg-xcannes-surface-demo h-screen rounded-none pb-[env(safe-area-inset-bottom)]"
              }
              style={
                !inline && overlayTranslateY
                  ? {
                      transform: `translateY(${Math.max(0, overlayTranslateY)}px)`,
                      transition: overlayDragging
                        ? "none"
                        : "transform 220ms cubic-bezier(0.2,0,0,1)",
                      opacity: Math.max(
                        0,
                        Math.min(1, 1 - overlayTranslateY / 420),
                      ),
                    }
                  : undefined
              }
              onPointerDown={handleSubModalPillDown}
            >
              {/* Glow */}
              <div className="pointer-events-none absolute inset-0" aria-hidden>
                <div className="absolute inset-0 bg-[radial-gradient(700px_circle_at_100%_50%,rgba(245,166,35,0.12),transparent_60%)]" />
                <div className="absolute inset-0 bg-[radial-gradient(400px_circle_at_0%_100%,rgba(255,255,255,0.03),transparent_55%)]" />
                <div className="absolute inset-0 bg-gradient-to-b from-black/0 via-black/10 to-black/55" />
              </div>

              <div className="relative z-10 flex flex-col flex-1 min-h-0">
                {!inline ? (
                  <div className="flex justify-center pt-3 pb-0" aria-hidden>
                    <span className="block w-12 h-1.5 rounded-full bg-white/20" />
                  </div>
                ) : null}

                <div className="px-5 pt-[70px] pb-5 flex flex-col flex-1 min-h-0 overflow-y-auto overscroll-contain">
                  <div className="flex flex-col items-center text-center mb-[40px]">
                    <h3 className="mt-1 text-[30px] font-bold text-white/95 tracking-tight">
                      {t(
                        "ui_send_pay_request_title",
                        "Renseigner une demande",
                      )}
                    </h3>
                    <p className="mt-2 text-[14px] text-white/60 max-w-[34ch] leading-relaxed">
                      {t(
                        "ui_send_pay_request_hint",
                        "Scannez, importez un QR code ou saisissez une demande de paiement.",
                      )}
                    </p>

                    <div className="mt-[40px] flex justify-center px-4 w-full">
                      <div className="rounded-[18px] bg-elevated ring-1 ring-white/10 ring-inset px-4 py-3 shadow-[0_4px_12px_rgba(0,0,0,0.4),0_0_8px_rgba(255,255,255,0.12)]">
                        <div className="text-[11px] text-white/45 text-center">
                          {t("moonpay_from_account", "Compte source")}
                        </div>
                        <div className="mt-1 flex justify-center">
                          {renderWalletMeta?.(
                            "text-center [&_.font-mono]:hidden",
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-4">
                    {/* Scanner un QR code */}
                    <div className="rounded-[20px] bg-elevated">
                      <button
                        type="button"
                        onClick={() => {
                          setSubModal(null);
                          onChoosePayRequest?.();
                        }}
                        className="w-full flex items-center gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 hover:bg-transparent hover:ring-white/15 transition-colors duration-150 text-left"
                      >
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-8 h-8 text-white/90"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M7 7h3M7 7v3M17 7h-3M17 7v3M7 17h3M7 17v-3M17 17h-3M17 17v-3"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M9.5 12h5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-white/85">
                            {t("ui_scan_qr_card_title", "Scanner un QR code")}
                          </p>
                          <p className="mt-1 text-[12px] text-white/50 leading-snug">
                            {t(
                              "ui_scan_qr_card_hint",
                              "Ouvrir la caméra pour lire une demande.",
                            )}
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 text-white/45 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M9 18L15 12L9 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Importer un QR code */}
                    <div className="rounded-[20px] bg-elevated">
                      <button
                        type="button"
                        onClick={() =>
                          triggerFileUpload(payreqFileInputIdRef.current)
                        }
                        className="w-full flex items-center gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 hover:bg-transparent hover:ring-white/15 transition-colors duration-150 text-left"
                      >
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-8 h-8 text-white/90"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M12 3v10"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M8.5 6.5L12 3l3.5 3.5"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                            <path
                              d="M5 14v4a3 3 0 0 0 3 3h8a3 3 0 0 0 3-3v-4"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-white/85">
                            {t(
                              "ui_import_qr_card_title",
                              "Importer un QR code",
                            )}
                          </p>
                          <p className="mt-1 text-[12px] text-white/50 leading-snug">
                            {t(
                              "ui_import_qr_card_hint",
                              "Charger une image contenant le QR.",
                            )}
                          </p>
                        </div>
                        <svg
                          className="w-5 h-5 text-white/45 flex-shrink-0"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden
                        >
                          <path
                            d="M9 18L15 12L9 6"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </button>
                    </div>

                    {/* Saisir une demande */}
                    <div className="rounded-[20px] bg-elevated">
                      <div className="w-full flex items-start gap-4 bg-white/5 ring-1 ring-inset ring-white/10 rounded-[20px] shadow-[inset_0_-34px_34px_-20px_rgba(0,0,0,0.95),inset_0_-18px_70px_-45px_rgba(0,0,0,0.9)] px-4 py-4 text-left">
                        <div className="w-11 h-11 flex items-center justify-center flex-shrink-0">
                          <svg
                            viewBox="0 0 24 24"
                            className="w-8 h-8 text-white/90"
                            fill="none"
                            aria-hidden
                          >
                            <path
                              d="M5 20h14"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinecap="round"
                            />
                            <path
                              d="M7 16l10-10 2 2-10 10H7v-2z"
                              stroke="currentColor"
                              strokeWidth="1.5"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-medium text-white/85">
                            {t("ui_paste_payreq_card_title", "Saisir une demande")}
                          </p>
                          <div className="relative mt-1.5">
                            <input
                              type="text"
                              value={payreqPasteValue}
                              onChange={(e) => {
                                setPayreqPasteValue(e.target.value);
                                setPayreqInvalidError(false);
                                setPayreqSelfSendError(false);
                                setPendingPayreq("");
                              }}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter") return;
                                const text = String(payreqPasteValue || "").trim();
                                const isSelf =
                                  text.toLowerCase().includes("self");
                                const isValid = text.length >= 8;
                                setPayreqSelfSendError(isSelf);
                                setPayreqInvalidError(!isValid && !isSelf);
                                setPendingPayreq(isValid && !isSelf ? text : "");
                              }}
                              onPaste={(e) => {
                                const text = String(
                                  e.clipboardData?.getData("text") || "",
                                ).trim();
                                if (!text) return;
                                e.preventDefault();
                                setPayreqPasteValue(text);
                                const isSelf = text.toLowerCase().includes("self");
                                const isValid = text.length >= 8;
                                setPayreqSelfSendError(isSelf);
                                setPayreqInvalidError(!isValid && !isSelf);
                                setPendingPayreq(isValid && !isSelf ? text : "");
                              }}
                              placeholder={t(
                                "ui_paste_payreq_placeholder",
                                "Saisir une demande de paiement",
                              )}
                              className="w-full bg-black/80 ring-1 ring-white/10 ring-inset rounded-xl shadow-[0_4px_18px_rgba(0,0,0,0.6),inset_0_16px_28px_rgba(255,255,255,0.08),inset_0_-14px_24px_rgba(0,0,0,0.30)] pl-3 pr-10 py-2 text-[13px] text-white placeholder:text-white/30 outline-none focus:ring-white/25 transition-all duration-200"
                            />
                            {String(payreqPasteValue || "").trim() ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const text = String(payreqPasteValue || "").trim();
                                  const isSelf =
                                    text.toLowerCase().includes("self");
                                  const isValid = text.length >= 8;
                                  setPayreqSelfSendError(isSelf);
                                  setPayreqInvalidError(!isValid && !isSelf);
                                  setPendingPayreq(
                                    isValid && !isSelf ? text : "",
                                  );
                                }}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg text-white/30 hover:text-white/60 transition-colors"
                                title={t("ui_go_label", "Valider")}
                              >
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                  strokeWidth={2}
                                  aria-hidden
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    d="M5 12h14M12 5l7 7-7 7"
                                  />
                                </svg>
                              </button>
                            ) : null}
                          </div>

                          {payreqSelfSendError ? (
                            <div className="rounded-lg ring-1 ring-orange-400/30 ring-inset bg-orange-400/10 px-3 py-2.5 text-xs text-orange-200/90 mt-2">
                              <div className="font-semibold">
                                {t(
                                  "ui_invalid_recipient_title",
                                  "Destinataire invalide",
                                )}
                              </div>
                              <div className="mt-0.5 text-orange-200/70">
                                {t(
                                  "ui_cannot_send_to_self",
                                  "Vous ne pouvez pas envoyer à votre propre compte.",
                                )}
                              </div>
                            </div>
                          ) : null}

                          {payreqInvalidError ? (
                            <div className="rounded-lg ring-1 ring-orange-400/20 ring-inset bg-orange-400/10 px-3 py-2.5 text-xs text-orange-200/90 mt-2">
                              <div className="font-semibold">
                                {t(
                                  "ui_invalid_payreq_title",
                                  "Demande invalide",
                                )}
                              </div>
                              <div className="mt-0.5 text-orange-200/70">
                                {t(
                                  "ui_invalid_payreq_hint",
                                  "Ce code ne ressemble pas à une demande de paiement.",
                                )}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    <div className="pt-[34px]">
                      <button
                        type="button"
                        disabled={!pendingPayreq}
                        onClick={() => {
                          if (!pendingPayreq) return;
                          setSubModal(null);
                          onChoosePayRequest?.();
                        }}
                        className={`w-full py-3.5 rounded-[14px] text-[16px] font-semibold transition-all duration-200 ${
                          pendingPayreq
                            ? "text-white hover:scale-[1.01] active:scale-[0.98]"
                            : "cursor-not-allowed ring-[0.5px] ring-[#f5a623]/40 ring-inset"
                        }`}
                        style={
                          pendingPayreq
                            ? {
                                background:
                                  "linear-gradient(180deg, #f5a623 0%, #d98c0f 100%)",
                                boxShadow:
                                  "0 14px 28px rgba(0,0,0,0.52), inset 0 1px 0 rgba(255,255,255,0.16), inset 0 -12px 20px rgba(0,0,0,0.28)",
                              }
                            : {
                                background: "rgba(245,166,35,0.07)",
                                color: "rgba(255,255,255,0.2)",
                              }
                        }
                      >
                        {pendingPayreq
                          ? t(
                              "ui_validate_payreq",
                              "Vérifier la demande de paiement",
                            )
                          : t(
                              "ui_fill_payreq",
                              "Renseignez la demande de paiement",
                            )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );

  if (inline) return content;
  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}
