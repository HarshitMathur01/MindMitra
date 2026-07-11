import { defineConfig, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createReadStream, createWriteStream, existsSync, readdirSync } from "fs";
import { mkdir, readdir } from "fs/promises";
import { pipeline } from "stream/promises";

const avatarVideosModuleId = "virtual:avatar-backdrop-videos";
const resolvedAvatarVideosModuleId = `\0${avatarVideosModuleId}`;
const avatarVideosDir = path.resolve(__dirname, "public/videos/Avatar_videos");
const avatarMediaPattern = /\.(mp4|webm|ogg|jpe?g|png|webp)$/i;

function readAvatarBackdropVideos() {
  if (!existsSync(avatarVideosDir)) return [];

  const videosByBase = new Map<string, { raw?: string; optimized?: string }>();
  const postersByBase = new Map<string, string>();

  for (const entry of readdirSync(avatarVideosDir, { withFileTypes: true })) {
    if (!entry.isFile()) continue;

    const ext = path.extname(entry.name);
    const stem = path.basename(entry.name, ext);
    const url = `/videos/Avatar_videos/${entry.name}`;

    if (/\.(mp4|webm|ogg)$/i.test(entry.name)) {
      const isOptimized = stem.endsWith(".optimized");
      const base = isOptimized ? stem.slice(0, -".optimized".length) : stem;
      const record = videosByBase.get(base) ?? {};
      if (isOptimized) record.optimized = url;
      else record.raw = url;
      videosByBase.set(base, record);
      continue;
    }

    if (/\.(jpe?g|png|webp)$/i.test(entry.name) && stem.endsWith(".poster")) {
      postersByBase.set(stem.slice(0, -".poster".length), url);
    }
  }

  return Array.from(videosByBase.entries())
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .flatMap(([base, video]) => {
      const src = video.optimized ?? video.raw;
      return src ? [{ src, poster: postersByBase.get(base) }] : [];
    });
}

function avatarBackdropVideosPlugin() {
  return {
    name: "avatar-backdrop-videos",
    resolveId(id: string) {
      if (id === avatarVideosModuleId) return resolvedAvatarVideosModuleId;
      return null;
    },
    load(id: string) {
      if (id !== resolvedAvatarVideosModuleId) return null;
      return `export default ${JSON.stringify(readAvatarBackdropVideos())};`;
    },
    configureServer(server: ViteDevServer) {
      // Defer watcher setup until server is ready to prevent blocking HTTP responses
      server.httpServer?.once('listening', () => {
        server.watcher.add(avatarVideosDir);
        server.watcher.on("all", (_event: string, file: string) => {
          const normalizedFile = path.normalize(file);
          if (!normalizedFile.startsWith(`${avatarVideosDir}${path.sep}`)) return;
          if (!avatarMediaPattern.test(normalizedFile)) return;

          const mod = server.moduleGraph.getModuleById(resolvedAvatarVideosModuleId);
          if (mod) {
            // Use setImmediate to avoid blocking the event loop
            setImmediate(() => {
              server.moduleGraph.invalidateModule(mod);
              server.ws.send({ type: "full-reload" });
            });
          }
        });
      });
    },
  };
}

