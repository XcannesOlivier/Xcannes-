# XCANNES Wallet - Notes dev

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-22

## Concepts cles

- Wallet non-custodial sur XRPL.
- Connexion + signature via Xumm/Xaman (QR + deeplink).
- UX "ledger" : allocations RLUSD par devise (off-chain) en plus des actifs XRPL.

## Actifs XRPL (on-chain)

Affiches via `/xumm/balance` :
- `XRP` (natif)
- IOUs XRPL (ex: `RLUSD`, `XCS`) avec `{ currency, issuer, value }`

L'UI propose d'installer les trustlines RLUSD/XCS via `TrustSet` quand besoin.

## Wallet lines (legacy)

- `wallet_lines` = tracking applicatif (ex: locked XCS).
- Endpoints : `/wallet/lines`.
- Pas de TrustSet XRPL a ce stade.

## Currency lines (allocations RLUSD)

- `wallet_currency_lines` = allocations RLUSD par devise (off-chain).
- Endpoints : `/wallet/currency-lines`, `/wallet/convert`.
- Invariant : `totalAllocatedRlusd <= rlusdOnChain`.
- Activation de ligne possible via `wallet_pending_allocations`.

## Flux principaux

- Connect : `/xumm/connect` + polling `/xumm/check`.
- Disconnect : `/wallet/session/disconnect` avec `sessionToken` (TTL backup).
- Refresh balance : `/xumm/balance`.
- Send : `Payment` XRPL signe via Xumm.
- Receive : QR + `xcannes-payreq-v1` (page `/pay`).
- Convert : allocations RLUSD (off-chain) + taux FX (Pyth/EOD).

## Mode preview

Quand `preview=true` sans wallet connecte :
- wallet fictif,
- soldes simules,
- conversions et send en mode demo (pas d'appel backend sensible).

## Stockage local

- `sessionStorage["xumm_wallet"]` : wallet connecte.
- `localStorage["xcannes_wallet_labels"]` : labels.
- `localStorage["xcannes_saved_addresses"]` : adresses sauvegardees.

## Notes UX

- Les actions principales sont "Send" / "Receive" / "Convert" / "Buy-Sell".
- Les styles actuels privilegient "Send" comme action primaire.
