import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

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
