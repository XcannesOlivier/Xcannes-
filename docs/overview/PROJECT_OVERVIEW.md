# XCANNES — Présentation (frontend)

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-13

## Ce que fait l’app (résumé)

Le frontend `Xcannes-` est une app Next.js qui propose :
- une page “DEX” avec chart, orderbook, trades et section marché (“EOD Exchange”),
- un wallet multi-écran (page dédiée + intégration dans le layout DEX),
- une connexion wallet via XUMM/Xaman (QR code + deep link),
- une page “Pay” (demande de paiement / `xcannes-payreq-v1`),
- une page “Démo wallets” pour comparer Wallet A/B (UI fictive),
- des écrans informatifs (whitepaper, contact, disclaimer, success).

## Dépendances côté backend

Le frontend consomme :
- **REST API** (proxy + wallet + XUMM + news) : configurée par `NEXT_PUBLIC_XCANNES_API_URL`
- **WebSocket** (live tickers/orderbooks/trades/pyth/eod-summary) : via `NEXT_PUBLIC_XCANNES_WS_URL` si présent, sinon logique fallback (voir `src/lib/runtimeConfig.js`).

Docs côté backend (repo `xcannes-dex`) :
- `docs/00_product/PRODUCT_OVERVIEW.md`
- `docs/20_backend/API_PUBLIC.md`
- `docs/20_backend/WEBSOCKET.md`
