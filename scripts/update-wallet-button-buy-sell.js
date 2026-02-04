const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');

// "+/−" est universel pour les boutons du wallet
const buttonLabel = "+/−";

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
    
    // Mettre à jour les clés des boutons du wallet
    commonJson["ui_buy_sell_ec2ec12982"] = buttonLabel;
    commonJson["ui_buy_sell_fce5963198"] = buttonLabel;

    fs.writeFileSync(commonJsonPath, JSON.stringify(commonJson, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}: "${buttonLabel}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${localeDirs.length}`);
