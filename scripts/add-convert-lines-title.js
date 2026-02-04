#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Conversion & Lignes de comptes"
const convertLinesTitleTranslations = {
  'ar': 'التحويل وخطوط الحسابات',
  'bn': 'রূপান্তর এবং অ্যাকাউন্ট লাইন',
  'da': 'Konvertering & Kontolinjer',
  'de': 'Umrechnung & Kontozeilen',
  'el': 'Μετατροπή & Γραμμές λογαριασμών',
  'en': 'Conversion & Account Lines',
  'es': 'Conversión y líneas de cuenta',
  'fi': 'Muunnos & Tilit',
  'fr': 'Conversion & Lignes de comptes',
  'hi': 'रूपांतरण और खाता लाइनें',
  'is': 'Breyting & Reikningslínur',
  'it': 'Conversione & Linee conto',
  'ja': '変換とアカウントライン',
  'ko': '전환 및 계정 라인',
  'lb': 'Ëmwandlung & Kontolinnen',
  'nl': 'Conversie & Accountlijnen',
  'no': 'Konvertering & Kontolinjer',
  'pl': 'Konwersja i linie konta',
  'pt': 'Conversão e linhas de conta',
  'rm': 'Conversiun & Lingias da conto',
  'ru': 'Конвертация и счета',
  'sv': 'Konvertering & Kontolinjer',
  'sw': 'Ubadilishaji na Mistari ya Akaunti',
  'th': 'การแปลงและบรรทัดบัญชี',
  'tr': 'Dönüşüm ve Hesap Hatları',
  'ur': 'تبدیلی اور اکاؤنٹ لائنیں',
  'vi': 'Chuyển đổi & Dòng tài khoản',
  'wuu': '转换和账户线',
  'zh': '转换和账户线'
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
    const titleText = convertLinesTitleTranslations[lang] || convertLinesTitleTranslations['en'];
    
    // Ajouter la nouvelle clé
    json.home_v2_essentials_convert_lines_title = titleText;
    
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
