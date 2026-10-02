import type { ModelOption } from "./types";

export const MODEL_OPTIONS: ModelOption[] = [
  { id: "nova", name: "Cyphor Nova", blurb: "Fast, light, great for everyday questions" },
  { id: "prime", name: "Cyphor Prime", blurb: "Balanced reasoning for daily work" },
  { id: "vault", name: "Cyphor Vault", blurb: "Slower, deeper reasoning for hard problems" },
];

export const SUGGESTED_PROMPTS = [
  {
    title: "Explain a concept",
    prompt: "Explain how transformers process attention, with a simple analogy.",
  },
  {
    title: "Debug something",
    prompt: "Why would a React useEffect run twice in development mode?",
  },
  {
    title: "Write for me",
    prompt: "Draft a short, warm email declining a meeting invite.",
  },
  {
    title: "Think it through",
    prompt: "What are the trade-offs between REST and GraphQL for a small team?",
  },
];
