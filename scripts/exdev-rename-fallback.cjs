/**
 * Workaround for Next.js build failures in some environments where
 * fs.rename() returns EXDEV even within the same apparent filesystem.
 *
 * We only fallback to copy+unlink for build artifact moves inside `.next/`.
 */

const fs = require("fs");
const path = require("path");

const originalRename = fs.rename.bind(fs);
const originalRenameSync = fs.renameSync.bind(fs);
const originalPromisesRename = fs.promises.rename.bind(fs.promises);

function isWorkdirNextArtifactMove(src, dest) {
  if (!src || !dest) return false;
  const normalizedSrc = String(src);
  const normalizedDest = String(dest);

  // Limit scope: only touch Next build artifacts.
  return (
    normalizedSrc.includes(`${path.sep}.next${path.sep}`) &&
    normalizedDest.includes(`${path.sep}.next${path.sep}`) &&
    normalizedSrc.includes(`${path.sep}.next${path.sep}export${path.sep}`) &&
    normalizedDest.includes(`${path.sep}.next${path.sep}server${path.sep}pages${path.sep}`)
  );
}

async function renameWithFallback(src, dest) {
  try {
    await originalPromisesRename(src, dest);
  } catch (error) {
    if (error?.code !== "EXDEV" || !isWorkdirNextArtifactMove(src, dest)) {
      throw error;
    }
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.copyFile(src, dest);
    await fs.promises.unlink(src);
  }
}

function renameCbWithFallback(src, dest, callback) {
  originalRename(src, dest, async (error) => {
    if (error?.code !== "EXDEV" || !isWorkdirNextArtifactMove(src, dest)) {
      callback(error);
      return;
    }
    try {
      await fs.promises.mkdir(path.dirname(dest), { recursive: true });
      await fs.promises.copyFile(src, dest);
      await fs.promises.unlink(src);
      callback(null);
    } catch (fallbackError) {
      callback(fallbackError);
    }
  });
}

function renameSyncWithFallback(src, dest) {
  try {
    originalRenameSync(src, dest);
  } catch (error) {
    if (error?.code !== "EXDEV" || !isWorkdirNextArtifactMove(src, dest)) {
      throw error;
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    fs.unlinkSync(src);
  }
}

fs.promises.rename = renameWithFallback;
fs.rename = renameCbWithFallback;
fs.renameSync = renameSyncWithFallback;

