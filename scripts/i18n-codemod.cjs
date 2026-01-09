#!/usr/bin/env node
/* eslint-disable no-console */

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generate = require("@babel/generator").default;

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
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

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function looksLikeUserFacingText(value) {
  const s = normalizeText(value);
  if (!s) return false;
  if (s.length < 2) return false;
  // Ignore pure punctuation/symbols/numbers.
  if (
    !/[A-Za-zÀ-ÿ\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u4e00-\u9fff]/.test(s)
  ) {
    return false;
  }
  return true;
}

function isJSXTranslatableAttribute(name) {
  return (
    name === "title" ||
    name === "alt" ||
    name === "placeholder" ||
    name === "aria-label" ||
    name === "aria-description" ||
    name === "label"
  );
}

function makeKey({ relPath, kind, text }) {
  const short =
    normalizeText(text)
      .toLowerCase()
      .replace(/&[a-z]+;/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 28) || "text";

  const hash = crypto
    .createHash("sha1")
    .update(`${relPath}::${kind}::${normalizeText(text)}`)
    .digest("hex")
    .slice(0, 10);

  return `ui_${short}_${hash}`;
}

function ensureUseTranslationImport(programPath) {
  const body = programPath.node.body;
  const existing = body.find(
    (n) =>
      t.isImportDeclaration(n) && n.source.value === "next-i18next"
  );
  if (!existing) {
    const newImport = t.importDeclaration(
      [t.importSpecifier(t.identifier("useTranslation"), t.identifier("useTranslation"))],
      t.stringLiteral("next-i18next")
    );
    // Insert after "use client" directive and other imports' prologue.
    let insertAt = 0;
    while (
      insertAt < body.length &&
      (t.isExpressionStatement(body[insertAt]) ||
        t.isImportDeclaration(body[insertAt]))
    ) {
      // Keep "use client" and existing imports at top.
      insertAt++;
    }
    body.splice(insertAt, 0, newImport);
    return;
  }

  const hasSpecifier = existing.specifiers.some(
    (s) =>
      t.isImportSpecifier(s) &&
      t.isIdentifier(s.imported, { name: "useTranslation" })
  );
  if (!hasSpecifier) {
    existing.specifiers.push(
      t.importSpecifier(t.identifier("useTranslation"), t.identifier("useTranslation"))
    );
  }
}

function componentNameForFunction(funcPath) {
  if (!funcPath || !funcPath.node) return null;

  if (funcPath.isFunctionDeclaration() && funcPath.node.id?.name) {
    return funcPath.node.id.name;
  }

  const parent = funcPath.parentPath;
  if (!parent) return null;

  if (parent.isVariableDeclarator() && t.isIdentifier(parent.node.id)) {
    return parent.node.id.name;
  }

  if (parent.isExportDefaultDeclaration()) {
    return "DefaultExport";
  }

  if (parent.isExportNamedDeclaration()) {
    return funcPath.node.id?.name || "NamedExport";
  }

  return null;
}

function isComponentFunction(funcPath) {
  const name = componentNameForFunction(funcPath);
  if (!name) return false;
  if (name === "DefaultExport" || name === "NamedExport") return true;
  return /^[A-Z]/.test(name);
}

function ensureTInComponent(funcPath) {
  if (!funcPath || !funcPath.node) return false;
  if (!isComponentFunction(funcPath)) return false;
  if (!funcPath.node.body || !t.isBlockStatement(funcPath.node.body)) return false;
  if (funcPath.scope.hasBinding("t")) return true;

  const decl = t.variableDeclaration("const", [
    t.variableDeclarator(
      t.objectPattern([t.objectProperty(t.identifier("t"), t.identifier("t"), false, true)]),
      t.callExpression(t.identifier("useTranslation"), [t.stringLiteral("common")])
    ),
  ]);

  funcPath.node.body.body.unshift(decl);
  return true;
}

function buildTCall(key, fallbackText) {
  return t.callExpression(t.identifier("t"), [
    t.stringLiteral(key),
    t.stringLiteral(fallbackText),
  ]);
}

