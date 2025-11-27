# 📊 Analyse : Qui utilise xcannesApi.js ?

> Analyse complète de tous les fichiers frontend qui importent et utilisent `xcannesApi.js`

---

## 🎯 Vue d'ensemble

`xcannesApi.js` est le **client HTTP centralisé** qui fait le pont entre le frontend React et le backend API. Il est utilisé par **4 types de composants** :

1. **Hooks** (logique métier réutilisable)
2. **Components** (interface utilisateur)
3. **Pages** (points d'entrée)
4. **Utils** (fonctions utilitaires)

---

## 📦 1. HOOKS - Logique métier réutilisable

### 🔸 `hooks/useExternalPrice.js`
**Rôle** : Récupérer les prix live des marchés Pyth (crypto, forex, commodities)

**Méthodes xcannesApi utilisées** :
```javascript
import xcannesApi from '../lib/xcannesApi';

// Dans le hook:
response = await xcannesApi.getForexPrice(symbol);      // Pour forex + crypto
response = await xcannesApi.getCommodityPrice(symbol);  // Pour commodities
```

**Fonctionnement** :
- ⏱️ **Polling** : Toutes les **5 secondes**
- 🎯 **Objectif** : Maintenir le prix live des paires Pyth
- 🔄 **Workflow** :
  1. Convertit `EUR/USD` → `EUR_USD`
  2. Appelle l'endpoint approprié selon la catégorie
  3. Retourne `{ price, loading, error, data }`

**Catégories supportées** :
- ✅ `crypto` : BTC, ETH, XRP
- ✅ `forex` : EUR/USD, GBP/USD, etc.
- ✅ `commodity` : XAU (or), XAG (argent), etc.
- ❌ `exotic` : **PAS supporté** (pas de prix live)

---

### 🔸 `hooks/useCandles1m.js`
**Rôle** : Maintenir les bougies 1m des dernières 24h pour calculer le % d'évolution

**Méthodes xcannesApi utilisées** :
```javascript
import xcannesApi from '../lib/xcannesApi';

// Dans le hook:
const data = await xcannesApi.getKlines(book.backendPair, '1m', 1440);
```

**Fonctionnement** :
- ⏱️ **Polling** : Toutes les **60 secondes** (1 minute)
- 🛡️ **Throttling** : Minimum **30 secondes** entre chaque requête
- 🎯 **Objectif** : Calculer le changement de prix sur 24h
- 📊 **Données** : 1440 bougies = 24h × 60 minutes
- 🔄 **Workflow** :
  1. Fetch 1440 bougies 1m via `getKlines()`
  2. Filtre les bougies vides (OHLC = 0)
  3. Trie par temps croissant
  4. Retourne `{ candles1m, loading, error }`

**Fonction utilitaire exportée** :
```javascript
export function compute24hPercentChange(candles1m, livePrice) {
  // Calcule: ((livePrice - openPrice24h) / openPrice24h) * 100
  return { percent, value, openPrice24h, periodHours };
}
```

---

## 🖼️ 2. COMPONENTS - Interface utilisateur

### 🔸 `components/XrplCandleChartRaw.jsx`
**Rôle** : Afficher le graphique de trading avec bougies, indicateurs techniques, volume

**Méthodes xcannesApi utilisées** :
```javascript
import xcannesApi from "../lib/xcannesApi";

// Dans fetchMarketData():
const klines = await xcannesApi.getKlines(
  book.backendPair,      // Ex: "EUR_USD"
  intervalMap[interval], // Ex: "1h"
  limits[intervalMap[interval]] // Ex: 1000
);
```

**Fonctionnement** :
- 🎯 **Objectif** : Charger l'historique des bougies pour le graphique
- 🕐 **Timeframes** : 1m, 5m, 15m, 1h, 4h, 1d
- 📊 **Limites intelligentes** :
  ```javascript
  const limits = {
    "1m": 500,   // ~8 heures
    "5m": 500,   // ~1.7 jours
    "15m": 500,  // ~5 jours
    "1h": 1000,  // ~42 jours (historique complet!)
    "4h": 500,   // ~2.7 mois
    "1d": 365    // ~1 an
  };
  ```
- 🔄 **Workflow** :
  1. Récupère l'ID du book via `getBookIdFromPair(pair)`
  2. Appelle `xcannesApi.getKlines()` avec le timeframe
  3. Formate les données pour `lightweight-charts`
  4. Trie par temps croissant
  5. Met à jour le chart avec `chart.setData()`

**Données retournées** :
```javascript
{
  time: 1700000000,    // Timestamp Unix (secondes)
  open: 1.15544,
  high: 1.15600,
  low: 1.15500,
  close: 1.15550,
  volume: 1234567      // Volume (optionnel)
}
```

---

## 📄 3. PAGES - Points d'entrée

### 🔸 `pages/dex.jsx`
**Rôle** : Page principale du DEX, charge toutes les paires disponibles

**Méthodes xcannesApi utilisées** :
```javascript
import xcannesApi from "../lib/xcannesApi";

// Au montage du composant:
const markets = await xcannesApi.getAllMarkets();
```

**Fonctionnement** :
- 🎯 **Objectif** : Construire la liste des paires disponibles dans le sélecteur
- 🔄 **Workflow** :
  1. Appelle `getAllMarkets()` au montage
  2. Reçoit : `{ trading: [...], display: [...], pyth: [...] }`
  3. Priorité : `display` > `pyth` (éviter les doublons)
  4. Filtre les paires actives : `market.active !== false`
  5. Convertit format : `XCS_XRP` → `XCS/XRP`
  6. Déduplique avec `Set`
  7. Stocke dans `availablePairs`

**Résultat** :
```javascript
// Exemple de paires chargées:
["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD", "BTC/USD", "ETH/USD", "EUR/USD", ...]
```

**Fallback** :
Si l'API échoue, garde uniquement :
```javascript
["XRP/RLUSD", "XCS/XRP", "XCS/RLUSD"]
```

---

## 🛠️ 4. UTILS - Fonctions utilitaires

### 🔸 `utils/xrpl.js`
**Rôle** : Convertir les paires frontend en métadonnées XRPL (issuers, currency codes)

**Méthodes xcannesApi utilisées** :
```javascript
import xcannesApi from "../lib/xcannesApi";

// Dans hydrateMarkets():
const data = await xcannesApi.getAllMarkets();
```

**Fonctionnement** :
- 🎯 **Objectif** : Construire une Map des métadonnées pour chaque paire
- 🔄 **Workflow** :
  1. Appelle `getAllMarkets()` une seule fois
  2. Fusionne : `trading` + `display` + `pyth`
  3. Crée une Map : `symbol` → `{ base, counter, baseIssuer, counterIssuer, source }`
  4. Utilisé par `getBookIdFromPair(pair)` pour résoudre les issuers

**Fonction principale** :
```javascript
export function getBookIdFromPair(pair) {
  // Input: "EUR/USD" ou "XRP/RLUSD"
  // Output: {
  //   backendPair: "EUR_USD",
  //   source: "pyth",
  //   baseIssuer: null,
  //   counterIssuer: null
  // }
}
```

**Exemple de Map construite** :
```javascript
marketMetadata.set("EUR_USD", {
  base: "EUR",
  counter: "USD",
  baseIssuer: null,
  counterIssuer: null,
  source: "pyth"
});
```

---

## 📊 Récapitulatif des méthodes utilisées

| Méthode xcannesApi | Utilisateur(s) | Fréquence | Objectif |
|-------------------|----------------|-----------|----------|
| `getForexPrice(symbol)` | `useExternalPrice` | 5s | Prix live forex/crypto |
| `getCommodityPrice(symbol)` | `useExternalPrice` | 5s | Prix live commodities |
| `getKlines(pair, tf, limit)` | `useCandles1m`, `XrplCandleChartRaw` | 60s, À la demande | Bougies historiques |
| `getAllMarkets()` | `dex.jsx`, `xrpl.js` | 1× au montage | Liste des paires |

---

## 🔄 Flux de données complet

```
┌─────────────────────────────────────────────────────────────────┐
│                      FRONTEND REACT                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  📄 dex.jsx (Page)                                              │
│      ↓ getAllMarkets() (montage)                                │
│      • Charge toutes les paires disponibles                     │
│      • ["XRP/RLUSD", "EUR/USD", "BTC/USD", ...]                │
│                                                                  │
│  📊 XrplCandleChartRaw.jsx (Composant graphique)                │
│      ↓ getKlines(pair, timeframe, limit) (à la demande)         │
│      • Charge l'historique des bougies                           │
│      • Timeframes: 1m, 5m, 15m, 1h, 4h, 1d                      │
│                                                                  │
│  🎣 useExternalPrice(pair, category) (Hook - 5s polling)        │
│      ↓ getForexPrice(symbol) | getCommodityPrice(symbol)        │
│      • Prix live Pyth                                            │
│      • { price, loading, error, data }                           │
│                                                                  │
│  🕐 useCandles1m(pair) (Hook - 60s polling)                     │
│      ↓ getKlines(pair, "1m", 1440)                              │
│      • 24h de bougies 1m                                         │
│      • Calcul du % d'évolution 24h                               │
│                                                                  │
│  🛠️ getBookIdFromPair(pair) (Utilitaire)                        │
│      ↓ getAllMarkets() (1× au montage)                          │
│      • Convertit EUR/USD → métadonnées XRPL                      │
│      • { backendPair, source, issuers }                          │
│                                                                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ↓ xcannesApi.js (Client HTTP)
                       │ • Gère timeout, retry, cache
                       │ • Unifie les appels API
                       │
┌──────────────────────┴──────────────────────────────────────────┐
│                      BACKEND API                                 │
├─────────────────────────────────────────────────────────────────┤
│  GET /api/v1/forex                    → Liste marchés Pyth      │
│  GET /api/v1/ticker/:symbol           → Prix live (Redis)       │
│  GET /api/v1/klines/:symbol?tf=...    → Bougies (MongoDB)       │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ Points clés

1. **Centralisation** : `xcannesApi.js` est le **seul point d'entrée** pour les appels backend
2. **4 utilisateurs principaux** : 2 hooks + 1 composant + 1 page + 1 utilitaire
3. **2 patterns de récupération** :
   - **Polling** : `useExternalPrice` (5s), `useCandles1m` (60s)
   - **On-demand** : `XrplCandleChartRaw` (au changement de paire/timeframe)
4. **Séparation des responsabilités** :
   - `useExternalPrice` : Prix live (dernière valeur)
   - `useCandles1m` : Bougies 1m pour calcul % 24h
   - `XrplCandleChartRaw` : Historique complet pour graphique
   - `dex.jsx` : Liste des paires disponibles
   - `xrpl.js` : Métadonnées XRPL (issuers)

---

## 🔍 Script de vérification

Pour tester que tous ces flux fonctionnent, voir :
- **Script 6** : `/root/xcannes-dex/Xcannes-/scripts/6-controler-flux-paires-pyth.js`
- **Documentation** : `/root/xcannes-dex/Xcannes-/docs/FLUX-DONNEES-PYTH-FRONTEND.md`

---

**Dernière mise à jour** : 26 novembre 2025
