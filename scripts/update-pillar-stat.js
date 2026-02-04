#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "en quelques secondes" (stat)
const pillar1StatTranslations = {
  'ar': 'في ثوانٍ',
  'bn': 'সেকেন্ডে',
  'da': 'på sekunder',
  'de': 'in Sekunden',
  'el': 'σε δευτερόλεπτα',
  'en': 'in seconds',
  'es': 'en segundos',
  'fi': 'sekunneissa',
  'fr': 'en quelques secondes',
  'hi': 'सेकंड में',
  'is': 'á sekúndum',
  'it': 'in secondi',
  'ja': '数秒で',
  'ko': '몇 초 안에',
  'lb': 'a Sekonnen',
  'nl': 'in seconden',
  'no': 'på sekunder',
  'pl': 'w sekundach',
  'pt': 'em segundos',
  'rm': 'en secundas',
  'ru': 'за секунды',
  'sv': 'på sekunder',
  'sw': 'kwa sekunde',
  'th': 'ภายในไม่กี่วินาที',
  'tr': 'saniyeler içinde',
  'ur': 'سیکنڈ میں',
  'vi': 'trong vài giây',
  'wuu': '几秒内',
  'zh': '几秒内'
};

const localeToLang = (locale) => {
  const base = locale.split('-')[0];
  return base;
};

const localesDir = path.join(__dirname, '..', 'public', 'locales');
const locales = fs.readdirSync(localesDir).filter(f => 
  fs.statSync(path.join(localesDir, f)).isDirectory()
);

console.log(`Found ${locales.length} locales to update...`);

let updated = 0;
let skipped = 0;

locales.forEach(locale => {
  const filePath = path.join(localesDir, locale, 'common.json');
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  Skipped ${locale}: file not found`);
    skipped++;
    return;
  }

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);
    
    const lang = localeToLang(locale);
    const statText = pillar1StatTranslations[lang] || pillar1StatTranslations['en'];
    
    // Mettre à jour ou ajouter la clé
    json.home_v2_hero_pillar_1_stat = statText;
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}: "${statText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
