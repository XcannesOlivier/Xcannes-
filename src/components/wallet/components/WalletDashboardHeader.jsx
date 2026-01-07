"use client";

	import XummConnectButton from "@/components/xumm/XummConnectButton";

export default function WalletDashboardHeader({
  layout,
  effectiveIsConnected,
  effectiveWallet,
  onDisconnect,
  totalLabel,
  onOpenGlobalStatement,
  xrplConnectionIndicator,
  walletLabel,
  walletHeaderToast,
  onOpenWalletLabelEditor,
  onCopyAddress,
  onSwitchWallet,
  isConnecting,
  isEditingWalletLabel,
  walletLabelDraft,
  onWalletLabelDraftChange,
  onSaveWalletLabel,
  onCancelWalletLabel,
}) {
  return (
    <div className={`panel-header ${layout.headerClass} flex flex-col shrink-0`}>
      {/* Titres discrets en haut */}
      <div className="flex items-center justify-between mb-2 md:mb-3">
        {layout.showBrandTitle ? (
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-xs md:text-sm font-orbitron font-semibold tracking-[0.2em] text-white/80 uppercase">
              XCANNES
            </span>
            <span className="text-[10px] font-light text-white/30">|</span>
            <span className="text-[10px] font-light text-white/40 truncate max-w-[160px] sm:max-w-none">
              Global USD Wallet
            </span>
          </div>
        ) : (
          <div />
        )}
        {/* Bouton Connect ou Déconnecter */}
        {effectiveIsConnected && effectiveWallet ? (
          <button
            type="button"
            onClick={() => onDisconnect?.()}
            className="px-3 py-1.5 text-[10px] md:text-xs bg-white/5 hover:bg-red-500/20 border border-white/10 hover:border-red-500/40 text-white/60 hover:text-red-400 rounded-md transition-colors"
          >
            Déconnecter
          </button>
        ) : (
          <XummConnectButton small variant="statement-blue" />
        )}
      </div>

      {/* Solde et info wallet */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-2xl md:text-3xl font-orbitron font-semibold text-white">
          {totalLabel}
        </p>

        {/* Bouton Global Statement - Toujours visible, même en démo */}
        <button
          type="button"
          onClick={onOpenGlobalStatement}
          className="mt-2 px-4 py-1.5 bg-xcannes-green/20 hover:bg-xcannes-green/30 text-xcannes-green rounded-lg text-xs font-medium transition-all duration-200 border border-xcannes-green/30 hover:scale-105"
        >
          Voir le relevé
        </button>

        <a
          href="https://ripple.com/solutions/stablecoin/transparency/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[10px] text-white/40 hover:text-xcannes-green/80 transition-colors"
        >
          Stablecoin USD régulé (détails)
        </a>

        {/* Affichage du wallet connecté à la place du menu déroulant */}
        {effectiveIsConnected && effectiveWallet && (
          <div className="w-full mt-2 px-2 flex justify-center">
            <div className="w-full max-w-[560px] rounded-xl border border-white/10 bg-black/20 px-3 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.35)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`h-2 w-2 rounded-full ring-4 ${xrplConnectionIndicator.dotClass} ${xrplConnectionIndicator.ringClass} ${
                        xrplConnectionIndicator.pulse ? "animate-pulse" : ""
                      }`}
                      title={xrplConnectionIndicator.label}
                      aria-label={xrplConnectionIndicator.label}
                    />
                    <span className="text-[12px] md:text-[13px] font-semibold text-white/85 truncate">
                      {walletLabel || "Wallet"}
                    </span>
                  </div>

                  <div className="mt-1 flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[11px] text-white/55 truncate">
                      {effectiveWallet.slice(0, 10)}…{effectiveWallet.slice(-8)}
                    </span>
                    {walletHeaderToast && (
                      <span className="text-[10px] text-xcannes-green/90">
                        {walletHeaderToast}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={onOpenWalletLabelEditor}
                    title="Renommer"
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all active:scale-95"
                    aria-label="Renommer le wallet"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16.862 3.487a2.1 2.1 0 012.97 2.97L8.9 17.39a4 4 0 01-1.69 1l-3.42 1.14 1.14-3.42a4 4 0 011-1.69L16.862 3.487z"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={onCopyAddress}
                    title="Copier l'adresse"
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all active:scale-95"
                    aria-label="Copier l'adresse XRPL"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={onSwitchWallet}
                    disabled={isConnecting}
                    title="Changer de wallet"
                    className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white rounded-lg transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    aria-label="Changer de wallet"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 1l4 4-4 4M21 5H9a4 4 0 00-4 4v1M7 23l-4-4 4-4M3 19h12a4 4 0 004-4v-1"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {isEditingWalletLabel && (
                <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg bg-white/5 border border-white/10 px-2 py-2">
                  <input
                    type="text"
                    value={walletLabelDraft}
                    onChange={(e) => onWalletLabelDraftChange?.(e.target.value)}
                    placeholder="Nom du wallet"
                    className="min-w-0 w-full bg-transparent text-[16px] md:text-[12px] text-white/85 outline-none placeholder:text-white/35"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        onSaveWalletLabel?.();
                      }
                      if (e.key === "Escape") {
                        onCancelWalletLabel?.();
                      }
                    }}
                    autoFocus
                  />

                  <button
                    type="button"
                    onClick={onSaveWalletLabel}
                    className="p-2 rounded-md bg-xcannes-green/15 hover:bg-xcannes-green/25 border border-xcannes-green/25 text-xcannes-green transition-colors active:scale-95"
                    aria-label="Enregistrer"
                    title="Enregistrer"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={onCancelWalletLabel}
                    className="p-2 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 transition-colors active:scale-95"
                    aria-label="Annuler"
                    title="Annuler"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
