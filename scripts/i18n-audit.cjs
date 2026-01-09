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

function looksLikeUserFacingText(value) {
  const s = String(value || "").replace(/\s+/g, " ").trim();
  if (!s) return false;
  if (s.length < 2) return false;
  // Ignore pure punctuation/symbols/numbers.
  if (!/[A-Za-zÀ-ÿ\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4e00-\u9fff]/.test(s)) {
    return false;
  }
  return true;
}

function tryRequireBabel() {
  try {
    // Next.js brings these in its dependency graph.
    const parser = require("@babel/parser");
    const traverse = require("@babel/traverse").default;
    return { parser, traverse };
  } catch {
    return null;
  }
}

function auditSourceStrings(srcRoot) {
  const babel = tryRequireBabel();
  if (!babel) {
    return {
      supported: false,
      issues: [],
      usedKeys: [],
      missingKeysInEn: [],
      reason:
        "Missing @babel/parser/@babel/traverse (not available to the audit script).",
    };
  }

  const { parser, traverse } = babel;
  const files = listSourceFiles(srcRoot);
  const issues = [];
  const usedKeys = new Set();
  const interestingAttrs = new Set([
    "title",
    "alt",
    "placeholder",
    "aria-label",
    "aria-description",
    "label",
  ]);

  for (const filePath of files) {
    const code = fs.readFileSync(filePath, "utf8");
    let ast;
    try {
      ast = parser.parse(code, {
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
    } catch {
      continue;
    }

    traverse(ast, {
      CallExpression(p) {
        const callee = p.node.callee;
        if (!callee || callee.type !== "Identifier" || callee.name !== "t") {
          return;
        }
        const firstArg = p.node.arguments?.[0];
        if (firstArg && firstArg.type === "StringLiteral") {
          usedKeys.add(firstArg.value);
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
        if (v && v.type === "StringLiteral" && v.value) usedKeys.add(v.value);
      },
      JSXText(p) {
        const raw = p.node.value;
        const text = raw.replace(/\s+/g, " ").trim();
        if (!looksLikeUserFacingText(text)) return;
        issues.push({
          file: filePath,
          line: p.node.loc?.start?.line || null,
          kind: "JSXText",
          text,
        });
      },
      JSXAttribute(p) {
        const nameNode = p.node.name;
        const attrName =
          nameNode && nameNode.type === "JSXIdentifier" ? nameNode.name : null;
        if (!attrName || !interestingAttrs.has(attrName)) return;

        const valueNode = p.node.value;
        if (!valueNode) return;
        if (valueNode.type === "StringLiteral") {
          const text = String(valueNode.value || "").trim();
          if (!looksLikeUserFacingText(text)) return;
          issues.push({
            file: filePath,
            line: valueNode.loc?.start?.line || null,
            kind: `JSXAttribute:${attrName}`,
            text,
          });
        }
      },
    });
  }

  return { supported: true, issues, usedKeys: Array.from(usedKeys).sort() };
}

function main() {
  const repoRoot = process.cwd();
  const localesRoot = path.join(repoRoot, "public", "locales");
  const basePath = path.join(localesRoot, "en", "common.json");
  const baseObj = readJson(basePath);
  const baseKeys = Object.keys(baseObj);
  const baseKeySet = new Set(baseKeys);

  const localeDirs = getLocaleDirs(localesRoot);
  const localeStats = [];
  let missingAny = 0;

  for (const locale of localeDirs) {
    const targetPath = path.join(localesRoot, locale, "common.json");
    const obj = readJson(targetPath);
    const keys = Object.keys(obj);
    const set = new Set(keys);
    const missing = baseKeys.filter((k) => !set.has(k));
    const extra = keys.filter((k) => !baseKeySet.has(k));
    const identicalToEn =
      locale === "en"
        ? 0
        : baseKeys.reduce(
            (count, k) => count + (obj[k] === baseObj[k] ? 1 : 0),
            0
          );
    if (missing.length) missingAny++;
    localeStats.push({
      locale,
      keys: keys.length,
      missing: missing.length,
      extra: extra.length,
      identicalToEn,
    });
  }

  localeStats.sort((a, b) => b.identicalToEn - a.identicalToEn);

  const srcAudit = auditSourceStrings(path.join(repoRoot, "src"));
  const missingKeysInEn = (srcAudit.usedKeys || []).filter(
    (k) => !baseKeySet.has(k)
  );

  const report = {
    base: { locale: "en", keys: baseKeys.length },
    locales: localeStats,
    localesMissingAny: missingAny,
    sourceAudit: {
      supported: srcAudit.supported,
      issueCount: srcAudit.issues.length,
      usedKeyCount: (srcAudit.usedKeys || []).length,
      missingKeyCount: missingKeysInEn.length,
      reason: srcAudit.supported ? undefined : srcAudit.reason,
      sample: srcAudit.issues.slice(0, 60),
      missingKeysSample: missingKeysInEn.slice(0, 60),
    },
  };

  console.log(JSON.stringify(report, null, 2));
}

main();
