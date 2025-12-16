import prettyMs from "pretty-ms";
import type { BenchmarkRun } from "@/lib/types";

export function generateMarkdown(run: BenchmarkRun): string {
  const lines: string[] = [];

  lines.push("# Benchmark Results");
  lines.push("");
  lines.push(`**Run ID:** \`${run.id}\``);
  lines.push(`**Timestamp:** ${new Date(run.timestamp).toLocaleString()}`);
  lines.push(`**Models:** ${run.models.length}`);
  lines.push(`**Documents:** ${run.documents.length}`);
  lines.push("");

  // Results table
  lines.push("## Results");
  lines.push("");
  lines.push(
    "| Model | Document | Time | Input Tokens | Output Tokens | Tok/s | Status |",
  );
  lines.push(
    "|-------|----------|------|--------------|---------------|-------|--------|",
  );

  for (const result of run.results) {
    const shortModel = result.model.split("/").pop() || result.model;
    const shortDoc = result.document.replace(".md", "");
    const time = prettyMs(result.durationMs, { secondsDecimalDigits: 1 });
    const speed = result.tokensPerSecond.toFixed(1);
    const status = result.success ? "✅" : "❌";

    lines.push(
      `| ${shortModel} | ${shortDoc} | ${time} | ${result.inputTokens.toLocaleString()} | ${result.outputTokens.toLocaleString()} | ${speed} | ${status} |`,
    );
  }

  lines.push("");

  // Statistics
  lines.push("## Statistics");
  lines.push("");

  const { stats } = run;
  lines.push(`- **Total Duration:** ${prettyMs(stats.totalDurationMs)}`);
  lines.push(`- **Average Duration:** ${prettyMs(stats.averageDurationMs)}`);

  if (stats.fastestResult.model) {
    const fastModel = stats.fastestResult.model.split("/").pop();
    lines.push(
      `- **⚡ Fastest:** ${fastModel} on ${stats.fastestResult.document} (${prettyMs(stats.fastestResult.durationMs)})`,
    );
  }

  if (stats.slowestResult.model) {
    const slowModel = stats.slowestResult.model.split("/").pop();
    lines.push(
      `- **🐢 Slowest:** ${slowModel} on ${stats.slowestResult.document} (${prettyMs(stats.slowestResult.durationMs)})`,
    );
  }

  lines.push("");

  // Model averages table
  lines.push("## Model Averages");
  lines.push("");
  lines.push("| Model | Average Time |");
  lines.push("|-------|--------------|");

  const sortedAverages = Object.entries(stats.modelAverages).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [model, avgMs] of sortedAverages) {
    const shortModel = model.split("/").pop() || model;
    lines.push(`| ${shortModel} | ${prettyMs(avgMs)} |`);
  }

  lines.push("");

  // Summaries section (collapsible)
  lines.push("## Summaries");
  lines.push("");

  for (const result of run.results) {
    if (result.success && result.summary) {
      const shortModel = result.model.split("/").pop() || result.model;
      const shortDoc = result.document.replace(".md", "");

      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${shortModel}</strong> → ${shortDoc}</summary>`,
      );
      lines.push("");
      lines.push(result.summary);
      lines.push("");
      lines.push(`</details>`);
      lines.push("");
    }
  }

  return lines.join("\n");
}

export async function saveMarkdownReport(run: BenchmarkRun): Promise<string> {
  const markdown = generateMarkdown(run);
  const filePath = `./results/${run.id}.md`;

  await Bun.write(filePath, markdown);
  return filePath;
}
