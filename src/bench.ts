import {
  runBenchmark,
  saveBenchmarkRun,
  loadLatestBenchmarkRun,
  loadBenchmarkRun,
} from "@/lib/runner";
import {
  displayProgress,
  displayResults,
  displayError,
  displaySuccess,
  displayInfo,
} from "@/lib/display";
import { saveMarkdownReport } from "@/lib/markdown";

const cyan = Bun.color("cyan", "ansi");
const reset = "\x1b[0m";

function showHelp(): void {
  console.info(`
${cyan}dex-bench${reset} - LLM Summarization Benchmark CLI

${cyan}Usage:${reset}
  bun src/bench.ts <command> [options]

${cyan}Commands:${reset}
  run              Run the benchmark against all models and documents
  results          Display the latest benchmark results
  results <file>   Display results from a specific JSON file
  markdown         Export the latest results to markdown
  markdown <file>  Export specific results to markdown

${cyan}Examples:${reset}
  bun src/bench.ts run
  bun src/bench.ts results
  bun src/bench.ts results ./results/benchmark-2024-01-01T12-00-00-000Z.json
  bun src/bench.ts markdown
`);
}

async function runCommand(): Promise<void> {
  displayInfo("Starting benchmark run...\n");

  const startTime = performance.now();

  const run = await runBenchmark((model, document, index, total) => {
    displayProgress(model, document, index, total);
  });

  const endTime = performance.now();
  const totalTime = endTime - startTime;

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
      await runCommand();
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
