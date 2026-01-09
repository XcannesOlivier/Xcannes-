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

  const enObj = readJson(basePath);
  const placeholderKeys = Object.keys(enObj).filter((k) =>
    k.toLowerCase().includes("placeholder")
  );

  const localeDirs = getLocaleDirs(localesRoot).filter((l) => l !== "en");
  const results = [];

  for (const locale of localeDirs) {
    const targetPath = path.join(localesRoot, locale, "common.json");
    if (!fs.existsSync(targetPath)) {
      results.push({ locale, status: "missing common.json" });
      continue;
    }

    const obj = readJson(targetPath);
    const changedKeys = [];

    for (const key of placeholderKeys) {
      if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
      if (obj[key] === enObj[key]) continue;
      obj[key] = enObj[key];
      changedKeys.push(key);
    }

    if (changedKeys.length && !dryRun) writeJson(targetPath, obj);

    results.push({
      locale,
      status: changedKeys.length ? (dryRun ? "would_update" : "updated") : "ok",
      changedKeys,
    });
  }

  const updated = results.filter((r) => r.status === (dryRun ? "would_update" : "updated"));
  const ok = results.filter((r) => r.status === "ok");
  const missing = results.filter((r) => r.status === "missing common.json");

  console.log(
    JSON.stringify(
      {
        base: { locale: "en", placeholderKeys: placeholderKeys.length },
        dryRun,
        totalLocales: results.length,
        updated: updated.length,
        ok: ok.length,
        missing: missing.map((m) => m.locale),
        placeholderKeys,
      },
      null,
      2
    )
  );
}

main();

