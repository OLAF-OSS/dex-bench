import type {
  BenchmarkRun,
  AggregatedData,
  ModelGpuPerformance,
  DocumentPerformance,
  SummarizationResult,
  StructuredOutputResult,
} from "../types";
import {
  parseModel,
  getNormalizedModelKey,
  getUniqueGpus,
  getUniqueBaseModels,
  getUniqueProviders,
} from "./parse-model";

interface ModelStats {
  summarization: {
    totalDurationMs: number;
    totalTokensPerSecond: number;
    successCount: number;
    totalCount: number;
  };
  structuredOutput: {
    totalDurationMs: number;
    totalExtractions: number;
    totalRelationships: number;
    successCount: number;
    totalCount: number;
  };
}

interface DocumentStats {
  document: string;
  documentTokens: number;
  models: Map<
    string,
    {
      totalDurationMs: number;
      totalTokensPerSecond: number;
      totalExtractions: number;
      successCount: number;
      totalCount: number;
    }
  >;
}

/**
 * Aggregate all benchmark runs into a unified analysis structure
 */
export function aggregateAllRuns(runs: BenchmarkRun[]): AggregatedData {
  // Collect all normalized model keys across all runs
  const allNormalizedKeys = new Set<string>();
  const allDocuments = new Set<string>();
  let hasSummarization = false;
  let hasStructuredOutput = false;

  for (const run of runs) {
    for (const model of run.models) {
      // Use normalized key so "a100/gemma-3-12b" and "gemma-3-12b/a100" are the same
      allNormalizedKeys.add(getNormalizedModelKey(model));
    }
    for (const doc of run.documents) {
      allDocuments.add(doc);
    }
    if (run.results.summarization?.length) {
      hasSummarization = true;
    }
    if (run.results.structuredOutput?.length) {
      hasStructuredOutput = true;
    }
  }

  // Aggregate stats per model (using normalized keys)
  const modelStatsMap = new Map<string, ModelStats>();

  // Initialize stats for all models
  for (const normalizedKey of allNormalizedKeys) {
    modelStatsMap.set(normalizedKey, {
      summarization: {
        totalDurationMs: 0,
        totalTokensPerSecond: 0,
        successCount: 0,
        totalCount: 0,
      },
      structuredOutput: {
        totalDurationMs: 0,
        totalExtractions: 0,
        totalRelationships: 0,
        successCount: 0,
        totalCount: 0,
      },
    });
  }

  // Aggregate document stats
  const documentStatsMap = new Map<string, DocumentStats>();

  // Process all runs
  for (const run of runs) {
    // Process summarization results
    if (run.results.summarization) {
      for (const result of run.results.summarization) {
        // Use normalized key for aggregation
        const normalizedKey = getNormalizedModelKey(result.model);
        const stats = modelStatsMap.get(normalizedKey);
        if (stats) {
          stats.summarization.totalCount++;
          if (result.success) {
            stats.summarization.successCount++;
            stats.summarization.totalDurationMs += result.durationMs;
            stats.summarization.totalTokensPerSecond += result.tokensPerSecond;
          }
        }

        // Document stats (use normalized key)
        updateDocumentStats(documentStatsMap, result, "summarization");
      }
    }

    // Process structured output results
    if (run.results.structuredOutput) {
      for (const result of run.results.structuredOutput) {
        // Use normalized key for aggregation
        const normalizedKey = getNormalizedModelKey(result.model);
        const stats = modelStatsMap.get(normalizedKey);
        if (stats) {
          stats.structuredOutput.totalCount++;
          if (result.success) {
            stats.structuredOutput.successCount++;
            stats.structuredOutput.totalDurationMs += result.durationMs;
            stats.structuredOutput.totalExtractions += result.extractionCount;
            stats.structuredOutput.totalRelationships +=
              result.relationshipCount;
          }
        }

        // Document stats (use normalized key)
        updateDocumentStats(documentStatsMap, result, "structuredOutput");
      }
    }
  }

  // Build model performances
  const modelPerformances: ModelGpuPerformance[] = [];
  for (const [normalizedKey, stats] of modelStatsMap) {
    // The normalized key IS a valid model format we can parse
    const parsed = parseModel(normalizedKey);

    const summarization =
      stats.summarization.totalCount > 0
        ? {
            avgDurationMs:
              stats.summarization.successCount > 0
                ? stats.summarization.totalDurationMs /
                  stats.summarization.successCount
                : 0,
            avgTokensPerSecond:
              stats.summarization.successCount > 0
                ? stats.summarization.totalTokensPerSecond /
                  stats.summarization.successCount
                : 0,
            totalRuns: stats.summarization.totalCount,
            successRate:
              (stats.summarization.successCount /
                stats.summarization.totalCount) *
              100,
          }
        : null;

    const structuredOutput =
      stats.structuredOutput.totalCount > 0
        ? {
            avgDurationMs:
              stats.structuredOutput.successCount > 0
                ? stats.structuredOutput.totalDurationMs /
                  stats.structuredOutput.successCount
                : 0,
            avgExtractions:
              stats.structuredOutput.successCount > 0
                ? stats.structuredOutput.totalExtractions /
                  stats.structuredOutput.successCount
                : 0,
            avgRelationships:
              stats.structuredOutput.successCount > 0
                ? stats.structuredOutput.totalRelationships /
                  stats.structuredOutput.successCount
                : 0,
            totalRuns: stats.structuredOutput.totalCount,
            successRate:
              (stats.structuredOutput.successCount /
                stats.structuredOutput.totalCount) *
              100,
          }
        : null;

    modelPerformances.push({
      modelId: normalizedKey,
      parsed,
      summarization,
      structuredOutput,
    });
  }

  // Sort by average tokens per second (summarization) or duration (structured output)
  modelPerformances.sort((a, b) => {
    if (a.summarization && b.summarization) {
      return (
        b.summarization.avgTokensPerSecond - a.summarization.avgTokensPerSecond
      );
    }
    if (a.structuredOutput && b.structuredOutput) {
      return (
        a.structuredOutput.avgDurationMs - b.structuredOutput.avgDurationMs
      );
    }
    return 0;
  });

  // Build document performances
  const documentPerformances: DocumentPerformance[] = [];
  for (const [document, stats] of documentStatsMap) {
    const models: DocumentPerformance["models"] = [];

    for (const [modelId, modelStats] of stats.models) {
      const parsed = parseModel(modelId);
      models.push({
        modelId,
        parsed,
        avgDurationMs:
          modelStats.successCount > 0
            ? modelStats.totalDurationMs / modelStats.successCount
            : 0,
        successRate: (modelStats.successCount / modelStats.totalCount) * 100,
        tokensPerSecond:
          modelStats.totalTokensPerSecond > 0
            ? modelStats.totalTokensPerSecond / modelStats.successCount
            : undefined,
        extractions:
          modelStats.totalExtractions > 0
            ? modelStats.totalExtractions / modelStats.successCount
            : undefined,
      });
    }

    // Sort models by duration
    models.sort((a, b) => a.avgDurationMs - b.avgDurationMs);

    documentPerformances.push({
      document,
      documentTokens: stats.documentTokens,
      models,
    });
  }

  // Sort documents by token count
  documentPerformances.sort((a, b) => a.documentTokens - b.documentTokens);

  const normalizedKeysArray = Array.from(allNormalizedKeys);

  return {
    modelPerformances,
    documentPerformances,
    uniqueGpus: getUniqueGpus(normalizedKeysArray),
    uniqueBaseModels: getUniqueBaseModels(normalizedKeysArray),
    uniqueProviders: getUniqueProviders(normalizedKeysArray),
    uniqueDocuments: Array.from(allDocuments).sort(),
    totalRuns: runs.length,
    hasSummarization,
    hasStructuredOutput,
  };
}

