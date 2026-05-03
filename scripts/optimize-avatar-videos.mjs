import { existsSync, readdirSync, statSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const videosDir = path.join(repoRoot, "public", "videos", "Avatar_videos");
const sourceVideoPattern = /\.(mp4|webm|ogg)$/i;

function isStale(output, input) {
  if (!existsSync(output)) return true;
  return statSync(output).mtimeMs < statSync(input).mtimeMs;
}

function runFfmpeg(args, label) {
  const result = spawnSync("ffmpeg", args, { stdio: "inherit" });
  if (result.status !== 0) {
    throw new Error(`${label} failed. Make sure ffmpeg is installed and on PATH.`);
  }
}

function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

if (!existsSync(videosDir)) {
  console.error(`Avatar videos folder not found: ${videosDir}`);
  process.exit(1);
}

const sourceVideos = readdirSync(videosDir)
  .filter((file) => sourceVideoPattern.test(file))
  .filter((file) => !path.basename(file, path.extname(file)).endsWith(".optimized"))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

if (sourceVideos.length === 0) {
  console.log("No source avatar videos found.");
  process.exit(0);
}

for (const file of sourceVideos) {
  const sourcePath = path.join(videosDir, file);
  const baseName = path.basename(file, path.extname(file));
  const optimizedPath = path.join(videosDir, `${baseName}.optimized.mp4`);
  const posterPath = path.join(videosDir, `${baseName}.poster.jpg`);

  if (isStale(optimizedPath, sourcePath)) {
    console.log(`Optimizing ${file}...`);
    runFfmpeg(
      [
        "-y",
        "-i",
        sourcePath,
        "-an",
        "-vf",
        "scale='min(1280,iw)':-2,fps=24",
        "-c:v",
        "libx264",
        "-preset",
        "slow",
        "-crf",
        "30",
        "-movflags",
        "+faststart",
        "-pix_fmt",
        "yuv420p",
        optimizedPath,
      ],
      `Optimization for ${file}`,
    );

    const sourceSize = statSync(sourcePath).size;
    const optimizedSize = statSync(optimizedPath).size;
    console.log(`  ${formatBytes(sourceSize)} -> ${formatBytes(optimizedSize)}`);
  } else {
    console.log(`Optimized video is current: ${path.basename(optimizedPath)}`);
  }

  if (isStale(posterPath, optimizedPath)) {
    console.log(`Creating poster for ${file}...`);
    runFfmpeg(
      [
        "-y",
        "-ss",
        "0.2",
        "-i",
        optimizedPath,
        "-frames:v",
        "1",
        "-q:v",
        "5",
        posterPath,
      ],
      `Poster generation for ${file}`,
    );
  } else {
    console.log(`Poster is current: ${path.basename(posterPath)}`);
  }
}
