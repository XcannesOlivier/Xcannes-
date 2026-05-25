import { useCallback, useRef, useState } from "react";
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
  walletAddress,
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

  if (!detailTx || typeof document === "undefined") return null;

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
        className={`relative w-full max-w-md rounded-[14px] ${modalBgClass} p-4 md:p-5 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in`}
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

        {/* Partage */}
        {detailTx?.txHash ? (
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

        <div className="mt-4 text-center text-[11px] tracking-[0.08em] text-white/30">
          XCANNES
        </div>
      </div>
    </div>,
    document.body,
  );
}
