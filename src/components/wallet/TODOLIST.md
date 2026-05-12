# Refactoring — dossier `wallet/`

> Objectif : réduire la complexité, améliorer la lisibilité et la maintenabilité **sans régression**.

---

## Étapes prioritaires

### ✅ 1. Extraire les utils inline de `WalletDashboard.jsx`
- **Quoi** : `isAcceptedOnChainToken`, `normalizeMovementKind`, `resolveIncomingXrpAmount`
- **Où** : → `wallet/utils/movementUtils.js` ✓
- **Résultat** : fichier créé, `WalletDashboard.jsx` mis à jour

---

### ✅ 2. Extraire `ActivityIconSvg` en composant dédié
- **Quoi** : composant SVG inline dans `WalletDashboard.jsx`
- **Où** : → `wallet/components/ActivityIconSvg.jsx` ✓
- **Résultat** : fichier créé, `WalletDashboard.jsx` mis à jour

---

### ✅ 3. Créer hook `useTransactionProgress`
- **Quoi** : state `txProgress`, `TX_ACTION_LABELS`, `signTransactionWithProgress`, `handleTxProgressClose`
- **Où** : → `wallet/hooks/useTransactionProgress.js` ✓
- **Résultat** : hook créé, `WalletDashboard.jsx` mis à jour

---

### ✅ 4. Créer hook `useMoonpayBuySettlement`
- **Quoi** : double `useEffect` de polling MoonPay buy (~100 lignes)
- **Où** : → `wallet/hooks/useMoonpayBuySettlement.js` ✓
- **Résultat** : hook créé, `WalletDashboard.jsx` mis à jour

---

### ✅ 5. Créer hook `useActivityBanner`
- **Quoi** : 6 useMemo + 2 useEffect activité récente
- **Où** : → `wallet/hooks/useActivityBanner.js` ✓
- **Résultat** : hook créé, `WalletDashboard.jsx` mis à jour

---

### ✅ 6. Remplacer le `useEffect` media query par `useIsDesktop`
- **Quoi** : `useEffect` + `setIsDesktopPanel` → `useIsDesktop(1024)` + `isDesktopPanel` dérivé
- **Résultat** : `WalletDashboard.jsx` simplifié, ~20 lignes supprimées

---

### ✅ 7. Splitter `WalletDashboardUsdSwapModal.jsx` (4 766 → 4 481 lignes)
- **Réalisé** :
  - `modals/simpleSwapUtils.js` ✓ — 9 constantes + 15 fonctions pures
  - `modals/simpleSwapBanners.jsx` ✓ — `ErrorBanner`, `WarnBanner`, `InfoBanner`
- **À faire (suite possible)** :
  - `useSimpleSwapApi.js` — `fetchCurrencies/Ranges/Estimate`, `createExchange`
  - `useUsdSwapForm.js` — état du formulaire

---

### ✅ 8. Dé-dupliquer `MoonPayBuyModal` / `MoonPaySellModal`
- **Réalisé** :
  - `hooks/useMoonpayBase.js` ✓ — states de base, `moonpayIframeAllow`, 2 useEffects, 7 helpers storage
  - `MoonPayBuyModal.jsx` : 2 600 → **2 466 lignes** (−134)
  - `MoonPaySellModal.jsx` : 2 196 → **2 057 lignes** (−139)

---

### ⬜ 9. Extraire sous-composants de `GlobalStatement.jsx` (2 209 lignes)
- **Quoi** : blocs de rendu répétés (lignes de transaction, en-têtes de mois, totaux)
- **Où** : composants séparés dans `wallet/statements/`
- **Pourquoi** : fichier trop monolithique

---

### ⬜ 10. Extraire sous-composants de `CurrencyStatement.jsx` (2 044 lignes)
- **Quoi** : row de transaction, filtres, totaux
- **Où** : composants séparés dans `wallet/statements/`
- **Pourquoi** : même problème que `GlobalStatement`

---

### ⬜ 11. Tests unitaires pour utils/hooks extraits
- **Priorité** : `movementUtils`, `useTransactionProgress`, `useActivityBanner`
- **Framework** : Vitest (déjà configuré)
- **Fichiers cibles** :
  - `wallet/utils/movementUtils.test.js`
  - `wallet/hooks/useTransactionProgress.test.js`
  - `wallet/hooks/useActivityBanner.test.js`

---

### ✅ 12. Vérification no-regression (tests existants)
- `npx vitest run` lancé après chaque étape — **54/54 tests passent** ✓

---

## Taille des fichiers (référence)

| Fichier | Lignes initiales | Lignes actuelles |
|---|---|---|
| `modals/WalletDashboardUsdSwapModal.jsx` | 4 766 | **4 481** ✅ |
| `modals/simpleSwapUtils.js` | — | 248 (nouveau) |
| `modals/simpleSwapBanners.jsx` | — | 22 (nouveau) |
| `modals/MoonPayBuyModal.jsx` | 2 600 | 2 600 |
| `statements/GlobalStatement.jsx` | 2 209 |
| `modals/MoonPaySellModal.jsx` | 2 196 |
| `modals/WalletDashboardReceiveModal.jsx` | 2 169 |
| `statements/CurrencyStatement.jsx` | 2 044 |
| `WalletDashboard.jsx` | 1 628 |
| `modals/WalletDashboardSendModal.jsx` | 1 529 |
| `components/WalletSettingsDropdown.jsx` | 1 169 |
| `modals/WalletDashboardSendChoiceModal.jsx` | 1 153 |
