#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "../public/locales");

// Mapping de traductions: wallet → compte
const translations = {
  en: "Multi-currency account",
  fr: "Compte multi-devises",
  es: "Cuenta multidivisa",
  de: "Multiwährungs-Konto",
  it: "Conto multivaluta",
  pt: "Conta multi-moeda",
  "pt-BR": "Conta multi-moeda",
  nl: "Multi-valuta account",
  pl: "Konto wielowalutowe",
  ru: "Мультивалютный счет",
  "ru-RU": "Мультивалютный счет",
  ja: "マルチ通貨口座",
  ko: "다중 통화 계정",
  zh: "多币种账户",
  "zh-CN": "多币种账户",
  "zh-TW": "多幣種帳戶",
  wuu: "多币种账户",
  ar: "حساب متعدد العملات",
  "ar-AE": "حساب متعدد العملات",
  "ar-BH": "حساب متعدد العملات",
  "ar-DZ": "حساب متعدد العملات",
  "ar-EG": "حساب متعدد العملات",
  "ar-IQ": "حساب متعدد العملات",
  "ar-JO": "حساب متعدد العملات",
  "ar-KW": "حساب متعدد العملات",
  "ar-LB": "حساب متعدد العملات",
  "ar-LY": "حساب متعدد العملات",
  "ar-MR": "حساب متعدد العملات",
  "ar-OM": "حساب متعدد العملات",
  "ar-QA": "حساب متعدد العملات",
  "ar-SD": "حساب متعدد العملات",
  "ar-SY": "حساب متعدد العملات",
  "ar-TN": "حساب متعدد العملات",
  "ar-YE": "حساب متعدد العملات",
  tr: "Çok para birimli hesap",
  "tr-TR": "Çok para birimli hesap",
  hi: "बहु-मुद्रा खाता",
  bn: "বহু-মুদ্রা অ্যাকাউন্ট",
  "bn-BD": "বহু-মুদ্রা অ্যাকাউন্ট",
  th: "บัญชีหลายสกุลเงิน",
  vi: "Tài khoản đa tiền tệ",
  fi: "Monivaluuttatili",
  sv: "Flervälutakonto",
  da: "Multivalutakonto",
  no: "Flervälutakonto",
  is: "Fjölmyntreikningur",
  el: "Λογαριασμός πολλαπλών νομισμάτων",
  rm: "Conto multivaluta",
  lb: "Mëhrwährungskonto",
  sw: "Akaunti ya sarafu nyingi",
  ur: "کثیر کرنسی اکاؤنٹ",
};

const KEY = "ui_global_usd_wallet_202f7e48be";

function updateTranslation(localeCode) {
  const filePath = path.join(localesDir, localeCode, "common.json");

  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  File not found: ${filePath}`);
    return;
  }

  try {
    const content = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(content);

    if (!data[KEY]) {
      console.log(`⚠️  Key not found in ${localeCode}/common.json`);
      return;
    }

    const newValue = translations[localeCode];
    if (!newValue) {
      console.log(`⚠️  No translation defined for locale: ${localeCode}`);
      return;
    }

    data[KEY] = newValue;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`✅ Updated ${localeCode}: "${newValue}"`);
  } catch (error) {
    console.error(`❌ Error updating ${localeCode}:`, error.message);
  }
}

// Get all locale directories
const localeDirs = fs
  .readdirSync(localesDir)
  .filter((dir) => {
    const fullPath = path.join(localesDir, dir);
    return fs.statSync(fullPath).isDirectory();
  });

console.log(`\n🔄 Updating "Wallet multi-devises" → "Compte multi-devises" in ${localeDirs.length} locales...\n`);

localeDirs.forEach(updateTranslation);

console.log("\n✨ Update complete!\n");
