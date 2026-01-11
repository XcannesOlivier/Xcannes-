#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');
const englishFile = path.join(localesDir, 'en', 'common.json');

// Lire le fichier anglais
const englishContent = JSON.parse(fs.readFileSync(englishFile, 'utf8'));
const totalKeys = Object.keys(englishContent).length;

console.log('\n╔═══════════════════════════════════════════════════════════╗');
console.log('║        📊 RAPPORT RAPIDE - TRADUCTIONS XCANNES          ║');
console.log('╚═══════════════════════════════════════════════════════════╝\n');

// Lire tous les dossiers
const languageDirs = fs.readdirSync(localesDir).filter(dir => {
  const fullPath = path.join(localesDir, dir);
  return fs.statSync(fullPath).isDirectory() && dir !== 'en';
}).sort();

let fullyTranslated = 0;
let fullyComplete = 0;
let partiallyTranslated = 0;
let totalUntranslated = 0;

for (const langDir of languageDirs) {
  const langFile = path.join(localesDir, langDir, 'common.json');
  
  if (!fs.existsSync(langFile)) continue;
  
  try {
    const langContent = JSON.parse(fs.readFileSync(langFile, 'utf8'));
    const keys = Object.keys(langContent);
    
    // Vérifier si structure complète
    if (keys.length === totalKeys) {
      fullyComplete++;
      
      // Vérifier si traduction complète (pas de [EN])
      let hasUntranslated = false;
      let untranslatedCount = 0;
      for (const value of Object.values(langContent)) {
        if (typeof value === 'string' && value.startsWith('[EN]')) {
          hasUntranslated = true;
          untranslatedCount++;
        }
      }
      
      if (!hasUntranslated) {
        fullyTranslated++;
      } else {
        partiallyTranslated++;
        totalUntranslated += untranslatedCount;
      }
    }
  } catch (e) {
    // Ignorer les erreurs
  }
}

console.log('📈 STATISTIQUES GLOBALES\n');
console.log(`   Langues totales:           ${languageDirs.length}`);
console.log(`   Clés de référence (EN):    ${totalKeys}`);
console.log('');
console.log(`   ✅ Structure complète:     ${fullyComplete}/${languageDirs.length} (${((fullyComplete/languageDirs.length)*100).toFixed(1)}%)`);
console.log(`   🎯 100% traduites:         ${fullyTranslated}/${languageDirs.length} (${((fullyTranslated/languageDirs.length)*100).toFixed(1)}%)`);
console.log(`   ⚠️  Partiellement:         ${partiallyTranslated}/${languageDirs.length} (${((partiallyTranslated/languageDirs.length)*100).toFixed(1)}%)`);
console.log('');
console.log(`   📝 Total de clés [EN]:     ${totalUntranslated}`);
console.log(`   📊 Moyenne par langue:     ${partiallyTranslated > 0 ? Math.round(totalUntranslated/partiallyTranslated) : 0} clés\n`);

console.log('─'.repeat(61));
console.log('\n💡 PROCHAINES ÉTAPES\n');

if (fullyComplete < languageDirs.length) {
  console.log('   1. Synchroniser les structures:');
  console.log('      node scripts/sync-missing-keys.js all\n');
}

if (partiallyTranslated > 0) {
  console.log('   2. Voir les traductions manquantes:');
  console.log('      node scripts/find-untranslated.js\n');
  console.log('   3. Générer le rapport HTML:');
  console.log('      node scripts/generate-html-report.js\n');
}

if (fullyTranslated === languageDirs.length) {
  console.log('   🎉 FÉLICITATIONS ! Toutes les traductions sont complètes!\n');
}

console.log('─'.repeat(61));
console.log('\n📖 Pour plus d\'infos: voir scripts/README.md\n');
