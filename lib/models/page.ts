/**
 * Cyphor chat · model registry
 * Snapshot: 2026-10-27. Free tiers change often, so re-check each provider's
 * docs link before trusting a limit.
 *
 * Put this file at lib/models.ts.
 * Keep every API key server-side (route handlers / server actions).
 * Never use a NEXT_PUBLIC_ prefix for a key.
 *
 * Tiers are computed from the numbers, so you never mislabel a model:
 *   context: low <= 128K | medium 200K-262K | high ~1M
 *   output : low < 16K   | medium 16K-63K   | high >= 64K
 *
 * `plan` tells you what your key gets today:
 *   free / free-preview / trial = no payment, `prodOk` says if terms allow a live site
 *   credits / prepaid / paid    = costs money (keep behind login + spend limits)
 *   unverified                  = reported free, not confirmed on the official page
 */

export type ProviderId =
  | "gemini"
  | "groq"
  | "openrouter"
  | "zai"
  | "nvidia"
  | "cohere"
  | "anthropic"
  | "meta";

export type Capability =
  | "chat"
  | "coding"
  | "ultracode"
  | "reasoning"
  | "vision"
  | "image-gen"
  | "deep-research"
  | "web-search"
  | "fast"
  | "multilingual"
  | "speech-to-text"
  | "embeddings"
  | "rerank";

export type Tier = "low" | "medium" | "high" | "unknown";
export type Modality = "text" | "image" | "audio" | "video" | "pdf";
export type Plan =
  | "free"
  | "free-preview"
  | "trial"
  | "credits"
  | "prepaid"
  | "paid"
  | "unverified";

export interface ProviderSpec {
  label: string;
  envKey: string;
  baseUrl: string;
  protocol: "openai" | "anthropic";
  keyUrl: string;
  docsUrl: string;
  plan: Plan;
  notes: string;
}

export interface ModelSpec {
  key: string; // `${provider}::${id}`
  id: string; // exact model id sent to the provider
  label: string; // shown in the UI
  provider: ProviderId;
  capabilities: Capability[];
  bestFor: string; // one-line specialty for the model card
  contextTokens: number | null; // null = not verified
  maxOutputTokens: number | null;
  inputs: Modality[];
  outputs: ("text" | "image")[];
  tools: boolean | null; // function calling
  plan: Plan;
  prodOk: boolean; // terms allow a public production site as-is
  trainsOnPrompts: boolean | "maybe" | "unknown";
  limits: string;
  notes?: string;
  verified: "official" | "third-party"; // where the specs came from
  defaultEnabled: boolean; // show in the public picker by default
}

/* ------------------------------------------------------------------ */
/* Providers (one entry per key in your .env)                          */
/* ------------------------------------------------------------------ */

