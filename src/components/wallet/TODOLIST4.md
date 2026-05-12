# Wallet — 4ème passe de nettoyage

## 🔴 Gains importants (50+ lignes)

- [x] **A. `useModalDragToClose` — système swipe-to-close triplé**
  `WalletDashboardSendModal.jsx` (ll. 409-515), `WalletDashboardCashModal.jsx` (ll. 178-241) et `WalletDashboardCashChoiceModal.jsx` (ll. 198-292) contiennent chacun la même implémentation complète du swipe-to-close : `overlayDragMetaRef`, `maybeStartOverlayDrag`, `handleOverlayPointerMove`, `handleOverlayPointerEnd`, `overlayDragging` + `overlayTranslateY` state.
  Extraire un hook `useModalDragToClose({ onClose, config? })` qui retourne `{ dragging, translateY, handlers: { onPointerDown, onPointerMove, onPointerUp } }`.
  Les seuils sont actuellement incohérents (220 vs 180, 0.28 vs 0.25, 1.25 vs 1.2) — les normaliser avec une config par défaut `DRAG_CONFIG = { minDistance: 220, maxDistance: 320, heightRatio: 0.28, velocityThreshold: 1.25 }`.

---

## 🟠 Gains moyens (10-30 lignes)

- [x] **B. `WalletDashboardSendModal.jsx` — deux useMemo balance quasi-identiques**
  `insufficientBalance` (ll. 138-164) et `manualInsufficientBalance` (ll. 165-215) : même logique de vérification RLUSD/token, même calcul du solde disponible. Seule la condition d'entrée diffère (`sendPaymentRequest || !selectedSendToken` vs saisie manuelle).
  Fusionner en un seul `useMemo` avec une branche ou un paramètre `mode`.

- [x] **C. `normalizeCurrencyCode(code)` — helper manquant**
  `String(code || "").trim().toUpperCase()` (parfois sans `.trim()`, parfois sans `.toUpperCase()`) est répété 15+ fois dans :
  `useWalletTokens.js`, `useWalletSwapOrchestrator.js`, `useAugmentedCurrencyLines.js`, `useCurrencyLinesActions.js`, `useRlusdPerUnitRates.js`, `useSwapConversion.js`, etc.
  Le helper `normalizeCurrencyCode` existe déjà dans `/root/xcannes-dex/utils/currency.js` (backend) mais pas côté frontend. Créer `src/components/wallet/utils/normalizeCurrencyCode.js` et l'importer dans chaque fichier.

- [x] **D. `WalletDashboardSendModal.jsx` — deux systèmes drag parallèles** *(absorbé par A)*
  En plus du drag overlay (ll. 409-515), le panneau scanner a ses propres handlers `scanSwipeStart/Move/End` et state `scanDragging/scanTranslateY` (ll. 369-408) avec une logique identique. Même après extraction du hook A, ces deux instances restent — les unifier en deux appels du même hook.

---

## 🟢 Petits nettoyages

- [x] **E. `useWalletSwapOrchestrator.js` — deps circulaires dans useEffect**
  Le `useEffect` du guard XRP/RLUSD (ll. 56-82) liste `setConvertBaseCurrency` et `setConvertQuoteCurrency` comme dépendances alors que ce sont des setters stables issus de `useState`. Retirer les setters des deps (ou wrapper en `useCallback` vide si le linter l'exige).

- [x] **F. `WalletDashboardTokenList.jsx` — className presque dupliqué**
  Les deux branches du ternaire (ll. 13-16) sont identiques à 90%, seul `"overflow-y-auto overscroll-contain"` diffère.
  Remplacer par : `const listClassName = [baseClass, !disableInternalScroll && "overflow-y-auto overscroll-contain"].filter(Boolean).join(" ")`.
