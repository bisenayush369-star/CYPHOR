// Rewrites app/palettes.css from lib/scene/palettes.ts. Run with: npm run build:palettes
import { writeFileSync } from "node:fs"
import { paletteCss } from "../lib/scene/palette-css.ts"

writeFileSync(new URL("../app/palettes.css", import.meta.url), paletteCss())
console.log("wrote app/palettes.css")
