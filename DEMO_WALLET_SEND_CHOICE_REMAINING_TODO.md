# Demo Wallet — “Send choice” (écarts restants UI → alignement wallet réel mobile)

Scope : **demo uniquement**  
- Fichier : `Xcannes-/src/components/demo-wallet/modals/DemoWalletDashboardSendChoiceModal.jsx`  
- Référence : `Xcannes-/src/components/wallet/modals/WalletDashboardSendChoiceModal.jsx`  
- Objectif : **UI parity** (pas de refacto mécanique, mais la structure/UX doit matcher le réel).

## TODO (reste à faire)

- [x] 1) **Supprimer les 2 écarts visibles**
  - Retirer la card “Scanner un QR” (dans le réel, le scan est géré dans le sous-parcours “Envoi simple”).
  - Retirer le bouton bas de page “Fermer” (le réel se ferme via backdrop + swipe).

- [x] 2) **Remplacer les cards par les 2 cards du réel**
  - Card 1 : “Envoi simple” (avec icône, title `ui_send_simple_title`, hint long `ui_send_simple_hint_long`, chevron).
  - Card 2 : “Payer une demande” (title `ui_send_choice_pay_request_title`, hint `ui_send_choice_pay_request_hint`, chevron).
  - Spacing : list scrollable, `gap-[32px]`, padding `px-4`, top spacing `mt-8 pt-1` (comme réel).

- [x] 3) **Ajouter “Voir les étapes” sous chaque card**
  - Toggle + chevron rotate.
  - Liste numérotée (badge rond 1/2) avec textes (steps send + steps payreq), mêmes couleurs (vert pour send, orange pour payreq).

- [x] 4) **Implémenter le comportement swipe-to-close (overlay)**
  - Drag handle visible en haut.
  - Backdrop avec opacity liée à `translateY`.
  - Pointer events + `maybeStartOverlayDrag` / meta drag (reprendre le pattern réel).

- [x] 5) **Sous-modal “Envoi simple” (UI)**
  - Sub-modal plein écran mobile, glow vert, swipe bar.
  - Title/subtitle : “Renseigner le destinataire” + hint.
  - Bloc “Compte source” (pill) visuellement identique.
  - 3 sections UI du réel :
    - “Choisir un contact” (picker avec dropdown stylé)
    - “Scanner” / “Importer QR” (cards/boutons)
    - “Entrer manuellement une adresse” (input + bouton valider)
  - Bouton final “Continuer” qui déclenche `onChooseSimpleSend` (mécanique demo ok, mais UI doit matcher).

- [x] 6) **Sous-modal “Payer une demande” (UI)**
  - Sub-modal plein écran mobile, accent orange.
  - Paste/import/scan du code (UI identique : input, file import, scan camera).
  - États d’erreur visuels (self-send, invalid code) au même style.
  - Bouton final qui déclenche `onChoosePayRequest` (ou scan) en gardant la mécanique demo actuelle.

- [x] 7) **Inputs QR image import**
  - Ajouter les `<input type="file">` cachés (quickscan + payreq) + handlers.
  - Le réel propose import QR image directement depuis le SendChoice.

- [ ] 8) **Micro-détails de parité**
  - `renderWalletMeta` : adapter l’appel pour matcher le rendu “pill-column” du réel (sans dépendre du composant réel).
  - Z-index / classes `wallet-modal-backdrop-in` / `wallet-modal-lift-in`.
  - Aucun `md:*`/variant desktop dans ce modal.

## Vérifs après chaque étape
- Lint : `cd Xcannes- && npm run lint`
- Tests : `cd Xcannes- && npm test`
