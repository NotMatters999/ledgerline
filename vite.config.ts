import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

// https://vite.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  // 1. Prevent Vite from obscuring rust errors
  clearScreen: false,

  build: {
    // No sourcemaps in production bundle — reduces output size significantly
    sourcemap: false,
    // Raise warning threshold; our chunks are intentionally separated below
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Split the 770KB monolith into async chunks:
        // - echarts is ~400KB on its own; lazy-load it separately
        // - zustand + react-dom can share a vendor chunk
        manualChunks: {
          // React runtime — changes rarely, good for cache hits
          "vendor-react": ["react", "react-dom"],
          // ECharts core + charts — large but only needed for chart views
          "vendor-echarts": [
            "echarts/core",
            "echarts/charts",
            "echarts/components",
            "echarts/renderers",
          ],
          // State management
          "vendor-zustand": ["zustand"],
        },
      },
    },
  },

  // 2. Tauri expects a fixed port, fail if that port is not available
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // 3. Tell Vite to ignore watching `src-tauri`
      ignored: ["**/src-tauri/**"],
    },
  },
}));
