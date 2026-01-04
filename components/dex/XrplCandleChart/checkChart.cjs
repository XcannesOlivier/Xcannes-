/* Verify XrplCandleChart structure/exports for regressions */

const fs = require("fs");
const path = require("path");

const chartRoot = __dirname;
const componentsRoot = path.join(chartRoot, ".."); // Xcannes-/components

const requiredFiles = [
  "XrplCandleChartRaw.jsx",
  "index.jsx",
  "indicators.js",
  "README.md",
  path.join("hooks", "useMarketData.js"),
  path.join("components", "ChartCanvas.jsx"),
  path.join("components", "ChartHeader.jsx"),
  path.join("components", "ChartFooter.jsx"),
  path.join("components", "IndicatorsToolbar.jsx"),
  path.join("components", "FxPairSelector.jsx"),
];

const expectedExports = [
  'export { default } from "./XrplCandleChartRaw";',
  'export { default as XrplCandleChartRaw } from "./XrplCandleChartRaw";',
  'export { default as ChartHeader } from "./components/ChartHeader";',
  'export { default as ChartFooter } from "./components/ChartFooter";',
  'export { default as IndicatorsToolbar } from "./components/IndicatorsToolbar";',
  'export { default as FxPairSelector } from "./components/FxPairSelector";',
  'export { default as ChartCanvas } from "./components/ChartCanvas";',
  'export { default as useMarketData } from "./hooks/useMarketData";',
];

let failed = false;

function fail(msg) {
  console.error(`✗ ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`✓ ${msg}`);
}

function checkFiles() {
  requiredFiles.forEach((rel) => {
    const full = path.join(chartRoot, rel);
    if (!fs.existsSync(full)) {
      fail(`Missing file: ${rel}`);
    } else {
      pass(`Found: ${rel}`);
    }
  });
}

function checkExports() {
  const indexPath = path.join(chartRoot, "index.jsx");
  if (!fs.existsSync(indexPath)) {
    fail("index.jsx not found for export checks");
    return;
  }
  const content = fs.readFileSync(indexPath, "utf8");
  expectedExports.forEach((line) => {
    if (!content.includes(line)) {
      fail(`Export missing in index.jsx: ${line}`);
    } else {
      pass(`Export OK: ${line}`);
    }
  });
}

function checkLegacyReexports() {
  const wrappers = [
    path.join(componentsRoot, "FxPairSelector.jsx"),
    path.join(componentsRoot, "ChartFooter.jsx"),
  ];
  wrappers.forEach((full) => {
    const rel = path.relative(process.cwd(), full);
    if (!fs.existsSync(full)) {
      pass(`Legacy wrapper optional (not found): ${rel}`);
      return;
    }
    const content = fs.readFileSync(full, "utf8");
    if (content.includes("./XrplCandleChart/components/")) {
      pass(`Legacy wrapper points to chart folder: ${rel}`);
    } else {
      fail(`Legacy wrapper not pointing to chart folder: ${rel}`);
    }
  });
}

function main() {
  console.log("Checking XrplCandleChart structure…");
  checkFiles();
  checkExports();
  checkLegacyReexports();
  if (failed) {
    console.error("\nChart check failed.");
    process.exit(1);
  }
  console.log("\nChart check passed.");
}

main();