function stripXattrsPlugin() {
  return {
    name: "strip-xattrs",
    apply: "build" as const,
    async configResolved(config: { root: string }) {
      const publicDir = path.resolve(config.root, "public");
      if (process.platform === "darwin" && existsSync(publicDir)) {
        const { spawn } = await import("child_process");
        await new Promise<void>((resolve, reject) => {
          const proc = spawn("xattr", ["-cr", publicDir], { stdio: "inherit" });
          proc.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`xattr failed with code ${code}`))));
          proc.on("error", reject);
        });
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ command }) => ({
  cacheDir: "node_modules/.vite-mindmitra",
  // Vite's default build-time public copy uses fs.copyFile, which can hang on
  // macOS files carrying provenance xattrs. We strip xattrs before build to avoid this.
  publicDir: "public",
  server: {
    // "::" = dual-stack loopback on macOS: responds to both localhost and
    // 127.0.0.1 so the browser works regardless of how macOS resolves localhost.
    // strictPort: true makes Vite fail fast if 8080 is taken instead of
    // silently moving to 8081 while you keep hitting the wrong port.
    host: "::",
    port: 8080,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      "/chat": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/onboarding": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/transcribe": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/me": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/speech": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/health": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/admin": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/therapist": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
    watch: {
      ignored: [
        "**/.git/**",
        "**/.cursor/**",
        "**/.pytest_cache/**",
        "**/chatbotAgent/**",
        "**/dist/**",
        "**/docs/**",
        "**/scripts/**",
        "**/tests/**",
        "**/supabase/**",
        "**/src/sounds/**",
        "**/src/pages/mindgym/forest/**",
        "**/src/components/handcrafted_image/**",
        "**/public/talkinghead/**",
        "**/*.md",
      ],
    },
  },
  plugins: [
    avatarBackdropVideosPlugin(),
    react(),
  ].filter(Boolean),
  resolve: {
    alias: [
      { find: /^lucide-react$/, replacement: path.resolve(__dirname, "./src/lib/lucide-react.ts") },
      { find: "@", replacement: path.resolve(__dirname, "./src") },
    ],
  },
  optimizeDeps: {
    // Keep dev startup bounded. A broad `src/**/*` glob makes Vite crawl
    // every lazy route and tool before the server is ready.
    entries: ["index.html"],
    include: [
      "react",
      "react-dom/client",
      "react/jsx-runtime",
      "react-router-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "framer-motion",
      "react-helmet-async",
      // Prebundle recharts so its lodash interop is normalized before the browser loads lazy routes.
      "recharts",
    ],
    // We alias lucide-react to a local selective facade below; excluding the
    // package prevents Vite's optimizer from crawling the upstream all-icons
    // barrel during the first browser request.
    exclude: ["lucide-react", "jspdf", "react-confetti", "mixpanel-browser"],
  },
  build: {
    // Cap the inlined-asset size so we don't bloat HTML with base64
    // images, but keep tiny SVG icons inlined.
    assetsInlineLimit: 4 * 1024,
    // 600 KB per chunk is the threshold above which Vite warns. Default
    // (500) is too noisy now that we ship a small set of intentional
    // vendor splits below; bump it modestly so the warning catches
    // *real* regressions only.
    chunkSizeWarningLimit: 600,
    // Avoid spending extra time gzipping every emitted chunk during local and
    // CI builds. Real compression is handled by the deploy/CDN layer.
    reportCompressedSize: false,
    rollupOptions: {
      output: {
        // ── Manual vendor chunking ──────────────────────────────────────
        // Goal: smallest possible critical path on the marketing landing
        // and /chat. The biggest deps in this app are framer-motion,
        // recharts, the radix-ui family, supabase-js, and tanstack-query.
        // Splitting them into their own chunks lets the browser cache
        // them long-term (their hashes rarely change vs our app code)
        // and parallelises download on first paint.
        //
        // Be conservative: any deeper splitting (e.g. per-route vendor
        // chunks) tends to *hurt* HTTP/2 perf. Keep this list small.
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          // Pin the cn() stack (clsx / cva / tailwind-merge) to its own tiny
          // chunk. Without an explicit assignment Rollup hoisted clsx into
          // vendor-charts, which made the entry statically import the whole
          // recharts bundle on every first paint.
          if (
            id.includes("/clsx/") ||
            id.includes("class-variance-authority") ||
            id.includes("tailwind-merge")
          ) {
            return "vendor-ui-utils";
          }
          if (id.includes("framer-motion")) return "vendor-motion";
          if (id.includes("recharts") || id.includes("d3-")) return "vendor-charts";
          if (id.includes("@radix-ui")) return "vendor-radix";
          if (id.includes("@supabase")) return "vendor-supabase";
          if (id.includes("@tanstack")) return "vendor-query";
          if (
            id.includes("react-dom") ||
            id.includes("/react/") ||
            id.includes("scheduler")
          ) {
            return "vendor-react";
          }
          // Everything else stays in the default vendor chunk so we
          // don't atomise into hundreds of tiny files.
          return undefined;
        },
      },
    },
  },
}));
