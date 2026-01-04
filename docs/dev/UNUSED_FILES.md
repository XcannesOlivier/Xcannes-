# Audit: unused files

Ce fichier sert de point de départ pour la “chasse aux fichiers morts”.

Lancez l’audit :

`node scripts/audit-unused-files.mjs > docs/dev/UNUSED_FILES_REPORT.md`

Ensuite, on supprime (ou on déplace) uniquement les fichiers listés comme **(0 import)** et qui ne sont pas des entrypoints Next (`src/pages/**`).
