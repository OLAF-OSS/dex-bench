import {
  runBenchmark,
  saveBenchmarkRun,
  loadLatestBenchmarkRun,
  loadBenchmarkRun,
  loadIncompleteRun,
  countCompletedRuns,
  countTotalRuns,
  getDocuments,
} from "@/lib/runner";
import { models } from "@/lib/models";
import {
  displayProgress,
  displayResults,
  displayError,
  displaySuccess,
  displayInfo,
  displayWarning,
} from "@/lib/display";
import { saveMarkdownReport } from "@/lib/markdown";
import { getRegisteredCategories } from "@/lib/benchmarks";
import type { BenchmarkCategory } from "@/lib/types";

const cyan = Bun.color("cyan", "ansi");
const yellow = Bun.color("yellow", "ansi");
const reset = "\x1b[0m";

function showHelp(): void {
  const categories = getRegisteredCategories();
  console.info(`
${cyan}dex-bench${reset} - LLM Benchmark CLI

${cyan}Usage:${reset}
  bun src/bench.ts <command> [options]

${cyan}Commands:${reset}
  run                   Run benchmarks against all models and documents
  results               Display the latest benchmark results
  results <file>        Display results from a specific JSON file
  markdown              Export the latest results to markdown
  markdown <file>       Export specific results to markdown

${cyan}Run Options:${reset}
  --category <name>     Run specific category (can be used multiple times)
  --all                 Run all benchmark categories (default)
  --fresh               Start a fresh run, ignoring any incomplete runs
  --concurrency <n>     Run up to n benchmarks in parallel (default: 1)
  --retries <n>         Retry failed benchmarks up to n times (default: 3)

${cyan}Available Categories:${reset}
  ${categories.map((c) => `${yellow}${c}${reset}`).join(", ")}

${cyan}Resume Behavior:${reset}
  If an incomplete benchmark run is detected, it will automatically resume.
  Use --fresh to start a new run instead.

${cyan}Examples:${reset}
  bun src/bench.ts run
  bun src/bench.ts run --fresh
  bun src/bench.ts run --concurrency 4
  bun src/bench.ts run --concurrency 4 --retries 5
  bun src/bench.ts run --category summarization
  bun src/bench.ts run --category structured-output
  bun src/bench.ts run --category summarization --category structured-output
  bun src/bench.ts results
  bun src/bench.ts results ./results/benchmark-2024-01-01T12-00-00-000Z.json
  bun src/bench.ts markdown
`);
}

interface ParsedArgs {
  categories: BenchmarkCategory[] | undefined;
  fresh: boolean;
  concurrency: number;
  retries: number;
}

function parseArgs(args: string[]): ParsedArgs {
  const categories: BenchmarkCategory[] = [];
  const registeredCategories = getRegisteredCategories();
  let fresh = false;
  let concurrency = 1;
  let retries = 3;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--category" && args[i + 1]) {
      const category = args[i + 1] as BenchmarkCategory;
      if (registeredCategories.includes(category)) {
        categories.push(category);
      } else {
        displayError(`Unknown category: ${category}`);
        displayInfo(`Available categories: ${registeredCategories.join(", ")}`);
        process.exit(1);
      }
      i++; // Skip the next arg
    } else if (args[i] === "--all") {
      // Return undefined to mean all categories
    } else if (args[i] === "--fresh") {
      fresh = true;
    } else if (args[i] === "--concurrency") {
      const value = args[i + 1];
      if (!value) {
        displayError("--concurrency requires a value");
        process.exit(1);
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        displayError("--concurrency must be a positive integer");
        process.exit(1);
      }
      concurrency = parsed;
      i++;
    } else if (args[i] === "--retries") {
      const value = args[i + 1];
      if (!value) {
        displayError("--retries requires a value");
        process.exit(1);
      }
      const parsed = Number.parseInt(value, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        displayError("--retries must be a non-negative integer");
        process.exit(1);
      }
      retries = parsed;
      i++;
    }
  }

  return {
    categories: categories.length > 0 ? categories : undefined,
    fresh,
    concurrency,
    retries,
  };
}

