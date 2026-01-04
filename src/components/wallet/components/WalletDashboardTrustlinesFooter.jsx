"use client";

export default function WalletDashboardTrustlinesFooter({ totalLockedXcs, onClose }) {
  return (
    <div className="mt-2 pt-2 border-t border-white/10 space-y-2">
      <p className="text-[11px] text-white/60">
        Total locked XCS:{" "}
        <span className="font-semibold text-white">
          {Number(totalLockedXcs || 0).toLocaleString("en-US", {
            maximumFractionDigits: 4,
          })}{" "}
          XCS
        </span>
      </p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onClose?.();
        }}
        className="w-full px-3 py-2 rounded-lg bg-white/5 text-xs text-white/80 hover:bg-white/10 transition-colors active:scale-95"
      >
        Fermer
      </button>
    </div>
  );
}

