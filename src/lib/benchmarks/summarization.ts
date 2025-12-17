import { z } from "zod";
import { ResultAsync } from "neverthrow";

import { analyzeAgent } from "@/lib/agent";
import { llmModel } from "@/lib/llm";
import { PROMPTS } from "@/lib/prompts";
import { countTokens } from "@/lib/utils";
import type {
  Document,
  SummarizationResult,
  SummarizationStats,
} from "@/lib/types";
import type { BenchmarkType } from "./types";

const summarySchema = z.object({
  summary: z.string().describe("The comprehensive summary of the document"),
});

// ============================================================================
// Summarization Benchmark Runner
// ============================================================================

async function runSummarizationBenchmark(
  model: string,
  document: Document,
): Promise<SummarizationResult> {
  const documentTokens = countTokens(document.content);
  const prompt = PROMPTS["summarize-document"](document.content);
  const inputTokens = countTokens(prompt);

  const startTime = performance.now();

  const result = await ResultAsync.fromPromise(
    analyzeAgent.generate(prompt, {
      structuredOutput: {
        schema: summarySchema,
        jsonPromptInjection: true,
        model: llmModel(model),
      },
    }),
    (error) => (error instanceof Error ? error : new Error(String(error))),
  );

  const endTime = performance.now();
  const durationMs = endTime - startTime;

  if (result.isErr()) {
    return {
      type: "summarization",
      model,
      document: document.name,
      documentTokens,
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
      durationMs,
      tokensPerSecond: 0,
      summary: "",
      success: false,
      error: result.error.message,
    };
  }

  const summaryText =
    (result.value.object as z.infer<typeof summarySchema>)?.summary ??
    result.value.text;
  const outputTokens =
    result.value.usage?.outputTokens ?? countTokens(summaryText);
  const totalTokens = inputTokens + outputTokens;
  const tokensPerSecond = (outputTokens / durationMs) * 1000;

  return {
    type: "summarization",
    model,
    document: document.name,
    documentTokens,
    inputTokens,
    outputTokens,
    totalTokens,
    durationMs,
    tokensPerSecond,
    summary: summaryText,
    success: true,
  };
}

// ============================================================================
// Stats Calculator
// ============================================================================

function calculateSummarizationStats(
  results: SummarizationResult[],
  models: string[],
): SummarizationStats {
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

  const totalInputTokens = successfulResults.reduce(
    (sum, r) => sum + r.inputTokens,
    0,
  );
  const totalOutputTokens = successfulResults.reduce(
    (sum, r) => sum + r.outputTokens,
    0,
  );
  const averageTokensPerSecond =
    successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.tokensPerSecond, 0) /
        successfulResults.length
      : 0;

  return {
    type: "summarization",
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
    totalInputTokens,
    totalOutputTokens,
    averageTokensPerSecond,
  };
}

// ============================================================================
// Benchmark Type Export
// ============================================================================

export const summarizationBenchmark: BenchmarkType<
  SummarizationResult,
  SummarizationStats
> = {
  id: "summarization",
  name: "Summarization",
  description: "Test LLM summarization capabilities with document analysis",
  run: runSummarizationBenchmark,
  calculateStats: calculateSummarizationStats,
};
