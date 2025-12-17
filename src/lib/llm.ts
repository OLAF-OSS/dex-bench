import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

import { env } from "@/lib/env";
import { models } from "@/lib/models";

export { models };

export const llmProvider = createOpenAICompatible({
  name: "litellm",
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
  supportsStructuredOutputs: true,
  includeUsage: true,
});

export const llmModel = (model: (typeof models)[number]) => llmProvider(model);
