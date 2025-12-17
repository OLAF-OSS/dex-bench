import prettyMs from "pretty-ms";
import type {
  BenchmarkCategory,
  BenchmarkRun,
  SummarizationResult,
  SummarizationStats,
  StructuredOutputResult,
  StructuredOutputStats,
} from "@/lib/types";

const green = Bun.color("green", "ansi");
const red = Bun.color("red", "ansi");
const cyan = Bun.color("cyan", "ansi");
const yellow = Bun.color("yellow", "ansi");
const gray = Bun.color("gray", "ansi");
const magenta = Bun.color("magenta", "ansi");
const reset = "\x1b[0m";

function pad(str: string, length: number): string {
  return str.length >= length
    ? str.slice(0, length)
    : str + " ".repeat(length - str.length);
}

function padLeft(str: string, length: number): string {
  return str.length >= length
    ? str.slice(0, length)
    : " ".repeat(length - str.length) + str;
}

function truncate(str: string, length: number): string {
  return str.length > length ? `${str.slice(0, length - 3)}...` : str;
}

export function displayProgress(
  category: BenchmarkCategory,
  model: string,
  document: string,
  index: number,
  total: number,
): void {
  const progress = `[${index}/${total}]`;
  const shortModel = model.split("/").pop() || model;
  const categoryLabel = category === "summarization" ? "SUM" : "JSON";
  console.info(
    `${cyan}${progress}${reset} ${magenta}[${categoryLabel}]${reset} Running ${yellow}${shortModel}${reset} on ${gray}${document}${reset}`,
  );
}

// ============================================================================
// Summarization Results Display
// ============================================================================

function displaySummarizationResults(
  results: SummarizationResult[],
  stats: SummarizationStats,
): void {
  console.info(`\n${cyan}─── SUMMARIZATION BENCHMARK ───${reset}\n`);

  const modelWidth = 30;
  const docWidth = 25;
  const timeWidth = 12;
  const tokensWidth = 10;
  const speedWidth = 12;
  const statusWidth = 8;

  console.info(
    `${cyan}${pad("Model", modelWidth)} ${pad("Document", docWidth)} ${padLeft("Time", timeWidth)} ${padLeft("Tokens", tokensWidth)} ${padLeft("Tok/s", speedWidth)} ${pad("Status", statusWidth)}${reset}`,
  );
  console.info(
    `${gray}${"─".repeat(modelWidth + docWidth + timeWidth + tokensWidth + speedWidth + statusWidth + 5)}${reset}`,
  );

  for (const result of results) {
    const shortModel = truncate(
      result.model.split("/").pop() || result.model,
      modelWidth,
    );
    const shortDoc = truncate(result.document.replace(".md", ""), docWidth);
    const time = prettyMs(result.durationMs, { secondsDecimalDigits: 1 });
    const tokens = result.totalTokens.toString();
    const speed = result.tokensPerSecond.toFixed(1);
    const status = result.success ? `${green}✓${reset}` : `${red}✗${reset}`;
    const statusColor = result.success ? "" : red;

    console.info(
      `${statusColor}${pad(shortModel, modelWidth)} ${pad(shortDoc, docWidth)} ${padLeft(time, timeWidth)} ${padLeft(tokens, tokensWidth)} ${padLeft(speed, speedWidth)} ${status}${reset}`,
    );
  }

  // Stats
  console.info();
  console.info(
    `${gray}Total Duration:${reset}   ${prettyMs(stats.totalDurationMs)}`,
  );
  console.info(
    `${gray}Average Duration:${reset} ${prettyMs(stats.averageDurationMs)}`,
  );
  console.info(
    `${gray}Avg Tok/s:${reset}        ${stats.averageTokensPerSecond.toFixed(1)}`,
  );

  if (stats.fastestResult.model) {
    const fastModel = stats.fastestResult.model.split("/").pop();
    console.info(
      `${green}⚡ Fastest:${reset} ${fastModel} on ${stats.fastestResult.document} (${prettyMs(stats.fastestResult.durationMs)})`,
    );
  }

  if (stats.slowestResult.model) {
    const slowModel = stats.slowestResult.model.split("/").pop();
    console.info(
      `${red}🐢 Slowest:${reset} ${slowModel} on ${stats.slowestResult.document} (${prettyMs(stats.slowestResult.durationMs)})`,
    );
  }
}

// ============================================================================
// Structured Output Results Display
// ============================================================================

