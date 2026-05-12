# Wallet — 6ème passe de nettoyage

## 🟠 Gains moyens

- [x] **A. `fmtAmountRight` — encore dupliqué dans 2 modals**
  `WalletDashboardSwapModal.jsx` (ll. 21-27) et `WalletDashboardSendModal.jsx` (ll. 15-21)
  redéfinissent `fmtAmountRight` identique au pixel près à `moonpayShared.js`.
  Ces deux fichiers sont dans le même dossier `modals/` — il suffit d'importer depuis `./moonpayShared`.

- [x] **B. `WalletDashboardSendChoiceModal.jsx` — 2 useCallback, warnings build**
  Deux `useCallback` (ll. 232 et 257) listent `onChooseSimpleSend`, `setSendDestination`,
  `setSendDestinationLabel` comme dépendances alors qu'aucune n'est utilisée dans le corps
  du callback. Le build signale : *"unnecessary dependencies"*.
  Retirer ces 3 valeurs des deux tableaux de deps.

- [x] **C. `useWalletSendOrchestrator.js` — setters stables en deps (l. 212)**
  `applyPaymentToSendForm` liste `setSendDestination`, `setSendDestinationLabel`,
  `setSendAssetKey`, `setSendAmount`, `setSendPaymentRequest` dans son dep array.
  Ces setters viennent tous de `useSendForm` → `useState` → stables par garantie React.
  Les retirer (ou ajouter `eslint-disable` si le linter l'exige).

---

## 🟢 Petits nettoyages

- [x] **D. `useWalletNavigation.js` — setters Convert dans les deps useCallback (ll. 151, 480)**
  `setConvertBaseCurrency`, `setConvertQuoteCurrency`, `setConvertAmount` sont passés comme
  props mais proviennent de `useState` côté appelant (stable). Ils apparaissent dans 2
  tableaux de deps — les retirer avec `eslint-disable` pour clarifier l'intention.

- [x] **E. `usePaymentRequestScanner.js` — setters props en deps (l. 28)**
  `setSendDestination` et `setSendDestinationLabel` passés en props depuis `useSendForm`.
  Stables (useState). Retirer du dep array du `useCallback` de `handleQrSuccess`.
