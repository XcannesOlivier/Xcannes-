# Wallet — 5ème passe de nettoyage

## 🔴 Gains importants

- [x] **A. `moonpayShared.js` — constantes/helpers dupliqués entre Buy et Sell**
  `MoonPayBuyModal.jsx` et `MoonPaySellModal.jsx` redéfinissent chacun les mêmes blocs :
  **Constantes partagées :** `DEBUG_LOGS`, `MOONPAY_ORIGIN_SUFFIX`, `MOONPAY_ACTIVE_STORAGE_KEY`,
  `MOONPAY_AUTOOPEN_TAB_KEY`, `MOONPAY_WALLET_ADDRESS_KEY`, `MOONPAY_RESUME_MAX_AGE_MS`, `MOONPAY_FLOW_MAX_AGE_MS`
  **Fonctions partagées :** `fmtAmountRight`, `isTrustedMoonPayOrigin` ⚠️ (validation sécurité origine iframe),
  `resolvePartnerName`, `notifyPwaMoonpayActive`, `normalizeFiatCurrencyCode`, `truncateMiddle`
  **Buy seulement :** `MOONPAY_TAG_XRP/RLUSD`, `resolveMoonpayTag`, `resolveIncomingXrpAmount`, `normalizeMovementKind`, `MOONPAY_SUPPORTED_CURRENCIES`
  Créer `modals/moonpayShared.js` avec les éléments partagés et importer dans les deux modals.

---

## 🟠 Gains moyens

- [x] **B. `normalizeCurrencyCode` dans les modals** *(suite de C/TODOLIST4)*
  17 occurrences restantes dans `WalletDashboardUsdSwapModal.jsx`, 6 dans `MoonPaySellModal.jsx`
  (à faire après A pour MoonPaySell), 1 dans `WalletDashboardSwapModal.jsx`.

- [x] **C. `WalletDashboardHeader.jsx` — 2 warnings exhaustive-deps (build)**
  `useEffect` (l.195) et `useMemo` (l.265) : dépendance `trimmed` manquante signalée au build.
  Ajouter `trimmed` aux tableaux de deps ou restructurer le calcul.

---

## 🟢 Petits nettoyages

- [x] **D. `console.log` non gardés (~15 appels directs)** *(déjà tous gardés — faux positif du grep)*
  Dans `usePaymentRequestScanner.js` (6), `QRScanner.jsx` (6), `WalletDashboardStatementModals.jsx` (4),
  `useSwapConversion.js` (3), `useSavedAddresses.js` (3), etc.
  Wrapper dans `if (DEBUG_LOGS)` ou supprimer les logs de debug.
