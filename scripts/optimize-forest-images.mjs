import { existsSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Mirrors scripts/optimize-avatar-videos.mjs: a one-shot, idempotent asset
// optimizer run via `npm run optimize:forest-images`. The 8 forest backdrops
// ship as ~6–7 MB JPGs and are loaded as a full-screen CSS background on every
// MindGym surface. We emit resized WebP siblings (a few hundred KB) next to the
// originals; ForestBackdrop serves the WebP via image-set() with the JPG as a
// fallback for browsers that don't support WebP, so the JPGs are kept on
// purpose.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const forestDir = path.join(repoRoot, "public", "mindgym", "forest");
const sourcePattern = /\.(jpe?g|png)$/i;

const MAX_WIDTH = 1920; // plenty for a full-bleed backdrop; never upscale
const WEBP_QUALITY = 72;

function isStale(output, input) {
  if (!existsSync(output)) return true;
  return statSync(output).mtimeMs < statSync(input).mtimeMs;
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (!existsSync(forestDir)) {
  console.error(`Forest images folder not found: ${forestDir}`);
  process.exit(1);
}

const sources = readdirSync(forestDir)
  .filter((file) => sourcePattern.test(file))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (sources.length === 0) {
  console.log("No source forest images found.");
  process.exit(0);
}

let totalSource = 0;
let totalWebp = 0;

for (const file of sources) {
  const sourcePath = path.join(forestDir, file);
  const baseName = path.basename(file, path.extname(file));
  const webpPath = path.join(forestDir, `${baseName}.webp`);

  if (!isStale(webpPath, sourcePath)) {
    console.log(`WebP is current: ${path.basename(webpPath)}`);
    continue;
  }

  console.log(`Optimizing ${file}...`);
  await sharp(sourcePath)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: WEBP_QUALITY })
    .toFile(webpPath);

  const sourceSize = statSync(sourcePath).size;
  const webpSize = statSync(webpPath).size;
  totalSource += sourceSize;
  totalWebp += webpSize;
  console.log(`  ${formatBytes(sourceSize)} -> ${formatBytes(webpSize)}`);
}

if (totalSource > 0) {
  console.log(`Total: ${formatBytes(totalSource)} -> ${formatBytes(totalWebp)} (WebP)`);
}
