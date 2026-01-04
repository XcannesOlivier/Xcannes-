"use client";

import { createPortal } from "react-dom";

export default function WalletDashboardSaveAddressPrompt({
  open,
  addressToSave,
  addressLabel,
  setAddressLabel,
  onClose,
  onSave,
}) {
  if (!open) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-md bg-gray-900 border-0 md:border md:border-white/10 rounded-2xl overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            <h3 className="text-xl font-bold text-white mb-2">
              Save this address?
            </h3>
            <p className="text-sm text-white/60 mb-4">
              Would you like to save this address for future use?
            </p>
            <div className="mb-4">
              <label className="block text-xs text-white/60 mb-2">Address</label>
              <div className="bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 font-mono break-all">
                {addressToSave}
              </div>
            </div>
            <div className="mb-6">
              <label className="block text-xs text-white/60 mb-2">
                Label (optional)
              </label>
              <input
                type="text"
                value={addressLabel}
                onChange={(e) => setAddressLabel(e.target.value)}
                placeholder="e.g., Exchange, Friend, ..."
                className="w-full bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green/80"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
              >
                Skip
              </button>
              <button
                onClick={onSave}
                className="flex-1 px-4 py-2.5 bg-xcannes-green hover:bg-xcannes-green/90 text-black font-semibold rounded-lg transition-colors"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      </div>
    </>,
    document.body
  );
}

