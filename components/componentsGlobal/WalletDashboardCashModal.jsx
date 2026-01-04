"use client";

import MoonPayBuyModal from "./MoonPayBuyModal";
import MoonPaySellModal from "./MoonPaySellModal";

export default function WalletDashboardCashModal({
  open,
  onClose,
  cashModalTab,
  setCashModalTab,
  renderWalletMeta,
  walletAddress,
}) {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[10000] bg-black/80 md:backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-[10001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-gray-900 border border-white/10 rounded-2xl overflow-hidden pointer-events-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header avec onglets Buy/Sell */}
          <div className="border-b border-white/10">
            <div className="flex items-center justify-between p-4 pb-0">
              <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
                Fiat Gateway
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-white/60 hover:text-white transition-colors text-xl"
              >
                ✕
              </button>
            </div>
            <div className="px-4 pb-3">{renderWalletMeta?.()}</div>

            {/* Onglets Buy/Sell */}
            <div className="flex gap-2 px-4 pt-3">
              <button
                type="button"
                onClick={() => setCashModalTab("buy")}
                className={`flex-1 px-4 py-3 rounded-t-lg font-semibold text-sm transition-all ${
                  cashModalTab === "buy"
                    ? "bg-gradient-to-br from-green-500 to-xcannes-green text-white shadow-lg"
                    : "bg-black/20 text-white/50 hover:bg-black/40 hover:text-white/80"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 5V19M5 12H19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>Buy Crypto</span>
                </div>
                <div className="text-[10px] mt-1 opacity-70">Fiat → Crypto</div>
              </button>

              <button
                type="button"
                onClick={() => setCashModalTab("sell")}
                className={`flex-1 px-4 py-3 rounded-t-lg font-semibold text-sm transition-all ${
                  cashModalTab === "sell"
                    ? "bg-gradient-to-br from-orange-500 to-amber-600 text-white shadow-lg"
                    : "bg-black/20 text-white/50 hover:bg-black/40 hover:text-white/80"
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M5 12H19M12 5L19 12L12 19"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>Sell Crypto</span>
                </div>
                <div className="text-[10px] mt-1 opacity-70">Crypto → Fiat</div>
              </button>
            </div>
          </div>

          {/* Contenu selon l'onglet actif */}
          <div className="p-4 md:p-5">
            {cashModalTab === "buy" ? (
              <MoonPayBuyModal
                isOpen={true}
                onClose={onClose}
                walletAddress={walletAddress || ""}
                embedded={true}
              />
            ) : (
              <MoonPaySellModal
                isOpen={true}
                onClose={onClose}
                walletAddress={walletAddress || ""}
                embedded={true}
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

