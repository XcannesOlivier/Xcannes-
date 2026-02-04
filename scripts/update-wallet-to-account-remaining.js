#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const localesDir = path.join(__dirname, "../public/locales");

const additionalTranslations = {
  "ar-MA": "حساب متعدد العملات",
  "ar-PS": "حساب متعدد العملات",
  "da-DK": "Multivalutakonto",
  "el-GR": "Λογαριασμός πολλαπλών νομισμάτων",
  "fi-FI": "Monivaluuttatili",
  "is-IS": "Fjölmyntreikningur",
  "no-NO": "Flervälutakonto",
  "pl-PL": "Konto wielowalutowe",
  "rm-CH": "Conto multivaluta",
  "sv-SE": "Flervälutakonto",
  "sw-KE": "Akaunti ya sarafu nyingi",
  "th-TH": "บัญชีหลายสกุลเงิน",
  "ur-PK": "کثیر کرنسی اکاؤنٹ",
  "vi-VN": "Tài khoản đa tiền tệ",
};

const KEY = "ui_global_usd_wallet_202f7e48be";

Object.entries(additionalTranslations).forEach(([localeCode, value]) => {
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

    data[KEY] = value;

    fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
    console.log(`✅ Updated ${localeCode}: "${value}"`);
  } catch (error) {
    console.error(`❌ Error updating ${localeCode}:`, error.message);
  }
});

console.log("\n✨ Additional locales updated!\n");
