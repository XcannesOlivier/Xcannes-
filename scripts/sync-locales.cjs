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

function getLocaleDirs(localesRoot) {
  return fs
    .readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function buildMergedLocale({ baseObj, baseKeys, localeObj }) {
  const merged = {};
  const baseKeySet = new Set(baseKeys);

  for (const key of baseKeys) {
    if (Object.prototype.hasOwnProperty.call(localeObj, key)) {
      merged[key] = localeObj[key];
    } else {
      merged[key] = baseObj[key];
    }
  }

  // Preserve locale-only keys (append at end).
  for (const key of Object.keys(localeObj)) {
    if (!baseKeySet.has(key)) merged[key] = localeObj[key];
  }

  return merged;
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  const repoRoot = process.cwd();
  const localesRoot = path.join(repoRoot, "public", "locales");
  const basePath = path.join(localesRoot, "en", "common.json");

  if (!fs.existsSync(basePath)) {
    console.error(`Missing base locale file: ${basePath}`);
    process.exit(1);
  }

  const baseObj = readJson(basePath);
  const baseKeys = Object.keys(baseObj);
  const baseKeySet = new Set(baseKeys);

  const localeDirs = getLocaleDirs(localesRoot);
  const results = [];

  for (const locale of localeDirs) {
    const targetPath = path.join(localesRoot, locale, "common.json");
    if (!fs.existsSync(targetPath)) {
      results.push({ locale, status: "missing common.json" });
      continue;
    }

    const localeObj = readJson(targetPath);
    const localeKeys = Object.keys(localeObj);
    const localeKeySet = new Set(localeKeys);
    const missingBefore = baseKeys.reduce(
      (count, key) => count + (localeKeySet.has(key) ? 0 : 1),
      0
    );
    const extraBefore = localeKeys.reduce(
      (count, key) => count + (baseKeySet.has(key) ? 0 : 1),
      0
    );

    if (missingBefore === 0 && extraBefore === 0) {
      results.push({
        locale,
        status: "ok",
        keys: localeKeys.length,
        missingBefore,
        extraBefore,
      });
      continue;
    }

    const merged = buildMergedLocale({ baseObj, baseKeys, localeObj });
    const mergedKeys = Object.keys(merged);
    const mergedKeySet = new Set(mergedKeys);
    const missingAfter = baseKeys.reduce(
      (count, key) => count + (mergedKeySet.has(key) ? 0 : 1),
      0
    );
    const extraAfter = mergedKeys.reduce(
      (count, key) => count + (baseKeySet.has(key) ? 0 : 1),
      0
    );

    if (!dryRun) writeJson(targetPath, merged);

    results.push({
      locale,
      status: dryRun ? "would_update" : "updated",
      keys: mergedKeys.length,
      missingBefore,
      missingAfter,
      extraBefore,
      extraAfter,
    });
  }

  const updated = results.filter((r) => r.status === (dryRun ? "would_update" : "updated"));
  const ok = results.filter((r) => r.status === "ok");
  const missing = results.filter((r) => r.status === "missing common.json");

  console.log(
    JSON.stringify(
      {
        base: { locale: "en", keys: baseKeys.length },
        dryRun,
        totalLocales: results.length,
        updated: updated.length,
        ok: ok.length,
        missing: missing.map((m) => m.locale),
      },
      null,
      2
    )
  );
}

main();

