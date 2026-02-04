const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');

// Traductions pour "Acheter & Vendre (+/−)"
const translations = {
  ar: "الشراء & البيع (+/−)",
  bn: "ক্রয় & বিক্রয় (+/−)",
  da: "Køb & Sælg (+/−)",
  de: "Kaufen & Verkaufen (+/−)",
  el: "Αγορά & Πώληση (+/−)",
  en: "Buy & Sell (+/−)",
  es: "Comprar & Vender (+/−)",
  fi: "Osta & Myy (+/−)",
  fr: "Acheter & Vendre (+/−)",
  hi: "खरीदें & बेचें (+/−)",
  is: "Kaupa & Selja (+/−)",
  it: "Acquista & Vendi (+/−)",
  ja: "購入 & 販売 (+/−)",
  ko: "구매 & 판매 (+/−)",
  lb: "Kafen & Verkafen (+/−)",
  nl: "Koop & Verkoop (+/−)",
  no: "Kjøp & Selg (+/−)",
  pl: "Kup & Sprzedaj (+/−)",
  pt: "Comprar & Vender (+/−)",
  rm: "Cumprar & Vender (+/−)",
  ru: "Покупка & Продажа (+/−)",
  sv: "Köp & Sälj (+/−)",
  sw: "Nunua & Uza (+/−)",
  th: "ซื้อ & ขาย (+/−)",
  tr: "Al & Sat (+/−)",
  ur: "خریدیں & فروخت کریں (+/−)",
  vi: "Mua & Bán (+/−)",
  wuu: "购买 & 出售 (+/−)",
  zh: "购买 & 出售 (+/−)"
};

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
    
    // Déterminer la langue de base à partir du code locale
    const baseLang = locale.split('-')[0];
    
    // Mettre à jour la clé
    if (translations[baseLang]) {
      commonJson["home_v2_essentials_4_title"] = translations[baseLang];
    } else if (translations[locale]) {
      commonJson["home_v2_essentials_4_title"] = translations[locale];
    } else {
      // Fallback vers l'anglais
      commonJson["home_v2_essentials_4_title"] = translations.en;
    }

    fs.writeFileSync(commonJsonPath, JSON.stringify(commonJson, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}: "${commonJson["home_v2_essentials_4_title"]}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${localeDirs.length}`);
