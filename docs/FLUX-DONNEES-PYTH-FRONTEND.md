# 📊 FLUX DES DONNÉES PYTH DANS LE FRONTEND

> Documentation complète : Qui fait quoi avec les données Pyth Network

---

## 🎯 VUE D'ENSEMBLE

```
PYTH NETWORK → Backend API → xcannesApi.js → Hooks React → Composants → Affichage
```

---

## 📁 ARCHITECTURE DES FICHIERS

### 1️⃣ **CLIENT HTTP** : `/lib/xcannesApi.js`
**Rôle** : Communiquer avec l'API backend

**Méthodes principales :**
```javascript
// Prix live (depuis Redis)
xcannesApi.getForexPrice("EUR_USD")
→ GET http://localhost:3003/api/v1/ticker/EUR_USD

xcannesApi.getCommodityPrice("XAU_USD")
→ GET http://localhost:3003/api/v1/ticker/XAU_USD

// Bougies historiques (depuis MongoDB)
xcannesApi.getKlines("EUR_USD", "1h", 1000)
→ GET http://localhost:3003/api/v1/klines/EUR_USD?interval=1h&limit=1000
```

**Caractéristiques :**
- ✅ Retry automatique (3 tentatives)
- ✅ Timeout (10 secondes)
- ✅ Cache (5 secondes TTL)
- ✅ Gestion des erreurs

---

### 2️⃣ **HOOK 1** : `/hooks/useExternalPrice.js`
**Rôle** : Récupérer les prix live Pyth toutes les 5 secondes

**Utilisation :**
```javascript
const { price, loading, error, data } = useExternalPrice("EUR/USD", "forex");
```

**Fonctionnement :**
```javascript
// 1. Polling toutes les 5 secondes
useEffect(() => {
  const intervalId = setInterval(() => {
    fetchPrice(); // Appel xcannesApi
  }, 5000);
}, [pair]);

// 2. Appel API selon la catégorie
const fetchPrice = async () => {
  if (category === 'forex') {
    response = await xcannesApi.getForexPrice(symbol);
  } else if (category === 'commodity') {
    response = await xcannesApi.getCommodityPrice(symbol);
  }
  
  setPrice(response.data.lastPrice);
};
```

**Données retournées :**
```javascript
{
  price: 1.15639,        // Prix actuel
  loading: false,        // État chargement
  error: null,           // Erreur éventuelle
  data: {                // Données complètes
    symbol: "EUR_USD",
    lastPrice: 1.15639,
    timestamp: 1764162923000,
    high24h: 1.15909,
    low24h: 1.15583,
    change24h: 0.00208,
    changePercent24h: 0.18
  }
}
```

**Paires supportées :**
- ✅ Crypto : BTC/USD, ETH/USD, XRP/USD
- ✅ Forex : 19 paires (EUR/USD, GBP/USD, etc.)
- ✅ Commodités : XAU/USD, XAG/USD, XPT/USD, XPD/USD, OIL/USD
- ❌ Exotic : Non supporté par ce hook (pas de polling 5s)

---

### 3️⃣ **HOOK 2** : `/hooks/useCandles1m.js`
**Rôle** : Récupérer 1440 bougies 1m (24h) pour calculer l'évolution %

**Utilisation :**
```javascript
const { candles1m, loading, error } = useCandles1m("EUR/USD");
const { percent, value } = compute24hPercentChange(candles1m, livePrice);
```

**Fonctionnement :**
```javascript
// 1. Polling toutes les 60 secondes
useEffect(() => {
  const fetchCandles = async () => {
    const data = await xcannesApi.getKlines(
      backendPair, 
      '1m',     // Toujours 1 minute
      1440      // 24 heures = 1440 minutes
    );
    setCandles1m(data);
  };
  
  // Throttling : minimum 30s entre chaque fetch
  const intervalId = setInterval(fetchCandles, 60000);
}, [pair]);
```

