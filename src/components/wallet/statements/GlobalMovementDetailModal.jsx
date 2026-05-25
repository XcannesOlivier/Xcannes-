import { useCallback, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * GlobalMovementDetailModal
 * Overlay portal showing the detail of a global statement movement.
 */
export default function GlobalMovementDetailModal({
  detailMovement,
  onClose,
  modalBgClass,
  detailIsConversion,
  detailConversionHeader,
  detailTypeLabel,
  getMovementUiType,
  getMovementDisplayAmount,
  formatAmountWithSymbolLocal,
  detailStatusLabel,
  formatMovementDateTime,
  normalizeKind,
  detailIsPaymentSent,
  detailIsPaymentReceive,
  detailRecipientLabel,
  detailSenderLabel,
  detailConversionFrom,
  detailConversionTo,
  detailConversionFee,
  copiedCounterparty,
  setCopiedCounterparty,
  copyToClipboard,
  copiedHash,
  setCopiedHash,
  handleShare,
  shareNotice,
  shareNoticeTone,
  isXrplAddress,
  truncateMiddle,
  walletLabel,
  walletAddress,
  t,
  locale,
}) {
  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragMetaRef = useRef(null);

  const onPointerDown = useCallback((e) => {
    if (!e.isPrimary || e.pointerType === "mouse") return;
    if (
      e.target?.closest?.(
        'input,textarea,select,button,a,[role="button"]',
      )
    )
      return;
    dragMetaRef.current = {
      startY: e.clientY,
      startAt: Date.now(),
      pointerId: e.pointerId,
      lastDelta: 0,
    };
  }, []);

  const onPointerMove = useCallback((e) => {
    const meta = dragMetaRef.current;
    if (!meta || e.pointerId !== meta.pointerId) return;
    const delta = e.clientY - meta.startY;
    if (delta <= 0) {
      meta.lastDelta = 0;
      setDragY(0);
      return;
    }
    meta.lastDelta = delta;
    setDragging(true);
    setDragY(delta);
  }, []);

  const onPointerEnd = useCallback(
    (e) => {
      const meta = dragMetaRef.current;
      if (!meta || e.pointerId !== meta.pointerId) return;
      const delta = meta.lastDelta || 0;
      const duration = Math.max(1, Date.now() - meta.startAt);
      const velocity = delta / duration;
      const height =
        typeof window !== "undefined" ? window.innerHeight : 800;
      const closeDistance = Math.max(140, Math.min(240, height * 0.2));
      const shouldClose =
        delta > closeDistance ||
        (delta > closeDistance * 0.55 && velocity > 1.15);
      dragMetaRef.current = null;
      setDragging(false);
      if (shouldClose) {
        setDragY(Math.max(delta, height));
        window.setTimeout(() => {
          onClose?.();
        }, 180);
        return;
      }
      setDragY(0);
    },
    [onClose],
  );

  if (!detailMovement || typeof document === "undefined") return null;

  const fadeOpacity =
    dragY > 0 ? Math.max(0, Math.min(1, 1 - dragY / 420)) : 1;
  const panelTransition = dragging
    ? "none"
    : "transform 220ms cubic-bezier(0.2,0,0,1), opacity 220ms cubic-bezier(0.2,0,0,1)";

  return createPortal(
    <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
        onClick={onClose}
        style={dragY > 0 ? { opacity: fadeOpacity } : undefined}
      />
      <div
        className={`relative w-full max-w-md rounded-[20px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
        style={{
          transform: dragY ? `translateY(${dragY}px)` : undefined,
          opacity: dragY ? fadeOpacity : undefined,
          transition: panelTransition,
          willChange: dragY ? "transform, opacity" : undefined,
          touchAction: "none",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
      >
        {/* Swipe handle (mobile) */}
        <div className="md:hidden -mt-1 mb-2 flex justify-center" aria-hidden>
          <span className="block w-12 h-1.5 rounded-full bg-white/20" />
        </div>
        {/* Bottom bar – mobile only (home indicator, comme dans send choice) */}
        <div
          className="md:hidden pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-20"
          aria-hidden
        >
          <span className="block w-36 h-1.5 rounded-full bg-white/80" />
        </div>
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[15px] md:text-[16px] font-semibold text-white/85 truncate">
              {(() => {
                const name = String(walletLabel || t("nav_wallet", "Wallet")).trim();
                const addr = String(walletAddress || "").trim();
                const half = addr ? `${addr.slice(0, Math.ceil(addr.length / 2))}…` : "";
                return `${t("ui_your_account_label", "Votre compte")}: ${name}${half ? " • " + half : ""}`;
              })()}
            </div>
            <div className="mt-1 text-[11px] tracking-[0.08em] text-[#8B98A5]">
              {detailIsConversion ? detailConversionHeader : detailTypeLabel}
            </div>
            {!detailIsConversion ? (
              <div
                className={[
                  "mt-1 text-[22px] md:text-[26px] font-bold font-mono whitespace-nowrap",
                  getMovementUiType(detailMovement) === "debit"
                    ? "text-red-400"
                    : getMovementUiType(detailMovement) === "credit"
                      ? "text-xcannes-green"
                      : "text-white/90",
                ].join(" ")}
              >
                {(() => {
                  const uiType = getMovementUiType(detailMovement);
                  const { amount, currency } =
                    getMovementDisplayAmount(detailMovement);
                  const sign =
                    uiType === "debit"
                      ? "−"
                      : uiType === "credit"
                        ? "+"
                        : "";
                  return `${sign}${formatAmountWithSymbolLocal(
                    amount,
                    currency,
                  )}`;
                })()}
              </div>
            ) : null}
          </div>
          {/* closed via backdrop click */}
        </div>

        <div className="h-px bg-white/[0.04] my-3" />

        {/* Status & Date */}
        <div className="space-y-3">
          <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
            {t("ui_status_and_date", "Statut & date")}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <div className="text-xs text-white/60">
                {t("ui_status_label", "Statut")}
              </div>
              <div className="mt-0.5 text-sm text-white/90 font-semibold">
                {detailStatusLabel}
              </div>
            </div>
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-2">
              <div className="text-xs text-white/60">
                {t("ui_date_label_7a2c1b9d5e", "Date")}
              </div>
              <div className="mt-0.5 text-sm text-white/90 font-semibold truncate">
                {formatMovementDateTime(detailMovement)}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.04] my-3" />

        {/* Details */}
        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
            {t("ui_details", "Détails")}
          </div>
          <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/60">
                {t("ui_type_label_8b1a4d2c7e", "Type")}
              </span>
              <span className="text-sm font-semibold text-white/90">
                {(() => {
                  const k = normalizeKind(detailMovement?.kind);
                  if (k === "PAYMENT_OUT" || k === "XRPL_PAYMENT_OUT") return t("ui_type_sent", "Envoyé");
                  if (k === "PAYMENT_IN" || k === "XRPL_PAYMENT_IN") return t("ui_type_received", "Reçu");
                  if (k === "CONVERSION") return t("ui_type_conversion", "Conversion");
                  if (k === "RECONCILE") return t("ui_type_reconcile", "Ajustement");
                  return String(detailMovement?.kind || "").trim() || "—";
                })()}
              </span>
            </div>
            {detailIsPaymentSent ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t("ui_currency_label_2f7a1c9b5e", "Devise")}
                  </span>
                  <span className="text-sm font-semibold text-white/90 font-mono">
                    {String(detailMovement?.fromCurrencyCode || "")
                      .toUpperCase()
                      .trim() || "—"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-white/60 pt-0.5">
                    {t(
                      "ui_recipient_label_2c7a1d9b5e",
                      "Destinataire",
                    )}
                  </span>
                  <div className="min-w-0 text-right">
                    <div className="text-sm font-semibold text-white/90 truncate">
                      {detailRecipientLabel}
                    </div>
                    {detailMovement?.counterparty &&
                    isXrplAddress(detailMovement.counterparty) ? (
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <span className="text-[11px] text-white/60 font-mono truncate">
                          {(() => {
                            const a = String(
                              detailMovement.counterparty || "",
                            );
                            return a
                              ? `${a.slice(0, Math.ceil(a.length / 2))}…`
                              : "";
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await copyToClipboard(
                              detailMovement.counterparty,
                              t("ui_copied_address", "Adresse copiée"),
                            );
                            setCopiedCounterparty(true);
                            window.setTimeout(
                              () => setCopiedCounterparty(false),
                              1200,
                            );
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-[14px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label={t("ui_copy_address", "Copier l'adresse")}
                          title={t("ui_copy_address", "Copier l'adresse")}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        {copiedCounterparty ? (
                          <span className="text-[10px] text-xcannes-green/90 font-medium">
                            {t("ui_copied", "Copié")}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : detailIsPaymentReceive ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t("ui_currency_label_2f7a1c9b5e", "Devise")}
                  </span>
                  <span className="text-sm font-semibold text-white/90 font-mono">
                    {String(detailMovement?.toCurrencyCode || "")
                      .toUpperCase()
                      .trim() || "—"}
                  </span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="text-xs text-white/60 pt-0.5">
                    {t(
                      "ui_sender_label_2c7a1d9b5e",
                      "Expéditeur",
                    )}
                  </span>
                  <div className="min-w-0 text-right">
                    <div className="text-sm font-semibold text-white/90 truncate">
                      {detailSenderLabel}
                    </div>
                    {detailMovement?.counterparty &&
                    isXrplAddress(detailMovement.counterparty) ? (
                      <div className="mt-1 flex items-center justify-end gap-2">
                        <span className="text-[11px] text-white/60 font-mono truncate">
                          {(() => {
                            const a = String(
                              detailMovement.counterparty || "",
                            );
                            return a
                              ? `${a.slice(0, Math.ceil(a.length / 2))}…`
                              : "";
                          })()}
                        </span>
                        <button
                          type="button"
                          onClick={async () => {
                            await copyToClipboard(
                              detailMovement.counterparty,
                              t("ui_copied_address", "Adresse copiée"),
                            );
                            setCopiedCounterparty(true);
                            window.setTimeout(
                              () => setCopiedCounterparty(false),
                              1200,
                            );
                          }}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-[14px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                          aria-label={t("ui_copy_address", "Copier l'adresse")}
                          title={t("ui_copy_address", "Copier l'adresse")}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                          </svg>
                        </button>
                        {copiedCounterparty ? (
                          <span className="text-[10px] text-xcannes-green/90 font-medium">
                            {t("ui_copied", "Copié")}
                          </span>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t("ui_from_label_2c7a1d9b5e", "From")}
                  </span>
                  <span className="text-sm font-semibold text-white/90 font-mono">
                    {detailIsConversion
                      ? detailConversionFrom
                      : String(detailMovement?.fromCurrencyCode || "")
                          .toUpperCase()
                          .trim() || "—"}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t("ui_to_label_7b2c1a9d5e", "To")}
                  </span>
                  <span className="text-sm font-semibold text-white/90 font-mono">
                    {detailIsConversion
                      ? detailConversionTo
                      : String(detailMovement?.toCurrencyCode || "")
                          .toUpperCase()
                          .trim() || "—"}
                  </span>
                </div>
                {detailIsConversion ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/60">
                      {t("ui_fx_rate", "Taux")}
                    </span>
                    <span className="text-sm font-semibold text-white/90 font-mono">
                      {detailConversionFee}
                    </span>
                  </div>
                ) : detailMovement?.fxRate ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-white/60">
                      {t("ui_fx_rate", "Taux")}
                    </span>
                    <span className="text-sm font-semibold text-white/90 font-mono">
                      {Number(detailMovement.fxRate).toLocaleString(
                        locale,
                        {
                          maximumFractionDigits: 8,
                        },
                      )}
                    </span>
                  </div>
                ) : null}
              </>
            )}
            {detailMovement?.note ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">
                  {t("ui_note", "Note")}
                </span>
                <span className="text-sm font-semibold text-white/90 truncate">
                  {String(detailMovement.note)}
                </span>
              </div>
            ) : null}
            {detailMovement?.counterparty &&
            !detailIsPaymentSent &&
            !detailIsPaymentReceive ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">
                  {t("ui_counterparty", "Contrepartie")}
                </span>
                <span className="text-sm font-semibold text-white/90 font-mono truncate">
                  {isXrplAddress(detailMovement.counterparty)
                    ? truncateMiddle(detailMovement.counterparty, 8, 6)
                    : String(detailMovement.counterparty)}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Counterparty copy (legacy block removed; copy icon shown inline under recipient/sender) */}

        {/* Partage */}
        {detailMovement?.txHash ? (
          <div className="mt-3 flex flex-col items-end gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex items-center gap-2 px-2 h-9 bg-transparent text-white/80 hover:text-white transition-colors text-sm font-semibold"
              aria-label={t("ui_share", "Partager")}
              title={t("ui_share", "Partager")}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
              <span>{t("ui_share", "Partager")}</span>
            </button>
            {shareNotice ? (
              <div
                className={[
                  "text-xs font-medium",
                  shareNoticeTone === "error"
                    ? "text-red-200"
                    : "text-xcannes-green/90",
                ].join(" ")}
              >
                {shareNotice}
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 mb-6 md:mb-0 text-center text-[11px] tracking-[0.08em] text-white/30">
          XCANNES
        </div>
      </div>
    </div>,
    document.body,
  );
}
