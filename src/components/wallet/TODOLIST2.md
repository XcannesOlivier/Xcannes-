# Wallet — 2ème passe de nettoyage

## 🟢 Suppression directe (rapide)

- [x] **A. `useWalletNavigation.js` — 3 wrappers inutiles**
  Supprimés : `handleOpenSecurity`, `handleOpenHelp`, `handleOpenTerms`. Le hook expose désormais `handleOpenDesktopSettingsPage` directement. Les 2 calleurs JSX dans `WalletDashboard.jsx` utilisent `() => handleOpenDesktopSettingsPage('security/help/terms')`.

- [x] **B. `WalletMobileModals.jsx` — `scanDragMeta` réinitialisé 4× manuellement**
  Extrait `INITIAL_SCAN_DRAG_META` comme constante module. `useRef` initial et les 3 réinitialisations utilisent désormais `{ ...INITIAL_SCAN_DRAG_META }`.

---

## 🟠 Refactoring état (moyen)

- [x] **C. `WalletMobileModals.jsx` — 8 setState séparés pour usdSwap**
  Fusionné en `const [usdSwapState, setUsdSwapState] = useState(INITIAL_USD_SWAP_STATE)`. `openUsdSwapOut` fait un seul `setUsdSwapState({...})`. `onClose` appelle `setUsdSwapState(INITIAL_USD_SWAP_STATE)`. Le JSX destructure l'objet pour garder les mêmes noms de variables.

- [x] **D. `WalletMobileModals.jsx` — logique scan QR dupliquée**
  Extrait `handleQrScanResult(data, callbackRef)` qui centralise `setQrScannerOpen(false)` + `setActiveAction('sendChoice')` + `setTimeout`. Les deux branches `scanFromPayreqRef` / `scanFromSendChoiceRef` réduites à 3 lignes chacune.

---

## 🟡 Extraction de hook (moyen)

- [x] **E. `WalletSettingsDropdown.jsx` — 5 useEffect identiques pour Escape**
  Extrait `useEscapeClose(isOpen, onClose)` juste avant le composant. Les 4 `useEffect` keydown remplacés par `useEscapeClose(isOpen, …)`, `useEscapeClose(showHelpModal, closeHelpModal)`, etc.

- [x] **F. `WalletSettingsDropdown.jsx` — 3 callbacks identiques**
  Remplacé par `makeModalCloser(setter)` (factory `useCallback`). Les 3 constantes utilisent `useMemo(() => makeModalCloser(setShowXxxModal))`. `useMemo` ajouté à l'import React.

---

## 🔴 Duplication logique (plus lourd)

- [~] **G. `useSendTransaction.js` — validation dupliquée**
  Non applicable : `handleSendSubmit` garde `!isConnected || !wallet` + `!selectedSendToken`, `handleFxSend` garde `!backendWalletAddress` + `!hasOnChainRlusd`. Variables et sémantique différentes — pas de fusion propre possible.

- [x] **H. `useSendTransaction.js` — cleanup payreq dupliqué**
  Extrait `removeMatchingPayreq()` comme helper interne. Les deux blocs de ~20 lignes (fin de `handleFxSend` et `handleDirectSend`) remplacés par un appel unique.

- [x] **I. `useWalletModalProps.js` — props selecteurs recopiés dans chaque useMemo**
  Ajout de deux memos partagés : `selectByAssetKeyProps` (pour `sendModalProps`) et `selectByCurrencyProps` (pour receive/swap/cash). Chaque `useMemo` utilise `...selectByAssetKeyProps` / `...selectByCurrencyProps` dans l'objet et `selectByAssetKeyProps` / `selectByCurrencyProps` dans le tableau de dépendances — au lieu de lister 4 fonctions séparées × 4 memos.

---

## 🟢 Organisation (mineur)

- [x] **J. `WalletDashboard.jsx` — import `isAcceptedOnChainToken` hors ordre**
  Déplacé après le bloc d'import `moonpayClientUtils`, avec `normalizeMovementKind` et `resolveIncomingXrpAmount`. Plus d'instruction `function` intercalée entre deux blocs `import`.
