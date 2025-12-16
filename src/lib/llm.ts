import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { env } from "@/lib/env";

export const llmProvider = createOpenAICompatible({
  name: "litellm",
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
  supportsStructuredOutputs: true,
  includeUsage: true,
});

export const models = [
  "openai/gpt-oss-20b",
  "google/gemma-3-12b-it",
  "google/gemma-3-27b-it",
  "mistralai/mistral-large-2411",
  "qwen/qwen3-vl-30b-a3b-instruct",
  "mistralai/devstral-medium",
  "meta-llama/llama-3.3-70b-instruct",
];

export const llmModel = (model: (typeof models)[number]) => llmProvider(model);
