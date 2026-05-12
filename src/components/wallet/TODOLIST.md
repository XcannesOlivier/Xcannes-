# WalletDashboard.jsx — Liste de nettoyage

## 🔴 Bugs / Code mort

- [x] **1. `activityTooltipOpen` — tooltip jamais visible**
  Ajout de `onMouseEnter` / `onMouseLeave` sur le bouton d'activité récente pour ouvrir/fermer le tooltip au survol.

- [x] **2. `recentActivityTimerRef` — timer jamais armé**
  Supprimé : `recentActivityTimerRef`, les deux blocs `clearTimeout` dans `flashRecentActivity` et l'`useEffect` de cleanup.

---

## 🟠 Variables / états inutiles

- [ ] **3. `[, setRecentActivityMovementId]`**
  La valeur n'est jamais lue (getter ignoré avec `,`). Le setter est appelé dans `flashRecentActivity`, mais cet ID n'est utilisé **nulle part dans le rendu**. État purement mort.

- [ ] **4. `hasRlusdTrustline = hasOnChainRlusd`**
  Alias direct, aucune logique supplémentaire. Remplacer les usages par `hasOnChainRlusd` directement.

- [ ] **5. `defaultWalletLabel`**
  Variable utilisée une seule fois, immédiatement en dessous. Peut s'inliner dans `walletHasCustomLabel`.

- [ ] **6. `recentActivityWhen.mobile` / `.desktop` toujours identiques**
  Depuis le nettoyage précédent, `mobile` et `desktop` ont la même valeur. Le JSX les rend encore séparément avec `md:hidden` / `hidden md:inline` pour un résultat identique. Simplifier en une seule propriété `.label`.

---

## 🟡 Duplication JSX

- [ ] **7. SVG d'icônes copié 2× (mobile 18px + desktop 16px)**
  Les 3 SVG (send / receive / convert) sont répétés à l'identique pour mobile et desktop, seule la taille de classe change. Un petit composant `<ActivityIcon size icon />` éliminerait ~60 lignes.

- [ ] **8. Label d'activité i18n dupliqué**
  Le bloc ternaire à 4 branches (`convert` / `receive` / `send` / default) avec `t(...)` est répété **2 fois** dans le JSX. Extraire dans une variable `const recentActivityLabel`.

---

## 🟢 Organisation (mineur)

- [ ] **9. Constantes MoonPay en scope module**
  `isTrustedMoonpayUrl`, `clearMoonpaySellClientState`, `returnToMoonpaySellWidget` + leurs 7 constantes `MOONPAY_*` sont uniquement liées au sell-flow. Un fichier `utils/moonpayClientUtils.js` allégerait le haut du composant.

- [ ] **10. `statementVariant` inline**
  `const statementVariant = WALLET_LAYOUT.statementVariant;` — une ligne intermédiaire qui peut s'inliner directement dans l'appel `useWalletModalProps`.