**Données retournées :**
```javascript
{
  candles1m: [
    { time: 1764129600, open: 1.15907, high: 1.15914, low: 1.15826, close: 1.15838 },
    { time: 1764129660, open: 1.15838, high: 1.15845, low: 1.15830, close: 1.15842 },
    // ... 1440 bougies au total
  ],
  loading: false,
  error: null
}
```

**Fonction utilitaire :**
```javascript
compute24hPercentChange(candles1m, livePrice) {
  const openPrice24h = candles1m[0].open;        // Prix il y a 24h
  const percent = ((livePrice - openPrice24h) / openPrice24h) * 100;
  
  return {
    percent: 0.18,         // +0.18%
    value: 0.00208,        // +0.00208 USD
    openPrice24h: 1.15431,
    periodHours: 24.0
  };
}
```

**Usage** : Afficher "+0.18%" ou "-1.5%" en haut du graphique, **indépendamment du timeframe** affiché (1m, 5m, 1h, etc.)

---

### 4️⃣ **COMPOSANT PRINCIPAL** : `/components/XrplCandleChartRaw.jsx`
**Rôle** : Afficher le graphique avec les données Pyth

**Props reçues :**
```jsx
<XrplCandleChartRaw
  pair="EUR/USD"           // Paire à afficher
  interval="1h"            // Timeframe (1m, 5m, 15m, 1h, 4h, 1d)
  onPairChange={...}       // Callback changement paire
  onIntervalChange={...}   // Callback changement timeframe
/>
```

**Détection du type de paire :**
```javascript
const pairCategory = getPairCategory(pair); // "forex", "crypto", "commodity", "exotic", "xrpl"
const isExternal = ['crypto', 'forex', 'commodity'].includes(pairCategory);
const isExotic = pairCategory === 'exotic';
```

**Récupération des données :**

#### 📍 **Source 1 : Prix live (Hook useExternalPrice)**
```javascript
const { price: externalPrice, loading: loadingExternalPrice } = useExternalPrice(
  isExternal && !isExotic ? pair : null,  // Seulement crypto, forex, commodity
  pairCategory
);

// Mise à jour toutes les 5 secondes
useEffect(() => {
  if (!externalPrice) return;
  console.log('[Chart] 📈 Prix live Pyth reçu:', externalPrice);
  updateCurrentCandle(externalPrice);  // Met à jour la bougie en cours
}, [externalPrice]);
```

#### 📍 **Source 2 : Évolution 24h (Hook useCandles1m)**
```javascript
const { candles1m, loading: loadingCandles1m } = useCandles1m(pair);

// Calcul du pourcentage 24h
useEffect(() => {
  if (!candles1m.length || !externalPrice) return;
  
  const { percent, value } = compute24hPercentChange(candles1m, externalPrice);
  setPercent24h({ percent, value });
}, [candles1m, externalPrice]);
```

#### 📍 **Source 3 : Bougies pour le graphique (fetchMarketData)**
```javascript
const fetchMarketData = useCallback(async () => {
  const book = getBookIdFromPair(pair);
  
  // Limites adaptées selon le timeframe
  const limits = {
    "1m": 500,   // ~8 heures
    "5m": 500,   // ~1.7 jours
    "15m": 500,  // ~5 jours
    "1h": 1000,  // ~42 jours
    "4h": 500,   // ~2.7 mois
    "1d": 365    // ~1 an
  };
  
  const klines = await xcannesApi.getKlines(
    book.backendPair,
    interval,
    limits[interval] || 100
  );
  
  return klines.map(candle => ({
    time: candle.time,
    open: parseFloat(candle.open),
    high: parseFloat(candle.high),
    low: parseFloat(candle.low),
    close: parseFloat(candle.close),
    volume: parseFloat(candle.volume || 0)
  }));
}, [pair, interval]);
```

