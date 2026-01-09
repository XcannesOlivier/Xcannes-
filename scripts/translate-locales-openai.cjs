#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunkArray(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(values.slice(i, i + size));
  return out;
}

function parseArgs(argv) {
  const args = {
    locales: null,
    all: false,
    force: false,
    dryRun: false,
    model: "gpt-4o-mini",
    chunkSize: 60,
    concurrency: 1,
    maxRetries: 6,
    retryBaseMs: 800,
    translateArabicRegions: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i];
    if (raw === "--all") args.all = true;
    else if (raw === "--force") args.force = true;
    else if (raw === "--dry-run") args.dryRun = true;
    else if (raw === "--locales") args.locales = String(argv[++i] || "");
    else if (raw === "--model") args.model = String(argv[++i] || args.model);
    else if (raw === "--chunk-size") args.chunkSize = Number(argv[++i] || args.chunkSize);
    else if (raw === "--concurrency") args.concurrency = Number(argv[++i] || args.concurrency);
    else if (raw === "--max-retries") args.maxRetries = Number(argv[++i] || args.maxRetries);
    else if (raw === "--retry-base-ms") args.retryBaseMs = Number(argv[++i] || args.retryBaseMs);
    else if (raw === "--translate-arabic-regions") args.translateArabicRegions = true;
  }

  args.chunkSize = Number.isFinite(args.chunkSize) && args.chunkSize > 0 ? Math.floor(args.chunkSize) : 60;
  args.concurrency = Number.isFinite(args.concurrency) && args.concurrency > 0 ? Math.floor(args.concurrency) : 1;
  args.maxRetries = Number.isFinite(args.maxRetries) && args.maxRetries > 0 ? Math.floor(args.maxRetries) : 6;
  args.retryBaseMs = Number.isFinite(args.retryBaseMs) && args.retryBaseMs > 0 ? Math.floor(args.retryBaseMs) : 800;

  return args;
}

function getLocaleDirs(localesRoot) {
  return fs
    .readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function localeDisplayName(locale) {
  const map = {
    en: "English",
    fr: "French",
    es: "Spanish",
    de: "German",
    nl: "Dutch",
    it: "Italian",
    pt: "Portuguese (Portugal)",
    hi: "Hindi",
    ko: "Korean",
    ja: "Japanese",
    zh: "Chinese (Simplified)",
    wuu: "Wu Chinese (Chinese, Wu)",
    ar: "Arabic (Modern Standard)",
    "ar-AE": "Arabic (United Arab Emirates)",
    "ar-QA": "Arabic (Qatar)",
    "ar-KW": "Arabic (Kuwait)",
    "ar-BH": "Arabic (Bahrain)",
    "ar-OM": "Arabic (Oman)",
    "ar-YE": "Arabic (Yemen)",
    "ar-EG": "Arabic (Egypt)",
    "ar-SD": "Arabic (Sudan)",
    "ar-LB": "Arabic (Lebanon)",
    "ar-SY": "Arabic (Syria)",
    "ar-MA": "Arabic (Morocco)",
    "ar-DZ": "Arabic (Algeria)",
    "ar-TN": "Arabic (Tunisia)",
    "ar-LY": "Arabic (Libya)",
    "ar-MR": "Arabic (Mauritania)",
    "ar-JO": "Arabic (Jordan)",
    "ar-PS": "Arabic (Palestine)",
    "ar-IQ": "Arabic (Iraq)",
    "rm-CH": "Romansh (Switzerland)",
    lb: "Luxembourgish",
    "da-DK": "Danish (Denmark)",
    "sv-SE": "Swedish (Sweden)",
    "no-NO": "Norwegian (Bokmål, Norway)",
    "fi-FI": "Finnish (Finland)",
    "is-IS": "Icelandic (Iceland)",
    "pl-PL": "Polish (Poland)",
    "ru-RU": "Russian (Russia)",
    "el-GR": "Greek (Greece)",
    "tr-TR": "Turkish (Turkey)",
    "th-TH": "Thai (Thailand)",
    "vi-VN": "Vietnamese (Vietnam)",
    "bn-BD": "Bengali (Bangladesh)",
    "ur-PK": "Urdu (Pakistan)",
    "sw-KE": "Swahili (Kenya)",
  };
  return map[locale] || locale;
}

function buildMergedLocale({ baseObj, baseKeys, localeObj }) {
  const merged = {};
  const baseKeySet = new Set(baseKeys);

  for (const key of baseKeys) {
    merged[key] = Object.prototype.hasOwnProperty.call(localeObj, key)
      ? localeObj[key]
      : baseObj[key];
  }

  // Preserve locale-only keys (append at end).
  for (const key of Object.keys(localeObj)) {
    if (!baseKeySet.has(key)) merged[key] = localeObj[key];
  }

  return merged;
}

function buildSchemaForKeys(keys) {
  const properties = {};
  for (const key of keys) properties[key] = { type: "string" };
  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: [...keys],
  };
}

