#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Votre argent ? Stable. Partout. Toujours."
const sloganTranslations = {
  'ar': 'أموالك؟ مستقرة. في كل مكان. دائماً.',
  'bn': 'আপনার অর্থ? স্থিতিশীল। সর্বত্র। সবসময়।',
  'da': 'Dine penge? Stabile. Overalt. Altid.',
  'de': 'Ihr Geld? Stabil. Überall. Immer.',
  'el': 'Τα χρήματά σας; Σταθερά. Παντού. Πάντα.',
  'en': 'Your money? Stable. Everywhere. Always.',
  'es': 'Tu dinero? Estable. En todas partes. Siempre.',
  'fi': 'Rahasi? Vakaa. Kaikkialla. Aina.',
  'fr': 'Votre argent ? Stable. Partout. Toujours.',
  'hi': 'आपका पैसा? स्थिर। हर जगह। हमेशा।',
  'is': 'Peningarnir þínir? Stöðugir. Alls staðar. Alltaf.',
  'it': 'Il tuo denaro? Stabile. Ovunque. Sempre.',
  'ja': 'あなたのお金？安定。どこでも。いつでも。',
  'ko': '귀하의 자금? 안정적. 어디서나. 항상.',
  'lb': 'Däi Suen? Stabil. Iwwerall. Ëmmer.',
  'nl': 'Jouw geld? Stabiel. Overal. Altijd.',
  'no': 'Pengene dine? Stabile. Overalt. Alltid.',
  'pl': 'Twoje pieniądze? Stabilne. Wszędzie. Zawsze.',
  'pt': 'Seu dinheiro? Estável. Em qualquer lugar. Sempre.',
  'rm': 'Tes daners? Stabels. Dapertut. Adina.',
  'ru': 'Ваши деньги? Стабильны. Везде. Всегда.',
  'sv': 'Dina pengar? Stabila. Överallt. Alltid.',
  'sw': 'Pesa zako? Imara. Kila mahali. Daima.',
  'th': 'เงินของคุณ? มั่นคง ทุกที่ เสมอ',
  'tr': 'Paranız? İstikrarlı. Her yerde. Her zaman.',
  'ur': 'آپ کی رقم؟ مستحکم۔ ہر جگہ۔ ہمیشہ۔',
  'vi': 'Tiền của bạn? Ổn định. Mọi nơi. Luôn luôn.',
  'wuu': '您的资金？稳定。到处。总是。',
  'zh': '您的资金？稳定。到处。总是。'
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
    const sloganText = sloganTranslations[lang] || sloganTranslations['en'];
    
    // Mettre à jour le slogan
    json.home_v2_demo_slogan = sloganText;
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}: "${sloganText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
