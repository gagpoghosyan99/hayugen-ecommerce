import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
  build: {
    outDir: "preview/rail",
    emptyOutDir: true,
    cssCodeSplit: false,
    lib: {
      entry: path.resolve(__dirname, "src/rail-entry.tsx"),
      name: "HayugenRail",
      formats: ["iife"],
      fileName: () => "rail.js",
    },
    rollupOptions: {
      output: {
        assetFileNames: "rail[extname]",
        inlineDynamicImports: true,
      },
    },
  },
});
