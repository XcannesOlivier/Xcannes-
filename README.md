# XCANNES Frontend (Next.js)

## Démarrage rapide

- Installer : `npm install`
- Dev : `npm run dev` (par défaut sur `http://localhost:2500`)
- Build : `npm run build`
- Start : `npm run start`

## Configuration

- Exemple : `.env.local.example`
- Fichier local : `.env.local`

## Documentation

- Index : `docs/README.md`
- Structure du code : `docs/architecture/FRONTEND_STRUCTURE.md`

## i18n (traductions)

- Audit global (clés manquantes / traductions identiques à EN) : `npm run i18n:audit`
- Revue par “lots” de clés (ex: 50 par 50) : `npm run i18n:sample -- --start 0 --count 50 --only-problems`
- Afficher quelques locales pour un lot : `npm run i18n:sample -- --start 0 --count 50 --show fr,es,ar-AE --format text`
