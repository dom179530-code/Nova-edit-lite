import { defineConfig } from "vite";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export default defineConfig({
  base: "/",
  root: __dirname,
  build: {
    outDir: resolve(__dirname, "dist/android"),
    emptyOutDir: true,
    assetsInlineLimit: 0,
    rollupOptions: { input: resolve(__dirname, "index.html") },
  },
});
