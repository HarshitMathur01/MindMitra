#!/usr/bin/env node
/**
 * One-off: convert the source watercolor PNGs in src/components/handcrafted_image/
 * into responsive WebP derivatives served from public/illustrations/.
 *
 * Run from repo root: node scripts/optimize-watercolors.mjs
 *
 * Source files are 5–7 MB each; we never ship them. The output is
 * 480w / 960w / 1600w WebP at quality 78 — typically 30–250 KB each.
 */

import { mkdirSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const SRC_DIR = join(ROOT, "src", "components", "handcrafted_image");
const OUT_DIR = join(ROOT, "public", "illustrations");

const MAP = {
  hills: "Gemini_Generated_Image_r4o2gpr4o2gpr4o2 (1).png",
  presence: "Gemini_Generated_Image_4bxvyg4bxvyg4bxv.png",
  breath: "Gemini_Generated_Image_kncoypkncoypknco.png",
  solitude: "Gemini_Generated_Image_cia0q7cia0q7cia0.png",
  companions: "Gemini_Generated_Image_cye1vqcye1vqcye1.png",
  mountain: "Gemini_Generated_Image_s5o3rxs5o3rxs5o3.png",
};

const WIDTHS = [480, 960, 1600];
const QUALITY = 78;

if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

const results = [];

for (const [scene, file] of Object.entries(MAP)) {
  const inputPath = join(SRC_DIR, file);
  if (!existsSync(inputPath)) {
    console.error(`MISSING: ${inputPath}`);
    process.exitCode = 1;
    continue;
  }

  for (const width of WIDTHS) {
    const out = join(OUT_DIR, `${scene}-${width}.webp`);
    const { size } = await sharp(inputPath)
      .resize({ width, withoutEnlargement: true })
      .webp({ quality: QUALITY, effort: 6 })
      .toFile(out);
    results.push({ scene, width, kb: Math.round(size / 1024), out });
  }
}

console.table(results);
console.log("done");
