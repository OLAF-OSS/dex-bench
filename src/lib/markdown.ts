import prettyMs from "pretty-ms";
import type {
  BenchmarkRun,
  SummarizationResult,
  SummarizationStats,
  StructuredOutputResult,
  StructuredOutputStats,
} from "@/lib/types";

// ============================================================================
// Summarization Section
// ============================================================================

function generateSummarizationSection(
  results: SummarizationResult[],
  stats: SummarizationStats,
): string[] {
  const lines: string[] = [];

  lines.push("## Summarization Benchmark");
  lines.push("");
  lines.push("Tests LLM summarization capabilities with document analysis.");
  lines.push("");

  // Results table
  lines.push("### Results");
  lines.push("");
  lines.push(
    "| Model | Document | Doc Tokens | Time | Input Tokens | Output Tokens | Total Tokens | Tok/s | Status |",
  );
  lines.push(
    "|-------|----------|------------|------|--------------|---------------|--------------|-------|--------|",
  );

  for (const result of results) {
    const shortModel = result.model;
    const shortDoc = result.document.replace(".md", "");
    const time = prettyMs(result.durationMs, { secondsDecimalDigits: 1 });
    const speed = result.tokensPerSecond.toFixed(1);
    const status = result.success ? "✅" : "❌";

    lines.push(
      `| ${shortModel} | ${shortDoc} | ${result.documentTokens.toLocaleString()} | ${time} | ${result.inputTokens.toLocaleString()} | ${result.outputTokens.toLocaleString()} | ${result.totalTokens.toLocaleString()} | ${speed} | ${status} |`,
    );
  }

  lines.push("");

  // Statistics
  lines.push("### Statistics");
  lines.push("");
  lines.push(`- **Total Duration:** ${prettyMs(stats.totalDurationMs)}`);
  lines.push(`- **Average Duration:** ${prettyMs(stats.averageDurationMs)}`);
  lines.push(
    `- **Total Input Tokens:** ${stats.totalInputTokens.toLocaleString()}`,
  );
  lines.push(
    `- **Total Output Tokens:** ${stats.totalOutputTokens.toLocaleString()}`,
  );
  lines.push(
    `- **Average Tokens/s:** ${stats.averageTokensPerSecond.toFixed(1)}`,
  );

  if (stats.fastestResult.model) {
    const fastModel = stats.fastestResult.model;
    lines.push(
      `- **⚡ Fastest:** ${fastModel} on ${stats.fastestResult.document} (${prettyMs(stats.fastestResult.durationMs)})`,
    );
  }

  if (stats.slowestResult.model) {
    const slowModel = stats.slowestResult.model;
    lines.push(
      `- **🐢 Slowest:** ${slowModel} on ${stats.slowestResult.document} (${prettyMs(stats.slowestResult.durationMs)})`,
    );
  }

  lines.push("");

  // Model averages table
  lines.push("### Model Averages");
  lines.push("");
  lines.push("| Model | Average Time |");
  lines.push("|-------|--------------|");

  const sortedAverages = Object.entries(stats.modelAverages).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [model, avgMs] of sortedAverages) {
    const shortModel = model;
    lines.push(`| ${shortModel} | ${prettyMs(avgMs)} |`);
  }

  lines.push("");

  // Summaries section (collapsible)
  lines.push("### Summaries");
  lines.push("");

  for (const result of results) {
    if (result.success && result.summary) {
      const shortModel = result.model;
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

  return lines;
}

// ============================================================================
// Structured Output Section
// ============================================================================

function generateStructuredOutputSection(
  results: StructuredOutputResult[],
  stats: StructuredOutputStats,
): string[] {
  const lines: string[] = [];

  lines.push("## Structured Output Benchmark");
  lines.push("");
  lines.push(
    "Tests LLM JSON structured output capabilities with entity extraction.",
  );
  lines.push("");

  // Results table
  lines.push("### Results");
  lines.push("");
  lines.push(
    "| Model | Document | Doc Tokens | Time | Entity Types | Extractions | Relationships | Status |",
  );
  lines.push(
    "|-------|----------|------------|------|--------------|-------------|---------------|--------|",
  );

  for (const result of results) {
    const shortModel = result.model;
    const shortDoc = result.document.replace(".md", "");
    const time = prettyMs(result.durationMs, { secondsDecimalDigits: 1 });
    const status = result.success ? "✅" : "❌";

    lines.push(
      `| ${shortModel} | ${shortDoc} | ${result.documentTokens.toLocaleString()} | ${time} | ${result.entityTypes.length} | ${result.extractionCount} | ${result.relationshipCount} | ${status} |`,
    );
  }

  lines.push("");

  // Statistics
  lines.push("### Statistics");
  lines.push("");
  lines.push(`- **Total Duration:** ${prettyMs(stats.totalDurationMs)}`);
  lines.push(`- **Average Duration:** ${prettyMs(stats.averageDurationMs)}`);
  lines.push(
    `- **Total Extractions:** ${stats.totalExtractions.toLocaleString()}`,
  );
  lines.push(
    `- **Total Relationships:** ${stats.totalRelationships.toLocaleString()}`,
  );
  lines.push(
    `- **Avg Extractions/Doc:** ${stats.averageExtractionsPerDoc.toFixed(1)}`,
  );
  lines.push(
    `- **Avg Entity Types/Doc:** ${stats.averageEntityTypesPerDoc.toFixed(1)}`,
  );

  if (stats.fastestResult.model) {
    const fastModel = stats.fastestResult.model;
    lines.push(
      `- **⚡ Fastest:** ${fastModel} on ${stats.fastestResult.document} (${prettyMs(stats.fastestResult.durationMs)})`,
    );
  }

  if (stats.slowestResult.model) {
    const slowModel = stats.slowestResult.model;
    lines.push(
      `- **🐢 Slowest:** ${slowModel} on ${stats.slowestResult.document} (${prettyMs(stats.slowestResult.durationMs)})`,
    );
  }

  lines.push("");

  // Model averages table
  lines.push("### Model Averages");
  lines.push("");
  lines.push("| Model | Average Time |");
  lines.push("|-------|--------------|");

  const sortedAverages = Object.entries(stats.modelAverages).sort(
    ([, a], [, b]) => a - b,
  );

  for (const [model, avgMs] of sortedAverages) {
    const shortModel = model;
    lines.push(`| ${shortModel} | ${prettyMs(avgMs)} |`);
  }

  lines.push("");

  // Entity Types section (collapsible)
  lines.push("### Entity Types by Model");
  lines.push("");

  for (const result of results) {
    if (result.success && result.entityTypes.length > 0) {
      const shortModel = result.model;
      const shortDoc = result.document.replace(".md", "");

      lines.push(`<details>`);
      lines.push(
        `<summary><strong>${shortModel}</strong> → ${shortDoc} (${result.entityTypes.length} types, ${result.extractionCount} extractions)</summary>`,
      );
      lines.push("");
      lines.push("**Entity Types:**");
      lines.push(result.entityTypes.map((t) => `\`${t}\``).join(", "));
      lines.push("");
      if (result.extractions.length > 0) {
        lines.push("**Sample Extractions (first 10):**");
        lines.push("");
        lines.push("| ID | Class | Text |");
        lines.push("|----|-------|------|");
        for (const extraction of result.extractions.slice(0, 10)) {
          const text =
            extraction.extractionText.length > 50
              ? `${extraction.extractionText.slice(0, 47)}...`
              : extraction.extractionText;
          lines.push(
            `| ${extraction.id} | ${extraction.extractionClass} | ${text} |`,
          );
        }
        lines.push("");
      }
      lines.push(`</details>`);
      lines.push("");
    }
  }

  return lines;
}

// ============================================================================
// Main Generator
// ============================================================================

export function generateMarkdown(run: BenchmarkRun): string {
  const lines: string[] = [];

  lines.push("# Benchmark Results");
  lines.push("");
  lines.push(`**Run ID:** \`${run.id}\``);
  lines.push(`**Timestamp:** ${new Date(run.timestamp).toLocaleString()}`);
  lines.push(`**Models:** ${run.models.length}`);
  lines.push(`**Documents:** ${run.documents.length}`);
  lines.push(`**Categories:** ${run.categories.join(", ")}`);
  lines.push("");

  // Table of contents
  lines.push("## Table of Contents");
  lines.push("");
  if (run.results.summarization) {
    lines.push("- [Summarization Benchmark](#summarization-benchmark)");
  }
  if (run.results.structuredOutput) {
    lines.push("- [Structured Output Benchmark](#structured-output-benchmark)");
  }
  lines.push("");

  // Generate sections for each category
  if (run.results.summarization && run.stats.summarization) {
    lines.push(
      ...generateSummarizationSection(
        run.results.summarization,
        run.stats.summarization,
      ),
    );
  }

  if (run.results.structuredOutput && run.stats.structuredOutput) {
    lines.push(
      ...generateStructuredOutputSection(
        run.results.structuredOutput,
        run.stats.structuredOutput,
      ),
    );
  }

  return lines.join("\n");
}

export async function saveMarkdownReport(run: BenchmarkRun): Promise<string> {
  const markdown = generateMarkdown(run);
  const filePath = `./results/${run.id}.md`;

  await Bun.write(filePath, markdown);
  return filePath;
}
