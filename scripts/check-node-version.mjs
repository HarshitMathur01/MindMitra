import { findSupportedNode, isSupportedVersion } from "./node-runtime.mjs";

if (!isSupportedVersion()) {
  const fallback = findSupportedNode();
  if (fallback) {
    console.log(
      `Current Node is ${process.versions.node}; npm scripts will use supported runtime: ${fallback}`,
    );
    process.exit(0);
  }
  console.error(
    [
      "",
      `MindMitra frontend requires Node >=22.13.0 <23 or >=24. Current: ${process.versions.node}.`,
      "Node 23 is intentionally blocked because Vite/Rollup native tooling has been unstable on it in this repo.",
      "Install the repo-local Node 22 runtime under .tools/ or switch your shell to Node 22.13.0 / 24+.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

console.log(`Node ${process.versions.node} is supported.`);
