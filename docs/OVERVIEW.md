# XCANNES Frontend - Overview

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-22

## Scope

Frontend Next.js pour :
- page DEX (chart, trades, market panels),
- wallet multi-devise (off-chain allocations RLUSD),
- pages "pay" / "wallet" / "dex" / "whitepaper" / "contact" / "disclaimer",
- pages demo wallets (UI fictive).

## Backend dependencies

- REST API : `NEXT_PUBLIC_XCANNES_API_URL`
- WebSocket : `NEXT_PUBLIC_XCANNES_WS_URL` (fallback dans `src/lib/runtimeConfig.js`)

Docs backend utiles :
- `docs/00_product/PRODUCT.md`
- `docs/20_backend/API.md`

## Structure (dossiers principaux)

- `src/pages/` : routes Next.js
- `src/components/layout/` : layout global (header/footer/SEO)
- `src/components/wallet/` : wallet (dashboard, modals, hooks, statements)
- `src/components/dex/` : DEX UI (layout, panels, chart)
- `src/components/marketGlobal/` : ticker + mini chart
- `src/components/demo-wallet/` : wallet demo (UI fictive)
- `src/components/xumm/` : connexion/QR Xumm
- `src/context/` : contexts React (Xumm, WS)
- `src/i18n/` : helpers i18n
- `src/lib/` : clients/services (API, websocket, runtime config)
- `src/utils/` : helpers purs

## Chart module (XrplCandleChart)

- Emplacement : `src/components/dex/XrplCandleChart/`
- Data : REST (`/api/v1/klines`) + WS (`ticker`, `pyth`)
- Usage conseille : import dynamique pour eviter SSR

Exemple minimal :
```jsx
import dynamic from "next/dynamic";
const XrplCandleChart = dynamic(
  () => import("@/components/dex/XrplCandleChart"),
  { ssr: false }
);
```
