# XCANNES — Frontend (Next.js)

Interface web du wallet **XCANNES** : site public + UI wallet (dashboard, send/receive/convert, ramps) + endpoints Next.js côté serveur (`/api/*`).

## Démarrage rapide

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Ouvrir `http://localhost:2500`.

## Prérequis

- Node.js `>= 18`
- Un backend XCANNES disponible (repo : `XcannesOlivier/Backend-xcannes`)


## Variables d’environnement

Le template est `./.env.local.example` (ne pas committer `./.env.local`).

### Minimum (dev)

- `NEXT_PUBLIC_XCANNES_API_URL` (ex: `http://localhost:3001`)
- `NEXT_PUBLIC_XCANNES_WS_URL` (ex: `ws://localhost:3002`)
- `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_RETURN_URL_WEB` (ex: `http://localhost:2500`)

### Services (server-side uniquement)

Ces variables **ne doivent pas** être préfixées par `NEXT_PUBLIC_` :

- Contact form : `RECAPTCHA_SECRET`, `OVH_EMAIL_PASSWORD`, optionnel `CONTACT_EMAIL`, `SMTP_HOST`, `SMTP_PORT` (`src/pages/api/contact.js`)
- SimpleSwap : `SIMPLESWAP_API_KEY`, optionnel `SIMPLESWAP_API_BASE_URL` (`src/lib/simpleswapServer.js`)

## Scripts utiles

- Dev : `npm run dev` (port `2500`)
- Build : `npm run build`
- Prod : `npm run start` (port `2500`)
- Lint : `npm run lint`
- Tests : `npm test`
- Format : `npm run format` / `npm run format:check`

### i18n / traductions

Les locales sont dans `public/locales/`.

- `npm run i18n:sync` : synchronise les clés entre locales
- `npm run i18n:audit` : détecte incohérences (clés manquantes, etc.)
- `npm run translations:report` : génère un rapport HTML

## Structure (repères)

- `src/pages/` : pages Next.js (+ API routes sous `src/pages/api/`)
- `src/components/` : UI (dont wallet)
- `src/lib/` : clients server-side (ex: SimpleSwap)
- `public/wallet-app/` : assets de la PWA statique “wallet-app” (servie côté backend sous `/wallet-app/*`)

## Sécurité

- Ne jamais committer `.env.local` (seul `.env.local.example` doit être versionné).
- Ne jamais exposer de secrets côté client : tout ce qui est secret reste sans `NEXT_PUBLIC_` et n’est lu que côté serveur (API routes / SSR).

