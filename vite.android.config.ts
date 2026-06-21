import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  base: "/",
  root: path.resolve(import.meta.dirname),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/android"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: path.resolve(import.meta.dirname, "index.html"),
    },
  },
});
