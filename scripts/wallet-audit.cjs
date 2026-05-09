/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "src");

function listFiles(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) listFiles(p, out);
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

const CODE_EXTS = new Set([".js", ".jsx", ".ts", ".tsx"]);

function isCodeFile(file) {
  return CODE_EXTS.has(path.extname(file));
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, "/");
}

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function parseFile(file, code) {
  return parser.parse(code, {
    sourceType: "module",
    sourceFilename: rel(file),
    plugins: [
      "jsx",
      "typescript",
      "dynamicImport",
      "importMeta",
      "classProperties",
      "classPrivateProperties",
      "classPrivateMethods",
      "optionalChaining",
      "nullishCoalescingOperator",
      "objectRestSpread",
      "topLevelAwait",
    ],
    errorRecovery: true,
    ranges: false,
  });
}

function isWalletLikeFile(fileRel) {
  return (
    fileRel.startsWith("src/pages/wallet.") ||
    fileRel.startsWith("src/components/wallet/") ||
    fileRel.startsWith("src/components/demo-wallet/") ||
    fileRel.startsWith("src/utils/") ||
    fileRel.startsWith("src/lib/") ||
    fileRel.startsWith("src/hooks/") ||
    fileRel.startsWith("src/context/")
  );
}

function auditFile(file) {
  const fileRel = rel(file);
  const code = read(file);
  const ast = parseFile(file, code);

  const importDecls = [];
  const importEdges = [];

  traverse(ast, {
    ImportDeclaration(p) {
      const source = String(p.node.source.value || "");
      const specs = p.node.specifiers || [];
      importDecls.push({
        loc: p.node.loc?.start || null,
        source,
        specifiers: specs.map((s) => ({
          type: s.type,
          local: s.local?.name || null,
        })),
        path: p,
      });

      // Track coupling between wallet and demo-wallet (via alias imports)
      if (fileRel.startsWith("src/components/demo-wallet/") && source.startsWith("@/components/wallet/")) {
        importEdges.push({ from: fileRel, to: source });
      }
      if (fileRel.startsWith("src/components/wallet/") && source.startsWith("@/components/demo-wallet/")) {
        importEdges.push({ from: fileRel, to: source });
      }
    },
  });

  // Determine unused imports (specifier-level).
  // We only report for wallet-ish files by default to keep signal high.
  const unusedImports = [];
  traverse(ast, {
    Program(programPath) {
      const scope = programPath.scope;
      for (const decl of importDecls) {
        const source = decl.source;
        // Side-effect imports (CSS etc.) are never "unused"
        if (!decl.specifiers.length) continue;
        for (const spec of decl.specifiers) {
          const local = spec.local;
          if (!local) continue;
          // Ignore React in Next (often unused but harmless); still reportable if you want.
          const binding = scope.getBinding(local);
          if (binding && !binding.referenced) {
            unusedImports.push({
              file: fileRel,
              line: decl.loc?.line || 1,
              local,
              source,
            });
          }
        }
      }
    },
  });

  return { fileRel, unusedImports, importEdges };
}

function main() {
  const files = listFiles(SRC).filter(isCodeFile);

  const allUnused = [];
  const edges = [];
  let parsed = 0;
  let failed = 0;

  for (const f of files) {
    const fileRel = rel(f);
    if (!isWalletLikeFile(fileRel)) continue;
    try {
      const res = auditFile(f);
      parsed += 1;
      allUnused.push(...res.unusedImports);
      edges.push(...res.importEdges);
    } catch (err) {
      failed += 1;
      console.warn(`[wallet-audit] failed to parse ${fileRel}: ${err?.message || err}`);
    }
  }

  console.log(`Scanned wallet-ish files: ${parsed} (failed: ${failed})`);

  // Coupling summary
  if (edges.length) {
    console.log("\nCoupling: demo-wallet -> wallet imports");
    for (const e of edges.filter((x) => x.from.startsWith("src/components/demo-wallet/"))) {
      console.log(`- ${e.from} imports ${e.to}`);
    }
    const reverse = edges.filter((x) => x.from.startsWith("src/components/wallet/"));
    if (reverse.length) {
      console.log("\nCoupling: wallet -> demo-wallet imports");
      for (const e of reverse) console.log(`- ${e.from} imports ${e.to}`);
    }
  } else {
    console.log("\nCoupling: none detected between demo-wallet and wallet via @/components/* imports.");
  }

  // Unused imports (sorted)
  const unused = allUnused.sort((a, b) => (a.file + a.local).localeCompare(b.file + b.local));
  if (unused.length) {
    console.log(`\nUnused imports (specifier-level): ${unused.length}`);
    for (const u of unused) {
      console.log(`- ${u.file}:${u.line} unused ${u.local} from ${u.source}`);
    }
  } else {
    console.log("\nUnused imports (specifier-level): none found in wallet-ish files.");
  }
}

main();

