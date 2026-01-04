# Frontend structure (`Xcannes-`)

Objectif: éviter un dossier `components` “fourre-tout” en regroupant par domaine.
Emplacement: `docs/architecture/`.

## Dossiers principaux

- `src/pages/` : routes Next.js
- `src/components/layout/` : layout global (header/footer/SEO)
- `src/components/wallet/` : tout ce qui concerne le wallet
  - `src/components/wallet/components/` : sous-composants du dashboard
  - `src/components/wallet/modals/` : modales (send/receive/swap/cash, MoonPay, info…)
  - `src/components/wallet/statements/` : relevés (global / devise)
  - `src/components/wallet/hooks/` : hooks utilisés par le wallet
- `src/components/ui/` : briques UI réutilisables et helpers (inputs, className helpers)
- `src/components/dex/` : DEX / trading UI
  - `src/components/dex/layout/` : layout DEX (sidebar, tabs, layout principal)
  - `src/components/dex/panels/` : panneaux DEX (orderbook, fees, news)
- `src/components/home/` : sections de la home
- `src/components/marketGlobal/` : ticker + mini-chart
- `src/components/xumm/` : connexion/QR Xumm
- `src/context/` : contexts React (Xumm, WS…)
- `src/lib/` : clients/services (API, websocket, config runtime…)
- `src/utils/` : helpers purs (market stats, XRPL helpers…)

## Règle simple

Si un composant sert à *une seule feature* (ex: wallet), il va dans le dossier de la feature.
S’il sert à plusieurs features (ex: input générique), il va dans `src/components/ui/`.

## Docs

- Doc globale frontend : `docs/` (index: `docs/README.md`)
- Doc “module” : autorisée à côté du code uniquement si le dossier est autonome (ex: `src/components/dex/XrplCandleChart/README.md` avec `package.json`)

## Imports

Alias recommandé : `@/` (configuré via `jsconfig.json`) pour éviter les chemins relatifs longs.
