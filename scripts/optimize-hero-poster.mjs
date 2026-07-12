import { existsSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

// Mirrors scripts/optimize-forest-images.mjs: a one-shot, idempotent asset
// optimizer run via `npm run optimize:hero-poster`. The marketing hero ships a
// full-bleed 1920x1080 baseline JPEG (~224 KB) that is preloaded
// fetchpriority=high and is the landing LCP element. We emit AVIF + WebP
// siblings at two widths (a phone-sized 1024 and the full 1920) next to the
// original; HeroVideo serves them via <picture> with the JPG as the final
// fallback, so the JPG is kept on purpose. Files are new names only — the
// /video/** path is served immutable, so variants must be added by rename,
// never edited in place.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videoDir = path.join(repoRoot, "public", "video");
const source = path.join(videoDir, "hero-poster.jpg");

// The hero is decorative (aria-hidden) and sits under two scrims, so it
// tolerates aggressive compression without any perceptible loss.
const WIDTHS = [1024, 1920];
const AVIF_QUALITY = 48;
const WEBP_QUALITY = 72;

function isStale(output) {
  if (!existsSync(output)) return true;
  return statSync(output).mtimeMs < statSync(source).mtimeMs;
}

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)} kB`;
}

if (!existsSync(source)) {
  console.error(`Hero poster not found: ${source}`);
  process.exit(1);
}

const sourceSize = statSync(source).size;
console.log(`Source: hero-poster.jpg ${formatBytes(sourceSize)}`);

for (const width of WIDTHS) {
  const jobs = [
    { ext: "avif", opts: { quality: AVIF_QUALITY }, fn: (p) => p.avif({ quality: AVIF_QUALITY }) },
    { ext: "webp", opts: { quality: WEBP_QUALITY }, fn: (p) => p.webp({ quality: WEBP_QUALITY }) },
  ];
  for (const job of jobs) {
    const out = path.join(videoDir, `hero-poster-${width}.${job.ext}`);
    if (!isStale(out)) {
      console.log(`  current: ${path.basename(out)}`);
      continue;
    }
    await job
      .fn(sharp(source).resize({ width, withoutEnlargement: true }))
      .toFile(out);
    console.log(`  ${path.basename(out)}  ${formatBytes(statSync(out).size)}`);
  }
}
