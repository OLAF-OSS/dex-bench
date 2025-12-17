import { Agent } from "@mastra/core/agent";

import { llmModel } from "@/lib/llm";
import { models } from "@/lib/models";

export const analyzeAgent = new Agent({
  id: "analyze-agent",
  name: "Analyze Agent",
  instructions: {
    role: "system",
    content:
      "You are a precise document analysis assistant. Analyze documents and extract structured information as requested.",
    providerOptions: {
      openai: {
        reasoningEffort: "high",
      },
    },
  },
  model: llmModel(models[0] as string),
});

export const extractionAgent = new Agent({
  id: "extraction-agent",
  name: "Extraction Agent",
  instructions: {
    role: "system",
    content:
      "You are a precise entity extraction assistant. Extract entities exactly as they appear in the text.",
    providerOptions: {
      openai: {
        reasoningEffort: "high",
      },
    },
  },
  model: llmModel(models[0] as string),
});
