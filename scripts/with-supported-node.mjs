import { spawn } from "node:child_process";
import path from "node:path";
import {
  findSupportedNode,
  installLocalSupportedNode,
  isSupportedVersion,
  projectRoot,
  supportedNodeBinDir,
} from "./node-runtime.mjs";

const [command, ...args] = process.argv.slice(2);

if (!command) {
  console.error("Usage: node scripts/with-supported-node.mjs <command> [...args]");
  process.exit(1);
}

const root = projectRoot();
let nodePath = isSupportedVersion() ? process.execPath : findSupportedNode();

if (!nodePath) {
  console.log("Installing repo-local Node 22 runtime for MindMitra frontend...");
  nodePath = installLocalSupportedNode();
}

if (!nodePath) {
  console.error(
    [
      "",
      `MindMitra frontend needs Node >=22.13.0 <23 or >=24. Current: ${process.versions.node}.`,
      "Install the repo-local runtime with:",
      "  mkdir -p .tools",
      "  curl -L https://nodejs.org/dist/v22.13.0/node-v22.13.0-darwin-arm64.tar.xz -o .tools/node-v22.13.0-darwin-arm64.tar.xz",
      "  tar -xJf .tools/node-v22.13.0-darwin-arm64.tar.xz -C .tools",
      "  rm .tools/node-v22.13.0-darwin-arm64.tar.xz",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

const binPaths = [
  path.join(root, "node_modules", ".bin"),
  supportedNodeBinDir(nodePath),
  process.env.PATH ?? "",
].filter(Boolean);

const child = spawn(command, args, {
  cwd: root,
  env: {
    ...process.env,
    PATH: binPaths.join(path.delimiter),
    MINDMITRA_NODE_RUNTIME: nodePath,
  },
  stdio: "inherit",
  shell: process.platform === "win32",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});

child.on("error", (error) => {
  console.error(error.message);
  process.exit(1);
});
