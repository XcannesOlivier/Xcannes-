const fs = require('fs');
const path = require('path');

const localesDir = path.join(__dirname, '..', 'public', 'locales');

// Traductions pour les titres avec & au lieu de /
const translations = {
  // Payer & Envoyer
  "home_v2_essentials_2_title": {
    ar: "الدفع & الإرسال",
    bn: "পরিশোধ & প্রেরণ",
    da: "Betal & Send",
    de: "Zahlen & Senden",
    el: "Πληρωμή & Αποστολή",
    en: "Pay & Send",
    es: "Pagar & Enviar",
    fi: "Maksa & Lähetä",
    fr: "Payer & Envoyer",
    hi: "भुगतान & भेजें",
    is: "Borga & Senda",
    it: "Paga & Invia",
    ja: "支払い & 送信",
    ko: "지불 & 전송",
    lb: "Bezuelen & Schécken",
    nl: "Betaal & Verstuur",
    no: "Betal & Send",
    pl: "Płać & Wyślij",
    pt: "Pagar & Enviar",
    rm: "Pajar & Trametter",
    ru: "Оплата & Отправка",
    sv: "Betala & Skicka",
    sw: "Lipa & Tuma",
    th: "จ่าย & ส่ง",
    tr: "Öde & Gönder",
    ur: "ادائیگی & بھیجیں",
    vi: "Thanh toán & Gửi",
    wuu: "付款 & 发送",
    zh: "付款 & 发送"
  },
  // Recevoir & Demander
  "home_v2_essentials_5_title": {
    ar: "الاستلام & الطلب",
    bn: "গ্রহণ & অনুরোধ",
    da: "Modtag & Anmod",
    de: "Empfangen & Anfordern",
    el: "Λήψη & Αίτηση",
    en: "Receive & Request",
    es: "Recibir & Solicitar",
    fi: "Vastaanota & Pyydä",
    fr: "Recevoir & Demander",
    hi: "प्राप्त करें & अनुरोध करें",
    is: "Móttaka & Biðja",
    it: "Ricevi & Richiedi",
    ja: "受信 & リクエスト",
    ko: "수신 & 요청",
    lb: "Empfänken & Ufroe",
    nl: "Ontvang & Aanvraag",
    no: "Motta & Be om",
    pl: "Odbierz & Poproś",
    pt: "Receber & Solicitar",
    rm: "Retschaiver & Dumandar",
    ru: "Получение & Запрос",
    sv: "Ta emot & Begär",
    sw: "Pokea & Omba",
    th: "รับ & ขอ",
    tr: "Al & Talep et",
    ur: "وصول & درخواست",
    vi: "Nhận & Yêu cầu",
    wuu: "接收 & 请求",
    zh: "接收 & 请求"
  },
  // Acheter & Vendre
  "home_v2_essentials_4_title": {
    ar: "الشراء & البيع",
    bn: "ক্রয় & বিক্রয়",
    da: "Køb & Sælg",
    de: "Kaufen & Verkaufen",
    el: "Αγορά & Πώληση",
    en: "Buy & Sell",
    es: "Comprar & Vender",
    fi: "Osta & Myy",
    fr: "Acheter & Vendre",
    hi: "खरीदें & बेचें",
    is: "Kaupa & Selja",
    it: "Acquista & Vendi",
    ja: "購入 & 販売",
    ko: "구매 & 판매",
    lb: "Kafen & Verkafen",
    nl: "Koop & Verkoop",
    no: "Kjøp & Selg",
    pl: "Kup & Sprzedaj",
    pt: "Comprar & Vender",
    rm: "Cumprar & Vender",
    ru: "Покупка & Продажа",
    sv: "Köp & Sälj",
    sw: "Nunua & Uza",
    th: "ซื้อ & ขาย",
    tr: "Al & Sat",
    ur: "خریدیں & فروخت کریں",
    vi: "Mua & Bán",
    wuu: "购买 & 出售",
    zh: "购买 & 出售"
  }
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
    
    // Mettre à jour les clés
    Object.keys(translations).forEach(key => {
      if (translations[key][baseLang]) {
        commonJson[key] = translations[key][baseLang];
      } else if (translations[key][locale]) {
        commonJson[key] = translations[key][locale];
      } else {
        // Fallback vers l'anglais si la langue n'est pas trouvée
        commonJson[key] = translations[key].en;
      }
    });

    fs.writeFileSync(commonJsonPath, JSON.stringify(commonJson, null, 2) + '\n', 'utf-8');
    console.log(`✅ Updated ${locale}: "${commonJson["home_v2_essentials_2_title"]}"`);
    updated++;
  } catch (error) {
    console.error(`❌ Error updating ${locale}:`, error.message);
    skipped++;
  }
});

console.log(`\n✅ Updated: ${updated}`);
console.log(`⚠️  Skipped: ${skipped}`);
console.log(`📊 Total: ${localeDirs.length}`);