function updateDocumentStats(
  documentStatsMap: Map<string, DocumentStats>,
  result: SummarizationResult | StructuredOutputResult,
  type: "summarization" | "structuredOutput",
) {
  if (!documentStatsMap.has(result.document)) {
    documentStatsMap.set(result.document, {
      document: result.document,
      documentTokens: result.documentTokens,
      models: new Map(),
    });
  }

  const docStats = documentStatsMap.get(result.document);
  if (!docStats) return;

  // Use normalized key for document model stats
  const normalizedKey = getNormalizedModelKey(result.model);
  if (!docStats.models.has(normalizedKey)) {
    docStats.models.set(normalizedKey, {
      totalDurationMs: 0,
      totalTokensPerSecond: 0,
      totalExtractions: 0,
      successCount: 0,
      totalCount: 0,
    });
  }

  const modelStats = docStats.models.get(normalizedKey);
  if (!modelStats) return;
  modelStats.totalCount++;

  if (result.success) {
    modelStats.successCount++;
    modelStats.totalDurationMs += result.durationMs;

    if (type === "summarization" && "tokensPerSecond" in result) {
      modelStats.totalTokensPerSecond += result.tokensPerSecond;
    }
    if (type === "structuredOutput" && "extractionCount" in result) {
      modelStats.totalExtractions += result.extractionCount;
    }
  }
}

/**
 * Get GPU comparison data for a specific base model
 */
export function getGpuComparisonForModel(
  data: AggregatedData,
  baseName: string,
): ModelGpuPerformance[] {
  return data.modelPerformances.filter(
    (perf) => perf.parsed.baseName === baseName,
  );
}

/**
 * Get performance data grouped by GPU
 */
export function getPerformanceByGpu(
  data: AggregatedData,
): Map<string, ModelGpuPerformance[]> {
  const gpuMap = new Map<string, ModelGpuPerformance[]>();

  for (const perf of data.modelPerformances) {
    const gpu = perf.parsed.gpu ?? "openrouter";
    if (!gpuMap.has(gpu)) {
      gpuMap.set(gpu, []);
    }
    const gpuPerfs = gpuMap.get(gpu);
    if (gpuPerfs) {
      gpuPerfs.push(perf);
    }
  }

  return gpuMap;
}

/**
 * Get leaderboard data sorted by performance metric
 */
export function getLeaderboard(
  data: AggregatedData,
  metric: "tokensPerSecond" | "duration" | "extractions",
  category: "summarization" | "structuredOutput",
): ModelGpuPerformance[] {
  return [...data.modelPerformances]
    .filter((perf) =>
      category === "summarization" ? perf.summarization : perf.structuredOutput,
    )
    .sort((a, b) => {
      if (category === "summarization") {
        const aVal = a.summarization;
        const bVal = b.summarization;
        if (!aVal || !bVal) return 0;
        if (metric === "tokensPerSecond") {
          return bVal.avgTokensPerSecond - aVal.avgTokensPerSecond;
        }
        return aVal.avgDurationMs - bVal.avgDurationMs;
      } else {
        const aVal = a.structuredOutput;
        const bVal = b.structuredOutput;
        if (!aVal || !bVal) return 0;
        if (metric === "extractions") {
          return bVal.avgExtractions - aVal.avgExtractions;
        }
        return aVal.avgDurationMs - bVal.avgDurationMs;
      }
    });
}
