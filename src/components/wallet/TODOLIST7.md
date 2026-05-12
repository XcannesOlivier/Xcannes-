# Wallet — 7ème passe de nettoyage

## 🟠 Gains moyens

- [x] **A. `topperShared.js` — `TOPPER_ACTIVE_STORAGE_KEY` + `setTopperActive` dupliqués**
  `TopperBuyModal.jsx` et `TopperSellModal.jsx` redéfinissent à l'identique :
  `TOPPER_ACTIVE_STORAGE_KEY` (constante), `setTopperActive(active)` (fonction ~18 lignes).
  Créer `modals/topperShared.js` avec ces deux exports et importer dans les deux modals.
  Gain : ~20 lignes dupliquées supprimées.

- [x] **B. `isXrplAddress` — regex dupliquée entre GlobalStatement et CurrencyStatement**
  Les deux statements définissent un `useCallback` identique :
  `/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(String(value || "").trim())`
  Extraire `isXrplAddress` dans `utils/xrplAddress.js` (ou l'importer depuis `@/utils/xrplHelpers`
  si elle y existe déjà) et remplacer les deux `useCallback` par un import direct.

- [x] **C. `flashShareNotice` — useCallback identique dans GlobalStatement et CurrencyStatement**
  Les deux composants définissent le même `flashShareNotice(message, { tone, autoClose })` avec
  la même logique `setShareNotice` / `setShareNoticeTone` / timer ref. Différence : les setters
  et la ref viennent du scope local — pas extractible en hook partagé sans refactor lourd, mais
  le pattern `shareNoticeTimerRef` + les 2 useState associés peuvent être extraits dans un hook
  `useFlashNotice()` → `{ notice, noticeTone, flashNotice, noticeRef }`.

---

## 🟢 Petits nettoyages

- [x] **D. `useWalletModalProps.js` — 2 useMemo identiques (selectByAssetKeyProps / selectByCurrencyProps)**
  `selectByAssetKeyProps` (l.144) et `selectByCurrencyProps` (l.148) ont les mêmes deps et un
  corps quasi-identique (renommage des clés uniquement). Les deps listées
  (`selectLabelByAssetKey`, etc.) sont des props passées depuis l'extérieur — potentiellement
  stables si issues de `useCallback`. Vérifier leur origine et supprimer des deps si stables,
  ou fusionner en un seul `useMemo` qui retourne les deux objets.

- [x] **E. `moonpayShared.js` → renommer en `walletModalShared.js`**
  `fmtAmountRight`, `truncateMiddle` et `normalizeFiatCurrencyCode` sont maintenant utilisés par
  4 modals non-MoonPay (`WalletDashboardSwapModal`, `WalletDashboardSendModal`, etc.).
  Renommer le fichier pour refléter son périmètre réel. Mettre à jour les 6 imports.