function displayStructuredOutputResults(
  results: StructuredOutputResult[],
  stats: StructuredOutputStats,
): void {
  console.info(`\n${cyan}─── STRUCTURED OUTPUT BENCHMARK ───${reset}\n`);

  const modelWidth = 28;
  const docWidth = 22;
  const timeWidth = 10;
  const entitiesWidth = 10;
  const relationsWidth = 10;
  const typesWidth = 8;
  const statusWidth = 8;

  console.info(
    `${cyan}${pad("Model", modelWidth)} ${pad("Document", docWidth)} ${padLeft("Time", timeWidth)} ${padLeft("Entities", entitiesWidth)} ${padLeft("Rels", relationsWidth)} ${padLeft("Types", typesWidth)} ${pad("Status", statusWidth)}${reset}`,
  );
  console.info(
    `${gray}${"─".repeat(modelWidth + docWidth + timeWidth + entitiesWidth + relationsWidth + typesWidth + statusWidth + 6)}${reset}`,
  );

  for (const result of results) {
    const shortModel = truncate(
      result.model.split("/").pop() || result.model,
      modelWidth,
    );
    const shortDoc = truncate(result.document.replace(".md", ""), docWidth);
    const time = prettyMs(result.durationMs, { secondsDecimalDigits: 1 });
    const entities = result.extractionCount.toString();
    const relations = result.relationshipCount.toString();
    const types = result.entityTypes.length.toString();
    const status = result.success ? `${green}✓${reset}` : `${red}✗${reset}`;
    const statusColor = result.success ? "" : red;

    console.info(
      `${statusColor}${pad(shortModel, modelWidth)} ${pad(shortDoc, docWidth)} ${padLeft(time, timeWidth)} ${padLeft(entities, entitiesWidth)} ${padLeft(relations, relationsWidth)} ${padLeft(types, typesWidth)} ${status}${reset}`,
    );
  }

  // Stats
  console.info();
  console.info(
    `${gray}Total Duration:${reset}     ${prettyMs(stats.totalDurationMs)}`,
  );
  console.info(
    `${gray}Average Duration:${reset}   ${prettyMs(stats.averageDurationMs)}`,
  );
  console.info(`${gray}Total Extractions:${reset}  ${stats.totalExtractions}`);
  console.info(
    `${gray}Total Relationships:${reset} ${stats.totalRelationships}`,
  );
  console.info(
    `${gray}Avg Extractions/Doc:${reset} ${stats.averageExtractionsPerDoc.toFixed(1)}`,
  );

  if (stats.fastestResult.model) {
    const fastModel = stats.fastestResult.model.split("/").pop();
    console.info(
      `${green}⚡ Fastest:${reset} ${fastModel} on ${stats.fastestResult.document} (${prettyMs(stats.fastestResult.durationMs)})`,
    );
  }

  if (stats.slowestResult.model) {
    const slowModel = stats.slowestResult.model.split("/").pop();
    console.info(
      `${red}🐢 Slowest:${reset} ${slowModel} on ${stats.slowestResult.document} (${prettyMs(stats.slowestResult.durationMs)})`,
    );
  }
}

// ============================================================================
// Model Averages Display
// ============================================================================

function displayModelAverages(
  category: string,
  modelAverages: Record<string, number>,
): void {
  console.info();
  console.info(`${cyan}${category} - Model Averages:${reset}`);
  console.info(`${gray}${"─".repeat(50)}${reset}`);

  const sortedAverages = Object.entries(modelAverages).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [model, avgMs] of sortedAverages) {
    const shortModel = model.split("/").pop() || model;
    console.info(
      `  ${pad(shortModel, 30)} ${yellow}${prettyMs(avgMs)}${reset}`,
    );
  }
}

// ============================================================================
// Main Display Function
// ============================================================================

export function displayResults(run: BenchmarkRun): void {
  console.info("\n");
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );
  console.info(
    `${cyan}                         BENCHMARK RESULTS                                     ${reset}`,
  );
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );
  console.info(`\n${gray}Run ID:${reset} ${run.id}`);
  console.info(`${gray}Timestamp:${reset} ${run.timestamp}`);
  console.info(`${gray}Models:${reset} ${run.models.length}`);
  console.info(`${gray}Documents:${reset} ${run.documents.length}`);
  console.info(`${gray}Categories:${reset} ${run.categories.join(", ")}`);

  // Display results for each category
  if (run.results.summarization && run.stats.summarization) {
    displaySummarizationResults(
      run.results.summarization,
      run.stats.summarization,
    );
  }

  if (run.results.structuredOutput && run.stats.structuredOutput) {
    displayStructuredOutputResults(
      run.results.structuredOutput,
      run.stats.structuredOutput,
    );
  }

  // Model averages section
  console.info();
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );
  console.info(
    `${cyan}                           MODEL AVERAGES                                      ${reset}`,
  );
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );

  if (run.stats.summarization) {
    displayModelAverages(
      "Summarization",
      run.stats.summarization.modelAverages,
    );
  }

  if (run.stats.structuredOutput) {
    displayModelAverages(
      "Structured Output",
      run.stats.structuredOutput.modelAverages,
    );
  }

  console.info();
}

export function displayError(message: string): void {
  console.error(`${red}Error:${reset} ${message}`);
}

export function displaySuccess(message: string): void {
  console.info(`${green}✓${reset} ${message}`);
}

export function displayInfo(message: string): void {
  console.info(`${cyan}ℹ${reset} ${message}`);
}

export function displayWarning(message: string): void {
  console.info(`${yellow}⚠${reset} ${message}`);
}