async function translateChunkWithOpenAI({
  apiKey,
  model,
  targetLocale,
  chunkObj,
  maxRetries,
  retryBaseMs,
}) {
  const glossary = [
    "XCANNES",
    "XCS",
    "XRP",
    "XRPL",
    "RLUSD",
    "XUMM",
    "Xumm",
    "Xaman",
    "MoonPay",
    "Stripe",
    "Cannes",
    "DEX",
    "WebSocket",
  ];

  const keys = Object.keys(chunkObj);
  const schema = buildSchemaForKeys(keys);
  const targetName = localeDisplayName(targetLocale);

  const system = [
    "You are a meticulous professional UI/marketing translator.",
    "Return ONLY valid JSON matching the provided schema (no markdown, no commentary).",
    "Translate to the target language requested by the user (the source text may be English, French, or mixed).",
    "Keep meaning and tone, and keep sentences concise for UI.",
    "Preserve punctuation, ellipses, and line breaks if present.",
    "Do not translate product names, tickers, or brands in the glossary.",
    "Preserve any substrings matching /\\{\\{[^}]+\\}\\}/ exactly as-is.",
    `Glossary (keep as-is): ${glossary.join(", ")}`,
  ].join("\n");

  const user = [
    `Target language/locale: ${targetName} (${targetLocale}).`,
    "Translate the values of this JSON object; keep the keys unchanged.",
    "JSON to translate:",
    JSON.stringify(chunkObj),
  ].join("\n\n");

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          temperature: 0.2,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "translations",
              schema,
              strict: true,
            },
          },
        }),
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        const retryable = [408, 409, 425, 429, 500, 502, 503, 504].includes(
          res.status
        );
        if (retryable && attempt < maxRetries) {
          const wait = retryBaseMs * Math.pow(2, attempt);
          await sleep(wait);
          continue;
        }
        throw new Error(
          `OpenAI request failed (${res.status}): ${text.slice(0, 400)}`
        );
      }

      const data = await res.json();
      const content = data?.choices?.[0]?.message?.content;
      if (!content || typeof content !== "string") {
        throw new Error("OpenAI response missing JSON content.");
      }
      const parsed = JSON.parse(content);
      // Basic validation: ensure all keys exist.
      for (const key of keys) {
        if (
          !Object.prototype.hasOwnProperty.call(parsed, key) ||
          typeof parsed[key] !== "string"
        ) {
          throw new Error(`Missing/invalid key in translation: ${key}`);
        }
      }
      return parsed;
    } catch (err) {
      if (attempt >= maxRetries) throw err;
      const wait = retryBaseMs * Math.pow(2, attempt);
      await sleep(wait);
    }
  }

  throw new Error("Unreachable: exceeded retry loop.");
}

