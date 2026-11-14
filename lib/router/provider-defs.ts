/**
 * The providers the router knows, and nothing else: their names, the variables that hold their keys,
 * their addresses and a starter list of models. No file or environment is touched here, so the browser
 * can import it as well (the single-file preview does). Nothing in this file holds a secret.
 */
import type { ProviderId } from "./types"

export interface ProviderDef {
  id: ProviderId
  label: string
  /** Variables that can hold the key. The first one is the name used in the docs and in .env.example. */
  keyEnv: readonly string[]
  /** Variables that can replace the default base URL. */
  baseUrlEnv: readonly string[]
  /** Variables with a comma separated list of model ids that replaces the automatic list. */
  modelsEnv: readonly string[]
  baseUrl: string
  protocol: "openai" | "anthropic"
  /** Name of the field that caps the reply length. Some providers only accept the newer one. */
  tokenParam: "max_tokens" | "max_completion_tokens"
  /** What to offer when the provider cannot list its models. */
  seed: readonly string[]
  /** The most models kept from a long list. */
  maxModels: number
  /** The key is optional (a local server). */
  keyOptional?: boolean
  docs: string
}

export const PROVIDERS: readonly ProviderDef[] = [
  {
    id: "anthropic",
    label: "Anthropic",
    keyEnv: ["ANTHROPIC_API_KEY"],
    baseUrlEnv: ["ANTHROPIC_BASE_URL"],
    modelsEnv: ["ANTHROPIC_MODELS"],
    baseUrl: "https://api.anthropic.com",
    protocol: "anthropic",
    tokenParam: "max_tokens",
    seed: ["claude-fable-5-1", "claude-opus-5-5", "claude-sonnet-5-5", "claude-haiku-5-5"],
    maxModels: 12,
    docs: "https://docs.claude.com/en/api/overview",
  },
  {
    id: "gemini",
    label: "Google Gemini",
    keyEnv: ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY"],
    baseUrlEnv: ["GEMINI_BASE_URL"],
    modelsEnv: ["GEMINI_MODELS"],
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["gemini-2.5-pro", "gemini-2.5-flash", "gemini-2.5-flash-lite"],
    maxModels: 12,
    docs: "https://ai.google.dev/gemini-api/docs/openai",
  },
  {
    id: "groq",
    label: "Groq",
    keyEnv: ["GROQ_API_KEY"],
    baseUrlEnv: ["GROQ_BASE_URL"],
    modelsEnv: ["GROQ_MODELS"],
    baseUrl: "https://api.groq.com/openai/v1",
    protocol: "openai",
    tokenParam: "max_completion_tokens",
    seed: ["openai/gpt-oss-120b", "openai/gpt-oss-20b", "llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    maxModels: 12,
    docs: "https://console.groq.com/docs/api-reference",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    keyEnv: ["OPENROUTER_API_KEY"],
    baseUrlEnv: ["OPENROUTER_BASE_URL"],
    modelsEnv: ["OPENROUTER_MODELS"],
    baseUrl: "https://openrouter.ai/api/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["openai/gpt-oss-120b:free", "openai/gpt-oss-20b:free", "meta-llama/llama-3.3-70b-instruct:free"],
    maxModels: 16,
    docs: "https://openrouter.ai/docs/api-reference/overview",
  },
  {
    id: "zai",
    label: "Z.AI (GLM)",
    keyEnv: ["ZAI_API_KEY", "Z_AI_API_KEY", "ZHIPU_API_KEY"],
    baseUrlEnv: ["ZAI_BASE_URL"],
    modelsEnv: ["ZAI_MODELS"],
    baseUrl: "https://api.z.ai/api/paas/v4",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["glm-4.6", "glm-4.5", "glm-4.5-air", "glm-4.5-flash"],
    maxModels: 10,
    docs: "https://docs.z.ai/api-reference/introduction",
  },
  {
    id: "nvidia",
    label: "NVIDIA NIM",
    keyEnv: ["NVIDIA_API_KEY", "NVIDIA_NIM_API_KEY"],
    baseUrlEnv: ["NVIDIA_BASE_URL"],
    modelsEnv: ["NVIDIA_MODELS"],
    baseUrl: "https://integrate.api.nvidia.com/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["meta/llama-3.3-70b-instruct", "nvidia/llama-3.3-nemotron-super-49b-v1", "deepseek-ai/deepseek-r1"],
    maxModels: 16,
    docs: "https://docs.api.nvidia.com/nim/reference/llm-apis",
  },
  {
    id: "cohere",
    label: "Cohere",
    keyEnv: ["COHERE_API_KEY", "CO_API_KEY"],
    baseUrlEnv: ["COHERE_BASE_URL"],
    modelsEnv: ["COHERE_MODELS"],
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["command-a-03-2025", "command-r-plus-08-2024", "command-r-08-2024", "command-r7b-12-2024"],
    maxModels: 10,
    docs: "https://docs.cohere.com/docs/compatibility-api",
  },
  {
    id: "mistral",
    label: "Mistral",
    keyEnv: ["MISTRAL_API_KEY"],
    baseUrlEnv: ["MISTRAL_BASE_URL"],
    modelsEnv: ["MISTRAL_MODELS"],
    baseUrl: "https://api.mistral.ai/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest", "codestral-latest"],
    maxModels: 12,
    docs: "https://docs.mistral.ai/api/",
  },
  {
    id: "meta",
    label: "Meta Llama",
    keyEnv: ["META_API_KEY", "LLAMA_API_KEY"],
    baseUrlEnv: ["META_BASE_URL", "LLAMA_BASE_URL"],
    modelsEnv: ["META_MODELS", "LLAMA_MODELS"],
    baseUrl: "https://api.llama.com/compat/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["Llama-4-Maverick-17B-128E-Instruct-FP8", "Llama-4-Scout-17B-16E-Instruct-FP8", "Llama-3.3-70B-Instruct", "Llama-3.3-8B-Instruct"],
    maxModels: 8,
    docs: "https://llama.developer.meta.com/docs/overview",
  },
  {
    id: "cloudflare",
    label: "Cloudflare Workers AI",
    keyEnv: ["CLOUDFLARE_API_KEY", "CLOUDFLARE_API_TOKEN", "CF_API_TOKEN"],
    baseUrlEnv: ["CLOUDFLARE_BASE_URL"],
    modelsEnv: ["CLOUDFLARE_MODELS"],
    // {account} is filled in from CLOUDFLARE_ACCOUNT_ID, or looked up from the token.
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{account}/ai/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["@cf/openai/gpt-oss-120b", "@cf/openai/gpt-oss-20b", "@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct"],
    maxModels: 12,
    docs: "https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/",
  },
  {
    id: "aionlabs",
    label: "AionLabs",
    keyEnv: ["AIONLABS_API_KEY", "AION_API_KEY"],
    baseUrlEnv: ["AIONLABS_BASE_URL", "AION_BASE_URL"],
    modelsEnv: ["AIONLABS_MODELS", "AION_MODELS"],
    baseUrl: "https://api.aionlabs.ai/v1",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: ["aion-1.0", "aion-1.0-mini", "aion-rp-llama-3.1-8b"],
    maxModels: 6,
    docs: "https://docs.aionlabs.ai/",
  },
  {
    id: "custom",
    label: "Your server",
    keyEnv: ["LLM_API_KEY"],
    baseUrlEnv: ["LLM_BASE_URL"],
    modelsEnv: ["LLM_MODELS", "LLM_MODEL"],
    baseUrl: "",
    protocol: "openai",
    tokenParam: "max_tokens",
    seed: [],
    maxModels: 24,
    keyOptional: true,
    docs: "https://platform.openai.com/docs/api-reference/chat",
  },
]

export const PROVIDER_BY_ID: Readonly<Record<ProviderId, ProviderDef>> = Object.fromEntries(PROVIDERS.map((p) => [p.id, p])) as Record<ProviderId, ProviderDef>

export function isProviderId(value: string): value is ProviderId {
  return value in PROVIDER_BY_ID
}
