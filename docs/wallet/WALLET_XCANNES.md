# Wallet XCANNES — Document explicatif (dev)

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-13

Ce document sert de **base de référence** pour continuer le développement du wallet XCANNES (frontend).  
Il décrit ce qui existe dans le code, ce qui est “spécification UX”, et ce qui reste à clarifier.

## 1) Vue d’ensemble

- Wallet **non-custodial** sur **XRPL** (source de vérité des soldes on-chain).
- Connexion + signature via **Xumm/Xaman** (QR code + deep link).
- UX “ledger” : en plus des actifs XRPL, le wallet gère des **lignes de devises internes** pour répartir un pool **RLUSD** en allocations (off-chain / applicatif).

Code principal: `Xcannes-/src/components/wallet/WalletDashboard.jsx`

## 2) Concepts clés (à ne pas confondre)

### 2.1 Actifs XRPL (on-chain)

Affichés dans la liste d’actifs via le solde XUMM:
- `XRP` (natif)
- IOUs / tokens XRPL (ex: `RLUSD`, `XCS`, etc.) avec `{ currency, issuer, value }`

**Tokens obligatoires (produit):** le wallet doit toujours exposer `XRP`, `RLUSD`, `XCS` côté UX.  
Note: `XRP` est toujours disponible; `RLUSD` et `XCS` peuvent nécessiter l’installation d’une **trustline XRPL** (TrustSet) si l’utilisateur ne l’a pas encore.

Source: `Xcannes-/src/context/XummContext.js` (endpoint `/xumm/balance`)

### 2.2 “Wallet lines” / “Trustlines” (concept applicatif)

Dans l’UI, “Trustlines” correspond actuellement à des **lignes internes** stockées côté backend:
- Chaque ligne = `{ currencyCode, lockedXcs }`
- `totalLockedXcs` est renvoyé par l’API.

Source: `Xcannes-/src/components/wallet/hooks/useWalletLines.js` (endpoints `/wallet/lines`)

Important: cette fonctionnalité **ne crée pas de TrustSet XRPL** à ce stade (c’est du tracking applicatif, cf. UI).

### 2.3 “Currency lines” (allocations RLUSD, off-chain)

Le wallet peut répartir RLUSD en “lignes de devise” (ex: EUR/GBP/…):
- Chaque ligne = `{ currencyCode, allocatedRlusd, fxRate?, fxSource? }` (selon backend)
- Résumé = `rlusdOnChain`, `totalAllocatedRlusd`, `unallocatedRlusd`, `invariantOk`, `excessAllocatedRlusd`
- Invariant attendu: `totalAllocatedRlusd <= rlusdOnChain`

Source: `Xcannes-/src/components/wallet/hooks/useWalletCurrencyLines.js` (endpoints `/wallet/currency-lines`, `/wallet/convert`)

Activation des lignes:
- Une ligne de devise est “activée” dès qu’elle existe (créée dans Convert, ou auto-créée si l’utilisateur reçoit un mouvement sur une devise non encore présente), **même si `allocatedRlusd = 0`**.
- Frais d’activation: **paiement on-chain de 0.20 XCS** vers le wallet XCANNES (uniquement si la ligne n’existe pas déjà).

## 3) Flux produit (UX)

### 3.1 Connexion / session

- `connect()` crée un payload via `/xumm/connect`, puis polling `/xumm/check?uuid=...`.
- Le wallet connecté est mémorisé en `sessionStorage` (`xumm_wallet`).

Source: `Xcannes-/src/context/XummContext.js`

### 3.2 Refresh du solde

- `refreshBalance()` relance `/xumm/balance`.

### 3.3 Installation des trustlines XRPL (RLUSD / XCS)

Si l’utilisateur n’a pas encore de trustline XRPL pour `RLUSD` et/ou `XCS`, l’UI propose un bouton d’installation (TrustSet) dans l’écran de conversion/allocations.

- Transaction signée via Xumm: `TransactionType: "TrustSet"` + `LimitAmount`
- Issuers connus: `Xcannes-/src/utils/xrpl.js`

Source UI: `Xcannes-/src/components/wallet/modals/WalletDashboardSwapModal.jsx`

### 3.4 Activation XRPL (réserve XRP) + “premier achat” MoonPay

Si l’adresse XRPL n’est pas encore activée (compte absent du ledger), le backend le détecte via `account_info` (`actNotFound`) et le wallet doit recevoir un minimum de XRP.

Spécification produit actuelle:
- Activation wallet: **1 XRP** minimum.
- Au **premier achat MoonPay**, la commande peut inclure **RLUSD + XRP** :
  - **+1 XRP** pour l’activation,
  - **+0.1 XRP** pour permettre l’installation des trustlines `RLUSD` et `XCS` (réserve/fees).

Note: l’installation des trustlines reste une action XRPL (TrustSet) à signer via Xumm, mais le premier achat peut prévoir le XRP nécessaire.

### 3.5 Send (XRPL Payment)

Le “Send” construit un `txjson` XRPL `Payment` et le soumet à signature via Xumm:
- XRP: `Amount` en drops (string)
- Token/IOU: `Amount` = `{ currency, issuer, value }` (value normalisée)

Source: `Xcannes-/src/components/wallet/WalletDashboard.jsx` (`handleSendSubmit`)

### 3.6 Receive

- Affiche un QR code avec l’adresse XRPL.
- “Request payment” génère un payload `xcannes-payreq-v1` (base64) et un lien `/pay?req=...` (QR ou lien partageable).
- La page `/pay` ( `src/pages/pay.jsx`) décode la demande, lance la connexion Xumm puis signe un paiement RLUSD.

