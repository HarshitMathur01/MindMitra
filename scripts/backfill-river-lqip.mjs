import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { makeLqip, writeManifest } from "./river-manifest.mjs";

/**
 * One-shot: add the `lqip` field to an existing manifest.
 *
 *   node scripts/backfill-river-lqip.mjs
 *
 * `optimize-river-images.mjs` emits `lqip` natively and is the script you want
 * for anything that touches the art. This exists only because the source
 * JPEGs are not in this repo — the optimizer cannot run here, and a manifest
 * is generated output that must not be typed by hand.
 *
 * So the placeholders are downscaled from the smallest committed WebP variant
 * instead of from the source. At 20px the generational loss is not
 * representable: the placeholder is four or five perceptible colours either
 * way. Nothing else in the manifest is touched, so every content hash — and
 * the rename-on-change contract that depends on it — is left exactly as it is.
 *
 * Delete this script once the source art is reachable from a checkout.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "src", "assets", "river");
const manifestPath = path.join(outDir, "manifest.ts");

const source = readFileSync(manifestPath, "utf8");
const match = source.match(/export const RIVER_MANIFEST = ([\s\S]*?) as const satisfies/);
if (!match) {
  console.error(`Could not find RIVER_MANIFEST in ${manifestPath}`);
  process.exit(1);
}

const manifest = JSON.parse(match[1]);

let bytes = 0;
for (const [name, entry] of Object.entries(manifest)) {
  const widths = Object.keys(entry.webp).map(Number).sort((a, b) => a - b);
  const smallest = entry.webp[widths[0]];
  entry.lqip = await makeLqip(path.join(outDir, smallest));
  bytes += entry.lqip.length;
  console.log(`${name.padEnd(28)} ← ${smallest.padEnd(40)} ${String(entry.lqip.length).padStart(4)} B`);
}

writeManifest(manifest, outDir);

const count = Object.keys(manifest).length;
console.log(`\n${count} placeholders, ${(bytes / 1024).toFixed(1)} KB total inlined into manifest.ts`);
