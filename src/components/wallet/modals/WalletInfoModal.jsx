"use client";

import { createPortal } from "react-dom";
import WalletNotConnectedNotice from "../components/WalletNotConnectedNotice";

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
          <p className="mt-3 text-[12px] text-white/45">
            In the wallet list, you will see 2 types of “lines”:{" "}
            <span className="font-mono">XRPL assets</span> (on-chain) and{" "}
            <span className="font-mono">local currency lines</span> (off-chain
            allocations). For local currency lines, the small{" "}
            <span className="font-mono">≈ … RLUSD</span> value represents the
            underlying allocation.
          </p>
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
            Note: le verrouillage sera géré via un mécanisme escrow. À la
            fermeture d’une ligne, <span className="font-mono">50%</span> du
            verrouillage revient au wallet (<span className="font-mono">0.10 XCS</span>)
            et <span className="font-mono">50%</span> est versé au wallet de gestion XCANNES.
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
              XCANNES ne prélève pas de “fee” séparé. Le modèle est un{" "}
              <span className="font-semibold">spread</span> appliqué uniquement
              quand il y a une conversion FX (ex:{" "}
              <span className="font-mono">EUR↔GBP</span>,{" "}
              <span className="font-mono">RLUSD↔EUR</span>).
            </li>
            <li>
              Spread FX: tiers <span className="font-mono">A/B/C</span> (ex:
              <span className="font-mono">A=0.60%</span>,{" "}
              <span className="font-mono">B=1.00%</span>,{" "}
              <span className="font-mono">C=1.80%</span> “total”, bid/ask autour
              du mid), prélevé en <span className="font-mono">RLUSD</span> et
              envoyé on-chain vers un wallet entreprise XCANNES.
            </li>
            <li>
              Convert interne: 1 signature Xumm (paiement du spread) ; paiement
              entre 2 wallets: 2 signatures (spread puis paiement).
            </li>
          </ul>
          <p className="mt-2 text-[12px] text-white/45">
            Source de taux: paires “live” via Pyth quand disponible, sinon FX
            EOD (coté 1×/jour).
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
            <li>
              Les montants en devise (EUR, USD, …) sont des valeurs indicatives
              basées sur des taux marché; la valeur de référence reste{" "}
              <span className="font-mono">RLUSD</span>.
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}

export default function WalletInfoModal({
  isOpen,
  onClose,
  isPreviewMode = false,
  noticeVariant = "preview",
  noticeContextLabel = "",
}) {
  if (!isOpen) return null;
  if (typeof document === "undefined") return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[11000] bg-black/80 md:backdrop-blur-sm"
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

          <WalletNotConnectedNotice
            show={isPreviewMode}
            className="mb-4"
            variant={noticeVariant}
            contextLabel={noticeContextLabel}
          />
          <WalletInfoContent withCloseGutter />
        </div>
      </div>
    </>,
    document.body
  );
}
