# 🌍 Scripts de gestion des traductions XCANNES

Ce dossier contient les outils pour gérer, synchroniser et vérifier les traductions du projet XCANNES.

## 📋 Scripts disponibles

### 1. `compare-translations.js`
Compare tous les fichiers `common.json` avec la version anglaise (référence complète).

```bash
node scripts/compare-translations.js
```

**Résultat:**
- Affiche un tableau récapitulatif de toutes les langues
- Montre le nombre de clés manquantes et obsolètes par langue
- Génère `translation-report.json` avec les détails complets

---

### 2. `sync-missing-keys.js`
Synchronise les clés manquantes dans les fichiers de traduction.

```bash
# Synchroniser toutes les langues
node scripts/sync-missing-keys.js all

# Synchroniser des langues spécifiques
node scripts/sync-missing-keys.js da-DK de es it nl pl-PL pt
```

**Fonctionnement:**
- Ajoute les clés manquantes avec le préfixe `[EN]` et la valeur anglaise
- Supprime les clés obsolètes (qui n'existent plus dans la version anglaise)
- Réordonne les clés selon l'ordre de la version anglaise

**⚠️ Important:** Les clés ajoutées sont marquées `[EN]` pour indiquer qu'elles nécessitent une traduction.

---

### 3. `find-untranslated.js`
Identifie toutes les clés qui n'ont pas encore été traduites (marquées `[EN]`).

```bash
node scripts/find-untranslated.js
```

**Résultat:**
- Liste toutes les langues avec des traductions manquantes
- Affiche le pourcentage de traduction par langue
- Génère `untranslated-report.json`

---

### 4. `generate-html-report.js`
Génère un rapport HTML visuel et interactif.

```bash
node scripts/generate-html-report.js
```

**Résultat:**
- Crée `translation-report.html`
- Ouvre ce fichier dans un navigateur pour voir:
  - Vue d'ensemble avec statistiques
  - Tableaux interactifs
  - Progression visuelle par langue
  - Liste détaillée des clés manquantes

---

### 5. `fix-json-advanced.js`
Répare les fichiers JSON cassés ou mal formatés.

```bash
node scripts/fix-json-advanced.js
```

**Fonctionnement:**
- Fusionne les objets JSON multiples
- Corrige les erreurs de syntaxe
- Reformate proprement le fichier

---

## 🔄 Workflow recommandé

### Étape 1: Vérifier l'état actuel
```bash
node scripts/compare-translations.js
```

### Étape 2: Synchroniser toutes les traductions
```bash
node scripts/sync-missing-keys.js all
```

### Étape 3: Générer le rapport visuel
```bash
node scripts/generate-html-report.js
# Ouvrir scripts/translation-report.html dans un navigateur
```

### Étape 4: Identifier les traductions à faire
```bash
node scripts/find-untranslated.js
```

### Étape 5: Traduire les clés marquées [EN]
Rechercher manuellement les clés avec `[EN]` dans chaque fichier et les traduire.

---

## 📊 État actuel des traductions

**Dernière mise à jour:** 2025-01-11

### ✅ Langues 100% complètes (structure)
- Toutes les 46 langues ont maintenant **917 clés** chacune
- Aucune clé manquante
- Aucune clé obsolète

### ⚠️ Langues avec traductions à faire

Les langues suivantes contiennent des clés marquées `[EN]` qui nécessitent une traduction:

| Langue | Clés à traduire | % à faire |
|--------|-----------------|-----------|
| hi (Hindi) | 430 | 46.9% |
| pl-PL (Polonais) | 287 | 31.3% |
| vi-VN (Vietnamien) | 269 | 29.3% |
| rm-CH, ru-RU, sv-SE, sw-KE, th-TH, tr-TR, ur-PK, wuu | 267 | 29.1% |
| da-DK, it, nl, pt | 195 | 21.3% |
| de (Allemand) | 194 | 21.2% |
| zh (Chinois) | 161 | 17.6% |
| es (Espagnol) | 131 | 14.3% |

### ✅ Langues 100% traduites

Les langues suivantes sont complètes et n'ont AUCUNE clé `[EN]`:
- **fr** (Français) ✨
- **ar** et toutes ses variantes (19 langues)
- **bn-BD** (Bengali)
- **el-GR** (Grec)
- **fi-FI** (Finnois)
- **is-IS** (Islandais)
- **ja** (Japonais)
- **ko** (Coréen)
- **lb** (Luxembourgeois)
- **no-NO** (Norvégien)

---

## 🛠️ Maintenance

### Ajouter une nouvelle clé de traduction

1. Ajouter la clé dans `public/locales/en/common.json`
2. Exécuter la synchronisation:
   ```bash
   node scripts/sync-missing-keys.js all
   ```
3. La clé sera ajoutée avec `[EN]` dans toutes les autres langues

### Supprimer une clé obsolète

1. Supprimer la clé de `public/locales/en/common.json`
2. Exécuter la synchronisation:
   ```bash
   node scripts/sync-missing-keys.js all
   ```
3. La clé sera automatiquement supprimée de toutes les langues

---

## 📝 Format des fichiers

Tous les fichiers `common.json` suivent le format:

```json
{
  "key_name": "Translated value",
  "another_key": "Another value",
  "untranslated_key": "[EN] English value to translate"
}
```

**Convention:**
- Les clés sont ordonnées alphabétiquement
- Les valeurs non traduites commencent par `[EN]`
- Les fichiers sont formatés avec 2 espaces d'indentation
- Pas de virgule après le dernier élément

---

## 🔍 Rechercher une traduction spécifique

```bash
# Rechercher une clé dans toutes les langues
grep -r "key_name" public/locales/*/common.json

# Compter les clés [EN] dans une langue
grep -c '"\[EN\]' public/locales/fr/common.json
```

---

## ⚙️ Configuration

Les scripts utilisent:
- **Référence:** `public/locales/en/common.json` (917 clés)
- **Langues:** Tous les dossiers dans `public/locales/` (46 langues)
- **Rapports:** Générés dans `scripts/`

---

## 🐛 Résolution de problèmes

### Erreur "Unexpected non-whitespace character"
```bash
node scripts/fix-json-advanced.js
```

### Fichier manquant
```bash
node scripts/sync-missing-keys.js <langue-manquante>
```

### Clés désynchronisées
```bash
node scripts/sync-missing-keys.js all
```

---

## 📞 Support

Pour toute question sur les traductions, contactez l'équipe de développement XCANNES.

---

**Dernière révision:** 2025-01-11
