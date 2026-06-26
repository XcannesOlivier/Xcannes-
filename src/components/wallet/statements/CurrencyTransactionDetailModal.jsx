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

  // Type detection
  const isCredit = !detailIsConversion && detailTx?.type !== "debit";
  const isDebit = !detailIsConversion && detailTx?.type === "debit";

  // Accent palette per type
  const accentText = detailIsConversion ? "text-blue-400" : isCredit ? "text-xcannes-green" : "text-red-400";
  const accentBorder = detailIsConversion ? "border-blue-400/40" : isCredit ? "border-green-500/40" : "border-red-400/40";
  const accentBg = detailIsConversion ? "bg-blue-400/10" : isCredit ? "bg-green-500/10" : "bg-red-400/10";
  const accentDotBg = detailIsConversion ? "bg-blue-400" : isCredit ? "bg-xcannes-green" : "bg-red-400";

  // Wallet
  const wName = String(walletLabel || t("nav_wallet", "Wallet")).trim();
  const wAddr = String(walletAddress || "").trim();
  const wAddrShort = wAddr.length > 18 ? `${wAddr.slice(0, 8)}…${wAddr.slice(-6)}` : wAddr;
  const initial = wName.charAt(0).toUpperCase();

  // Amount
  const sign = isDebit ? "−" : isCredit ? "+" : "";
  const amountDisplay = `${sign}${formatAmountRlusdAsLocal(detailTx?.amount ?? 0)}`;

  // Date
  const formattedDate = formatDateTime(detailTx);

  // TX hash
  const txHash = String(detailTx?.txHash || "").trim();
  const txHashShort = txHash.length > 22 ? `${txHash.slice(0, 10)}…${txHash.slice(-10)}` : txHash;

  // Balance after
  const balAfterRaw = detailTx?.displayRunningBalance ?? detailTx?.runningBalance;
  const balAfterDisplay = balAfterRaw != null ? formatAmountRlusdAsLocal(balAfterRaw) : null;

  // Security note
  const secNote = t("ui_security_confirmation_note", "Chaque transaction nécessite une confirmation.");

  return createPortal(
    <div className="fixed inset-0 z-[10300] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm wallet-modal-backdrop-in"
        onClick={onClose}
        style={dragY > 0 ? { opacity: fadeOpacity } : undefined}
      />
      {/* Bottom bar – mobile only */}
      <div
        className="md:hidden pointer-events-none fixed left-1/2 -translate-x-1/2 bottom-[max(env(safe-area-inset-bottom),10px)] z-[10310]"
        aria-hidden
      >
        <span className="block w-36 h-1.5 rounded-full bg-white/80" />
      </div>
      <div
        className={`relative w-full max-w-md rounded-[20px] ${modalBgClass} px-4 pt-2 pb-3 ring-1 ring-white/10 ring-inset shadow-[0_24px_60px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-26px_46px_rgba(0,0,0,0.55)] wallet-modal-lift-in overflow-y-auto max-h-[92dvh]`}
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
        <div className="md:hidden mb-2 flex justify-center" aria-hidden>
          <span className="block w-12 h-1.5 rounded-full bg-white/20" />
        </div>

        {/* Account header: avatar + nom + adresse */}
        <div className="flex items-center gap-2.5 mb-2">
          <div className="relative shrink-0">
            <div className={`w-10 h-10 rounded-full border-2 ${accentBorder} ${accentBg} flex items-center justify-center text-white font-bold text-base`}>
              {initial}
            </div>
            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full ${accentDotBg} border-2 border-[#0b0f10]`} />
          </div>
          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white/85 truncate">{wName}</div>
            {wAddrShort ? <div className="text-[11px] text-white/50 font-mono truncate">{wAddrShort}</div> : null}
          </div>
        </div>

        {/* Grand icône central */}
        <div className="flex justify-center mb-1.5">
          <div className={`w-12 h-12 rounded-full border-2 ${accentBorder} ${accentBg} flex items-center justify-center`}>
            {detailIsConversion ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${accentText}`} aria-hidden="true">
                <path d="M7 16V4m0 0L3 8m4-4l4 4" /><path d="M17 8v12m0 0l4-4m-4 4l-4-4" />
              </svg>
            ) : isCredit ? (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${accentText}`} aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`w-5 h-5 ${accentText}`} aria-hidden="true">
                <line x1="12" y1="19" x2="12" y2="5" /><polyline points="5 12 12 5 19 12" />
              </svg>
            )}
          </div>
        </div>

        {/* Titre */}
        <div className="text-center text-xl font-extrabold text-white mb-1">
          {detailTypeLabel || t("ui_transaction", "Transaction")}
        </div>

        {/* Montant large */}
        <div className={`text-center text-[1.75rem] font-extrabold font-mono ${accentText} leading-tight mb-2`}>
          {amountDisplay}
        </div>

        {/* Divider */}
        <div className="h-px bg-white/[0.07] mb-2" />

        {/* Statut & date */}
        <div className="mb-1 text-[11px] tracking-[0.08em] text-[#8B98A5]">
          {t("ui_status_and_date", "Statut & date")}
        </div>
        <div className="grid grid-cols-2 gap-2 mb-2">
          <div className={`rounded-[14px] border ${accentBorder} bg-white/[0.03] px-3 py-2 flex items-center gap-2`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`w-4 h-4 shrink-0 ${accentText}`} aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <div className="min-w-0">
              <div className="text-xs text-white/60">{t("ui_status_label", "Statut")}</div>
              <div className={`text-sm font-bold ${accentText} truncate`}>{detailStatusLabel || "—"}</div>
            </div>
          </div>
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-white/50" aria-hidden="true">
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <div className="min-w-0">
              <div className="text-xs text-white/60">{t("ui_date_label_7a2c1b9d5e", "Date")}</div>
              <div className="text-sm font-semibold text-white/90 leading-tight truncate">{formattedDate}</div>
            </div>
          </div>
        </div>

        {/* Expéditeur / Destinataire */}
        {!detailIsConversion && counterpartyAddress ? (
          <>
            <div className="mb-1 text-[11px] tracking-[0.08em] text-[#8B98A5]">{counterpartyTitle}</div>
            <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 mb-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-[15px] font-bold text-white truncate">{counterpartyName}</div>
                  <div className="text-[11px] text-white/50 font-mono mt-0.5 truncate">
                    {truncateMiddle(counterpartyAddress, 8, 6)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={async () => {
                    await copyToClipboard(counterpartyAddress, t("ui_copied_address", "Adresse copiée"));
                    setCopiedAddress(true);
                    if (copiedAddressTimerRef.current) window.clearTimeout(copiedAddressTimerRef.current);
                    copiedAddressTimerRef.current = window.setTimeout(() => {
                      setCopiedAddress(false);
                      copiedAddressTimerRef.current = null;
                    }, 1200);
                  }}
                  className="flex-none inline-flex items-center justify-center w-9 h-9 rounded-[14px] bg-white/[0.04] border border-white/[0.06] text-white/70 hover:text-white hover:bg-white/[0.06] transition-colors"
                  aria-label={t("ui_copy_address", "Copier l'adresse")}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5" aria-hidden="true">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                </button>
              </div>
              {copiedAddress ? (
                <div className="text-[10px] text-xcannes-green/90 font-medium mt-1">{t("ui_copied", "Copié")}</div>
              ) : null}
            </div>
          </>
        ) : null}

        {/* Détails: Montant + Frais (conversion) + Solde après */}
        <div className="mb-1 text-[11px] tracking-[0.08em] text-[#8B98A5]">{t("ui_details_label", "Détails")}</div>
        <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 mb-2 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-white/60">{t("ui_amount_52cea2dd3d", "Montant")}</span>
            <span className={`text-sm font-bold font-mono ${accentText}`}>{amountDisplay}</span>
          </div>
          {showConversionFee ? (
            <>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">{t("statement_conversion_fee_label", "Frais")}</span>
                <span className="text-sm font-semibold font-mono text-white/90">
                  {formatAmountRlusdAsLocal(detailTx?.spreadRlusd ?? 0)}
                </span>
              </div>
            </>
          ) : null}
          {balAfterDisplay ? (
            <>
              <div className="h-px bg-white/[0.06]" />
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs text-white/60">{t("ui_balance_after_label", "Solde après")}</span>
                <span className="text-sm font-semibold font-mono text-white/90">{balAfterDisplay}</span>
              </div>
            </>
          ) : null}
        </div>

        {/* TX ID */}
        {txHash ? (
          <div className="rounded-[14px] border border-white/[0.06] bg-white/[0.03] px-3 py-2 mb-2">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0 flex items-center gap-2">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-white/50" aria-hidden="true">
                  <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" />
                  <line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
                </svg>
                <div className="min-w-0">
                  <div className="text-xs text-white/60">{t("ui_tx_id", "ID de transaction")}</div>
                  <div className="text-[11px] font-mono text-white/85 truncate">{txHashShort}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await copyToClipboard(txHash, t("ui_copied_hash", "Hash copié"));
                  setCopiedHash(true);
                  if (copiedHashTimerRef.current) window.clearTimeout(copiedHashTimerRef.current);
                  copiedHashTimerRef.current = window.setTimeout(() => {
                    setCopiedHash(false);
                    copiedHashTimerRef.current = null;
                  }, 1200);
                }}
                className={`shrink-0 px-3 h-8 rounded-[12px] ${accentBg} border ${accentBorder} ${accentText} text-xs font-semibold transition-colors`}
              >
                {copiedHash ? t("ui_copied", "Copié") : t("ui_copy_action", "Copier")}
              </button>
            </div>
          </div>
        ) : null}

        {/* Note de sécurité */}
        <div className="flex items-center gap-2 mb-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 shrink-0 text-white/30" aria-hidden="true">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <span className="text-[11px] text-white/40">{secNote}</span>
        </div>

        {/* Bouton Partager */}
        <div className="flex flex-col items-end gap-1">
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-2 px-2 h-8 bg-transparent text-white/80 hover:text-white transition-colors text-sm font-semibold"
            aria-label={t("ui_share", "Partager")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4" aria-hidden="true">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            <span>{t("ui_share", "Partager")}</span>
          </button>
          {shareNotice ? (
            <div className={`text-xs font-medium ${shareNoticeTone === "error" ? "text-red-200" : "text-xcannes-green/90"}`}>
              {shareNotice}
            </div>
          ) : null}
        </div>

        {/* Footer XCANNES */}
        <div className="mt-1.5 text-center text-[11px] tracking-[0.08em] text-white/30">
          XCANNES
        </div>
      </div>
    </div>,
    document.body,
  );
}
