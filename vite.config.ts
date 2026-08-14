import { defineConfig, loadEnv, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { createReadStream, createWriteStream, existsSync, readdirSync } from "fs";
import { mkdir, readdir } from "fs/promises";
import { pipeline } from "stream/promises";
import {
  HERO_SIZES,
  sceneForHour,
  type TimeScene,
} from "./src/components/sanctuary/river/scene";

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

const HERO_PRELOAD_MARKER = "<!-- nr:hero-preload -->";
const HERO_ASSET = /^hero-landscape-(morning|afternoon|evening|night)-(\d+)\./;

/**
 * Starts the Night River hero download from `<head>`, before any JS exists.
 *
 * The hero is the LCP candidate on the authenticated `/`, and it was the last
 * thing the browser learned about: `/` is a lazy route behind an auth check,
 * so the `<img>` does not exist until the entry chunk, the vendor chunks, the
 * auth resolution and the route chunk have all landed. Measured on Slow 4G
 * that put the request at ~3.9s — the bytes were never the problem, the
 * discovery was. `fetchpriority="high"` on the element cannot help with this;
 * it only ranks a request that has already been made.
 *
 * Two things have to be baked in at build time for a `<head>` script to name
 * the right file: which scene belongs to the current hour (`sceneForHour`,
 * imported so this cannot drift from what the page will actually render) and
 * the content-hashed URLs, which are read back out of the emitted bundle
 * rather than guessed — a preload naming a file the page won't request is
 * worse than no preload at all, it is a second download.
 *
 * Only AVIF is preloaded. `type="image/avif"` means a browser without support
 * ignores the tag entirely and falls through to the WebP `<source>`.
 */
function nightRiverHeroPreload() {
  let base = "/";

  return {
    name: "night-river-hero-preload",
    configResolved(config: { base: string }) {
      base = config.base;
    },
    transformIndexHtml: {
      // `post` so the asset URLs are final and present in the bundle.
      order: "post" as const,
      handler(
        html: string,
        ctx: { bundle?: Record<string, { type: string; fileName?: string }> },
      ) {
        if (!html.includes(HERO_PRELOAD_MARKER)) return html;
        // Dev has no bundle and no throttled network; not worth a shim.
        if (!ctx.bundle) return html.replace(HERO_PRELOAD_MARKER, "");

        const srcSets = new Map<TimeScene, string[]>();
        for (const output of Object.values(ctx.bundle)) {
          if (output.type !== "asset" || !output.fileName) continue;
          const match = HERO_ASSET.exec(path.basename(output.fileName));
          if (!match || !output.fileName.endsWith(".avif")) continue;
          const scene = match[1] as TimeScene;
          const entry = srcSets.get(scene) ?? [];
          entry.push(`${base}${output.fileName} ${match[2]}w`);
          srcSets.set(scene, entry);
        }

        // All four or none: a partial table would leave whoever loads at the
        // missing hour silently slower than everyone else.
        const scenes: TimeScene[] = ["morning", "afternoon", "evening", "night"];
        if (scenes.some((scene) => !srcSets.get(scene)?.length)) {
          this.warn?.(
            "[night-river-hero-preload] hero AVIF variants missing from the bundle — skipping the preload",
          );
          return html.replace(HERO_PRELOAD_MARKER, "");
        }

        const bySceneJson = JSON.stringify(
          Object.fromEntries(scenes.map((scene) => [scene, srcSets.get(scene)!.join(", ")])),
        );
        // Hour → scene, evaluated here so the browser ships a lookup rather
        // than a second copy of the branching in scene.ts.
        const hoursJson = JSON.stringify(
          Array.from({ length: 24 }, (_, hour) => sceneForHour(hour)),
        );

        const script = `<script>/* generated by night-river-hero-preload — see vite.config.ts */
(function(){
  if (location.pathname !== "/") return;
  try {
    var authed = false;
    for (var i = 0; i < localStorage.length; i++) {
      var k = localStorage.key(i);
      if (k && k.indexOf("sb-") === 0 && k.slice(-11) === "-auth-token") { authed = true; break; }
    }
    /* An unauthenticated "/" is the marketing page and has no hero art. This
       audience is mostly on metered mobile data; speculatively pulling ~60 KB
       they will never see is not a rounding error to them. */
    if (!authed) return;
  } catch (e) { return; }
  var srcset = ${bySceneJson}[${hoursJson}[new Date().getHours()]];
  var l = document.createElement("link");
  l.rel = "preload"; l.as = "image"; l.type = "image/avif";
  l.setAttribute("imagesrcset", srcset);
  l.setAttribute("imagesizes", ${JSON.stringify(HERO_SIZES)});
  l.setAttribute("fetchpriority", "high");
  document.head.appendChild(l);
})();
</script>`;

        return html.replace(HERO_PRELOAD_MARKER, script);
      },
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
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const backendTarget = (env.VITE_BACKEND_URL?.trim() || "http://127.0.0.1:8000").replace(/\/$/, "");

  return {
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
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes("text/html")) {
            return "/index.html"; // Let Vite serve the SPA instead of proxying to the backend
          }
        },
      },
      "/onboarding": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes("text/html")) return "/index.html";
        },
      },
      "/transcribe": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/me": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/speech": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/health": {
        target: backendTarget,
        changeOrigin: true,
      },
      "/admin": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes("text/html")) return "/index.html";
        },
      },
      "/therapist": {
        target: backendTarget,
        changeOrigin: true,
        bypass(req) {
          if (req.headers.accept?.includes("text/html")) return "/index.html";
        },
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
        "**/*.md",
      ],
    },
  },
  plugins: [
    avatarBackdropVideosPlugin(),
    nightRiverHeroPreload(),
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
        manualChunks(rawId) {
          // Rollup ids are posix on every platform Vite supports, but the
          // Windows dev machines in this repo have produced back-slashed ids
          // before; normalise so the substring matches below can't silently
          // stop matching and quietly re-bloat the critical path.
          const id = rawId.replace(/\\/g, "/");
          if (!id.includes("node_modules")) return undefined;
          // ── Tiny shared class-name utils, pinned FIRST ────────────────
          // clsx / tailwind-merge / cva are ~2 KB total but are imported by
          // both `cn()` (every surface, including the eager App shell) and
          // by recharts. Left unassigned, Rollup hoisted them into whichever
          // manual chunk claimed them first — which was vendor-charts. The
          // entry then had to statically `import { clsx } from vendor-charts`,
          // dragging all 367 KB of recharts + d3 into first paint on every
          // route. Giving them their own chunk keeps them shared and keeps
          // recharts strictly lazy. Verify with:
          //   grep 'vendor-charts' dist/index.html   → must not appear
          if (
            id.includes("node_modules/clsx") ||
            id.includes("node_modules/tailwind-merge") ||
            id.includes("node_modules/class-variance-authority")
          ) {
            return "vendor-classnames";
          }
          if (id.includes("node_modules/three")) return "vendor-three";
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
  };
});
