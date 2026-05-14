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
  t,
  locale,
}) {
  if (!detailMovement || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-[20px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
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
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t(
                      "ui_recipient_label_2c7a1d9b5e",
                      "Destinataire",
                    )}
                  </span>
                  <span className="text-sm font-semibold text-white/90 truncate">
                    {detailRecipientLabel}
                  </span>
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
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-white/60">
                    {t(
                      "ui_sender_label_2c7a1d9b5e",
                      "Expéditeur",
                    )}
                  </span>
                  <span className="text-sm font-semibold text-white/90 truncate">
                    {detailSenderLabel}
                  </span>
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

        {/* Counterparty copy */}
        {detailMovement?.counterparty &&
        isXrplAddress(detailMovement.counterparty) &&
        !detailIsPaymentSent ? (
          <div className="mt-3 flex items-center justify-end gap-2">
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
              className="inline-flex items-center justify-center px-3 py-2 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors text-sm font-semibold"
            >
              {t("ui_copy_address", "Copier l'adresse")}
            </button>
            {copiedCounterparty ? (
              <span className="text-[10px] text-xcannes-green/90 font-medium">
                {t("ui_copied", "Copié")}
              </span>
            ) : null}
          </div>
        ) : null}

        <div className="h-px bg-white/[0.04] my-3" />

        {/* Wallet + partage */}
        {detailMovement?.txHash ? (
          <div className="space-y-2">
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="h-2.5 w-2.5 rounded-full bg-xcannes-green ring-4 ring-xcannes-green/20 shrink-0 animate-pulse" aria-hidden />
                  <span className="text-sm text-white/90 font-semibold truncate">
                    {walletLabel || t("nav_wallet", "Wallet")}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(
                        detailMovement.txHash,
                        t("ui_copied_hash", "Hash copié"),
                      );
                      setCopiedHash(true);
                      window.setTimeout(
                        () => setCopiedHash(false),
                        1200,
                      );
                    }}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label={t("ui_copy_hash", "Copy hash")}
                    title={t("ui_copy_hash", "Copy hash")}
                  >
                    ⧉
                  </button>
                  {copiedHash ? (
                    <span className="text-[10px] text-xcannes-green/90 font-medium">
                      {t("ui_copied", "Copié")}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex items-center justify-center w-9 h-9 rounded-[20px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                    aria-label={t("ui_share", "Partager")}
                    title={t("ui_share", "Partager")}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </button>
                </div>
              </div>
              {shareNotice ? (
                <div
                  className={[
                    "mt-3 text-xs font-medium",
                    shareNoticeTone === "error"
                      ? "text-red-200"
                      : "text-xcannes-green/90",
                  ].join(" ")}
                >
                  {shareNotice}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
