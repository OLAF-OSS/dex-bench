import { generateText } from "ai";
import { llmModel, models } from "@/lib/llm";
import { PROMPTS } from "@/lib/prompts";
import {
  saveBenchmarkRun,
  loadLatestBenchmarkRun,
  loadBenchmarkRun,
} from "@/lib/storage";
import { countTokens } from "@/lib/utils";
import type {
  BenchmarkResult,
  BenchmarkRun,
  BenchmarkStats,
} from "@/lib/types";

export { saveBenchmarkRun, loadLatestBenchmarkRun, loadBenchmarkRun };

const DOCS_DIR = "./docs";

async function getDocuments(): Promise<{ name: string; content: string }[]> {
  const glob = new Bun.Glob("*.md");
  const documents: { name: string; content: string }[] = [];

  for await (const path of glob.scan(DOCS_DIR)) {
    const filePath = `${DOCS_DIR}/${path}`;
    const content = await Bun.file(filePath).text();
    documents.push({ name: path, content });
  }

  return documents;
}

async function runSingleBenchmark(
  model: string,
  document: { name: string; content: string },
): Promise<BenchmarkResult> {
  const prompt = PROMPTS["analyze-document"](document.content);
  const inputTokens = countTokens(prompt);

  const startTime = performance.now();

  try {
    const result = await generateText({
      model: llmModel(model) as Parameters<typeof generateText>[0]["model"],
      prompt,
    });

    const endTime = performance.now();
    const durationMs = endTime - startTime;
    const outputTokens = result.usage?.outputTokens ?? countTokens(result.text);
    const totalTokens = inputTokens + outputTokens;
    const tokensPerSecond = (outputTokens / durationMs) * 1000;

    return {
      model,
      document: document.name,
      inputTokens,
      outputTokens,
      totalTokens,
      durationMs,
      tokensPerSecond,
      summary: result.text,
      success: true,
    };
  } catch (error) {
    const endTime = performance.now();
    const durationMs = endTime - startTime;

    return {
      model,
      document: document.name,
      inputTokens,
      outputTokens: 0,
      totalTokens: inputTokens,
      durationMs,
      tokensPerSecond: 0,
      summary: "",
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function calculateStats(results: BenchmarkResult[]): BenchmarkStats {
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

  return {
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
  };
}

export async function runBenchmark(
  onProgress?: (
    model: string,
    document: string,
    index: number,
    total: number,
  ) => void,
): Promise<BenchmarkRun> {
  const documents = await getDocuments();
  const results: BenchmarkResult[] = [];
  const totalRuns = models.length * documents.length;
  let currentRun = 0;

  for (const model of models) {
    for (const document of documents) {
      currentRun++;
      onProgress?.(model, document.name, currentRun, totalRuns);

      const result = await runSingleBenchmark(model, document);
      results.push(result);
    }
  }

  const stats = calculateStats(results);
  const timestamp = new Date().toISOString();
  const id = `benchmark-${timestamp.replace(/[:.]/g, "-")}`;

  return {
    id,
    timestamp,
    models: [...models],
    documents: documents.map((d) => d.name),
    results,
    stats,
  };
}

