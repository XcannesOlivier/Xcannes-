const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');

// "+/−" est universel dans toutes les langues (symboles mathématiques)
const newTitle = "+/−";

// Obtenir tous les dossiers de locales
const localeDirs = fs.readdirSync(localesDir).filter(dir => {
  const fullPath = path.join(localesDir, dir);
  return fs.statSync(fullPath).isDirectory();
});

console.log(`Found ${localeDirs.length} locales to update...`);

let updated = 0;
let skipped = 0;

localeDirs.forEach(locale => {
  const commonJsonPath = path.join(localesDir, locale, 'common.json');
  
  if (!fs.existsSync(commonJsonPath)) {
    console.log(`⚠️  Skipping ${locale}: common.json not found`);
    skipped++;
    return;
  }

  try {
    const commonJson = JSON.parse(fs.readFileSync(commonJsonPath, 'utf-8'));
    
    // Mettre à jour la clé
    commonJson["home_v2_essentials_4_title"] = newTitle;

    fs.writeFileSync(commonJsonPath, JSON.stringify(commonJson, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}: "${newTitle}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${localeDirs.length}`);
