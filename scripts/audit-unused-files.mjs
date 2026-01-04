import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import * as acorn from "acorn";
import jsx from "acorn-jsx";

const repoRoot = path.resolve(process.cwd());
const srcRoot = path.join(repoRoot, "src");

const EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".json", ".css"];
const SOURCE_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx", ".json", ".css"];

const Parser = acorn.Parser.extend(jsx());

function isFile(p) {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function listGitFiles() {
  try {
    const out = execSync("git ls-files", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
    return out
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((p) => path.join(repoRoot, p));
  } catch {
    return null;
  }
}

function listAllFilesUnder(dir) {
  const result = [];
  const stack = [dir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(full);
      } else if (entry.isFile()) {
        result.push(full);
      }
    }
  }
  return result;
}

function normalize(p) {
  return path.normalize(p);
}

function resolveWithExtensions(basePath) {
  if (isFile(basePath)) return basePath;
  for (const ext of EXTENSIONS) {
    const candidate = `${basePath}${ext}`;
    if (isFile(candidate)) return candidate;
  }
  if (isDir(basePath)) {
    for (const ext of EXTENSIONS) {
      const candidate = path.join(basePath, `index${ext}`);
      if (isFile(candidate)) return candidate;
    }
  }
  return null;
}

function resolveSpecifier(fromFile, spec) {
  if (!spec || typeof spec !== "string") return null;
  if (spec.startsWith("http:") || spec.startsWith("https:")) return null;
  if (spec.startsWith("next/") || spec.startsWith("react") || spec.startsWith("node:")) return null;

  // Absolute path in app (usually public assets) -> not a source import
  if (spec.startsWith("/")) return null;

  if (spec.startsWith("@/")) {
    const without = spec.slice(2);
    const candidate = path.join(srcRoot, without);
    return resolveWithExtensions(candidate);
  }

  if (spec.startsWith("./") || spec.startsWith("../")) {
    const candidate = path.resolve(path.dirname(fromFile), spec);
    return resolveWithExtensions(candidate);
  }

  return null;
}

function collectSpecifiersFromAst(ast) {
  const specifiers = new Set();
  const stack = [ast];

  while (stack.length > 0) {
    const node = stack.pop();
    if (!node || typeof node !== "object") continue;

    switch (node.type) {
      case "ImportDeclaration":
      case "ExportAllDeclaration":
      case "ExportNamedDeclaration":
        if (node.source && typeof node.source.value === "string") {
          specifiers.add(node.source.value);
        }
        break;
      case "ImportExpression":
        if (node.source && node.source.type === "Literal" && typeof node.source.value === "string") {
          specifiers.add(node.source.value);
        }
        break;
      case "CallExpression":
        if (
          node.callee &&
          node.callee.type === "Identifier" &&
          node.callee.name === "require" &&
          Array.isArray(node.arguments) &&
          node.arguments.length > 0 &&
          node.arguments[0] &&
          node.arguments[0].type === "Literal" &&
          typeof node.arguments[0].value === "string"
        ) {
          specifiers.add(node.arguments[0].value);
        }
        break;
      default:
        break;
    }

    for (const value of Object.values(node)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === "object" && typeof child.type === "string") {
            stack.push(child);
          }
        }
      } else if (value && typeof value === "object" && typeof value.type === "string") {
        stack.push(value);
      }
    }
  }

  return specifiers;
}

function parseFileImports(filePath) {
  const code = fs.readFileSync(filePath, "utf8");
  let ast;
  try {
    ast = Parser.parse(code, {
      ecmaVersion: "latest",
      sourceType: "module",
      allowHashBang: true,
    });
  } catch {
    // Some files may not be valid ESM/JSX (or may be intentionally malformed for tests).
    // We fallback to a conservative regex so they still contribute edges.
    const specifiers = new Set();
    const regex = /\b(?:import|export)\s+(?:[^"']*from\s+)?["']([^"']+)["']/g;
    const requireRegex = /\brequire\(\s*["']([^"']+)["']\s*\)/g;
    const dynamicRegex = /\bimport\(\s*["']([^"']+)["']\s*\)/g;
    for (const r of [regex, requireRegex, dynamicRegex]) {
      let m;
      while ((m = r.exec(code))) {
        if (m[1]) specifiers.add(m[1]);
      }
    }
    return specifiers;
  }
  return collectSpecifiersFromAst(ast);
}

function getAllSourceFiles() {
  const gitFiles = listGitFiles();
  const files = gitFiles ?? listAllFilesUnder(repoRoot);
  const inSrc = files
    .filter((p) => normalize(p).startsWith(normalize(srcRoot + path.sep)))
    .filter((p) => isFile(p))
    .filter((p) => SOURCE_EXTENSIONS.includes(path.extname(p)));
  return Array.from(new Set(inSrc));
}

function getRoots(allFiles) {
  const roots = [];
  for (const file of allFiles) {
    const rel = path.relative(srcRoot, file).replaceAll("\\", "/");
    if (!rel.startsWith("pages/")) continue;
    if (!SOURCE_EXTENSIONS.includes(path.extname(file))) continue;
    roots.push(file);
  }
  return roots;
}

function main() {
  if (!isDir(srcRoot)) {
    console.error("Missing src/ directory. Run this script from the frontend repo root.");
    process.exit(1);
  }

  const allFiles = getAllSourceFiles();
  const roots = getRoots(allFiles);

  const adjacency = new Map(); // file -> Set(resolvedFile)
  const inbound = new Map(); // file -> Set(fromFile)

  for (const file of allFiles) {
    const specifiers = parseFileImports(file);
    const deps = new Set();
    for (const spec of specifiers) {
      const resolved = resolveSpecifier(file, spec);
      if (!resolved) continue;
      if (!SOURCE_EXTENSIONS.includes(path.extname(resolved))) continue;
      deps.add(resolved);
      if (!inbound.has(resolved)) inbound.set(resolved, new Set());
      inbound.get(resolved).add(file);
    }
    adjacency.set(file, deps);
  }

  const reachable = new Set();
  const queue = [...roots];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    const deps = adjacency.get(current);
    if (!deps) continue;
    for (const dep of deps) {
      if (!reachable.has(dep)) queue.push(dep);
    }
  }

  const unused = allFiles
    .filter((f) => !reachable.has(f))
    .sort((a, b) => a.localeCompare(b));

  const formatList = (items) =>
    items
      .map((p) => {
        const rel = path.relative(repoRoot, p).replaceAll("\\", "/");
        const refs = inbound.get(p) ? Array.from(inbound.get(p)) : [];
        return { rel, refs: refs.map((r) => path.relative(repoRoot, r).replaceAll("\\", "/")) };
      })
      .map((x) => `- ${x.rel}${x.refs.length ? ` (importé par ${x.refs.length} fichier(s))` : " (0 import)"}`)
      .join("\n");

  console.log(`# Unused files report\n`);
  console.log(`- Total fichiers analysés: ${allFiles.length}`);
  console.log(`- Entry points (src/pages): ${roots.length}`);
  console.log(`- Fichiers atteignables: ${reachable.size}`);
  console.log(`- Candidats non référencés: ${unused.length}\n`);

  if (unused.length === 0) {
    console.log("Aucun fichier source non référencé trouvé.");
    return;
  }

  console.log(formatList(unused));
}

main();
