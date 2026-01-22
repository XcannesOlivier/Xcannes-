# XCANNES Frontend - Dev notes

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-22

## i18n scripts

Les scripts i18n sont dans `Xcannes-/scripts/`.

Commandes courantes :
- `npm run i18n:audit`
- `npm run i18n:sample -- --start 0 --count 50 --only-problems`
- `npm run i18n:realign`
- `npm run i18n:codemod`
- `npm run i18n:sync`
- `npm run translations:status`

## Audit fichiers inutilises

Commande :
```
npx --yes madge@6.1.0 --extensions js,jsx --orphans src/pages src/components > docs/UNUSED_FILES_REPORT.md
```

Supprimer uniquement les fichiers listes comme orphans et qui ne sont pas des entrypoints Next (`src/pages/**`).

## Notes

- Les anciennes design notes non implementees ont ete retirees pour garder la doc concise.
- Artefacts ponctuels (JSON/HTML) : `docs/assets/`.