export const PROVIDERS: Record<ProviderId, ProviderSpec> = {
  gemini: {
    label: "Google Gemini",
    envKey: "GEMINI_API_KEY",
    // OpenAI-compatible endpoint (confirm in Google's docs). Google also pushes its Interactions API for new work.
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    protocol: "openai",
    keyUrl: "https://aistudio.google.com/apikey",
    docsUrl: "https://ai.google.dev/gemini-api/docs/pricing",
    plan: "free",
    notes:
      "Free-tier content may be used to improve Google products. Apps serving users in the EEA, Switzerland or the UK must use paid. Google Search grounding is paid-only on Gemini 3+ (5,000 free grounded prompts/month on paid, then $14 per 1,000). Free limits are only shown inside AI Studio.",
  },
  groq: {
    label: "Groq",
    envKey: "GROQ_API_KEY",
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai",
    keyUrl: "https://console.groq.com/keys",
    docsUrl: "https://console.groq.com/docs/models",
    plan: "free",
    notes:
      "Free plan trackers report ~30 req/min, 1,000 req/day and ~8,000 tokens/min, so long prompts fail. Needs phone verification. Preview models can be discontinued at short notice.",
  },
  openrouter: {
    label: "OpenRouter",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai",
    keyUrl: "https://openrouter.ai/keys",
    docsUrl: "https://openrouter.ai/docs/api-reference/limits",
    plan: "free",
    notes:
      "All ':free' models share 20 req/min and 50 req/day (1,000/day after a one-time $10 credit purchase). The free list changes weekly: fetch /api/v1/models and filter ids ending in ':free'. Some free hosts may train on prompts; send provider.data_collection='deny' when privacy matters. Terms bar reselling API access or building a competing service.",
  },
  zai: {
    label: "Z.ai (GLM)",
    envKey: "ZAI_API_KEY",
    // General endpoint; confirm in docs.z.ai.
    baseUrl: "https://api.z.ai/api/paas/v4/",
    protocol: "openai",
    keyUrl: "https://z.ai",
    docsUrl: "https://docs.z.ai/guides/overview/pricing",
    plan: "free",
    notes:
      "Only the Flash models are free, and the free tier handles one request at a time. Flagship GLM-5.x, image models and Web Search ($0.01/use) are paid. Terms ban using it to build competing models.",
  },
  nvidia: {
    label: "NVIDIA NIM",
    envKey: "NVIDIA_API_KEY",
    baseUrl: "https://integrate.api.nvidia.com/v1",
    protocol: "openai",
    keyUrl: "https://build.nvidia.com/settings/api-keys",
    docsUrl: "https://build.nvidia.com",
    plan: "free",
    notes:
      "The free endpoint is for prototyping and testing (~40 req/min reported). Use a partner endpoint for production. Keep it out of public routes.",
  },
  cohere: {
    label: "Cohere",
    envKey: "COHERE_API_KEY",
    // OpenAI-compatible endpoint (confirm in Cohere's docs).
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    protocol: "openai",
    keyUrl: "https://dashboard.cohere.com/api-keys",
    docsUrl: "https://docs.cohere.com/docs/models",
    plan: "trial",
    notes:
      "Trial keys are for evaluation only (no production or commercial use) and reported at 20 chat req/min and 1,000 calls/month. Great for prototyping RAG with Embed and Rerank.",
  },
  anthropic: {
    label: "Anthropic Claude",
    envKey: "ANTHROPIC_API_KEY",
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    keyUrl: "https://platform.claude.com/settings/keys",
    docsUrl: "https://platform.claude.com/docs/en/models/overview",
    plan: "prepaid",
    notes:
      "Not free: the API runs on prepaid credits (Tier 1 starts with a $5 purchase). Set a monthly spend limit in Console > Settings > Limits. On a public site keep Claude behind login and per-user caps.",
  },
  meta: {
    label: "Meta Model API (Muse)",
    envKey: "META_API_KEY",
    baseUrl: "https://api.meta.ai/v1",
    protocol: "openai",
    keyUrl: "https://dev.meta.ai/platform",
    docsUrl: "https://dev.meta.ai/docs/models",
    plan: "credits",
    notes:
      "Meta retired the free Llama API preview on 2026-07-06. The current Meta Model API is pay-as-you-go (launch coverage mentioned $20 starter credits; no free tier documented). Avoid '-contributor' model ids: they let Meta train on your content. Availability varies by country.",
  },
};

/* ------------------------------------------------------------------ */
/* Capability labels for the UI                                        */
/* ------------------------------------------------------------------ */

export const CAPABILITIES: Record<Capability, { label: string; blurb: string }> = {
  chat: { label: "General chat", blurb: "Everyday questions, writing and summaries." },
  coding: { label: "Coding", blurb: "Write, explain and debug code." },
  ultracode: {
    label: "Ultracode",
    blurb: "Long-horizon, repo-scale agentic coding. Free models here are good, not Opus-level.",
  },
  reasoning: { label: "Reasoning & math", blurb: "Step-by-step problem solving." },
  vision: { label: "Image understanding", blurb: "Read screenshots, charts, documents and photos." },
  "image-gen": {
    label: "Image generation",
    blurb: "Create or edit images. No free option in the current keys (see MISSING).",
  },
  "deep-research": {
    label: "Deep research",
    blurb: "Long-context synthesis over many sources. Needs a search tool (see MISSING).",
  },
  "web-search": {
    label: "Built-in web search",
    blurb: "Search is part of the model API (usually billed per search).",
  },
  fast: { label: "Fastest", blurb: "Lowest latency for short replies." },
  multilingual: { label: "Multilingual", blurb: "Strong across many languages." },
  "speech-to-text": { label: "Speech to text", blurb: "Transcribe audio." },
  embeddings: { label: "Embeddings", blurb: "Vectors for search and RAG." },
  rerank: { label: "Rerank", blurb: "Re-order retrieved passages for RAG." },
};

