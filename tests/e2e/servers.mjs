/**
 * Starts everything the browser tests need, and stops it all when told to:
 *
 *   a fake AI provider and web search      http://127.0.0.1:4599
 *   Cyphor with fake providers connected   http://127.0.0.1:4174   (auto routing, God Mode, web sources)
 *   Cyphor with nothing connected          http://127.0.0.1:4173   (the built-in demo model)
 *
 * It builds the app first unless SKIP_BUILD=1. The demo server starts last, so Playwright, which waits
 * for that address, only starts testing once all three are ready. No key here is real.
 */
import { spawn, spawnSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const root = fileURLToPath(new URL("../..", import.meta.url))
// Next is started with node, not through npx: npx would leave the real server running when it is stopped.
const next = fileURLToPath(new URL("../../node_modules/next/dist/bin/next", import.meta.url))
const FAKE = Number(process.env.FAKE_LLM_PORT ?? 4599)
const DEMO = Number(process.env.DEMO_PORT ?? 4173)
const ROUTER = Number(process.env.ROUTER_PORT ?? 4174)
const fake = `http://127.0.0.1:${FAKE}`

/** Every variable that could connect a provider, emptied so a developer's own keys never leak into a test. */
const BLANK = [
  "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "GROQ_API_KEY", "OPENROUTER_API_KEY",
  "ZAI_API_KEY", "Z_AI_API_KEY", "ZHIPU_API_KEY", "NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY", "COHERE_API_KEY", "CO_API_KEY",
  "MISTRAL_API_KEY", "META_API_KEY", "LLAMA_API_KEY", "CLOUDFLARE_API_KEY", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN",
  "AIONLABS_API_KEY", "AION_API_KEY", "LLM_API_KEY", "LLM_BASE_URL", "LLM_MODELS", "LLM_MODEL", "TINYFISH_API_KEY", "TINYFISH_KEY",
  "ANTHROPIC_BASE_URL", "GROQ_BASE_URL", "MISTRAL_BASE_URL", "GEMINI_BASE_URL", "OPENROUTER_BASE_URL", "CYPHOR_BASIC_AUTH",
  "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "BETTER_AUTH_SECRET", "AUTH_SECRET", "BETTER_AUTH_URL", "APP_URL", "TRUSTED_ORIGINS",
].reduce((all, name) => ({ ...all, [name]: "" }), {})

const common = {
  ...BLANK,
  // Each server keeps its accounts and chats in a Postgres that lives inside its own process (PGlite), so nothing is
  // shared between runs and no database account is needed. The secret is made up and signs nothing real.
  BETTER_AUTH_SECRET: "e2e-session-secret-not-real-0123456789abcdef",
  AUTH_RATE_LIMIT: "off", // every test makes its own account from this one address
  LLM_ENV_DISABLE: "1",
  RATE_LIMIT_CHAT_PER_MIN: "1000",
  RATE_LIMIT_API_PER_MIN: "5000",
  RATE_LIMIT_GOD_PER_MIN: "1000",
  NEXT_TELEMETRY_DISABLED: "1",
}

const children = []
function start(command, args, env) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "inherit", "inherit"] })
  children.push(child)
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`[servers] ${args.join(" ")} stopped early (${code})`)
      stop(1)
    }
  })
  return child
}

let stopping = false
function stop(code = 0) {
  stopping = true
  for (const c of children) c.kill("SIGTERM")
  setTimeout(() => process.exit(code), 500)
}
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => stop(0))

async function waitFor(url, label) {
  for (let i = 0; i < 240; i++) {
    try {
      // Any answer that is not a server error means the server is up. Signed out, the API answers 401.
      if ((await fetch(url)).status < 500) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  console.error(`[servers] ${label} did not start in time`)
  stop(1)
}

if (process.env.SKIP_BUILD !== "1") {
  console.log("[servers] building")
  const build = spawnSync(process.execPath, [next, "build"], { cwd: root, stdio: "inherit", env: { ...process.env, NEXT_TELEMETRY_DISABLED: "1" } })
  if (build.status !== 0) process.exit(build.status ?? 1)
}

start(process.execPath, ["tests/e2e/fake-llm.mjs"], { FAKE_LLM_PORT: String(FAKE) })
await waitFor(`${fake}/health`, "the fake provider")

start(process.execPath, [next, "start", "-p", String(ROUTER), "-H", "127.0.0.1"], {
  ...common,
  DATABASE_URL: "pglite://memory",
  BETTER_AUTH_URL: `http://127.0.0.1:${ROUTER}`,
  GROQ_API_KEY: "e2e-groq-key-not-real",
  GROQ_BASE_URL: `${fake}/groq/v1`,
  MISTRAL_API_KEY: "e2e-mistral-key-not-real",
  MISTRAL_BASE_URL: `${fake}/mistral/v1`,
  ANTHROPIC_API_KEY: "e2e-anthropic-key-not-real",
  ANTHROPIC_BASE_URL: `${fake}/anthropic`,
  TINYFISH_API_KEY: "e2e-tinyfish-key-not-real",
  TINYFISH_SEARCH_URL: `${fake}/tinyfish/search`,
  TINYFISH_FETCH_URL: `${fake}/tinyfish/fetch`,
})
await waitFor(`http://127.0.0.1:${ROUTER}/login`, "Cyphor with fake providers")

start(process.execPath, [next, "start", "-p", String(DEMO), "-H", "127.0.0.1"], { ...common, DATABASE_URL: "pglite://memory", BETTER_AUTH_URL: `http://127.0.0.1:${DEMO}` })
await waitFor(`http://127.0.0.1:${DEMO}/login`, "Cyphor in demo mode")
console.log(`[servers] ready: demo ${DEMO}, fake providers ${ROUTER}`)
