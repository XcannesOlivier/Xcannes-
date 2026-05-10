# Demo Wallet — Parcours “Envoyer” (UI parity only)

Objectif : reproduire **uniquement l’UI** du parcours **Envoyer** du wallet réel (mobile) dans le **wallet demo**.

Important :
- On **ne change pas la mécanique** demo (state/flows peuvent différer du réel) → on aligne **visuel / structure / micro-copy** uniquement.
- Ne pas modifier le code du **wallet réel** (`Xcannes-/src/components/wallet/**`) : référence visuelle uniquement.
- Garder le rendu **mobile** sur desktop (pas de variantes responsive “desktop” côté demo).

## Références (read-only)
- Réel : `Xcannes-/src/components/wallet/modals/WalletDashboardSendChoiceModal.jsx`
- Réel : `Xcannes-/src/components/wallet/modals/WalletDashboardSendModal.jsx`
- Demo : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`
- Demo : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardPayreqModal.jsx`

## TODO (parcours Envoyer)

- [x] 1) **Entry point “Envoyer”**
  - Depuis `DemoWalletActionBar` → ouverture d’un écran **SendChoice** (style mobile) puis accès au flow send.
  - Fichiers : `Xcannes-/src/components/demo-wallet/components/DemoWalletActionBar.jsx`, `Xcannes-/src/components/demo-wallet/components/DemoWalletModals.jsx`, `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendChoiceModal.jsx`

- [x] 2) **Header / meta wallet**
  - Aligner header du modal : title, close, sous-titre, et bloc “wallet meta” (même look que réel mobile).
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [x] 3) **Sélecteur destinataire (input)**
  - Styles input + placeholder + focus ring + helper text (mêmes tailles/espacements).
  - Assurer que “paste” (adresse / payload) n’affecte pas le style (uniquement comportement).
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [x] 4) **Picker “adresses sauvegardées”**
  - Reproduire le bottom-sheet / menu mobile réel : header, rows, separators, empty state.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [x] 5) **Action “scanner / importer QR” (UI)**
  - Aligner le bloc scanner : boutons (upload/paste), cards, textes d’aide, état “camera unavailable”.
  - Fichiers : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`, `Xcannes-/src/components/demo-wallet/components/DemoQRScanner.jsx`

- [ ] 6) **Sélecteur token + montant**
  - Aligner le look des selects + `TokenAmountInput` : label, surface, ring, spacing, typography.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [ ] 7) **Bloc FX / infos (si affiché)**
  - Harmoniser le card/info FX (si `sendFxInfo`) : layout, bullets, emphasis, couleurs.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [ ] 8) **Review / confirmation (UI)**
  - Le résumé (destinataire, montant, devise) + CTA (swipe/confirm) doit matcher le réel mobile.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [ ] 9) **États “processing / success / error”**
  - Loading, disabled, success screen, error box : mêmes surfaces/typos/spacings.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendModal.jsx`

- [ ] 10) **Payreq modal (UI)**
  - Aligner la présentation d’une demande (payreq) : header, infos bénéficiaire, montant, CTA, save address.
  - Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardPayreqModal.jsx`

- [ ] 11) **Mobile-only (garde-fou)**
  - Vérifier qu’aucune variante responsive “desktop” ne change le rendu du parcours Envoyer.
  - Scope : `Xcannes-/src/components/demo-wallet/**`

## Vérifs après chaque étape
- Lint : `cd Xcannes- && npm run lint`
- Tests : `cd Xcannes- && npm test`
- Vérif visuelle : comparer modal “Envoyer” demo vs réel en viewport mobile (et desktop doit rester identique au mobile).