/* ------------------------------------------------------------------ */
/* Tiers                                                               */
/* ------------------------------------------------------------------ */

export const contextTier = (n: number | null): Tier =>
  n == null ? "unknown" : n <= 131_072 ? "low" : n <= 300_000 ? "medium" : "high";

export const outputTier = (n: number | null): Tier =>
  n == null ? "unknown" : n < 16_000 ? "low" : n < 64_000 ? "medium" : "high";

export const TIER_HELP = {
  context: { low: "up to 128K", medium: "200K-262K", high: "about 1M" },
  output: { low: "under 16K", medium: "16K-63K", high: "64K or more" },
} as const;

/* ------------------------------------------------------------------ */
/* Models                                                              */
/* ------------------------------------------------------------------ */

const DEFS: Omit<ModelSpec, "key">[] = [
  /* ---------- Google Gemini (GEMINI_API_KEY) ---------- */
  {
    id: "gemini-3.8-flash",
    label: "Gemini 3.8 Flash",
    provider: "gemini",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "vision", "deep-research", "multilingual"],
    bestFor: "Best free all-rounder: 1M-token context, long-horizon coding and agents, multimodal input.",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputs: ["text", "image", "audio", "video", "pdf"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: true,
    limits: "Free tier; exact limits only shown in AI Studio.",
    notes: "Supports thinking, code execution and URL context. Search grounding needs the paid tier.",
    verified: "official",
    defaultEnabled: true,
  },
  {
    id: "gemini-3.6-flash",
    label: "Gemini 3.6 Flash",
    provider: "gemini",
    capabilities: ["chat", "coding", "reasoning", "vision", "deep-research", "multilingual"],
    bestFor: "Previous-gen Flash, still GA: agentic and multimodal work with the same 1M context.",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputs: ["text", "image", "audio", "video", "pdf"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: true,
    limits: "Free tier; exact limits only shown in AI Studio.",
    verified: "official",
    defaultEnabled: true,
  },
  {
    id: "gemini-3.5-flash-lite",
    label: "Gemini 3.5 Flash-Lite",
    provider: "gemini",
    capabilities: ["chat", "fast", "vision", "multilingual"],
    bestFor: "Cheapest, fastest Gemini (~350 tok/s): routing, summaries, translation, high-volume chat.",
    contextTokens: 1_048_576,
    maxOutputTokens: 65_536,
    inputs: ["text", "image", "audio", "video", "pdf"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: true,
    limits: "Free tier, rate-limited; exact limits only shown in AI Studio.",
    verified: "official",
    defaultEnabled: true,
  },
  {
    id: "deep-research-preview-04-2026",
    label: "Gemini Deep Research (preview)",
    provider: "gemini",
    capabilities: ["deep-research", "web-search"],
    bestFor: "Google's managed research agent. Runs in the background through the Interactions API.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["text"],
    tools: null,
    plan: "unverified",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Free-tier access not confirmed. Grounded search is paid-only on Gemini 3+, so expect to need billing.",
    notes: "deep-research-max-preview-04-2026 is the exhaustive variant.",
    verified: "official",
    defaultEnabled: false,
  },

  /* ---------- Groq (GROQ_API_KEY) ---------- */
  {
    id: "openai/gpt-oss-120b",
    label: "GPT-OSS 120B",
    provider: "groq",
    capabilities: ["chat", "coding", "reasoning", "fast"],
    bestFor: "Fast open-weight reasoning model (~500 tok/s). Great default for chat and code.",
    contextTokens: 131_072,
    maxOutputTokens: 65_536,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "Free tier (tracker, Oct 2026): ~30 req/min, 1,000 req/day, ~8,000 tokens/min. Long prompts will fail.",
    verified: "official",
    defaultEnabled: true,
  },
  {
    id: "openai/gpt-oss-20b",
    label: "GPT-OSS 20B",
    provider: "groq",
    capabilities: ["chat", "fast", "reasoning"],
    bestFor: "Fastest reasoning-capable model on Groq (~1,000 tok/s) for short, high-volume replies.",
    contextTokens: 131_072,
    maxOutputTokens: 65_536,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "Free tier (tracker, Oct 2026): ~30 req/min, 1,000 req/day, ~8,000 tokens/min.",
    verified: "official",
    defaultEnabled: true,
  },
  {
    id: "qwen/qwen3.8-27b",
    label: "Qwen3.8 27B (preview)",
    provider: "groq",
    capabilities: ["chat", "coding", "reasoning", "multilingual"],
    bestFor: "Strong mid-size model with toggleable thinking. Preview, so it can disappear at short notice.",
    contextTokens: 131_072,
    maxOutputTokens: 16_384,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free-preview",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Free tier (tracker, Oct 2026): ~30 req/min, 1,000 req/day, ~8,000 tokens/min.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "whisper-large-v3-turbo",
    label: "Whisper Large v3 Turbo",
    provider: "groq",
    capabilities: ["speech-to-text", "multilingual"],
    bestFor: "Fast multilingual speech-to-text for voice input.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["audio"],
    outputs: ["text"],
    tools: false,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "Free-plan audio caps: check the Groq console.",
    verified: "official",
    defaultEnabled: true,
  },

  /* ---------- OpenRouter (OPENROUTER_API_KEY) ---------- */
  {
    id: "thinkingmachines/inkling:free",
    label: "Inkling (free)",
    provider: "openrouter",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "vision", "deep-research"],
    bestFor: "1M-context multimodal reasoner: agentic coding, math, visual reasoning, audio understanding.",
    contextTokens: 1_000_000,
    maxOutputTokens: 262_144,
    inputs: ["text", "image", "audio"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: "maybe",
    limits: "Shared pool: 20 req/min and 50 req/day across all :free models (1,000/day after a one-time $10 credit purchase).",
    notes:
      "Free hosts may train on prompts; if you deny data collection this model may have no host, so fall back to Gemma 4. Strong on math and vision, weaker on factuality and long-horizon agentic coding than frontier models.",
    verified: "third-party",
    defaultEnabled: true,
  },
  {
    id: "google/gemma-4-31b-it:free",
    label: "Gemma 4 31B (free)",
    provider: "openrouter",
    capabilities: ["chat", "vision", "multilingual"],
    bestFor: "Google's open model: 262K context, image and video input, host that does not train on prompts.",
    contextTokens: 262_144,
    maxOutputTokens: null,
    inputs: ["text", "image", "video"],
    outputs: ["text"],
    tools: null,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "Shared pool: 20 req/min and 50 req/day across all :free models.",
    verified: "third-party",
    defaultEnabled: true,
  },
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b:free",
    label: "Nemotron 3 Ultra (free via OpenRouter)",
    provider: "openrouter",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "deep-research"],
    bestFor: "550B reasoning model for long-context agentic work, reachable here without the NVIDIA prototype limits.",
    contextTokens: 1_000_000,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: "maybe",
    limits: "Shared pool: 20 req/min and 50 req/day across all :free models.",
    verified: "third-party",
    defaultEnabled: false,
  },

  /* ---------- Z.ai (ZAI_API_KEY) ---------- */
  {
    id: "glm-4.7-flash",
    label: "GLM-4.7-Flash",
    provider: "zai",
    capabilities: ["chat", "coding", "reasoning"],
    bestFor: "Free 30B-class MoE built for coding and agent workflows (MIT-licensed open weights).",
    contextTokens: 200_000,
    maxOutputTokens: 131_072,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "Free; one request at a time; rate limits shown in the Z.ai console.",
    notes: "Output cap taken from provider listings; verify before relying on it.",
    verified: "third-party",
    defaultEnabled: true,
  },
  {
    id: "glm-4.5-flash",
    label: "GLM-4.5-Flash",
    provider: "zai",
    capabilities: ["chat", "coding", "reasoning"],
    bestFor: "Free lightweight GLM text model for general chat, code and long-form writing.",
    contextTokens: 128_000,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "Free; one request at a time.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "glm-4.6v-flash",
    label: "GLM-4.6V-Flash",
    provider: "zai",
    capabilities: ["vision", "chat"],
    bestFor: "Free vision model: OCR, charts, documents and screenshots; accepts image and video.",
    contextTokens: 128_000,
    maxOutputTokens: 32_768,
    inputs: ["text", "image", "video"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "Free; one request at a time.",
    verified: "third-party",
    defaultEnabled: true,
  },
  {
    id: "cogview-3-flash",
    label: "CogView-3-Flash",
    provider: "zai",
    capabilities: ["image-gen"],
    bestFor: "Z.ai text-to-image model. Third parties report it free, but it is missing from the official price list I checked.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["image"],
    tools: false,
    plan: "unverified",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Verify on docs.z.ai before enabling.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "cogview-4",
    label: "CogView-4",
    provider: "zai",
    capabilities: ["image-gen"],
    bestFor: "Cheap paid image generation.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["image"],
    tools: false,
    plan: "paid",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "$0.01 per image.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "glm-image",
    label: "GLM-Image",
    provider: "zai",
    capabilities: ["image-gen"],
    bestFor: "Z.ai's newest image model, aimed at knowledge-heavy images.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: ["image"],
    tools: false,
    plan: "paid",
    prodOk: true,
    trainsOnPrompts: false,
    limits: "$0.015 per image.",
    verified: "official",
    defaultEnabled: false,
  },

  /* ---------- NVIDIA NIM (NVIDIA_API_KEY): prototype only ---------- */
  {
    id: "nvidia/nemotron-3-ultra-550b-a55b",
    label: "NVIDIA Nemotron 3 Ultra",
    provider: "nvidia",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "deep-research"],
    bestFor: "NVIDIA's 550B reasoning model (55B active) for long-context agentic work.",
    contextTokens: 1_000_000,
    maxOutputTokens: 16_384,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "~40 req/min reported. Free endpoint is for prototyping and testing.",
    notes: "Output cap from a conservative catalog value; other listings show a higher cap. Test before relying on it.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "nvidia/nemotron-3-super-120b-a12b",
    label: "NVIDIA Nemotron 3 Super",
    provider: "nvidia",
    capabilities: ["chat", "coding", "reasoning"],
    bestFor: "Smaller Nemotron 3 (120B, 12B active) for agent loops at lower latency.",
    contextTokens: 262_144,
    maxOutputTokens: 8_192,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "free",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "~40 req/min reported. Free endpoint is for prototyping and testing.",
    verified: "third-party",
    defaultEnabled: false,
  },

  /* ---------- Cohere (COHERE_API_KEY): trial = evaluation only ---------- */
  {
    id: "command-a-plus-05-2026",
    label: "Command A+",
    provider: "cohere",
    capabilities: ["chat", "reasoning", "vision", "multilingual"],
    bestFor: "Cohere's newest MoE: vision input, agentic tool use, reasoning and translation in one model.",
    contextTokens: 128_000,
    maxOutputTokens: 64_000,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: true,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only; ~20 chat req/min and 1,000 calls/month.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "command-a-03-2025",
    label: "Command A",
    provider: "cohere",
    capabilities: ["chat", "deep-research", "multilingual"],
    bestFor: "256K context built for tool use, agents and RAG.",
    contextTokens: 256_000,
    maxOutputTokens: 8_000,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only; ~20 chat req/min and 1,000 calls/month.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "command-a-reasoning-08-2025",
    label: "Command A Reasoning",
    provider: "cohere",
    capabilities: ["reasoning", "deep-research", "multilingual"],
    bestFor: "256K-context reasoning model for nuanced problem solving and agent tasks in 23 languages.",
    contextTokens: 256_000,
    maxOutputTokens: 32_000,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Cohere docs say it is free until rate limits are hit, on trial and production keys.",
    notes: "Production use is through Cohere Model Vault.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "command-a-vision-07-2025",
    label: "Command A Vision",
    provider: "cohere",
    capabilities: ["vision"],
    bestFor: "Charts, tables, OCR, document Q&A and object detection.",
    contextTokens: 128_000,
    maxOutputTokens: 8_000,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: null,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "north-mini-code-1-0",
    label: "North Mini Code",
    provider: "cohere",
    capabilities: ["coding"],
    bestFor: "30B MoE (3B active) trained for agentic coding, with 256K context and 64K output.",
    contextTokens: 256_000,
    maxOutputTokens: 64_000,
    inputs: ["text"],
    outputs: ["text"],
    tools: true,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "API access is for evaluation; production deployment goes through Cohere Model Vault.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "embed-v5.0-fast",
    label: "Embed v5 Fast",
    provider: "cohere",
    capabilities: ["embeddings"],
    bestFor: "Text and image embeddings for RAG (128K input).",
    contextTokens: 128_000,
    maxOutputTokens: null,
    inputs: ["text", "image"],
    outputs: [],
    tools: false,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "rerank-v5.0-fast",
    label: "Rerank v5 Fast",
    provider: "cohere",
    capabilities: ["rerank"],
    bestFor: "Low-latency reranker (32K per document) to sharpen RAG results.",
    contextTokens: 32_000,
    maxOutputTokens: null,
    inputs: ["text"],
    outputs: [],
    tools: false,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "cohere-transcribe-03-2026",
    label: "Cohere Transcribe",
    provider: "cohere",
    capabilities: ["speech-to-text", "multilingual"],
    bestFor: "Open-source multilingual speech-to-text (25 MB file limit).",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["audio"],
    outputs: ["text"],
    tools: false,
    plan: "trial",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Trial key: evaluation only.",
    verified: "official",
    defaultEnabled: false,
  },

  /* ---------- Anthropic Claude (ANTHROPIC_API_KEY): prepaid, not free ---------- */
  {
    id: "claude-fable-5-1",
    label: "Claude Fable 5.1",
    provider: "anthropic",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "vision", "deep-research"],
    bestFor: "Most capable Claude: demanding reasoning and long-horizon agentic work.",
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: true,
    plan: "prepaid",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "$10 in / $50 out per million tokens.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "claude-opus-5-5",
    label: "Claude Opus 5.5",
    provider: "anthropic",
    capabilities: ["chat", "coding", "ultracode", "reasoning", "vision", "deep-research"],
    bestFor: "Long-running agentic coding and knowledge work at a lower price than Fable.",
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: true,
    plan: "prepaid",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "$4 in / $20 out per million tokens.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "claude-sonnet-5-5",
    label: "Claude Sonnet 5.5",
    provider: "anthropic",
    capabilities: ["chat", "coding", "reasoning", "vision", "deep-research"],
    bestFor: "Best speed-to-intelligence balance for everyday coding and chat.",
    contextTokens: 1_000_000,
    maxOutputTokens: 128_000,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: true,
    plan: "prepaid",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "$2 in / $10 out per million tokens.",
    notes: "Context and output caps match the Sonnet 5 page; confirm on the Sonnet 5.5 model page.",
    verified: "third-party",
    defaultEnabled: false,
  },
  {
    id: "claude-haiku-5-5",
    label: "Claude Haiku 5.5",
    provider: "anthropic",
    capabilities: ["chat", "fast"],
    bestFor: "Fastest, cheapest Claude for high-volume replies.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text", "image"],
    outputs: ["text"],
    tools: true,
    plan: "prepaid",
    prodOk: true,
    trainsOnPrompts: "unknown",
    limits: "Check pricing and specs on the Anthropic models overview.",
    verified: "third-party",
    defaultEnabled: false,
  },

  /* ---------- Meta Model API (META_API_KEY): pay-as-you-go ---------- */
  {
    id: "muse-spark-1.3",
    label: "Muse Spark 1.3",
    provider: "meta",
    capabilities: ["chat", "coding", "reasoning", "vision", "deep-research", "web-search"],
    bestFor: "Meta's recommended model for agentic work: multi-step tool use, 1M context, search grounding.",
    contextTokens: 1_048_576,
    maxOutputTokens: null,
    inputs: ["text", "image", "video", "audio", "pdf"],
    outputs: ["text"],
    tools: true,
    plan: "credits",
    prodOk: false,
    trainsOnPrompts: false,
    limits: "Pay-as-you-go; see dev.meta.ai pricing.",
    notes:
      "Standard mode does not train on your content; the '-contributor' id does. Audio quality is degraded on 1.3, so use 1.2 or Muse Voice Transcribe for audio. Availability varies by country.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "muse-wonder-1.0",
    label: "Muse Wonder (preview)",
    provider: "meta",
    capabilities: ["coding", "ultracode", "reasoning", "vision", "deep-research"],
    bestFor: "Meta's most capable model: complex multi-file software engineering and long-running agents.",
    contextTokens: 1_048_576,
    maxOutputTokens: null,
    inputs: ["text", "image", "video", "audio", "pdf"],
    outputs: ["text"],
    tools: true,
    plan: "credits",
    prodOk: false,
    trainsOnPrompts: false,
    limits: "Pay-as-you-go, standard mode only.",
    notes: "Preview. Not available in South Korea.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "muse-image-1.0",
    label: "Muse Image",
    provider: "meta",
    capabilities: ["image-gen"],
    bestFor: "Image generation and editing in one model; can search the web for references.",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["text", "image"],
    outputs: ["image"],
    tools: false,
    plan: "credits",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Pay-as-you-go.",
    verified: "official",
    defaultEnabled: false,
  },
  {
    id: "muse-voice-transcribe-1.0",
    label: "Muse Voice Transcribe",
    provider: "meta",
    capabilities: ["speech-to-text", "multilingual"],
    bestFor: "Real-time and file transcription with speaker diarization (25 evaluated languages).",
    contextTokens: null,
    maxOutputTokens: null,
    inputs: ["audio"],
    outputs: ["text"],
    tools: false,
    plan: "credits",
    prodOk: false,
    trainsOnPrompts: "unknown",
    limits: "Pay-as-you-go.",
    verified: "official",
    defaultEnabled: false,
  },
];

