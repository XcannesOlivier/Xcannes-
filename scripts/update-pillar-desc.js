#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Votre argent dans 160+ devises."
const heroTitleTranslations = {
  'ar': 'أموالك في 160+ عملة.',
  'bn': '160+ টি মুদ্রায় আপনার অর্থ।',
  'da': 'Dine penge i 160+ valutaer.',
  'de': 'Ihr Geld in 160+ Währungen.',
  'el': 'Τα χρήματά σας σε 160+ νομίσματα.',
  'en': 'Your money in 160+ currencies.',
  'es': 'Tu dinero en 160+ monedas.',
  'fi': 'Rahasi 160+ valuutassa.',
  'fr': 'Votre argent dans 160+ devises.',
  'hi': '160+ मुद्राओं में आपका पैसा।',
  'is': 'Peningarnir þínir í 160+ gjaldmiðlum.',
  'it': 'Il tuo denaro in 160+ valute.',
  'ja': '160+通貨であなたのお金。',
  'ko': '160+개 통화로 된 귀하의 자금.',
  'lb': 'Däi Suen an 160+ Wärungen.',
  'nl': 'Jouw geld in 160+ valuta.',
  'no': 'Pengene dine i 160+ valutaer.',
  'pl': 'Twoje pieniądze w 160+ walutach.',
  'pt': 'Seu dinheiro em 160+ moedas.',
  'rm': 'Tes daners en 160+ munaidas.',
  'ru': 'Ваши деньги в 160+ валютах.',
  'sv': 'Dina pengar i 160+ valutor.',
  'sw': 'Pesa zako katika sarafu 160+.',
  'th': 'เงินของคุณใน 160+ สกุลเงิน',
  'tr': 'Paranız 160+ para biriminde.',
  'ur': '160+ کرنسیوں میں آپ کی رقم۔',
  'vi': 'Tiền của bạn trong 160+ loại tiền tệ.',
  'wuu': '160+种货币中的您的资金。',
  'zh': '您的资金在160+种货币中。'
};

// Traductions pour "Protégé contre la volatilité."
const heroEmphasisTranslations = {
  'ar': 'محمي من التقلبات.',
  'bn': 'অস্থিরতার বিরুদ্ধে সুরক্ষিত।',
  'da': 'Beskyttet mod volatilitet.',
  'de': 'Geschützt vor Volatilität.',
  'el': 'Προστατευμένο από τη μεταβλητότητα.',
  'en': 'Protected against volatility.',
  'es': 'Protegido contra la volatilidad.',
  'fi': 'Suojattu volatiliteetilta.',
  'fr': 'Protégé contre la volatilité.',
  'hi': 'अस्थिरता से सुरक्षित।',
  'is': 'Verndað gegn sveiflum.',
  'it': 'Protetto dalla volatilità.',
  'ja': 'ボラティリティから保護。',
  'ko': '변동성으로부터 보호됩니다.',
  'lb': 'Geschützt géint Volatilitéit.',
  'nl': 'Beschermd tegen volatiliteit.',
  'no': 'Beskyttet mot volatilitet.',
  'pl': 'Chroniony przed zmiennością.',
  'pt': 'Protegido contra a volatilidade.',
  'rm': 'Protegì cunter volatilitad.',
  'ru': 'Защищено от волатильности.',
  'sv': 'Skyddat mot volatilitet.',
  'sw': 'Inalindwa dhidi ya mabadiliko.',
  'th': 'ป้องกันความผันผวน',
  'tr': 'Volatiliteye karşı korumalı.',
  'ur': 'اتار چڑھاؤ سے محفوظ۔',
  'vi': 'Được bảo vệ khỏi biến động.',
  'wuu': '防止波动。',
  'zh': '防止波动。'
};

// Mapping des codes de langue (locale-code -> base language)
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
    const titleText = heroTitleTranslations[lang] || heroTitleTranslations['en'];
    const emphasisText = heroEmphasisTranslations[lang] || heroEmphasisTranslations['en'];
    
    // Mettre à jour les deux clés
    json.home_v2_hero_title = titleText;
    json.home_v2_hero_title_emphasis = emphasisText;
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}:`);
    console.log(`   Title: "${titleText}"`);
    console.log(`   Emphasis: "${emphasisText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
