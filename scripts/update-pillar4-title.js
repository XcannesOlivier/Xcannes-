#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Protégé contre la volatilité"
const pillar4TitleTranslations = {
  'ar': 'محمي من التقلبات',
  'bn': 'অস্থিরতার বিরুদ্ধে সুরক্ষিত',
  'da': 'Beskyttet mod volatilitet',
  'de': 'Geschützt vor Volatilität',
  'el': 'Προστατευμένο από τη μεταβλητότητα',
  'en': 'Protected against volatility',
  'es': 'Protegido contra la volatilidad',
  'fi': 'Suojattu volatiliteetilta',
  'fr': 'Protégé contre la volatilité',
  'hi': 'अस्थिरता से सुरक्षित',
  'is': 'Verndað gegn sveiflum',
  'it': 'Protetto dalla volatilità',
  'ja': 'ボラティリティから保護',
  'ko': '변동성으로부터 보호됨',
  'lb': 'Geschützt géint Volatilitéit',
  'nl': 'Beschermd tegen volatiliteit',
  'no': 'Beskyttet mot volatilitet',
  'pl': 'Chroniony przed zmiennością',
  'pt': 'Protegido contra a volatilidade',
  'rm': 'Protegì cunter volatilitad',
  'ru': 'Защищено от волатильности',
  'sv': 'Skyddat mot volatilitet',
  'sw': 'Inalindwa dhidi ya mabadiliko',
  'th': 'ป้องกันความผันผวน',
  'tr': 'Volatiliteye karşı korumalı',
  'ur': 'اتار چڑھاؤ سے محفوظ',
  'vi': 'Được bảo vệ khỏi biến động',
  'wuu': '防止波动',
  'zh': '防止波动'
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
    const titleText = pillar4TitleTranslations[lang] || pillar4TitleTranslations['en'];
    
    // Mettre à jour le titre du pillar 4
    json.home_v2_hero_pillar_4_title = titleText;
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}: "${titleText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