export const MODELS: ModelSpec[] = DEFS.map((m) => ({ ...m, key: `${m.provider}::${m.id}` }));

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const isFree = (m: ModelSpec) =>
  m.plan === "free" || m.plan === "free-preview" || m.plan === "trial";

export interface Filter {
  capability?: Capability;
  provider?: ProviderId;
  context?: Tier; // "low" | "medium" | "high"
  output?: Tier;
  freeOnly?: boolean; // no payment needed
  prodOnly?: boolean; // terms allow a public production site
  enabledOnly?: boolean; // only models you want in the public picker
}

export function filterModels(f: Filter = {}): ModelSpec[] {
  return MODELS.filter(
    (m) =>
      (!f.capability || m.capabilities.includes(f.capability)) &&
      (!f.provider || m.provider === f.provider) &&
      (!f.context || contextTier(m.contextTokens) === f.context) &&
      (!f.output || outputTier(m.maxOutputTokens) === f.output) &&
      (!f.freeOnly || isFree(m)) &&
      (!f.prodOnly || m.prodOk) &&
      (!f.enabledOnly || m.defaultEnabled),
  );
}

export const byCapability = (capability: Capability, f: Omit<Filter, "capability"> = {}) =>
  filterModels({ ...f, capability });

export const getModel = (key: string) => MODELS.find((m) => m.key === key);