function replaceJSXText(path, key, fallbackText) {
  const expr = t.jsxExpressionContainer(buildTCall(key, fallbackText));
  path.replaceWith(expr);
}

function replaceJSXAttrString(attrPath, key, fallbackText) {
  attrPath.node.value = t.jsxExpressionContainer(buildTCall(key, fallbackText));
}

function main() {
  const args = new Set(process.argv.slice(2));
  const dryRun = args.has("--dry-run");

  const repoRoot = process.cwd();
  const srcRoot = path.join(repoRoot, "src");
  const localesRoot = path.join(repoRoot, "public", "locales");
  const enPath = path.join(localesRoot, "en", "common.json");
  const enObj = readJson(enPath);

  const files = listSourceFiles(srcRoot);
  const addedKeys = new Map();

  let changedFiles = 0;
  let replacedCount = 0;
  let skippedCount = 0;

  for (const filePath of files) {
    const relPath = path.relative(repoRoot, filePath).replace(/\\/g, "/");
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

    let fileChanged = false;
    let needsUseTranslationImport = false;
    const componentFunctionsToEnsureT = new Set();

    traverse(ast, {
      JSXText(p) {
        const raw = p.node.value;
        const text = normalizeText(raw);
        if (!looksLikeUserFacingText(text)) return;

        const key = makeKey({ relPath, kind: "jsx", text });

        // Ensure t is in scope or can be provided by a component.
        if (!p.scope.hasBinding("t")) {
          const func = p.getFunctionParent();
          if (!func || !isComponentFunction(func)) {
            skippedCount++;
            return;
          }
          componentFunctionsToEnsureT.add(func);
          needsUseTranslationImport = true;
        }

        if (!enObj[key]) {
          enObj[key] = text;
          addedKeys.set(key, text);
        }

        replaceJSXText(p, key, text);
        replacedCount++;
        fileChanged = true;
      },
      JSXAttribute(p) {
        const nameNode = p.node.name;
        if (!nameNode || nameNode.type !== "JSXIdentifier") return;
        const attrName = nameNode.name;
        if (!isJSXTranslatableAttribute(attrName)) return;

        const valueNode = p.node.value;
        if (!valueNode || valueNode.type !== "StringLiteral") return;
        const raw = valueNode.value;
        const text = normalizeText(raw);
        if (!looksLikeUserFacingText(text)) return;

        const key = makeKey({ relPath, kind: `attr_${attrName}`, text });

        if (!p.scope.hasBinding("t")) {
          const func = p.getFunctionParent();
          if (!func || !isComponentFunction(func)) {
            skippedCount++;
            return;
          }
          componentFunctionsToEnsureT.add(func);
          needsUseTranslationImport = true;
        }

        if (!enObj[key]) {
          enObj[key] = text;
          addedKeys.set(key, text);
        }

        replaceJSXAttrString(p, key, text);
        replacedCount++;
        fileChanged = true;
      },
    });

    if (!fileChanged) continue;

    // Inject useTranslation import if needed.
    if (needsUseTranslationImport) {
      traverse(ast, {
        Program(programPath) {
          ensureUseTranslationImport(programPath);
          programPath.stop();
        },
      });
    }

    // Ensure `t` binding exists in relevant component functions.
    for (const func of componentFunctionsToEnsureT) {
      const ok = ensureTInComponent(func);
      if (!ok) skippedCount++;
    }

    const output = generate(
      ast,
      {
        retainLines: true,
        jsescOption: { minimal: true },
      },
      code
    ).code;

    if (!dryRun) fs.writeFileSync(filePath, output, "utf8");
    changedFiles++;
  }

  if (!dryRun) {
    writeJson(enPath, enObj);
  }

  console.log(
    JSON.stringify(
      {
        dryRun,
        filesScanned: files.length,
        filesChanged: changedFiles,
        replacements: replacedCount,
        skipped: skippedCount,
        newKeysAdded: addedKeys.size,
      },
      null,
      2
    )
  );
}

main();

