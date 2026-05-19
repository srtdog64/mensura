import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const here = fileURLToPath(new URL(".", import.meta.url));
const root = resolve(here, "../..");

export default defineConfig({
  build: {
    emptyOutDir: true,
    lib: {
      entry: resolve(here, "src/index.ts"),
      fileName: "mensura-browser-smoke",
      formats: ["es"]
    },
    minify: false,
    outDir: resolve(root, ".mensura-smoke/browser-smoke"),
    target: "es2022"
  },
  resolve: {
    alias: [
      {
        find: /^@exornea\/mensura$/,
        replacement: resolve(root, "dist/index.js")
      },
      {
        find: /^@exornea\/mensura\/([^/]+)$/,
        replacement: resolve(root, "dist/$1/index.js")
      }
    ]
  }
});