const k = (provider: ProviderId, id: string) => `${provider}::${id}`;

/**
 * Fallback chains per capability: free + production-safe models only.
 * Try the first; on 429/5xx move to the next.
 */
export const ROUTES: Partial<Record<Capability, string[]>> = {
  chat: [
    k("gemini", "gemini-3.8-flash"),
    k("groq", "openai/gpt-oss-120b"),
    k("zai", "glm-4.7-flash"),
    k("openrouter", "google/gemma-4-31b-it:free"),
  ],
  fast: [
    k("groq", "openai/gpt-oss-20b"),
    k("gemini", "gemini-3.5-flash-lite"),
    k("groq", "openai/gpt-oss-120b"),
  ],
  coding: [
    k("groq", "openai/gpt-oss-120b"),
    k("zai", "glm-4.7-flash"),
    k("gemini", "gemini-3.6-flash"),
  ],
  ultracode: [k("gemini", "gemini-3.8-flash"), k("openrouter", "thinkingmachines/inkling:free")],
  reasoning: [
    k("groq", "openai/gpt-oss-120b"),
    k("gemini", "gemini-3.8-flash"),
    k("openrouter", "thinkingmachines/inkling:free"),
  ],
  vision: [
    k("gemini", "gemini-3.8-flash"),
    k("zai", "glm-4.6v-flash"),
    k("openrouter", "google/gemma-4-31b-it:free"),
  ],
  "deep-research": [k("gemini", "gemini-3.8-flash"), k("openrouter", "thinkingmachines/inkling:free")],
  "speech-to-text": [k("groq", "whisper-large-v3-turbo")],
};

