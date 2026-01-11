#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const generate = require("@babel/generator").default;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function listSourceFiles(rootDir) {
  const out = [];
  const stack = [rootDir];
  while (stack.length) {
    const dir = stack.pop();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === "public" ||
          entry.name === "dist"
        ) {
          continue;
        }
        stack.push(full);
      } else if (entry.isFile()) {
        if (/\.(js|jsx|ts|tsx)$/.test(entry.name)) out.push(full);
      }
    }
  }
  return out.sort();
}

function buildSuffixToKeyMap(enObj) {
  const bySuffix = new Map();
  for (const key of Object.keys(enObj)) {
    const m = key.match(/_([0-9a-f]{10})$/);
    if (!m) continue;
    const suffix = m[1];
    if (!bySuffix.has(suffix)) bySuffix.set(suffix, new Set());
    bySuffix.get(suffix).add(key);
  }

  const unique = new Map();
  for (const [suffix, keys] of bySuffix.entries()) {
    if (keys.size === 1) unique.set(suffix, Array.from(keys)[0]);
  }
  return unique;
}

function parse(code) {
  return parser.parse(code, {
    sourceType: "module",
    plugins: [
      "jsx",
      "typescript",
      "classProperties",
      "dynamicImport",
      "optionalChaining",
      "nullishCoalescingOperator",
    ],
    errorRecovery: true,
  });
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  const repoRoot = process.cwd();
  const srcRoot = path.join(repoRoot, "src");
  const localesRoot = path.join(repoRoot, "public", "locales");
  const enPath = path.join(localesRoot, "en", "common.json");

  const enObj = readJson(enPath);
  const enKeySet = new Set(Object.keys(enObj));
  const suffixMap = buildSuffixToKeyMap(enObj);

  const files = listSourceFiles(srcRoot);
  let filesChanged = 0;
  let replacements = 0;
  const stillMissing = new Set();
  const unmapped = new Set();

  for (const filePath of files) {
    const code = fs.readFileSync(filePath, "utf8");
    let ast;
    try {
      ast = parse(code);
    } catch {
      continue;
    }

    let fileChanged = false;

    function maybeRealignKey(key) {
      if (enKeySet.has(key)) return key;
      stillMissing.add(key);

      const m = key.match(/_([0-9a-f]{10})$/);
      if (!m) {
        unmapped.add(key);
        return key;
      }
      const suffix = m[1];
      const candidate = suffixMap.get(suffix);
      if (!candidate) {
        unmapped.add(key);
        return key;
      }
      return candidate;
    }

    traverse(ast, {
      CallExpression(p) {
        const callee = p.node.callee;
        if (!callee || callee.type !== "Identifier" || callee.name !== "t") {
          return;
        }
        const firstArg = p.node.arguments?.[0];
        if (!firstArg || firstArg.type !== "StringLiteral") return;

        const currentKey = firstArg.value;
        const nextKey = maybeRealignKey(currentKey);
        if (nextKey !== currentKey) {
          firstArg.value = nextKey;
          fileChanged = true;
          replacements++;
        }
      },
      JSXOpeningElement(p) {
        const name = p.node.name;
        const isTrans =
          name &&
          ((name.type === "JSXIdentifier" && name.name === "Trans") ||
            (name.type === "JSXMemberExpression" &&
              name.property?.type === "JSXIdentifier" &&
              name.property.name === "Trans"));
        if (!isTrans) return;

        const attr = (p.node.attributes || []).find((a) => {
          if (!a || a.type !== "JSXAttribute") return false;
          if (!a.name || a.name.type !== "JSXIdentifier") return false;
          return a.name.name === "i18nKey";
        });
        const v = attr?.value;
        if (!v || v.type !== "StringLiteral" || !v.value) return;

        const currentKey = v.value;
        const nextKey = maybeRealignKey(currentKey);
        if (nextKey !== currentKey) {
          v.value = nextKey;
          fileChanged = true;
          replacements++;
        }
      },
    });

    if (!fileChanged) continue;

    const output = generate(
      ast,
      {
        retainLines: true,
        jsescOption: { minimal: true },
      },
      code
    ).code;

    if (!dryRun) fs.writeFileSync(filePath, output, "utf8");
    filesChanged++;
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        filesScanned: files.length,
        filesChanged,
        replacements,
        missingKeyCountBefore: stillMissing.size,
        unmappedMissingKeyCount: unmapped.size,
        unmappedMissingKeysSample: Array.from(unmapped).sort().slice(0, 60),
      },
      null,
      2
    )
  );
}

main();

