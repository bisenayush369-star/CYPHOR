import type { NextConfig } from "next"

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Load the database drivers from node_modules at run time instead of bundling them.
  // pg talks to Neon over TCP; PGlite (tests and local trials only) ships a WebAssembly file that must stay next to its code.
  serverExternalPackages: ["pg", "@electric-sql/pglite"],
  // `next dev` writes an AGENTS.md into the project when it sees an AI coding tool. This project keeps its own notes (README, DESIGN, TOOLKIT).
  agentRules: false,
}

export default config
