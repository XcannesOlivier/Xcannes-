#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Stable comme le dollar. Accessible dans n'importe quelle devise."
const pillar4DescTranslations = {
  'ar': 'مستقر مثل الدولار. متاح بأي عملة.',
  'bn': 'ডলারের মতো স্থিতিশীল। যেকোনো মুদ্রায় অ্যাক্সেসযোগ্য।',
  'da': 'Stabil som dollaren. Tilgængelig i enhver valuta.',
  'de': 'Stabil wie der Dollar. In jeder Währung zugänglich.',
  'el': 'Σταθερό όπως το δολάριο. Προσβάσιμο σε οποιοδήποτε νόμισμα.',
  'en': 'Stable as the dollar. Accessible in any currency.',
  'es': 'Estable como el dólar. Accesible en cualquier moneda.',
  'fi': 'Vakaa kuin dollari. Käytettävissä missä tahansa valuutassa.',
  'fr': 'Stable comme le dollar. Accessible dans n\'importe quelle devise.',
  'hi': 'डॉलर की तरह स्थिर। किसी भी मुद्रा में सुलभ।',
  'is': 'Stöðugt eins og dollarinn. Aðgengilegt í öllum gjaldmiðlum.',
  'it': 'Stabile come il dollaro. Accessibile in qualsiasi valuta.',
  'ja': 'ドルのように安定。あらゆる通貨でアクセス可能。',
  'ko': '달러처럼 안정적입니다. 모든 통화로 액세스 가능합니다.',
  'lb': 'Stabil wéi den Dollar. Zougänglech an all Währung.',
  'nl': 'Stabiel als de dollar. Toegankelijk in elke valuta.',
  'no': 'Stabil som dollaren. Tilgjengelig i enhver valuta.',
  'pl': 'Stabilny jak dolar. Dostępny w dowolnej walucie.',
  'pt': 'Estável como o dólar. Acessível em qualquer moeda.',
  'rm': 'Stabil sco il dollar. Accessibel en mintga munaida.',
  'ru': 'Стабилен как доллар. Доступен в любой валюте.',
  'sv': 'Stabil som dollarn. Tillgänglig i vilken valuta som helst.',
  'sw': 'Imara kama dola. Inaweza kupatikana katika sarafu yoyote.',
  'th': 'มั่นคงเหมือนดอลลาร์ เข้าถึงได้ในสกุลเงินใดก็ได้',
  'tr': 'Dolar kadar istikrarlı. Herhangi bir para biriminde erişilebilir.',
  'ur': 'ڈالر کی طرح مستحکم۔ کسی بھی کرنسی میں قابل رسائی۔',
  'vi': 'Ổn định như đô la. Có thể truy cập trong bất kỳ loại tiền tệ nào.',
  'wuu': '像美元一样稳定。可在任何货币中访问。',
  'zh': '像美元一样稳定。可在任何货币中访问。'
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
    const descText = pillar4DescTranslations[lang] || pillar4DescTranslations['en'];
    
    // Mettre à jour la description du pillar 4
    json.home_v2_hero_pillar_4_desc = descText;
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}: "${descText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
