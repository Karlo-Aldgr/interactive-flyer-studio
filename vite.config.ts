import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime", "@tanstack/react-query", "@tanstack/query-core"],
  },
  build: {
    rollupOptions: {
      output: {
        // Split big vendor libs into their own cacheable chunks so the initial
        // bundle stays small and library upgrades don't bust the whole cache.
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          // Keep React core with the shared vendor chunk so every other vendor
          // chunk resolves the same React instance at load time.
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/") ||
            id.includes("node_modules/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("react-konva") || id.includes("/konva/") || id.includes("use-image")) {
            return "konva";
          }
          if (id.includes("recharts") || id.includes("d3-")) {
            return "charts";
          }
          if (id.includes("@supabase") || id.includes("@lovable.dev/cloud-auth-js")) {
            return "supabase";
          }
          if (id.includes("@radix-ui")) {
            return "radix";
          }
          if (id.includes("lucide-react")) {
            return "icons";
          }
          if (id.includes("react-router") || id.includes("@tanstack")) {
            return "react-vendor";
          }
          if (id.includes("jszip") || id.includes("qrcode.react")) {
            return "utils-vendor";
          }
        },
      },
    },
  },
}));
