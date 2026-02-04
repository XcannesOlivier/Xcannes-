#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Paiement & conversion en quelques secondes"
const pillar1SubtitleTranslations = {
  'ar': 'الدفع والتحويل في ثوانٍ قليلة',
  'bn': 'পেমেন্ট ও রূপান্তর কয়েক সেকেন্ডে',
  'da': 'Betaling & konvertering på få sekunder',
  'de': 'Zahlung & Umrechnung in Sekunden',
  'el': 'Πληρωμή & μετατροπή σε δευτερόλεπτα',
  'en': 'Payment & conversion in seconds',
  'es': 'Pago y conversión en segundos',
  'fi': 'Maksu & muunnos sekunneissa',
  'fr': 'Paiement & conversion en quelques secondes',
  'hi': 'भुगतान और रूपांतरण कुछ सेकंड में',
  'is': 'Greiðsla og breyting á sekúndum',
  'it': 'Pagamento & conversione in secondi',
  'ja': '支払いと変換は数秒で',
  'ko': '결제 및 전환이 몇 초 안에',
  'lb': 'Bezuelung & Ëmwandlung a Sekonnen',
  'nl': 'Betaling & conversie in seconden',
  'no': 'Betaling & konvertering på sekunder',
  'pl': 'Płatność i konwersja w sekundach',
  'pt': 'Pagamento & conversão em segundos',
  'rm': 'Pajament & conversiun en secundas',
  'ru': 'Платеж и конвертация за секунды',
  'sv': 'Betalning & konvertering på sekunder',
  'sw': 'Malipo na ubadilishaji kwa sekunde',
  'th': 'การชำระเงินและแปลงภายในวินาที',
  'tr': 'Ödeme ve dönüşüm saniyeler içinde',
  'ur': 'ادائیگی اور تبدیلی سیکنڈ میں',
  'vi': 'Thanh toán & chuyển đổi trong vài giây',
  'wuu': '支付和转换几秒内',
  'zh': '支付和转换在几秒内'
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
    const subtitleText = pillar1SubtitleTranslations[lang] || pillar1SubtitleTranslations['en'];
    
    // Mettre le texte dans caption (affiché comme subtitle dans le code)
    json.home_v2_hero_pillar_1_caption = subtitleText;
    // Vider stat pour qu'il n'affiche rien en gros
    json.home_v2_hero_pillar_1_stat = "";
    
    // Réécrire avec une indentation de 2 espaces
    fs.writeFileSync(filePath, JSON.stringify(json, null, 2) + '\n', 'utf8');
    
    console.log(`✅ Updated ${locale}: "${subtitleText}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${locales.length}`);