export const resolveRoute = (cap: Capability): ModelSpec[] =>
  (ROUTES[cap] ?? []).map(getModel).filter((m): m is ModelSpec => !!m);

/* ------------------------------------------------------------------ */
/* What your 8 keys cannot do yet                                      */
/* ------------------------------------------------------------------ */

export interface MissingPiece {
  need: string;
  add: string;
  env: string[];
  free: string;
  url: string;
}

export const MISSING: MissingPiece[] = [
  {
    need: "Image generation (free)",
    add: "Cloudflare Workers AI: @cf/black-forest-labs/flux-1-schnell",
    env: ["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"],
    free: "Shares the 10,000 Neurons/day pool with chat. FLUX schnell costs 4.8 Neurons per 512x512 tile plus 9.6 per step, roughly 170 images/day at 1024x1024 and 4 steps.",
    url: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  },
  {
    need: "Web search",
    add: "Tavily (or Exa, Serper, Brave). Feed cleaned results into the prompt.",
    env: ["TAVILY_API_KEY"],
    free: "Tavily: 1,000 credits/month. Exa: about $10 credits/month. Brave: $5 credits/month. Serper: 2,500-query trial.",
    url: "https://tavily.com",
  },
  {
    need: "Deep research",
    add: "Your own loop: plan, search, read, synthesize with a 1M-context model (Gemini 3.8 Flash or Inkling). Gemini's managed Deep Research agent is in preview; confirm free-tier access first.",
    env: [],
    free: "Costs only model quota plus search credits.",
    url: "https://ai.google.dev/gemini-api/docs/interactions",
  },
  {
    need: "Embeddings and RAG (learn from your documents)",
    add: "Cloudflare BGE embeddings (usable in production) or Cohere Embed + Rerank (trial = evaluation only).",
    env: [],
    free: "BGE-small is about 1,841 Neurons per million input tokens.",
    url: "https://docs.cohere.com/docs/models",
  },
  {
    need: "Text-to-speech",
    add: "Cloudflare MeloTTS: @cf/myshell-ai/melotts",
    env: [],
    free: "About 18.6 Neurons per audio minute.",
    url: "https://developers.cloudflare.com/workers-ai/platform/pricing/",
  },
  {
    need: "A paid safety net",
    add: "A small prepaid balance so chat never fails when a free quota runs out (OpenRouter $10 lifts :free models to 1,000 req/day and unlocks paid models).",
    env: [],
    free: "Not free, but pennies per thousand short chats on open models.",
    url: "https://openrouter.ai/credits",
  },
  {
    need: "Abuse protection",
    add: "Login plus per-user rate limits before any model that costs money (Anthropic, Meta, paid Z.ai).",
    env: [],
    free: "Code only.",
    url: "",
  },
];

/* ------------------------------------------------------------------ */
/* Sanity check: call once in a test or at server start-up             */
/* ------------------------------------------------------------------ */

export function assertRegistry(): void {
  const seen = new Set<string>();
  for (const m of MODELS) {
    if (seen.has(m.key)) throw new Error(`Duplicate model key: ${m.key}`);
    seen.add(m.key);
    if (!PROVIDERS[m.provider]) throw new Error(`Unknown provider: ${m.provider}`);
  }
  for (const [cap, keys] of Object.entries(ROUTES)) {
    for (const key of keys ?? []) {
      const m = getModel(key);
      if (!m) throw new Error(`Route ${cap} points at a missing model: ${key}`);
      if (!m.capabilities.includes(cap as Capability))
        throw new Error(`Route ${cap} includes ${key}, which lacks that capability`);
      if (!m.prodOk) throw new Error(`Route ${cap} includes ${key}, which is not production-safe`);
      if (!isFree(m)) throw new Error(`Route ${cap} includes ${key}, which is not free`);
    }
  }
}