import prettyMs from "pretty-ms";
import type { BenchmarkRun } from "@/lib/types";

const green = Bun.color("green", "ansi");
const red = Bun.color("red", "ansi");
const cyan = Bun.color("cyan", "ansi");
const yellow = Bun.color("yellow", "ansi");
const gray = Bun.color("gray", "ansi");
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
  model: string,
  document: string,
  index: number,
  total: number,
): void {
  const progress = `[${index}/${total}]`;
  const shortModel = model.split("/").pop() || model;
  console.info(
    `${cyan}${progress}${reset} Running ${yellow}${shortModel}${reset} on ${gray}${document}${reset}`,
  );
}

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
  console.info();

  // Results table header
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

  // Results rows
  for (const result of run.results) {
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

  // Stats section
  console.info();
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );
  console.info(
    `${cyan}                              STATISTICS                                       ${reset}`,
  );
  console.info(
    `${cyan}═══════════════════════════════════════════════════════════════════════════════${reset}`,
  );
  console.info();

  const { stats } = run;
  console.info(
    `${gray}Total Duration:${reset}   ${prettyMs(stats.totalDurationMs)}`,
  );
  console.info(
    `${gray}Average Duration:${reset} ${prettyMs(stats.averageDurationMs)}`,
  );
  console.info();

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

  console.info();
  console.info(`${cyan}Model Averages:${reset}`);
  console.info(`${gray}${"─".repeat(50)}${reset}`);

  const sortedAverages = Object.entries(stats.modelAverages).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [model, avgMs] of sortedAverages) {
    const shortModel = model.split("/").pop() || model;
    console.info(
      `  ${pad(shortModel, 30)} ${yellow}${prettyMs(avgMs)}${reset}`,
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