**Affichage sur le graphique :**
```javascript
// 1. Créer le chart (bibliothèque lightweight-charts)
const chart = createChart(chartRef.current, { ... });

// 2. Créer la série de bougies
candleSeriesRef.current = chart.addCandlestickSeries({
  upColor: "#16b303",
  downColor: "#dc2626"
});

// 3. Charger les données historiques
const data = await fetchMarketData();
candleSeriesRef.current.setData(data);

// 4. Mise à jour temps réel avec prix live
useEffect(() => {
  if (!externalPrice) return;
  
  // Mettre à jour la dernière bougie avec le nouveau prix
  const currentCandle = {
    time: Math.floor(Date.now() / 1000),
    open: previousClose,
    high: Math.max(previousHigh, externalPrice),
    low: Math.min(previousLow, externalPrice),
    close: externalPrice
  };
  
  candleSeriesRef.current.update(currentCandle);
}, [externalPrice]);
```

**Affichage de l'évolution 24h :**
```jsx
<div className="price-info">
  <span className="current-price">${externalPrice.toFixed(2)}</span>
  <span className={percent24h.percent >= 0 ? "positive" : "negative"}>
    {percent24h.percent >= 0 ? "+" : ""}{percent24h.percent.toFixed(2)}%
  </span>
</div>
```

---

### 5️⃣ **PAGE D'ENTRÉE** : `/pages/dex.jsx`
**Rôle** : Point d'entrée utilisateur

**Structure :**
```jsx
export default function DexPage() {
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [interval, setInterval] = useState("1h");
  
  return (
    <>
      <Header />
      <PriceTicker pairs={pairs} />
      
      <main>
        {/* Graphique avec données Pyth */}
        <XrplCandleChartRaw
          key={`${selectedPair}-${interval}`}
          pair={selectedPair}
          interval={interval}
          onPairChange={setSelectedPair}
          onIntervalChange={setInterval}
          availablePairs={pairs}
        />
        
        <TradingPanel pair={selectedPair} />
        <SetupPanel />
      </main>
      
      <FooterPro />
    </>
  );
}
```

**Route** : `https://xcannes.com/dex`

---

## 🔄 FLUX COMPLET EN ACTION

### Scénario : Utilisateur visite `/dex` et sélectionne EUR/USD en 1h

```
┌─────────────────────────────────────────────────────────────────┐
│ 1. CHARGEMENT PAGE                                              │
└─────────────────────────────────────────────────────────────────┘
   ↓
dex.jsx monte → XrplCandleChartRaw(pair="EUR/USD", interval="1h")

┌─────────────────────────────────────────────────────────────────┐
│ 2. DÉTECTION TYPE DE PAIRE                                      │
└─────────────────────────────────────────────────────────────────┘
   ↓
getPairCategory("EUR/USD") → "forex"
isExternal = true
isExotic = false

┌─────────────────────────────────────────────────────────────────┐
│ 3. ACTIVATION DES HOOKS (Parallèle)                             │
└─────────────────────────────────────────────────────────────────┘
   ↓
┌──────────────────┬──────────────────┬──────────────────────────┐
│ useExternalPrice │ useCandles1m     │ fetchMarketData          │
└──────────────────┴──────────────────┴──────────────────────────┘
   ↓                  ↓                  ↓
   │                  │                  │
   │ Polling 5s       │ Polling 60s      │ Initial load
   │                  │                  │
   ├─→ xcannesApi    ├─→ xcannesApi    ├─→ xcannesApi
   │   .getForexPrice│   .getKlines     │   .getKlines
   │   ("EUR_USD")   │   ("EUR_USD",    │   ("EUR_USD",
   │                  │    "1m", 1440)  │    "1h", 1000)
   │                  │                  │
   ↓                  ↓                  ↓
GET /api/v1/ticker  GET /api/v1/klines GET /api/v1/klines
/EUR_USD            ?interval=1m       ?interval=1h
                    &limit=1440        &limit=1000
   ↓                  ↓                  ↓
REDIS (prix live)   MongoDB (1m)      MongoDB (1h)
   ↓                  ↓                  ↓
prix: 1.15639       1440 bougies      1000 bougies
âge: 0s             (24h historique)   (42 jours)

┌─────────────────────────────────────────────────────────────────┐
│ 4. TRAITEMENT DES DONNÉES                                       │
└─────────────────────────────────────────────────────────────────┘
   ↓
Prix live → updateCurrentCandle(1.15639)
            → Mise à jour bougie en cours sur le graphique

Candles 1m → compute24hPercentChange(candles1m, 1.15639)
             → percent24h = +0.18%
             → Affichage "+0.18%" en haut du graphique

Candles 1h → candleSeriesRef.current.setData(klines)
             → Affichage 1000 bougies 1h sur le graphique

┌─────────────────────────────────────────────────────────────────┐
│ 5. MISES À JOUR CONTINUES                                       │
└─────────────────────────────────────────────────────────────────┘
   ↓
Toutes les 5s  → Nouveau prix live → Bougie mise à jour
Toutes les 60s → Nouvelles bougies 1m → % 24h recalculé
```

