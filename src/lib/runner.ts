import pLimit from "p-limit";
import pRetry from "p-retry";
import { models } from "@/lib/models";
import {
  saveBenchmarkRun,
  loadLatestBenchmarkRun,
  loadBenchmarkRun,
  loadIncompleteRun,
} from "@/lib/storage";
import {
  getBenchmark,
  getRegisteredCategories,
  summarizationBenchmark,
  structuredOutputBenchmark,
} from "@/lib/benchmarks";
import type {
  BenchmarkCategory,
  BenchmarkRun,
  BenchmarkRunResults,
  Document,
  ProgressCallback,
  SummarizationResult,
  StructuredOutputResult,
} from "@/lib/types";

export {
  saveBenchmarkRun,
  loadLatestBenchmarkRun,
  loadBenchmarkRun,
  loadIncompleteRun,
};

const DOCS_DIR = "./docs";

// ============================================================================
// Document Loading
// ============================================================================

export async function getDocuments(): Promise<Document[]> {
  const glob = new Bun.Glob("*.md");
  const documents: Document[] = [];

  for await (const path of glob.scan(DOCS_DIR)) {
    const filePath = `${DOCS_DIR}/${path}`;
    const content = await Bun.file(filePath).text();
    documents.push({ name: path, content });
  }

  return documents;
}

// ============================================================================
// Helper: Check if a result already exists
// ============================================================================

function isResultCompleted(
  results: BenchmarkRunResults,
  category: BenchmarkCategory,
  model: string,
  documentName: string,
): boolean {
  if (category === "summarization" && results.summarization) {
    return results.summarization.some(
      (r) => r.model === model && r.document === documentName,
    );
  }
  if (category === "structured-output" && results.structuredOutput) {
    return results.structuredOutput.some(
      (r) => r.model === model && r.document === documentName,
    );
  }
  return false;
}

// ============================================================================
// Helper: Add result to run
// ============================================================================

function addResultToRun(
  run: BenchmarkRun,
  category: BenchmarkCategory,
  result: SummarizationResult | StructuredOutputResult,
): void {
  if (category === "summarization") {
    if (!run.results.summarization) {
      run.results.summarization = [];
    }
    run.results.summarization.push(result as SummarizationResult);
  } else if (category === "structured-output") {
    if (!run.results.structuredOutput) {
      run.results.structuredOutput = [];
    }
    run.results.structuredOutput.push(result as StructuredOutputResult);
  }
}

// ============================================================================
// Helper: Calculate and update stats
// ============================================================================

function updateStats(run: BenchmarkRun): void {
  if (run.results.summarization && run.results.summarization.length > 0) {
    run.stats.summarization = summarizationBenchmark.calculateStats(
      run.results.summarization,
      run.models,
    );
  }
  if (run.results.structuredOutput && run.results.structuredOutput.length > 0) {
    run.stats.structuredOutput = structuredOutputBenchmark.calculateStats(
      run.results.structuredOutput,
      run.models,
    );
  }
}

// ============================================================================
// Main Benchmark Runner
// ============================================================================

export interface RunBenchmarkOptions {
  categories?: BenchmarkCategory[];
  onProgress?: ProgressCallback;
  resumeFrom?: BenchmarkRun;
  concurrency?: number;
  retries?: number;
}

export async function runBenchmark(
  options: RunBenchmarkOptions = {},
): Promise<BenchmarkRun> {
  const {
    categories = getRegisteredCategories(),
    onProgress,
    resumeFrom,
    concurrency = 1,
    retries = 3,
  } = options;

  const documents = await getDocuments();
  const modelList = [...models];

  // Create or resume run
  let run: BenchmarkRun;

  if (resumeFrom) {
    // Resume from existing run
    run = {
      ...resumeFrom,
      // Ensure categories match what we want to run
      categories: [...new Set([...resumeFrom.categories, ...categories])],
    };
  } else {
    // Create new run
    const timestamp = new Date().toISOString();
    const id = `benchmark-${timestamp.replace(/[:.]/g, "-")}`;

    run = {
      id,
      timestamp,
      status: "in-progress",
      models: modelList,
      documents: documents.map((d) => d.name),
      categories,
      results: {},
      stats: {},
    };

    // Save initial run state
    await saveBenchmarkRun(run);
  }

  // Build task queue for all (category, model, document) combinations
  interface Task {
    category: BenchmarkCategory;
    model: string;
    document: Document;
  }

  const tasks: Task[] = [];
  for (const category of categories) {
    const benchmark = getBenchmark(category);
    if (!benchmark) {
      console.warn(`Skipping unknown category: ${category}`);
      continue;
    }
    for (const model of modelList) {
      for (const document of documents) {
        tasks.push({ category, model, document });
      }
    }
  }

  // Calculate totals for progress
  const totalRuns = tasks.length;
  let completedRuns = tasks.filter((t) =>
    isResultCompleted(run.results, t.category, t.model, t.document.name),
  ).length;

  // Create concurrency limiter
  const limit = pLimit(concurrency);

  // Execute tasks with concurrency limit and retry
  await Promise.all(
    tasks.map((task) =>
      limit(async () => {
        // Skip if already completed
        if (
          isResultCompleted(
            run.results,
            task.category,
            task.model,
            task.document.name,
          )
        ) {
          return;
        }

        const benchmark = getBenchmark(task.category);
        if (!benchmark) return;

        const shortModel = task.model.split("/").pop() || task.model;

        // Run benchmark with retry
        const result = await pRetry(
          () => benchmark.run(task.model, task.document),
          {
            retries,
            onFailedAttempt: (context) => {
              console.warn(
                `  ↳ Retry ${context.attemptNumber}/${retries} for ${shortModel} on ${task.document.name}: ${context.error.message}`,
              );
            },
          },
        );

        // Add result to run
        addResultToRun(
          run,
          task.category,
          result as SummarizationResult | StructuredOutputResult,
        );

        // Save incrementally after each result
        await saveBenchmarkRun(run);

        // Update progress
        completedRuns++;
        onProgress?.(
          task.category,
          task.model,
          task.document.name,
          completedRuns,
          totalRuns,
        );
      }),
    ),
  );

  // Calculate final stats
  updateStats(run);

  // Mark as complete
  run.status = "complete";
  await saveBenchmarkRun(run);

  return run;
}

// ============================================================================
// Utility: Count total runs for progress tracking
// ============================================================================

export function countTotalRuns(
  categories: BenchmarkCategory[],
  modelCount: number,
  documentCount: number,
): number {
  return categories.length * modelCount * documentCount;
}

// ============================================================================
// Utility: Count completed runs in an existing run
// ============================================================================

export function countCompletedRuns(run: BenchmarkRun): number {
  let count = 0;

  if (run.results.summarization) {
    count += run.results.summarization.length;
  }
  if (run.results.structuredOutput) {
    count += run.results.structuredOutput.length;
  }

  return count;
}
