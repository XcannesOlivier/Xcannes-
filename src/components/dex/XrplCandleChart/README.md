# XrplCandleChart module

Composant client React basé sur Lightweight Charts pour afficher des bougies XRPL/Pyth + mode FX EOD (Fawaz).

## Branchement rapide
1) Envelopper l’arbre avec le provider WS (écoute XRPL/Pyth/tickers) :
```jsx
// ex: src/pages/_app.jsx (ou pages/_app.jsx si pas de structure src/)
import { XcannesWSProvider } from "@/context/XcannesWSContext";

export default function RootLayout({ children }) {
  return <XcannesWSProvider>{children}</XcannesWSProvider>;
}
```

2) Importer le chart (généralement en dynamique pour éviter le rendu SSR) :
```jsx
import dynamic from "next/dynamic";
const XrplCandleChart = dynamic(() => import("@/components/dex/XrplCandleChart"), { ssr: false });

export default function ChartPage() {
  return (
    <div className="h-[70vh]">
      <XrplCandleChart
        pair="XCS/XRP"
        interval="1m"
        availablePairs={["XCS/XRP", "RLUSD/XRP", "BTC/USD_PYTH"]}
        onPairChange={(p) => console.log("pair ->", p)}
        onIntervalChange={(i) => console.log("interval ->", i)}
      />
    </div>
  );
}
```

Le composant gère seul l’historique (REST), le live (WS), les indicateurs et les stats 24h. Aucun state parent n’est requis en dehors des callbacks/props optionnelles.

## Props principales
- `pair` (string) : paire initiale, ex `XCS/XRP` ou `BTC/USD_PYTH`.
- `interval` (string) : `"1m" | "5m" | "15m" | "1h" | "4h" | "1d"`.
- `availablePairs?` (string[]) : liste proposée dans le sélecteur (sinon dérivée de `MARKET_STRUCTURE`).
- `availableIntervals?` (string[]) : intervales disponibles dans l’UI (défaut `["1m","5m","15m","1h","4h","1d"]`).
- `onPairChange?` (fn) : callback sélection paire.
- `onIntervalChange?` (fn) : callback sélection intervalle.

## Fonctionnement interne
- `hooks/useMarketData.js` : fetch historique (Mongo klines), abonnement WebSocket (`XcannesWSContext`) pour prix XRPL via ticker + Pyth, polling ticker 24h (30s), calcul bougie courante, mode FX EOD via REST (`getFxEod`).
- `components/ChartHeader.jsx` : prix actuel, sélection paire/intervalle, switch Live/EOD, menu settings (focus trap + Escape).
- `components/IndicatorsToolbar.jsx` : toggles volume/RSI/MACD/Bollinger/VWAP/SMA/EMA + tooltips.
- `components/ChartCanvas.jsx` : conteneur chart, crosshair custom, overlay loading/no-data, barre OHLC.
- `components/ChartFooter.jsx` : stats 24h (WS ou REST) + icônes drapeaux/actifs.
- `components/FxPairSelector.jsx` : UI dédiée pour les paires FX EOD.
- `indicators.js` : helpers purs (Bollinger, SMA/EMA, RSI, MACD, VWAP).

## Options utiles
- Env : `NEXT_PUBLIC_DEBUG_LOGS=true` pour afficher les logs verbeux du chart/hook.
- Vérif structure/export : `npm run check:chart` exécute `checkChart.cjs`.

Importez depuis le barrel `components/XrplCandleChart` pour éviter les chemins profonds :  
`import XrplCandleChart, { ChartHeader, useMarketData, IndicatorsToolbar } from "@/components/dex/XrplCandleChart";`