Source: `Xcannes-/src/components/wallet/modals/WalletDashboardReceiveModal.jsx`, `Xcannes-/src/pages/pay.jsx`

### 3.7 Convert (allocations RLUSD)

Deux modes:
- **Preview**: conversion locale (démo) via `demoLines` (pas de backend).
- **Connecté**: conversion d’allocations via `/wallet/convert` en envoyant `amountRlusd` + taux utilisés.

Les taux sont estimés côté frontend:
- `RLUSD`: 1
- `XRP`/`XCS`: ticker `${code}_RLUSD` via `xcannesApi.getTicker`
- Fiat: `xcannesApi.getFxEod("USD", code, 30)` puis inversion (approx RLUSD ≈ USD)

Source: `Xcannes-/src/components/wallet/hooks/useSwapConversion.js`

### 3.8 Fiat gateway (MoonPay)

Deux widgets embedded:
- Buy: `/api/moonpay/generate-buy-url`
- Sell: `/api/moonpay/generate-sell-url`

Source: `Xcannes-/src/components/wallet/modals/MoonPayBuyModal.jsx`, `Xcannes-/src/components/wallet/modals/MoonPaySellModal.jsx`

### 3.9 Statements

Deux modales:
- Global statement
- Currency statement

Note: une partie des données (movements/transactions/export) ressemble à un **placeholder** ou à une base UI (pas de chargement métier complet visible ici).

Source: `Xcannes-/src/components/wallet/modals/WalletDashboardStatementModals.jsx`, `Xcannes-/src/components/wallet/statements/*`

## 4) Mode “preview” (démo)

Quand `preview=true` et qu’aucun wallet n’est connecté:
- `effectiveWallet` devient une adresse factice.
- Le solde est simulé (XRP + `demoLines`).
- Certaines actions backend sont désactivées (pas d’adresse à envoyer au backend).
- Convert + Send FX peuvent être testés en **mode fictif** (spread appliqué, signatures simulées).
- Les lignes de devises sont **pré-remplies** avec des montants fictifs, et la page “Currency lines” permet d’ajouter/supprimer/modifier des lignes en démo (activation simulée, pas de paiement XCS).

Source: `Xcannes-/src/components/wallet/WalletDashboard.jsx`

## 5) Persistance locale (navigateur)

- Wallet connecté: `sessionStorage["xumm_wallet"]` (`Xcannes-/src/context/XummContext.js`)
- Labels wallet: `localStorage["xcannes_wallet_labels"]` (`Xcannes-/src/components/wallet/hooks/useWalletLabel.js`)
- Adresses sauvegardées: `localStorage["xcannes_saved_addresses"]` (`Xcannes-/src/components/wallet/hooks/useSavedAddresses.js`)

## 6) “Info & Fees” (spécification UX à confirmer)

La modale “Info & Fees” décrit (spécification produit actuelle):
- Frais d’activation: **0.20 XCS** par nouvelle ligne (paiement on-chain vers XCANNES)
- Frais XRPL (network fee)
- Le modèle de conversion FX reste basé sur un **spread** (prélevé en RLUSD).

Règles de spread (wallet):
- Le spread s’applique **uniquement quand il y a conversion FX** (ex: EUR↔GBP, RLUSD↔EUR, etc.).
- Spread “total” **par tier A/B/C** selon stabilité/exotique (bid/ask autour du mid, soit **±0.5 × spread_total**).
- Le spread est **prélevé en RLUSD** et envoyé vers un **wallet entreprise XCANNES** (on-chain).
- Wallet entreprise (spread RLUSD): `rGt44i8APV6KMLCCkuaJpY19RVkj2JhnHC`
- Convert (allocations internes): **1 signature Xumm** (paiement du spread), puis mise à jour des allocations côté backend.
- Transaction entre 2 wallets (send/pay): **2 signatures Xumm** (1 paiement spread vers XCANNES, puis 1 paiement vers le destinataire).
- Source de vérité pour la liste des paires FX “live” Pyth: `xcannesApi.getAllMarkets().pyth` (même logique que `useEodBasePairs`), sinon fallback FX EOD.

Source: `Xcannes-/src/components/wallet/modals/WalletInfoModal.jsx`

Important: ces règles sont **expliquées à l’utilisateur** mais ne sont pas (encore) visibles comme calcul appliqué dans les flows `Send`/`Convert` côté frontend.

## 7) Questions ouvertes (à valider)

1. “Trustlines” dans l’UI: doit-on rester sur un **concept applicatif** (`/wallet/lines`) ou implémenter de vraies **TrustSet XRPL** (avec issuers/limits) ?
2. “XCS lock”: comment est-il appliqué techniquement aujourd’hui (simple compta backend) et quelle est la roadmap vers un mécanisme on-chain (escrow) ?
3. Quels actifs sont officiellement supportés pour le wallet (XRP, RLUSD, XCS… + autres IOUs) et quelles sont les règles d’issuer (hardcodées vs marché backend) ?
4. Convert: doit-on afficher/figer une source de taux (Pyth/FX EOD/orderbook) et enregistrer `fxSource` côté backend ?
5. Payment Requests: quel format final (URI XRPL standard, payload Xumm, lien backend) et quel niveau de sécurité (amount/currency/issuer/memo) ?
6. Statements: quelle source de vérité (XRPL tx history + backend indexer) et quelles catégories (send/receive/convert/fees/moonpay) ?
7. Spread: veut-on un **spread unique 1%** pour toutes les paires FX, ou un spread **par tier (A/B/C)** selon stabilité/exotique (déjà présent dans `services/apiServer.js` via `WALLET_SPREAD_BPS_TIER_*`) ?
