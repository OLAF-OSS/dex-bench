import { generateEntityTypes, extractEntities } from "@/lib/entity-extraction";
import { countTokens } from "@/lib/utils";
import type {
  Document,
  StructuredOutputResult,
  StructuredOutputStats,
} from "@/lib/types";
import type { BenchmarkType } from "./types";

// ============================================================================
// Structured Output Benchmark Runner
// ============================================================================

async function runStructuredOutputBenchmark(
  model: string,
  document: Document,
): Promise<StructuredOutputResult> {
  const documentTokens = countTokens(document.content);
  const startTime = performance.now();

  try {
    // Step 1: Generate entity types
    const entityTypesResult = await generateEntityTypes({
      model,
      document: document.content,
    });

    if ("error" in entityTypesResult) {
      const endTime = performance.now();
      return {
        type: "structured-output",
        model,
        document: document.name,
        documentTokens,
        durationMs: endTime - startTime,
        success: false,
        error: `Entity types generation failed: ${entityTypesResult.error}`,
        entityTypesTimeMs: entityTypesResult._executionTimeMs,
        extractionTimeMs: 0,
        entityTypes: [],
        extractionCount: 0,
        relationshipCount: 0,
        extractions: [],
        relationships: [],
      };
    }

    const entityTypesTimeMs = entityTypesResult._executionTimeMs;
    const entityTypes = entityTypesResult.entityTypes;

    // Step 2: Extract entities using the generated types
    const extractionResult = await extractEntities({
      model,
      document: document.content,
      entityTypes,
    });

    if ("error" in extractionResult) {
      const endTime = performance.now();
      return {
        type: "structured-output",
        model,
        document: document.name,
        documentTokens,
        durationMs: endTime - startTime,
        success: false,
        error: `Entity extraction failed: ${extractionResult.error}`,
        entityTypesTimeMs,
        extractionTimeMs: extractionResult._executionTimeMs,
        entityTypes,
        extractionCount: 0,
        relationshipCount: 0,
        extractions: [],
        relationships: [],
      };
    }

    const endTime = performance.now();
    const extractions = extractionResult.extractions;
    const relationships = extractionResult.relationships;

    return {
      type: "structured-output",
      model,
      document: document.name,
      documentTokens,
      durationMs: endTime - startTime,
      success: true,
      entityTypesTimeMs,
      extractionTimeMs: extractionResult._executionTimeMs,
      entityTypes,
      extractionCount: extractions.length,
      relationshipCount: relationships.length,
      extractions,
      relationships,
    };
  } catch (error) {
    const endTime = performance.now();
    return {
      type: "structured-output",
      model,
      document: document.name,
      documentTokens,
      durationMs: endTime - startTime,
      success: false,
      error: error instanceof Error ? error.message : String(error),
      entityTypesTimeMs: 0,
      extractionTimeMs: 0,
      entityTypes: [],
      extractionCount: 0,
      relationshipCount: 0,
      extractions: [],
      relationships: [],
    };
  }
}

// ============================================================================
// Stats Calculator
// ============================================================================

function calculateStructuredOutputStats(
  results: StructuredOutputResult[],
  models: string[],
): StructuredOutputStats {
  const successfulResults = results.filter((r) => r.success);

  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0);
  const averageDurationMs =
    successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.durationMs, 0) /
        successfulResults.length
      : 0;

  const sortedByDuration = [...successfulResults].sort(
    (a, b) => a.durationMs - b.durationMs,
  );
  const fastest = sortedByDuration[0];
  const slowest = sortedByDuration[sortedByDuration.length - 1];

  const modelAverages: Record<string, number> = {};
  for (const model of models) {
    const modelResults = successfulResults.filter((r) => r.model === model);
    if (modelResults.length > 0) {
      modelAverages[model] =
        modelResults.reduce((sum, r) => sum + r.durationMs, 0) /
        modelResults.length;
    }
  }

  const totalExtractions = successfulResults.reduce(
    (sum, r) => sum + r.extractionCount,
    0,
  );
  const totalRelationships = successfulResults.reduce(
    (sum, r) => sum + r.relationshipCount,
    0,
  );
  const totalEntityTypes = successfulResults.reduce(
    (sum, r) => sum + r.entityTypes.length,
    0,
  );

  const docCount = new Set(successfulResults.map((r) => r.document)).size;
  const averageExtractionsPerDoc =
    docCount > 0 ? totalExtractions / docCount : 0;
  const averageEntityTypesPerDoc =
    docCount > 0 ? totalEntityTypes / successfulResults.length : 0;

  return {
    type: "structured-output",
    totalDurationMs,
    averageDurationMs,
    fastestResult: fastest
      ? {
          model: fastest.model,
          document: fastest.document,
          durationMs: fastest.durationMs,
        }
      : { model: "", document: "", durationMs: 0 },
    slowestResult: slowest
      ? {
          model: slowest.model,
          document: slowest.document,
          durationMs: slowest.durationMs,
        }
      : { model: "", document: "", durationMs: 0 },
    modelAverages,
    totalExtractions,
    totalRelationships,
    averageExtractionsPerDoc,
    averageEntityTypesPerDoc,
  };
}

// ============================================================================
// Benchmark Type Export
// ============================================================================

export const structuredOutputBenchmark: BenchmarkType<
  StructuredOutputResult,
  StructuredOutputStats
> = {
  id: "structured-output",
  name: "Structured Output",
  description:
    "Test LLM JSON structured output capabilities with entity extraction",
  run: runStructuredOutputBenchmark,
  calculateStats: calculateStructuredOutputStats,
};
