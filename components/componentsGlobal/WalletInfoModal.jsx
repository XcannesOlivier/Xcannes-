"use client";

import { createPortal } from "react-dom";

export function WalletInfoContent({ withCloseGutter = false }) {
  return (
    <>
      <div className={withCloseGutter ? "pr-8" : ""}>
        <h3 className="text-lg md:text-xl font-orbitron font-bold text-white">
          XCANNES Wallet — How it works
        </h3>
        <p className="mt-1 text-sm text-white/60">
          Wallet non-custodial sur XRPL + un “ledger UX” pour répartir RLUSD en
          lignes de devises.
        </p>
      </div>

      <div className="mt-5 grid gap-4">
        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">Core features</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>Hold assets on-chain (XRP / RLUSD / XCS).</li>
            <li>
              Create currency lines (EUR/GBP/…) to allocate RLUSD internally.
            </li>
            <li>Convert between lines (allocation-only MVP, no on-chain FX).</li>
            <li>Statements show a unified view of your wallet activity.</li>
          </ul>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">
            XCS lock (activation + currency lines)
          </h4>
          <p className="mt-2 text-[13px] text-white/70">
            XCANNES utilise un verrouillage de XCS comme “engagement” pour
            activer les fonctionnalités avancées et/ou pour créer des lignes de
            devises.
          </p>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>
              Activation wallet: <span className="font-mono">1 XCS</span>{" "}
              (réserve bloquée).
            </li>
            <li>
              Création d’une ligne de devise:{" "}
              <span className="font-mono">0.20 XCS</span> bloqué.
            </li>
            <li>
              Suppression d’une ligne: le XCS correspondant peut être “libéré” à{" "}
              <span className="font-mono">50%</span> (refund{" "}
              <span className="font-mono">0.10 XCS</span>).
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">
            Note: à ce stade, le verrouillage est un concept applicatif (UX) et
            peut évoluer vers un mécanisme on-chain (escrow) plus tard.
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">Fees</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>
              XRPL network fee (on-chain): payable sur chaque transaction XRPL
              (ex: Payment, TrustSet).
            </li>
            <li>
              Frais XCANNES: <span className="font-mono">1%</span> du montant de
              la transaction (en <span className="font-mono">RLUSD</span>),
              payable en <span className="font-mono">XCS</span> au prix du
              moment.
            </li>
            <li>
              Spread de conversion: marge variable appliquée sur certains
              conversions, selon les conditions de marché (liquidité/volatilité),
              toujours affichée avant confirmation.
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">
            Formules:{" "}
            <span className="font-mono">fee_rlusd = amount_rlusd × 0.01</span>{" "}
            puis{" "}
            <span className="font-mono">
              fee_xcs = fee_rlusd / price(RLUSD_per_XCS)
            </span>
            .
          </p>
        </section>

        <section className="rounded-xl border border-white/10 bg-black/30 p-4">
          <h4 className="text-sm font-semibold text-white/80">Important</h4>
          <ul className="mt-2 space-y-1 text-[13px] text-white/70 list-disc pl-5">
            <li>XRPL est la source de vérité pour les soldes on-chain.</li>
            <li>
              Les lignes de devises représentent une répartition interne de
              RLUSD.
            </li>
            <li>L’allocation totale ne doit jamais dépasser RLUSD on-chain.</li>
          </ul>
        </section>
      </div>
    </>
  );
}

export default function WalletInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[11000] bg-black/80 backdrop-blur-sm"
        onClick={() => onClose && onClose()}
      />
      <div className="fixed inset-0 z-[11001] flex items-center justify-center px-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-elevated border border-subtle rounded-2xl p-4 md:p-6 max-h-[92vh] overflow-y-auto flex flex-col overscroll-contain pointer-events-auto shadow-2xl"
          style={{ WebkitOverflowScrolling: "touch" }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            onClick={() => onClose && onClose()}
            className="absolute top-3 right-3 md:top-4 md:right-4 text-white/60 hover:text-white transition-colors text-xl"
            aria-label="Close"
          >
            ✕
          </button>

          <WalletInfoContent withCloseGutter />
        </div>
      </div>
    </>,
    document.body
  );
}
