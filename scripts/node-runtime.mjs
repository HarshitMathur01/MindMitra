import { existsSync, mkdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");

const LOCAL_NODE_VERSION = "v22.13.0";
const NODE_DIST_PLATFORM = process.platform === "darwin" ? "darwin" : null;
const NODE_DIST_ARCH = process.arch === "arm64" || process.arch === "x64" ? process.arch : null;
const localNodeDir =
  NODE_DIST_PLATFORM && NODE_DIST_ARCH
    ? `node-${LOCAL_NODE_VERSION}-${NODE_DIST_PLATFORM}-${NODE_DIST_ARCH}`
    : null;

export function isSupportedVersion(version = process.versions.node) {
  const [major, minor] = version.split(".").map(Number);
  return (major === 22 && minor >= 13) || major >= 24;
}

export function findSupportedNode() {
  const candidates = [
    localNodeDir ? path.join(root, ".tools", localNodeDir, "bin", "node") : null,
    "/opt/homebrew/opt/node@22/bin/node",
    "/opt/homebrew/opt/node@24/bin/node",
  ].filter(Boolean);

  for (const nodePath of candidates) {
    if (existsSync(nodePath)) return nodePath;
  }

  return null;
}

export function installLocalSupportedNode() {
  if (!NODE_DIST_PLATFORM || !NODE_DIST_ARCH || !localNodeDir) {
    return null;
  }

  const toolsDir = path.join(root, ".tools");
  const archive = path.join(toolsDir, `${localNodeDir}.tar.xz`);
  const targetNode = path.join(toolsDir, localNodeDir, "bin", "node");
  const url = `https://nodejs.org/dist/${LOCAL_NODE_VERSION}/${localNodeDir}.tar.xz`;

  if (existsSync(targetNode)) return targetNode;

  mkdirSync(toolsDir, { recursive: true });
  rmSync(archive, { force: true });

  run("curl", ["-L", url, "-o", archive]);
  run("tar", ["-xJf", archive, "-C", toolsDir]);
  rmSync(archive, { force: true });

  return existsSync(targetNode) ? targetNode : null;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: "inherit",
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

export function supportedNodeBinDir(nodePath) {
  return path.dirname(nodePath);
}

export function projectRoot() {
  return root;
}

export { LOCAL_NODE_VERSION };
