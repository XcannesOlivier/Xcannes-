# Demo Wallet — UI parity (mobile look everywhere)

Objectif : rendre la **page principale du wallet demo** visuellement **quasi identique** au **wallet réel (UI mobile)**, y compris sur desktop.

Statut : ✅ **validée** (2026-05-10)

Contraintes :
- Ne pas modifier le code du **wallet réel** (`Xcannes-/src/components/wallet/**`).
- Éviter le partage de composants/imports entre demo et réel : on **copie** et on adapte côté demo.
- Les tests ne couvrent pas tout : avancer par petites étapes et vérifier visuellement.

## TODO (priorité)

- [x] 1) **Footer mobile 3 colonnes (le plus visible)**
   - Remplacer le footer minimal du demo par un footer identique au réel : **+ Devise / Scanner / Historique**.
   - Fichiers : `Xcannes-/src/components/demo-wallet/components/DemoWalletFooter.jsx`, `Xcannes-/src/components/demo-wallet/DemoWalletDashboard.jsx`

- [x] 2) **Layout “mobile full-screen” sur toutes tailles**
   - Supprimer/neutraliser l’effet “panel encadré” du demo si ça diverge du réel.
   - Objectif : le demo doit se comporter comme une page wallet mobile.
   - Fichier : `Xcannes-/src/components/demo-wallet/DemoWalletDashboard.jsx`

- [x] 3) **Header demo → header réel (mobile)**
   - Aligner : padding/typo, bloc wallet selector, toast, dropdown settings.
   - Ajouter l’équivalent visuel du dot XRPL (en mode demo : statique ou “DEMO”).
   - Fichier : `Xcannes-/src/components/demo-wallet/components/DemoWalletHeader.jsx`

- [x] 4) **Action row (Send/Receive/Convert/Funds)**
   - Refaire la barre d’actions demo pour matcher `WalletDashboardActionRow` (mêmes cards, mêmes labels).
   - Fichier : `Xcannes-/src/components/demo-wallet/components/DemoWalletActionBar.jsx`

- [x] 5) **Mini-card “activité récente” au-dessus de la liste**
   - Répliquer la mini-card du wallet réel (structure + styles) et la nourrir avec les données preview du demo.
   - Fichiers : `Xcannes-/src/components/demo-wallet/components/DemoWalletTokenList.jsx`, `Xcannes-/src/components/demo-wallet/hooks/useDemoStatementData.js`

- [x] 6) **Liste des tokens (styles + structure)**
   - Aligner spacing, separators, header gradient (sans réutiliser le composant réel).
   - Fichier : `Xcannes-/src/components/demo-wallet/components/DemoWalletTokenList.jsx`

- [x] 7) **Historique (entry point)**
   - Rendre le déclenchement “Historique” identique au réel (depuis le footer) et ouvrir `showGlobalStatement`.
   - Fichiers : `Xcannes-/src/components/demo-wallet/components/DemoWalletFooter.jsx`, `Xcannes-/src/components/demo-wallet/DemoWalletDashboard.jsx`

- [x] 8) **Mobile look sur desktop (garde-fou global)**
   - Neutraliser les `md:*` / variantes desktop dans le dashboard demo quand ça change le rendu.
   - Scope : `Xcannes-/src/components/demo-wallet/**`

## Vérifs après chaque étape

- Lint : `cd Xcannes- && npm run lint`
- Tests : `cd Xcannes- && npm test`
- Vérif visuelle : comparer la page demo vs la page `/wallet` (réel) en viewport mobile.
