import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { existsSync, readdirSync } from "fs";
import { componentTagger } from "lovable-tagger";

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
    configureServer(server) {
      server.watcher.add(avatarVideosDir);
      server.watcher.on("all", (_event, file) => {
        const normalizedFile = path.normalize(file);
        if (!normalizedFile.startsWith(`${avatarVideosDir}${path.sep}`)) return;
        if (!avatarMediaPattern.test(normalizedFile)) return;

        const mod = server.moduleGraph.getModuleById(resolvedAvatarVideosModuleId);
        if (mod) server.moduleGraph.invalidateModule(mod);
        server.ws.send({ type: "full-reload" });
      });
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: [
      "nonshrinkable-averie-unprovidently.ngrok-free.dev",
    ],
  },
  plugins: [
    avatarBackdropVideosPlugin(),
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    // Only scan the real app entry points — prevents Vite from crawling
    // public/talkinghead.html which uses an import-map bare specifier
    // ("talkinghead") that Vite cannot resolve as an npm package.
    entries: ["index.html", "src/**/*.{ts,tsx,js,jsx}"],

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
