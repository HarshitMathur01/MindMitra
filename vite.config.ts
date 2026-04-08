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
}));
