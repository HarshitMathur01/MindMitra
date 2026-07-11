import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, copyFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Compresses the TalkingHead avatar GLBs in place:
//   dedup -> prune -> resize textures to <=1024 -> WebP base color -> meshopt.
//
// Safe because the iframe's loader always registers MeshoptDecoder
// (public/talkinghead/modules/talkinghead.mjs) and three's GLTFLoader
// supports EXT_texture_webp natively. Do NOT run this on
// public/companion/*.glb — the companion viewer (src/lib/companion/viewer.js)
// has no meshopt decoder.
//
// Usage: node scripts/optimize-avatar-models.mjs [file.glb ...]
// With no arguments it processes every GLB in public/talkinghead/avatars.

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const avatarsDir = path.join(repoRoot, "public", "talkinghead", "avatars");

function runGltfTransform(args, label) {
  const result = spawnSync("npx", ["--yes", "@gltf-transform/cli", ...args], {
    stdio: ["ignore", "ignore", "inherit"],
    shell: process.platform === "win32",
  });
  if (result.status !== 0) {
    throw new Error(`gltf-transform ${label} failed for ${args.at(-2)}`);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

const targets = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(avatarsDir)
      .filter((name) => name.toLowerCase().endsWith(".glb"))
      .map((name) => path.join(avatarsDir, name));

if (!targets.length) {
  console.error(`No GLBs found in ${avatarsDir}`);
  process.exit(1);
}

const tmpDir = mkdtempSync(path.join(os.tmpdir(), "glb-opt-"));
try {
  for (const file of targets) {
    if (!existsSync(file)) {
      console.error(`Skipping missing file: ${file}`);
      continue;
    }
    const before = statSync(file).size;
    const step = (n) => path.join(tmpDir, `step${n}.glb`);

    runGltfTransform(["dedup", file, step(1)], "dedup");
    runGltfTransform(["prune", step(1), step(2)], "prune");
    runGltfTransform(["resize", "--width", "1024", "--height", "1024", step(2), step(3)], "resize");
    runGltfTransform(["webp", "--slots", "{baseColor,diffuse,emissive}*", step(3), step(4)], "webp");
    runGltfTransform(["meshopt", step(4), step(5)], "meshopt");

    copyFileSync(step(5), file);
    const after = statSync(file).size;
    console.log(`${path.basename(file)}: ${formatBytes(before)} -> ${formatBytes(after)}`);
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