async function mapWithConcurrency(items, limit, fn) {
  const results = new Array(items.length);
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const current = index++;
      results[current] = await fn(items[current], current);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker()
  );
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error(
      "Missing OPENAI_API_KEY. Set it in your shell (do not commit it) then rerun."
    );
    process.exit(1);
  }

  const repoRoot = process.cwd();
  const localesRoot = path.join(repoRoot, "public", "locales");
  const basePath = path.join(localesRoot, "en", "common.json");
  const baseObj = readJson(basePath);
  const baseKeys = Object.keys(baseObj);

  const localeDirs = getLocaleDirs(localesRoot);
  const requestedLocales = args.locales
    ? args.locales
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
    : null;

  const baseTargetLocales = (requestedLocales || localeDirs)
    .filter((l) => (args.all ? true : l !== "en"))
    .filter((l) => localeDirs.includes(l));

  const wantsArabicVariants =
    !args.translateArabicRegions &&
    baseTargetLocales.some((l) => l.startsWith("ar-"));
  const includeArabicBase = wantsArabicVariants && !baseTargetLocales.includes("ar");

  const targetLocales = [...baseTargetLocales];
  if (includeArabicBase) targetLocales.unshift("ar");

  // Ensure "ar" is processed before "ar-*" so we can copy from it.
  targetLocales.sort((a, b) => {
    if (a === "ar" && b.startsWith("ar-")) return -1;
    if (b === "ar" && a.startsWith("ar-")) return 1;
    return a.localeCompare(b);
  });

  const summary = [];

  for (const locale of targetLocales) {
    const targetPath = path.join(localesRoot, locale, "common.json");
    const localeObj = readJson(targetPath);
    const mergedObj = buildMergedLocale({ baseObj, baseKeys, localeObj });

    if (
      !args.translateArabicRegions &&
      locale.startsWith("ar-") &&
      localeDirs.includes("ar")
    ) {
      const arabicBasePath = path.join(localesRoot, "ar", "common.json");
      const arabicBaseObj = readJson(arabicBasePath);
      for (const k of baseKeys) mergedObj[k] = arabicBaseObj[k];
      if (!args.dryRun) writeJson(targetPath, mergedObj);
      summary.push({
        locale,
        translated: 0,
        total: baseKeys.length,
        dryRun: args.dryRun,
        copiedFrom: "ar",
      });
      console.log(`[${locale}] copied base translations from ar`);
      continue;
    }

    const keysToTranslate = baseKeys.filter((k) => {
      if (args.force) return true;
      // Default behavior: only translate if it still equals the English string.
      return mergedObj[k] === baseObj[k];
    });

    console.log(
      `[${locale}] keys: ${baseKeys.length} | toTranslate: ${keysToTranslate.length}`
    );

    const chunks = chunkArray(keysToTranslate, args.chunkSize).map((keys) => {
      const obj = {};
      for (const k of keys) obj[k] = baseObj[k];
      return { keys, obj };
    });

    let translatedCount = 0;
    await mapWithConcurrency(chunks, args.concurrency, async ({ keys, obj }) => {
      if (!keys.length) return;
      if (args.dryRun) {
        translatedCount += keys.length;
        return;
      }
      const translated = await translateChunkWithOpenAI({
        apiKey,
        model: args.model,
        targetLocale: locale,
        chunkObj: obj,
        maxRetries: args.maxRetries,
        retryBaseMs: args.retryBaseMs,
      });
      for (const k of keys) mergedObj[k] = translated[k];
      translatedCount += keys.length;
    });

    if (!args.dryRun) writeJson(targetPath, mergedObj);
    summary.push({
      locale,
      translated: translatedCount,
      total: baseKeys.length,
      dryRun: args.dryRun,
    });
  }

  console.log(JSON.stringify({ model: args.model, summary }, null, 2));
}

main().catch((err) => {
  console.error(err?.stack || String(err));
  process.exit(1);
});