async function runCommand(args: string[]): Promise<void> {
  const { categories, fresh, concurrency, retries } = parseArgs(args);
  const registeredCategories = getRegisteredCategories();
  const selectedCategories = categories ?? registeredCategories;

  // Check for incomplete runs
  let resumeFrom = null;
  if (!fresh) {
    resumeFrom = await loadIncompleteRun();
    if (resumeFrom) {
      const completedCount = countCompletedRuns(resumeFrom);
      const documents = await getDocuments();
      const totalCount = countTotalRuns(
        resumeFrom.categories,
        models.length,
        documents.length,
      );

      displayWarning(`Found incomplete benchmark run: ${resumeFrom.id}`);
      displayInfo(
        `Progress: ${completedCount}/${totalCount} results completed`,
      );
      displayInfo(`Resuming from where it left off...`);
      displayInfo(`Use --fresh to start a new run instead.\n`);
    }
  }

  if (!resumeFrom) {
    displayInfo(`Starting benchmark run...`);
    displayInfo(`Categories: ${selectedCategories.join(", ")}`);
    displayInfo(`Concurrency: ${concurrency}, Retries: ${retries}\n`);
  }

  const startTime = performance.now();

  const run = await runBenchmark({
    categories: resumeFrom ? resumeFrom.categories : selectedCategories,
    onProgress: displayProgress,
    resumeFrom: resumeFrom ?? undefined,
    concurrency,
    retries,
  });

  const endTime = performance.now();
  const totalTime = endTime - startTime;

  // Run is already saved progressively, but save final state
  const jsonPath = await saveBenchmarkRun(run);
  const mdPath = await saveMarkdownReport(run);

  displayResults(run);
  displaySuccess(`Results saved to ${jsonPath}`);
  displaySuccess(`Markdown report saved to ${mdPath}`);
  displayInfo(
    `Total benchmark time: ${(totalTime / 1000 / 60).toFixed(2)} minutes`,
  );
}

async function resultsCommand(filePath?: string): Promise<void> {
  let run: Awaited<ReturnType<typeof loadLatestBenchmarkRun>>;

  if (filePath) {
    try {
      run = await loadBenchmarkRun(filePath);
    } catch {
      displayError(`Could not load results from ${filePath}`);
      process.exit(1);
    }
  } else {
    run = await loadLatestBenchmarkRun();

    if (!run) {
      displayError(
        "No benchmark results found. Run 'bun src/bench.ts run' first.",
      );
      process.exit(1);
    }
  }

  displayResults(run);
}

async function markdownCommand(filePath?: string): Promise<void> {
  let run: Awaited<ReturnType<typeof loadLatestBenchmarkRun>>;

  if (filePath) {
    try {
      run = await loadBenchmarkRun(filePath);
    } catch {
      displayError(`Could not load results from ${filePath}`);
      process.exit(1);
    }
  } else {
    run = await loadLatestBenchmarkRun();

    if (!run) {
      displayError(
        "No benchmark results found. Run 'bun src/bench.ts run' first.",
      );
      process.exit(1);
    }
  }

  const mdPath = await saveMarkdownReport(run);
  displaySuccess(`Markdown report saved to ${mdPath}`);
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "run":
      await runCommand(args.slice(1));
      break;
    case "results":
      await resultsCommand(args[1]);
      break;
    case "markdown":
    case "md":
      await markdownCommand(args[1]);
      break;
    case "help":
    case "--help":
    case "-h":
      showHelp();
      break;
    default:
      if (command) {
        displayError(`Unknown command: ${command}`);
      }
      showHelp();
      process.exit(command ? 1 : 0);
  }
}

main().catch((error) => {
  displayError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
