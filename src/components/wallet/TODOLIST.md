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

- [x] **8. Label d'activité i18n dupliqué**
  Extrait en variable `recentActivityLabel` après `recentActivityIcon`. Les 2 blocs ternaires JSX remplacés par `{recentActivityLabel}`.

---

## 🟢 Organisation (mineur)

- [x] **9. Constantes MoonPay en scope module**
  Extrait dans `moonpayClientUtils.js` : 8 constantes + 4 fonctions (`readMoonpayBuyResumeState`, `saveMoonpayBuyResumeState`, `isTrustedMoonpayUrl`, `clearMoonpaySellClientState`, `returnToMoonpaySellWidget`). `WalletDashboard.jsx` importe uniquement ce dont il a besoin.

- [x] **10. `statementVariant` inline**
  `const statementVariant = WALLET_LAYOUT.statementVariant;` inliné directement dans l'appel `useWalletModalProps`.
