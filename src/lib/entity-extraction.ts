import { z } from "zod";
import { ResultAsync } from "neverthrow";

import { PROMPTS } from "@/lib/prompts";
import { extractionAgent } from "./agent";
import { llmModel } from "./llm";

const extractionSchema = z.object({
  extractions: z
    .array(
      z.object({
        id: z
          .string()
          .describe("unique identifier for this extraction (e.g., e1, e2, e3)"),
        extractionClass: z
          .string()
          .describe("UPPER_SNAKE_CASE like PERSON, ORGANIZATION"),
        extractionText: z.string().describe("exact text from document"),
      }),
    )
    .describe(
      "Array of extractions. Each has: id (e.g., e1), extractionClass (UPPER_SNAKE_CASE like PERSON, ORGANIZATION), extractionText (exact text from document)",
    ),
  relationships: z
    .array(
      z.object({
        sourceId: z.string().describe("ID of the source entity (e.g., e1)"),
        targetId: z.string().describe("ID of the target entity (e.g., e2)"),
        relationshipType: z
          .string()
          .describe("UPPER_SNAKE_CASE like WORKS_FOR, LOCATED_IN"),
      }),
    )
    .describe(
      "Relationships between entities. Each has: sourceId, targetId, relationshipType (UPPER_SNAKE_CASE like WORKS_FOR, LOCATED_IN)",
    ),
});

const entityTypesSchema = z.object({
  entityTypes: z
    .array(z.string())
    .describe(
      "Array of entity types to extract (e.g., PERSON, ORGANIZATION, LOCATION). Must contain at least one type.",
    ),
});

export async function generateEntityTypes({
  model,
  document,
}: {
  model: string;
  document: string;
}) {
  const prompt = PROMPTS["generate-entity-types"](document);
  const startTime = performance.now();

  const result = await ResultAsync.fromPromise(
    extractionAgent.generate(prompt, {
      structuredOutput: {
        schema: entityTypesSchema,
        jsonPromptInjection: true,
        model: llmModel(model),
      },
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );

  if (result.isErr()) {
    console.error("Generate entity types error:", result.error);
    return {
      error: result.error.message,
      _executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  const parsed = result.value.object as z.infer<typeof entityTypesSchema>;

  // Validate the parsed result has the expected structure
  if (!parsed || !Array.isArray(parsed.entityTypes)) {
    console.error("Invalid entity types response:", JSON.stringify(parsed));
    return {
      error: `Invalid structured output: expected { entityTypes: string[] }, got ${JSON.stringify(parsed)}`,
      _executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  return {
    ...parsed,
    _executionTimeMs: Math.round(performance.now() - startTime),
  };
}

export async function extractEntities({
  model,
  document,
  entityTypes,
}: {
  model: string;
  document: string;
  entityTypes: string[];
}) {
  const prompt = PROMPTS["extract-entities"](document, entityTypes);
  const startTime = performance.now();

  const result = await ResultAsync.fromPromise(
    extractionAgent.generate(prompt, {
      structuredOutput: {
        schema: extractionSchema,
        jsonPromptInjection: true,
        model: llmModel(model),
      },
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );

  if (result.isErr()) {
    console.error("Extraction agent error:", result.error);
    return {
      error: result.error.message,
      _executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  const parsed = result.value.object as z.infer<typeof extractionSchema>;

  // Validate the parsed result has the expected structure
  if (!parsed || !Array.isArray(parsed.extractions) || !Array.isArray(parsed.relationships)) {
    console.error("Invalid extraction response:", JSON.stringify(parsed));
    return {
      error: `Invalid structured output: expected { extractions: [], relationships: [] }, got ${JSON.stringify(parsed)}`,
      _executionTimeMs: Math.round(performance.now() - startTime),
    };
  }

  return {
    ...parsed,
    _executionTimeMs: Math.round(performance.now() - startTime),
  };
}
