# Artifact runtime

Two files that Cyphor serves itself, so the preview of a React artifact does not depend on a CDN. Both are committed, so the app runs without a build step for them. They are public files and are not behind the sign-in page.

| File | What it is | Size | SHA-256 |
| --- | --- | --- | --- |
| `runtime.js` | The program that runs inside the preview frame: React 19.3.1 and ReactDOM, the sucrase 3.35.1 compiler (JSX and TypeScript), lucide-react 1.62.0, Recharts 3.10.1 and clsx 2.1.1, in one file | 1.8 MB | `546f86b1be579ce1ea322653e5548b020df8adc508adfeea2c8abf481933ab91` |
| `tailwind.js` | Tailwind CSS 4.3.5 for the browser | 287 KB | `2d0753619d37bb4452761b874ffc6ae6429e9e051eb26f44c5ac83c7362fc7b1` |

## Where they come from

**`runtime.js`** is built from `scripts/artifact-runtime/entry.ts` with esbuild 0.28.2:

```bash
npm run build:artifact-runtime
```

Building with the packages in `package-lock.json` gives this file byte for byte (checked on 2026-11-20). Rebuild it after changing the entry file or upgrading one of the packages above, then open a React artifact to check that it still runs. The modules an artifact may import are listed in `MODULES` in the entry file: `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client`, `lucide-react`, `recharts` and `clsx`. Anything else is reported back to the model with that list so it can correct itself.

**`tailwind.js`** is `dist/index.global.js` from the npm package `@tailwindcss/browser@4.3.5`, unchanged. Its SHA-256 matches the file in that package (checked on 2026-11-20). To update it, run `npm pack @tailwindcss/browser@<version>` in an empty folder, copy `package/dist/index.global.js` here as `tailwind.js`, and update the table above.

## Mermaid is not here

Diagrams load Mermaid from jsDelivr when they open: `https://cdn.jsdelivr.net/npm/mermaid@12.3.0/dist/mermaid.min.js`, with a subresource-integrity hash. The hash in `lib/artifact/srcdoc.ts` (`MERMAID_SRI`) is the SHA-384 of `dist/mermaid.min.js` in the npm package `mermaid@12.3.0` (checked on 2026-11-20). A file that does not match its hash is refused, and the panel says so. To move to another version, change `MERMAID_URL` and `MERMAID_SRI` together.

Not checked: that jsDelivr serves exactly the bytes npm publishes. The container this project was built in cannot reach jsDelivr, so the test that draws a diagram skips itself there.

## Licences

The built `runtime.js` carries no licence headers, so they are credited here.

| Package | Licence |
| --- | --- |
| React, ReactDOM, sucrase, Recharts, clsx, esbuild | MIT |
| lucide-react | ISC |
| Tailwind CSS (`@tailwindcss/browser`), Mermaid | MIT |