---

## 📊 RÉSUMÉ : QUI FAIT QUOI

| Composant | Rôle | Fréquence | Source |
|-----------|------|-----------|--------|
| **xcannesApi.js** | Client HTTP | À la demande | Backend API REST |
| **useExternalPrice** | Prix live Pyth | 5 secondes | Redis via API |
| **useCandles1m** | Évolution 24h | 60 secondes | MongoDB via API |
| **fetchMarketData** | Bougies graphique | Initial + changement | MongoDB via API |
| **XrplCandleChartRaw** | Affichage graphique | Temps réel | Tous les hooks |
| **dex.jsx** | Page d'entrée | - | Utilisateur |

---

## ✅ PAIRES SUPPORTÉES (41 TOTAL)

### 🔹 CRYPTO (3)
- BTC/USD, ETH/USD, XRP/USD

### 💱 FOREX (19)
- EUR/USD, EUR/GBP, EUR/JPY, EUR/CHF, EUR/AUD
- GBP/USD, GBP/JPY, GBP/CHF, GBP/AUD
- AUD/USD, AUD/JPY, NZD/USD
- USD/CAD, USD/CHF, USD/JPY, USD/HKD, USD/SGD, USD/MXN
- CHF/JPY

### 🌍 EXOTIC (14)
- USD/BRL, USD/INR, USD/ZAR, USD/TRY
- USD/CLP, USD/COP, USD/IDR, USD/PHP
- USD/KRW, USD/TWD, USD/NOK, USD/SEK
- USD/CNH, USD/PEN

### 🛢️ COMMODITIES (5)
- XAU/USD (Or), XAG/USD (Argent)
- XPT/USD (Platine), XPD/USD (Palladium)
- OIL/USD (Pétrole)

---

## 🎯 POINTS CLÉS À RETENIR

1. **3 sources de données distinctes** :
   - Prix live (5s) → Bougie en cours
   - Bougies 1m (60s) → Évolution 24h
   - Bougies timeframe (initial) → Graphique historique

2. **Séparation des responsabilités** :
   - `xcannesApi.js` = Communication HTTP
   - Hooks = Logique métier + polling
   - Composant = Affichage + interactions

3. **Performance optimisée** :
   - Cache 5s dans xcannesApi
   - Throttling 30s dans useCandles1m
   - Retry automatique (3 tentatives)

4. **Données temps réel** :
   - Âge moyen : 0-2 secondes
   - Temps de réponse : 1-27ms
   - 100% de disponibilité vérifiée

---

## 🔍 SCRIPTS DE VÉRIFICATION

```bash
# Script 5 : Vérifier que le frontend peut appeler l'API
cd /root/xcannes-dex/Xcannes-
node scripts/5-verifier-frontend.js
# → 49/49 tests OK (41 paires + hooks + klines + polling)

# Script 6 : Vérifier que le composant reçoit les données
cd /root/xcannes-dex/Xcannes-
node scripts/6-verifier-composant-chart.js
# → 85/85 tests OK (41 paires × 2 sources + formats)
```

---

**Auteur** : Système de monitoring Xcannes DEX  
**Date** : 26 novembre 2025  
**Version** : 1.0.0
