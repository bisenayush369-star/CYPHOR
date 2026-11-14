import { fileURLToPath } from "node:url"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
import { viteSingleFile } from "vite-plugin-singlefile"

const here = (path: string) => fileURLToPath(new URL(path, import.meta.url))

/**
 * Builds the single-file preview: the whole app in one HTML file that opens from disk, with a demo model and no server.
 *
 *   npm run build:preview     writes dist-preview/index.html
 *
 * The two Next.js modules the screens use are swapped for small stand-ins (preview/shims), and __STANDALONE__
 * switches off everything that needs a server (see lib/provider.ts).
 */
export default defineConfig({
  root: here("."),
  plugins: [react(), tailwindcss(), viteSingleFile()],
  define: { __STANDALONE__: "true" },
  resolve: {
    alias: [
      { find: /^next\/link$/, replacement: here("shims/link.tsx") },
      { find: /^next\/navigation$/, replacement: here("shims/navigation.ts") },
      { find: /^@\//, replacement: here("../") },
    ],
  },
  build: { outDir: here("../dist-preview"), emptyOutDir: true, target: "es2022", chunkSizeWarningLimit: 4096 },
})
