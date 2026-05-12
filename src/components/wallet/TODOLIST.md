# WalletDashboard.jsx — Liste de nettoyage

## 🔴 Bugs / Code mort

- [x] **1. `activityTooltipOpen` — tooltip jamais visible**
  Ajout de `onMouseEnter` / `onMouseLeave` sur le bouton d'activité récente pour ouvrir/fermer le tooltip au survol.

- [x] **2. `recentActivityTimerRef` — timer jamais armé**
  Supprimé : `recentActivityTimerRef`, les deux blocs `clearTimeout` dans `flashRecentActivity` et l'`useEffect` de cleanup.

---

## 🟠 Variables / états inutiles

- [x] **3. `[, setRecentActivityMovementId]`**
  Supprimé : déclaration du state, reset dans le `useEffect` wallet-switch, et appel dans `flashRecentActivity`.

- [x] **4. `hasRlusdTrustline = hasOnChainRlusd`**
  Supprimé l'alias. Les 2 usages remplacés par `hasOnChainRlusd` directement (`useWalletActivation` et `WalletDashboardHeader`).

- [x] **5. `defaultWalletLabel`**
  Inliné directement dans `walletHasCustomLabel`.

- [x] **6. `recentActivityWhen.mobile` / `.desktop` toujours identiques**
  Fusionné en une seule propriété `.label`. JSX simplifié en 3 endroits (attribut `title`, tooltip, rendu double span → span unique).

---

## 🟡 Duplication JSX

- [x] **7. SVG d'icônes copié 2× (mobile 18px + desktop 16px)**
  Extrait en composant `ActivityIconSvg({ icon, size })` avant le composant principal. Les 2 blocs JSX remplacés par `<ActivityIconSvg icon={recentActivityIcon} size={18/16} />`.

- [ ] **8. Label d'activité i18n dupliqué**
  Le bloc ternaire à 4 branches (`convert` / `receive` / `send` / default) avec `t(...)` est répété **2 fois** dans le JSX. Extraire dans une variable `const recentActivityLabel`.

---

## 🟢 Organisation (mineur)

- [ ] **9. Constantes MoonPay en scope module**
  `isTrustedMoonpayUrl`, `clearMoonpaySellClientState`, `returnToMoonpaySellWidget` + leurs 7 constantes `MOONPAY_*` sont uniquement liées au sell-flow. Un fichier `utils/moonpayClientUtils.js` allégerait le haut du composant.

- [ ] **10. `statementVariant` inline**
  `const statementVariant = WALLET_LAYOUT.statementVariant;` — une ligne intermédiaire qui peut s'inliner directement dans l'appel `useWalletModalProps`.
