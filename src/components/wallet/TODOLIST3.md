# Wallet — 3ème passe de nettoyage

## 🔴 Gains importants (50+ lignes)

- [x] **K. `usePaymentRequestScanner.js` — bloc xcannesPayReq dupliqué**
  Extrait `applyXcannesPayreq(request)` comme helper interne dans le `useCallback`. Les deux blocs de ~60 lignes (JSON path et URI path) remplacés par `const { handled, beneficiaryLabel } = applyXcannesPayreq(request); if (handled) return;`.

- [x] **L. `WalletSettingsDropdown.jsx` — 3 modales structure identique**
  Les pages security, help et terms partagent exactement la même structure : `fixed inset-0`, header avec chevron + titre, zone scrollable. Extraire un composant `SettingsPageModal({ isOpen, onClose, title, children })` utilisé 3 fois.

---

## 🟠 Gains moyens (10-30 lignes)

- [x] **M. `WalletDesktopModals.jsx` — pattern reset cash répété 3×**
  Dans les handlers de choix cash (buy, sell, usdSwap), le pattern `resetXxxForm() + setActiveAction(...) + setCashBuyPrefill()` est recopié 3 fois. Extraire `handleCashChoice(type)`.

- [x] **N. `useWalletSendOrchestrator.js` — remplissage formulaire dupliqué**
  `handleResumePayreq()` et `startMoonpaySellRequest()` font la même séquence : set destination, set destination label, set asset key, set amount, set payment request. Extraire `applyPaymentToSendForm({ destination, label, assetKey, amount, paymentRequest })`.

- [~] **O. `WalletDashboardHeader.jsx` — `walletAddressSet` calculé 2×**
  Déjà résolu : un seul `useMemo` existe, partagé comme dépendance par deux `useEffect`. Non applicable.

---

## 🟢 Petits nettoyages (constantes)

- [x] **P. `useSwapConversion.js` — magic numbers inline**
  `1` utilisé comme taux RLUSD→USD dans deux contextes, `1e-9` comme epsilon de comparaison. Nommer en `RLUSD_USD_RATE = 1` et `EPSILON = 1e-9` au niveau module.

- [ ] **Q. `WalletSettingsDropdown.jsx` — classe CSS répétée 3×**
  `"fixed inset-0 z-[9999] bg-[#0b0f10]"` apparaît 3 fois (une par modale). Extraire en constante `SETTINGS_PAGE_OVERLAY_CLASS` (sera supprimée si L est fait avant).
