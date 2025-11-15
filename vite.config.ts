import path from "path";
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  root: path.resolve(__dirname, "src/renderer"),
  plugins: [vue()],
  resolve: {
    alias: {
      "@renderer": path.resolve(__dirname, "src/renderer")
    }
  },
  base: "./",
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: path.resolve(__dirname, "src/renderer/index.html")
    }
  },
  server: {
    port: 5174,
    strictPort: true
  }
});
