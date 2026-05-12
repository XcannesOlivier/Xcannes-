import { createPortal } from "react-dom";

/**
 * CurrencyTransactionDetailModal
 * Overlay portal showing the detail of a single currency statement transaction.
 */
export default function CurrencyTransactionDetailModal({
  detailTx,
  onClose,
  modalBgClass,
  detailIsConversion,
  detailTypeLabel,
  detailStatusLabel,
  formatDateTime,
  formatAmountRlusdAsLocal,
  walletLabel,
  counterpartyAddress,
  counterpartyTitle,
  counterpartyName,
  copyToClipboard,
  copiedAddress,
  setCopiedAddress,
  copiedAddressTimerRef,
  copiedHash,
  setCopiedHash,
  copiedHashTimerRef,
  truncateMiddle,
  showConversionFee,
  handleShare,
  shareNotice,
  shareNoticeTone,
  t,
}) {
  if (!detailTx || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
        onClick={onClose}
      />
      <div
        className={`relative w-full max-w-md rounded-[14px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
              {detailTypeLabel || t("ui_transaction", "Transaction")}
            </div>
            <div
              className={`mt-1 text-[22px] md:text-[26px] font-bold font-mono whitespace-nowrap ${
                detailTx?.type === "debit"
                  ? "text-red-400"
                  : "text-xcannes-green"
              }`}
            >
              {detailTx?.type === "debit" ? "−" : "+"}
              {formatAmountRlusdAsLocal(detailTx?.amount ?? 0)}
            </div>
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
                {formatDateTime(detailTx)}
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-white/[0.04] my-3" />

        {detailIsConversion ? (
          <div className="space-y-2">
            <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
              {t("ui_account", "Compte")}
            </div>
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
              <div className="text-sm text-white/90 font-semibold truncate">
                {walletLabel || t("nav_wallet", "Wallet")}
              </div>
            </div>
          </div>
        ) : null}

        {/* Counterparty */}
        {!detailIsConversion && counterpartyAddress ? (
          <div className="space-y-2">
            <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
              {counterpartyTitle}
            </div>
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm text-white/90 font-semibold truncate">
                    {counterpartyName}
                  </div>
                  <div className="mt-0.5 text-xs text-white/60 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                    {truncateMiddle(counterpartyAddress, 8, 6)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard(
                      counterpartyAddress,
                      t("ui_copied_address", "Adresse copiée"),
                    );
                    setCopiedAddress(true);
                    if (copiedAddressTimerRef.current) {
                      window.clearTimeout(copiedAddressTimerRef.current);
                    }
                    copiedAddressTimerRef.current = window.setTimeout(() => {
                      setCopiedAddress(false);
                      copiedAddressTimerRef.current = null;
                    }, 1200);
                  }}
                  className="flex-none inline-flex items-center justify-center w-9 h-9 rounded-lg bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  aria-label={t("ui_copy_address", "Copy address")}
                  title={t("ui_copy_address", "Copy address")}
                >
                  ⧉
                </button>
                {copiedAddress ? (
                  <span className="text-[10px] text-xcannes-green/90 font-medium">
                    {t("ui_copied", "Copié")}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}

        <div className="h-px bg-white/[0.04] my-3" />

        {/* Financial details */}
        <div className="space-y-2">
          <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
            {t("ui_details_label", "Détails")}
          </div>
          <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs text-white/60">
                {t("ui_amount_52cea2dd3d", "Montant")}
              </span>
              <span
                className={`text-sm font-semibold font-mono ${
                  detailTx?.type === "debit"
                    ? "text-red-400"
                    : "text-xcannes-green"
                }`}
              >
                {detailTx?.type === "debit" ? "−" : "+"}
                {formatAmountRlusdAsLocal(detailTx?.amount ?? 0)}
              </span>
            </div>
            {showConversionFee ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">
                  {t("statement_conversion_fee_label", "Frais")}
                </span>
                <span className="text-sm font-semibold font-mono text-white/90">
                  {detailTx?.spreadRlusd
                    ? formatAmountRlusdAsLocal(detailTx.spreadRlusd)
                    : formatAmountRlusdAsLocal(0)}
                </span>
              </div>
            ) : null}
            {detailTx?.runningBalance != null ||
            detailTx?.displayRunningBalance != null ? (
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">
                  {t("ui_balance_after_label", "Solde après")}
                </span>
                <span className="text-sm font-semibold font-mono text-white/90">
                  {formatAmountRlusdAsLocal(
                    detailTx?.displayRunningBalance != null
                      ? detailTx.displayRunningBalance
                      : detailTx?.runningBalance ?? 0,
                  )}
                </span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="h-px bg-white/[0.04] my-3" />

        {/* Technical */}
        {detailTx?.txHash ? (
          <div className="space-y-2">
            <div className="text-[11px] tracking-[0.08em] text-[#8B98A5]">
              {t("ui_transaction", "Transaction")}
            </div>
            <div className="rounded-[20px] border border-white/[0.06] bg-white/[0.03] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-xs text-white/60">
                    {t("ui_tx_hash_label_2b7c1a9d5e", "Hash")}
                  </div>
                  <div className="mt-0.5 text-sm text-white/90 font-mono whitespace-nowrap overflow-hidden text-ellipsis">
                    {truncateMiddle(detailTx.txHash, 10, 8)}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-none">
                  <button
                    type="button"
                    onClick={async () => {
                      await copyToClipboard(
                        detailTx.txHash,
                        t("ui_copied_hash", "Hash copié"),
                      );
                      setCopiedHash(true);
                      if (copiedHashTimerRef.current) {
                        window.clearTimeout(copiedHashTimerRef.current);
                      }
                      copiedHashTimerRef.current = window.setTimeout(() => {
                        setCopiedHash(false);
                        copiedHashTimerRef.current = null;
                      }, 1200);
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
                    ↗
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
