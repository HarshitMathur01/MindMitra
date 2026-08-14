import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { makeLqip, writeManifest } from "./river-manifest.mjs";

/**
 * Night River image pipeline.
 *
 * The design's source art arrives as ~17 MB of near-lossless JPEG — 1.8 MB for
 * a 1024x1024 door tile that renders at 108 CSS px. This app is opened mostly
 * on Indian mobile data, so shipping that as-is is not an option.
 *
 * Reads source JPEGs from a directory you pass on the command line and writes
 * AVIF + WebP at a couple of widths into src/assets/river/, plus a manifest the
 * components import so the <picture> srcsets stay in step with what exists on
 * disk.
 *
 *   node scripts/optimize-river-images.mjs <source-dir>
 *
 * Outputs are content-hashed. Vite serves hashed assets with immutable cache
 * headers, so a changed image MUST get a changed filename or nobody sees it —
 * rename-on-change is the whole contract.
 *
 * Only the outputs are committed. The source art is not in this repo.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(repoRoot, "src", "assets", "river");

/**
 * Widths per image role, driven by the largest box each one paints into:
 *   hero  — full-bleed backdrop, capped at the 1264px source
 *   door  — 640 for the 2x2 lead card, 256 for the 108px thumbnail rows
 *
 * The hero's 960 rung exists because the jump from 640 to 1264 made every
 * mid-range phone round up: a 393pt viewport at DPR 2 asks for 786px and got
 * the 1264 file, roughly twice the bytes it could use.
 */
const ROLES = {
  hero: { widths: [640, 960, 1264], avif: 48, webp: 70 },
  door: { widths: [256, 640], avif: 50, webp: 72 },
};

function roleFor(basename) {
  return basename.startsWith("hero-") ? "hero" : "door";
}

function formatKb(bytes) {
  return `${(bytes / 1024).toFixed(0)} KB`;
}

const sourceDir = process.argv[2];
if (!sourceDir) {
  console.error("Usage: node scripts/optimize-river-images.mjs <source-dir>");
  process.exit(1);
}
if (!existsSync(sourceDir)) {
  console.error(`Source directory not found: ${sourceDir}`);
  process.exit(1);
}

const sources = readdirSync(sourceDir)
  .filter((f) => /\.jpe?g$/i.test(f))
  .sort();

if (sources.length === 0) {
  console.error(`No JPEGs in ${sourceDir}`);
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });

const manifest = {};
let totalIn = 0;
let totalOut = 0;

for (const file of sources) {
  const sourcePath = path.join(sourceDir, file);
  const base = path.basename(file, path.extname(file));
  const role = roleFor(base);
  const { widths, avif, webp } = ROLES[role];

  const inBytes = statSync(sourcePath).size;
  totalIn += inBytes;

  const entry = { avif: {}, webp: {} };
  const image = sharp(sourcePath);
  const meta = await image.metadata();

  for (const width of widths) {
    // Never upscale — a 1264px source asked for at 1264 is a straight re-encode.
    const target = Math.min(width, meta.width);

    for (const [format, quality] of [
      ["avif", avif],
      ["webp", webp],
    ]) {
      const buffer = await sharp(sourcePath)
        .resize({ width: target, withoutEnlargement: true })
        .toFormat(format, { quality })
        .toBuffer();

      // 8 hex chars of content hash is plenty to bust an immutable cache and
      // keeps the filenames readable in a network panel.
      const { createHash } = await import("node:crypto");
      const hash = createHash("sha256").update(buffer).digest("hex").slice(0, 8);
      const name = `${base}-${target}.${hash}.${format}`;

      writeFileSync(path.join(outDir, name), buffer);
      entry[format][target] = name;
      totalOut += buffer.length;
    }
  }

  entry.width = Math.min(widths[widths.length - 1], meta.width);
  entry.height = Math.round(
    (meta.height / meta.width) * Math.min(widths[widths.length - 1], meta.width),
  );
  // Inline, not a file: at ~200 bytes it has to be in the manifest to be worth
  // anything — a placeholder that costs its own request is not a placeholder.
  entry.lqip = await makeLqip(sourcePath);
  manifest[base] = entry;

  console.log(`${base.padEnd(30)} ${formatKb(inBytes).padStart(9)} → ${widths.join("/")}px avif+webp`);
}

// Emitted as TypeScript rather than JSON on purpose: tsconfig.app.json does not
// set `resolveJsonModule`, and a generated .ts file gives the components a real
// union type for the image names instead of `string`.
writeManifest(manifest, outDir);

console.log(
  `\n${sources.length} images: ${formatKb(totalIn)} → ${formatKb(totalOut)} ` +
    `(${((1 - totalOut / totalIn) * 100).toFixed(1)}% smaller across all variants)`,
);
console.log(`Wrote ${outDir}`);
