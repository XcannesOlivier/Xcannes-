# Audit: unused files

Ce fichier sert de point de départ pour la “chasse aux fichiers morts”.

> **Status:** ACTIVE  
> **Last Reviewed:** 2026-01-13

Lancez l’audit (Madge) :

`npx --yes madge@6.1.0 --extensions js,jsx --orphans src/pages src/components > docs/dev/UNUSED_FILES_REPORT.md`

Ensuite, on supprime (ou on déplace) uniquement les fichiers listés comme **(0 import)** et qui ne sont pas des entrypoints Next (`src/pages/**`).
