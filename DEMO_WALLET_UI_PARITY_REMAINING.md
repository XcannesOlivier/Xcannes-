# Demo Wallet — UI parity : reste à faire (inventaire)

Objectif : lister les **écarts UI restants** entre wallet réel (mobile) et wallet demo, puis les traiter étape par étape **sans toucher au code du wallet réel**.

Rappel contraintes :
- Scope modifs : `Xcannes-/src/components/demo-wallet/**`
- Pas de “desktop variants” : le demo doit rester **mobile-look** partout.

## Écarts identifiés (par comparaison des modales/components)

### Modales présentes dans le wallet réel mais absentes côté demo
- `WalletDashboardCashChoiceModal.jsx` (réel) → pas d’équivalent demo
- `WalletDashboardUsdSwapModal.jsx` (réel) → pas d’équivalent demo
- `TopperBuyModal.jsx` / `TopperSellModal.jsx` (réel) → pas d’équivalent demo
- `TransactionProgressModal.jsx` (réel) → pas d’équivalent demo
- `WalletActivationModal.jsx` / `WalletActivationRequestModal.jsx` (réel) → pas d’équivalent demo

Note : on décidera au cas par cas si elles sont nécessaires dans le demo (UI only), en fonction de ce que tu veux montrer.

## TODO (prochaine vague)

- [ ] 1) **Receive (UI) — audit + alignement complet**
  - Fichier demo : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardReceiveModal.jsx`
  - Référence réelle : `Xcannes-/src/components/wallet/modals/WalletDashboardReceiveModal.jsx`

- [ ] 2) **Swap/Convert (UI) — audit + alignement complet**
  - Fichier demo : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSwapModal.jsx`
  - Référence réelle : `Xcannes-/src/components/wallet/modals/WalletDashboardSwapModal.jsx`

- [ ] 3) **Cash (UI) — reproduire le flow réel**
  - Ajouter une étape “cashChoice” (UI) ou faire en sorte que `DemoWalletDashboardCashModal` reproduise exactement la séquence visuelle.
  - Fichier demo : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardCashModal.jsx`
  - Références réelles : `Xcannes-/src/components/wallet/modals/WalletDashboardCashChoiceModal.jsx`, `Xcannes-/src/components/wallet/modals/WalletDashboardCashModal.jsx`

- [ ] 4) **USD Swap (UI) (si on veut la parité cash)**
  - Créer `DemoWalletDashboardUsdSwapModal.jsx` (copie UI du réel, mécanique demo simplifiée).
  - Référence réelle : `Xcannes-/src/components/wallet/modals/WalletDashboardUsdSwapModal.jsx`

- [ ] 5) **Transaction progress (UI) (si on veut la parité)**
  - Créer un modal UI-only type “progress/signed/success” (ou réutiliser le pattern existant dans demo send).
  - Référence réelle : `Xcannes-/src/components/wallet/modals/TransactionProgressModal.jsx`

- [ ] 6) **Topper (UI) (optionnel)**
  - Ajouter des modales demo UI-only si Topper est visible dans le cash réel.
  - Références réelles : `Xcannes-/src/components/wallet/modals/TopperBuyModal.jsx`, `Xcannes-/src/components/wallet/modals/TopperSellModal.jsx`

- [ ] 7) **Activation (UI) (optionnel)**
  - Ajouter des modales demo UI-only si tu veux montrer l’écran d’activation.
  - Références réelles : `Xcannes-/src/components/wallet/modals/WalletActivationModal.jsx`, `Xcannes-/src/components/wallet/modals/WalletActivationRequestModal.jsx`

## Vérifs après chaque étape
- Lint : `cd Xcannes- && npm run lint`
- Tests : `cd Xcannes- && npm test`

