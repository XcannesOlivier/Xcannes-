#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Traductions pour "Payez, recevez et convertissez en toute simplicité ⟶ rapide, sécurisé, économique."
const subtitleTranslations = {
  'ar': 'ادفع واستقبل وحوّل بكل بساطة ⟶ سريع وآمن واقتصادي.',
  'bn': 'সহজভাবে পেমেন্ট করুন, গ্রহণ করুন এবং রূপান্তর করুন ⟶ দ্রুত, নিরাপদ, সাশ্রয়ী।',
  'da': 'Betal, modtag og konverter med lethed ⟶ hurtigt, sikkert, økonomisk.',
  'de': 'Zahlen, empfangen und umrechnen mit Leichtigkeit ⟶ schnell, sicher, wirtschaftlich.',
  'el': 'Πληρώστε, λάβετε και μετατρέψτε με απλότητα ⟶ γρήγορα, ασφαλώς, οικονομικά.',
  'en': 'Pay, receive, and convert with ease ⟶ fast, secure, low-cost.',
  'es': 'Paga, recibe y convierte con facilidad ⟶ rápido, seguro, económico.',
  'fi': 'Maksa, vastaanota ja muunna helposti ⟶ nopeasti, turvallisesti, edullisesti.',
  'fr': 'Payez, recevez et convertissez en toute simplicité ⟶ rapide, sécurisé, économique.',
  'hi': 'आसानी से भुगतान करें, प्राप्त करें और रूपांतरण करें ⟶ तेज़, सुरक्षित, किफायती।',
  'is': 'Borgaðu, taktu á móti og umbreyttu með auðveldum hætti ⟶ hratt, öruggt, hagkvæmt.',
  'it': 'Paga, ricevi e converti con facilità ⟶ veloce, sicuro, economico.',
  'ja': '簡単に支払い、受取り、変換 ⟶ 高速、安全、低コスト。',
  'ko': '간편하게 결제, 수령 및 전환 ⟶ 빠르고 안전하며 경제적입니다.',
  'lb': 'Bezuelen, empfänken an ëmwandelen mat Liichtegkeet ⟶ séier, sécher, ekonomesch.',
  'nl': 'Betaal, ontvang en converteer met gemak ⟶ snel, veilig, voordelig.',
  'no': 'Betal, motta og konverter med letthet ⟶ raskt, sikkert, rimelig.',
  'pl': 'Płać, otrzymuj i konwertuj z łatwością ⟶ szybko, bezpiecznie, ekonomicznie.',
  'pt': 'Pague, receba e converta com facilidade ⟶ rápido, seguro, econômico.',
  'rm': 'Pajar, retschaiver e converter cun facilitad ⟶ spert, segir, economic.',
  'ru': 'Платите, получайте и конвертируйте с легкостью ⟶ быстро, безопасно, экономично.',
  'sv': 'Betala, ta emot och konvertera med enkelhet ⟶ snabbt, säkert, ekonomiskt.',
  'sw': 'Lipa, pokea na badilisha kwa urahisi ⟶ haraka, salama, nafuu.',
  'th': 'จ่าย รับ และแปลงได้อย่างง่ายดาย ⟶ รวดเร็ว ปลอดภัย ประหยัด',
  'tr': 'Kolayca ödeyin, alın ve dönüştürün ⟶ hızlı, güvenli, ekonomik.',
  'ur': 'آسانی سے ادا کریں، وصول کریں اور تبدیل کریں ⟶ تیز، محفوظ، سستا۔',
  'vi': 'Thanh toán, nhận và chuyển đổi dễ dàng ⟶ nhanh chóng, an toàn, tiết kiệm.',
  'wuu': '轻松支付、接收和转换 ⟶ 快速、安全、经济。',
  'zh': '轻松支付、接收和转换 ⟶ 快速、安全、经济。'
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
    const subtitleText = subtitleTranslations[lang] || subtitleTranslations['en'];
    
    // Mettre à jour la clé subtitle
    json.home_v2_hero_subtitle = subtitleText;
    
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
