#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function getLocaleDirs(localesRoot) {
  return fs
    .readdirSync(localesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
}

function parseCsv(value) {
  if (!value) return [];
  return String(value)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseArgs(argv) {
  const args = {
    start: 0,
    count: 50,
    locales: null,
    show: [],
    format: "text",
    output: null,
    onlyProblems: false,
    showIssues: false,
    maxShowIssues: 12,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => (i + 1 < argv.length ? argv[++i] : null);

    if (a === "--help" || a === "-h") {
      args.help = true;
    } else if (a === "--start" || a === "--from") {
      args.start = Number(next());
    } else if (a === "--count" || a === "--limit") {
      args.count = Number(next());
    } else if (a === "--locales") {
      args.locales = parseCsv(next());
    } else if (a === "--locale") {
      args.locales = args.locales || [];
      args.locales.push(String(next() || "").trim());
    } else if (a === "--show") {
      args.show = parseCsv(next());
    } else if (a === "--format") {
      args.format = String(next() || "").trim();
    } else if (a === "--output" || a === "-o") {
      args.output = String(next() || "").trim();
    } else if (a === "--only-problems") {
      args.onlyProblems = true;
    } else if (a === "--show-issues") {
      args.showIssues = true;
    } else if (a === "--max-show-issues") {
      args.maxShowIssues = Number(next());
    }
  }

  return args;
}

function looksLikeTranslatableText(value) {
  if (typeof value !== "string") return false;
  const s = value.replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (/^https?:\/\//i.test(s)) return false;
  if (/@/.test(s) && /\w@\w/.test(s)) return false; // emails
  if (/^\d+(\.\d+)?$/.test(s)) return false;
  if (/^[A-Z0-9]{2,8}$/.test(s)) return false; // currency codes, tickers, etc.
  // Prefer strings that look like real sentences/labels.
  return /[A-Za-zÀ-ÿ]/.test(s) && (/[a-z]/.test(s) || s.length >= 8 || /\s/.test(s));
}

function extractMustacheTokens(value) {
  if (typeof value !== "string") return [];
  const out = [];
  const re = /{{\s*-?\s*([A-Za-z0-9_.-]+)\s*}}/g;
  let m;
  while ((m = re.exec(value))) out.push(m[1]);
  return out;
}

function extractReactNumericTags(value) {
  if (typeof value !== "string") return [];
  const out = [];
  const re = /<\/?(\d+)\s*\/?>/g;
  let m;
  while ((m = re.exec(value))) out.push(m[1]);
  return out;
}

function uniqSorted(arr) {
  return Array.from(new Set(arr)).sort();
}

function sameSet(a, b) {
  const sa = uniqSorted(a);
  const sb = uniqSorted(b);
  if (sa.length !== sb.length) return false;
  for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
  return true;
}

function hasGlossaryPlaceholder(value) {
  if (typeof value !== "string") return false;
  return /_+GLOSSAIRE_\d+_+/.test(value) || /_+GLOSSARY_\d+_+/.test(value);
}

function formatList(list, max = 20) {
  if (!list.length) return "";
  if (list.length <= max) return list.join(", ");
  return `${list.slice(0, max).join(", ")} …(+${list.length - max})`;
}

function usage() {
  return [
    "Usage: node scripts/i18n-sample.cjs [options]",
    "",
    "Options:",
    "  --start <n>            Start index in en/common.json (default: 0)",
    "  --count <n>            Number of keys (default: 50)",
    "  --locales <a,b,c>      Only check these locales (default: all found)",
    "  --show <a,b,c>         Always include these locales' values",
    "  --format <text|json>   Output format (default: text)",
    "  --output <file>        Write output to a file (optional)",
    "  --only-problems        Only include keys with issues",
    "  --show-issues          In text mode, print values for issue locales",
    "  --max-show-issues <n>  In text mode, cap printed issue locales (default: 12)",
  ].join("\n");
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(usage());
    return;
  }

  const repoRoot = process.cwd();
  const localesRoot = path.join(repoRoot, "public", "locales");
  const basePath = path.join(localesRoot, "en", "common.json");

  if (!fs.existsSync(basePath)) {
    console.error(`Missing base locale file: ${basePath}`);
    process.exit(1);
  }

  const baseObj = readJson(basePath);
  const baseKeys = Object.keys(baseObj);

  const start = Number.isFinite(args.start) ? Math.max(0, args.start) : 0;
  const count = Number.isFinite(args.count) ? Math.max(0, args.count) : 50;
  const slice = baseKeys.slice(start, start + count);

  const localeDirs = getLocaleDirs(localesRoot);
  const filteredLocales = (args.locales && args.locales.length
    ? localeDirs.filter((l) => args.locales.includes(l))
    : localeDirs
  ).sort();

  const localeData = {};
  for (const locale of filteredLocales) {
    const filePath = path.join(localesRoot, locale, "common.json");
    if (!fs.existsSync(filePath)) {
      localeData[locale] = { ok: false, reason: "missing common.json" };
      continue;
    }
    try {
      localeData[locale] = { ok: true, obj: readJson(filePath) };
    } catch (e) {
      localeData[locale] = { ok: false, reason: `invalid json: ${e?.message || e}` };
    }
  }

  const keys = [];
  let keysWithIssues = 0;

  for (let idx = 0; idx < slice.length; idx++) {
    const key = slice[idx];
    const enValue = baseObj[key];
    const expectedTokens = {
      mustache: extractMustacheTokens(enValue),
      reactTags: extractReactNumericTags(enValue),
    };

    const perLocale = {};
    const missingLocales = [];
    const untranslatedLocales = [];
    const tokenMismatchLocales = [];
    const glossaryPlaceholderLocales = [];
    const invalidLocaleFiles = [];

    for (const locale of filteredLocales) {
      const data = localeData[locale];
      if (!data.ok) {
        invalidLocaleFiles.push(locale);
        perLocale[locale] = { status: data.reason };
        continue;
      }

      const obj = data.obj;
      if (!Object.prototype.hasOwnProperty.call(obj, key)) {
        missingLocales.push(locale);
        perLocale[locale] = { status: "missing" };
        continue;
      }

      const value = obj[key];
      const actualTokens = {
        mustache: extractMustacheTokens(value),
        reactTags: extractReactNumericTags(value),
      };

      const tokenMismatch =
        !sameSet(expectedTokens.mustache, actualTokens.mustache) ||
        !sameSet(expectedTokens.reactTags, actualTokens.reactTags);

      if (tokenMismatch) tokenMismatchLocales.push(locale);

      const glossaryPlaceholder = hasGlossaryPlaceholder(value);
      if (glossaryPlaceholder) glossaryPlaceholderLocales.push(locale);

      const untranslated =
        locale !== "en" &&
        looksLikeTranslatableText(enValue) &&
        value === enValue;
      if (untranslated) untranslatedLocales.push(locale);

      perLocale[locale] = {
        status: "ok",
        value,
        tokenMismatch,
        glossaryPlaceholder,
        untranslated,
      };
    }

    const hasIssues =
      missingLocales.length ||
      untranslatedLocales.length ||
      tokenMismatchLocales.length ||
      glossaryPlaceholderLocales.length ||
      invalidLocaleFiles.length;
    if (hasIssues) keysWithIssues++;

    keys.push({
      index: start + idx,
      key,
      en: enValue,
      expectedTokens,
      issues: {
        missingLocales,
        untranslatedLocales,
        tokenMismatchLocales,
        glossaryPlaceholderLocales,
        invalidLocaleFiles,
      },
      locales: perLocale,
    });
  }

  const report = {
    base: {
      locale: "en",
      file: path.relative(repoRoot, basePath),
      totalKeys: baseKeys.length,
    },
    slice: {
      start,
      count,
      keys: slice.length,
      keysWithIssues,
    },
    locales: {
      total: filteredLocales.length,
      list: filteredLocales,
      show: args.show,
    },
    keys: args.onlyProblems ? keys.filter((k) => {
      const i = k.issues;
      return (
        i.missingLocales.length ||
        i.untranslatedLocales.length ||
        i.tokenMismatchLocales.length ||
        i.glossaryPlaceholderLocales.length ||
        i.invalidLocaleFiles.length
      );
    }) : keys,
  };

  let output;
  if (args.format === "json") {
    output = JSON.stringify(report, null, 2);
  } else if (args.format === "text") {
    const lines = [];
    lines.push(
      `i18n sample: en/common.json keys [${start}..${start + slice.length - 1}] (${slice.length} keys), locales=${filteredLocales.length}`
    );
    lines.push(
      `keys with issues: ${keysWithIssues}${args.onlyProblems ? " (filtered)" : ""}`
    );

    for (const item of report.keys) {
      const issues = item.issues;
      const hasIssues =
        issues.missingLocales.length ||
        issues.untranslatedLocales.length ||
        issues.tokenMismatchLocales.length ||
        issues.glossaryPlaceholderLocales.length ||
        issues.invalidLocaleFiles.length;
      if (args.onlyProblems && !hasIssues) continue;

      lines.push("");
      lines.push(`#${item.index + 1} ${item.key}`);
      lines.push(`en: ${JSON.stringify(item.en)}`);

      if (issues.invalidLocaleFiles.length) {
        lines.push(`invalid locale files: ${formatList(issues.invalidLocaleFiles)}`);
      }
      if (issues.missingLocales.length) {
        lines.push(`missing: ${formatList(issues.missingLocales)}`);
      }
      if (issues.untranslatedLocales.length) {
        lines.push(`untranslated (same as en): ${formatList(issues.untranslatedLocales)}`);
      }
      if (issues.tokenMismatchLocales.length) {
        lines.push(
          `tokens mismatch: ${formatList(issues.tokenMismatchLocales)} (mustache=${JSON.stringify(
            uniqSorted(item.expectedTokens.mustache)
          )}, reactTags=${JSON.stringify(uniqSorted(item.expectedTokens.reactTags))})`
        );
      }
      if (issues.glossaryPlaceholderLocales.length) {
        lines.push(`glossary placeholders: ${formatList(issues.glossaryPlaceholderLocales)}`);
      }

      const forceShow = new Set(args.show);
      const localesToShow = new Set();
      for (const l of forceShow) localesToShow.add(l);

      if (args.showIssues) {
        const issueLocales = uniqSorted([
          ...issues.invalidLocaleFiles,
          ...issues.missingLocales,
          ...issues.tokenMismatchLocales,
          ...issues.glossaryPlaceholderLocales,
        ]);
        for (const l of issueLocales.slice(0, args.maxShowIssues)) localesToShow.add(l);
      }

      const shown = uniqSorted(Array.from(localesToShow)).filter((l) =>
        Object.prototype.hasOwnProperty.call(item.locales, l)
      );

      for (const locale of shown) {
        const entry = item.locales[locale];
        if (!entry) continue;
        if (entry.status !== "ok") {
          lines.push(`${locale}: <${entry.status}>`);
        } else {
          lines.push(`${locale}: ${JSON.stringify(entry.value)}`);
        }
      }
    }

    output = lines.join("\n");
  } else {
    console.error(`Unknown --format: ${args.format} (expected: text|json)`);
    process.exit(1);
  }

  if (args.output) {
    fs.writeFileSync(args.output, output + "\n", "utf8");
  } else {
    console.log(output);
  }
}

main();
