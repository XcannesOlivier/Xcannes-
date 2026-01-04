"use client";

import WalletCurrencySelector from "./WalletCurrencySelector";

export default function WalletDashboardTrustlinesAddForm({
  trustlineCode,
  setTrustlineCode,
  trustlineLocked,
  setTrustlineLocked,
  onSubmit,
}) {
  return (
    <div className="mb-3 space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-2">
        <WalletCurrencySelector
          value={trustlineCode}
          onChange={setTrustlineCode}
          placeholder="Select currency..."
          extraOptions={[
            { code: "XCS", name: "XCS Token" },
            { code: "RLUSD", name: "RLUSD Stablecoin" },
          ]}
        />
        <input
          type="number"
          min="0"
          step="0.0001"
          value={trustlineLocked}
          onChange={(e) => setTrustlineLocked(e.target.value)}
          placeholder="Locked XCS"
          className="bg-black/40 border border-white/15 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-xcannes-green"
        />
      </div>
      <div className="flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSubmit?.();
          }}
          className="w-full md:w-auto md:ml-auto px-3 py-2 rounded-lg bg-xcannes-green text-black text-sm font-semibold hover:bg-xcannes-green/90 transition-colors active:scale-95"
        >
          Valider &amp; créer la ligne
        </button>
      </div>
    </div>
  );
}

