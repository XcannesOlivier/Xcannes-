# 🌍 Scripts de gestion des traductions XCANNES

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-13

Ce dossier contient des scripts pour auditer et harmoniser les traductions (`public/locales/*/common.json`).

## Scripts disponibles (présents dans ce repo)

### 1) `i18n-audit.cjs`
Audit i18n côté code (clés utilisées, textes non i18n).

```bash
npm run i18n:audit
```

### 2) `i18n-sample.cjs`
Revue par lots de clés pour contrôle qualité.

```bash
npm run i18n:sample -- --start 0 --count 50 --only-problems
```

### 3) `i18n-realign-keys.cjs`
Réordonne les clés selon l'anglais (sans supprimer les clés locales).

```bash
npm run i18n:realign
```

### 4) `i18n-codemod.cjs`
Aide à migrer des chaînes vers des clés i18n (relecture manuelle requise).

```bash
npm run i18n:codemod
```

### 5) `sync-locales.cjs`
Synchronise les locales avec EN (remplit les clés manquantes avec la valeur EN).

```bash
npm run i18n:sync
# dry-run
npm run i18n:sync -- --dry-run
```

### 6) `sync-placeholder-text.cjs`
Aligne les placeholders d'exemple sur EN.

```bash
node scripts/sync-placeholder-text.cjs --dry-run
```

### 7) `status.js`
Rapport rapide sur l'état des traductions.

```bash
npm run translations:status
```

### 8) `generate-html-report.js`
Génère un rapport HTML à partir de `scripts/translation-report.json`.

```bash
node scripts/generate-html-report.js
```

> Note: `translation-report.json` n'est pas généré par un script présent dans ce repo.

## Commandes npm utiles (package.json)

- `npm run i18n:audit`
- `npm run i18n:sample -- --start 0 --count 50 --only-problems`
- `npm run i18n:realign`
- `npm run i18n:codemod`
- `npm run i18n:sync`
- `npm run translations:status`
