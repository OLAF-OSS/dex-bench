# Development Guide

This document provides comprehensive technical details for developers and LLMs working with dex-bench.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Benchmark System](#benchmark-system)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Configuration](#configuration)
- [Web Dashboard](#web-dashboard)
- [Build System](#build-system)
- [Code Style](#code-style)
- [Scripts Reference](#scripts-reference)
- [Extending the Tool](#extending-the-tool)

---

## Architecture Overview

dex-bench is an extensible CLI benchmarking tool that measures LLM performance across multiple benchmark categories. It consists of three main parts:

1. **Benchmark Registry** (`src/lib/benchmarks/`) - Extensible system for registering different benchmark types
2. **CLI Benchmark Runner** (`src/`) - Executes benchmarks against LLM APIs and generates results
3. **Web Dashboard** (`web/`) - React-based visualization of benchmark results

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun | Fast startup, built-in TypeScript, native file APIs |
| LLM Integration | AI SDK v6 | Unified API for multiple LLM providers |
| Structured Output | Mastra Agent | Schema-validated JSON generation |
| Token Counting | gpt-tokenizer | Accurate cl100k_base tokenization |
| Frontend | React 19 | Declarative UI, ecosystem |
| Charts | Recharts | React-native, composable charts |
| Data Table | TanStack Table | Headless, sortable, filterable |
| Styling | Tailwind CSS v4 | Utility-first, @theme support |
| Linting | Biome | Fast, unified linting/formatting |

---

## Project Structure

```
dex-bench/
├── src/                    # CLI source code
│   ├── bench.ts           # CLI entry point (commands)
│   ├── build-web.ts       # Web dashboard build script
│   ├── index.ts           # Dev entry point
│   └── lib/               # Core library modules
│       ├── benchmarks/    # Benchmark type registry
│       │   ├── index.ts           # Registry and exports
│       │   ├── types.ts           # BenchmarkType interface
│       │   ├── summarization.ts   # Summarization benchmark
│       │   └── structured-output.ts # Entity extraction benchmark
│       ├── agent.ts       # Mastra agent configuration
│       ├── display.ts     # Terminal output formatting
│       ├── entity-extraction.ts   # Entity extraction functions
│       ├── env.ts         # Environment validation (Zod)
│       ├── llm.ts         # LLM provider configuration
│       ├── markdown.ts    # Markdown report generation
│       ├── models.ts      # Model definitions
│       ├── prompts.ts     # Prompt templates
│       ├── runner.ts      # Benchmark orchestration
│       ├── storage.ts     # File I/O for results
│       ├── types.ts       # TypeScript interfaces
│       └── utils.ts       # Token counting utilities
│
├── web/                    # Web dashboard source
│   ├── app.tsx            # React app entry
│   ├── index.html         # HTML template
│   ├── styles.css         # Tailwind CSS with @theme
│   ├── types.ts           # Shared types + Window augmentation
│   └── components/        # React components
│       ├── charts.tsx     # Recharts visualizations
│       ├── results-table.tsx  # TanStack Tables (per category)
│       ├── stats-cards.tsx    # Summary stat cards
│       └── summaries.tsx      # Summaries + Extractions sections
│
├── docs/                   # Benchmark input documents
├── results/                # Benchmark output (JSON/MD)
├── dist/                   # Built web dashboard
├── biome.json             # Linting configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

---

## Benchmark System

### Registry Pattern

The benchmark system uses a registry pattern that allows easy addition of new benchmark types:

```typescript
// src/lib/benchmarks/types.ts
export interface BenchmarkType<TResult, TStats> {
  id: BenchmarkCategory;
  name: string;
  description: string;
  run: (model: string, document: Document) => Promise<TResult>;
  calculateStats: (results: TResult[], models: string[]) => TStats;
}
```

### Available Categories

| Category | ID | Description |
|----------|-----|-------------|
| Summarization | `summarization` | Tests document summarization |
| Structured Output | `structured-output` | Tests JSON entity extraction |

### Category Type System

Results use discriminated unions for type safety:

```typescript
// Base types
interface BaseBenchmarkResult {
  model: string;
  document: string;
  durationMs: number;
  success: boolean;
  error?: string;
}

// Category-specific types
interface SummarizationResult extends BaseBenchmarkResult {
  type: "summarization";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensPerSecond: number;
  summary: string;
}

interface StructuredOutputResult extends BaseBenchmarkResult {
  type: "structured-output";
  entityTypesTimeMs: number;
  extractionTimeMs: number;
  entityTypes: string[];
  extractionCount: number;
  relationshipCount: number;
  extractions: Extraction[];
  relationships: Relationship[];
}

// Union type
type BenchmarkResult = SummarizationResult | StructuredOutputResult;
```

---

## Core Components

### 1. CLI Entry Point (`src/bench.ts`)

The CLI uses a simple command pattern with category selection:

```typescript
// Command routing
switch (command) {
  case "run":      // Execute benchmark with optional --category flags
  case "results":  // Display latest/specific results
  case "markdown": // Export to markdown
  case "help":     // Show usage
}

// Category parsing
function parseCategories(args: string[]): BenchmarkCategory[] | undefined {
  // Parses --category <name> flags
  // Returns undefined for "all categories"
}
```

**Commands:**
- `run [--category <name>]` - Executes benchmark (default: all categories)
- `results [file]` - Displays results table in terminal
- `markdown [file]` - Exports results to GitHub-flavored markdown
- `help` - Shows usage information

### 2. Benchmark Registry (`src/lib/benchmarks/index.ts`)

Central registry for all benchmark types:

```typescript
const registry: BenchmarkRegistry = new Map();

// Register built-in benchmarks
registry.set("summarization", summarizationBenchmark);
registry.set("structured-output", structuredOutputBenchmark);

// API functions
export function registerBenchmark(benchmark: BenchmarkType): void;
export function getBenchmark(category: BenchmarkCategory): BenchmarkType | undefined;
export function getAllBenchmarks(): BenchmarkType[];
export function getRegisteredCategories(): BenchmarkCategory[];
```

### 3. Benchmark Runner (`src/lib/runner.ts`)

Orchestrates benchmark execution across categories:

```typescript
export interface RunBenchmarkOptions {
  categories?: BenchmarkCategory[];
  onProgress?: ProgressCallback;
}

export async function runBenchmark(
  options: RunBenchmarkOptions = {}
): Promise<BenchmarkRun>
```

**Execution Flow:**
1. Load documents from `docs/` using `Bun.Glob`
2. For each selected category:
   - For each model × document combination:
     - Execute category-specific benchmark
     - Collect results
   - Calculate category-specific statistics
3. Return combined `BenchmarkRun` object

### 4. Summarization Benchmark (`src/lib/benchmarks/summarization.ts`)

Tests LLM summarization capabilities:

```typescript
async function runSummarizationBenchmark(
  model: string,
  document: Document
): Promise<SummarizationResult>
```

**Process:**
1. Count input tokens using `gpt-tokenizer`
2. Call LLM with `generateText()` from AI SDK
3. Measure duration with `performance.now()`
4. Calculate tokens/second

### 5. Structured Output Benchmark (`src/lib/benchmarks/structured-output.ts`)

Tests LLM JSON structured output with entity extraction:

```typescript
async function runStructuredOutputBenchmark(
  model: string,
  document: Document
): Promise<StructuredOutputResult>
```

**Process:**
1. Call `generateEntityTypes()` to identify entity types in document
2. Call `extractEntities()` with identified types
3. Track timing for both steps separately
4. Return combined results with extractions and relationships

### 6. Entity Extraction (`src/lib/entity-extraction.ts`)

Uses Mastra Agent for structured JSON output:

```typescript
export async function generateEntityTypes({
  model,
  document,
}: {
  model: string;
  document: string;
}): Promise<{ entityTypes: string[]; _executionTimeMs: number } | { error: string; _executionTimeMs: number }>

export async function extractEntities({
  model,
  document,
  entityTypes,
}: {
  model: string;
  document: string;
  entityTypes: string[];
}): Promise<ExtractionResult>
```

Uses Zod schemas for validation:

```typescript
const extractionSchema = z.object({
  extractions: z.array(z.object({
    id: z.string(),
    extractionClass: z.string(),
    extractionText: z.string(),
    attributes: z.record(z.string(), z.string()).optional(),
  })),
  relationships: z.array(z.object({
    sourceId: z.string(),
    targetId: z.string(),
    relationshipType: z.string(),
    description: z.string().optional(),
  })).optional(),
});
```

### 7. LLM Configuration (`src/lib/llm.ts`)

Uses AI SDK's OpenAI-compatible provider:

```typescript
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export const llmProvider = createOpenAICompatible({
  name: "litellm",
  baseURL: env.LLM_BASE_URL,
  apiKey: env.LLM_API_KEY,
  supportsStructuredOutputs: true,
  includeUsage: true,
});

export const llmModel = (model: string) => llmProvider(model);
```

This allows connecting to any OpenAI-compatible API (LiteLLM, vLLM, Ollama, etc.).

### 8. Mastra Agent (`src/lib/agent.ts`)

Configured for structured output extraction:

```typescript
import { Agent } from "@mastra/core/agent";

export const extractionAgent = new Agent({
  id: "extraction-agent",
  name: "Extraction Agent",
  instructions: {
    role: "system",
    content: "You are a precise entity extraction assistant...",
    providerOptions: {
      openai: { reasoningEffort: "high" },
    },
  },
  model: llmModel(models[0]),
});
```

### 9. Type Definitions (`src/lib/types.ts`)

Core interfaces with categorized results:

```typescript
// Categories
type BenchmarkCategory = "summarization" | "structured-output";

// Results container
interface BenchmarkRunResults {
  summarization?: SummarizationResult[];
  structuredOutput?: StructuredOutputResult[];
}

// Stats container
interface BenchmarkRunStats {
  summarization?: SummarizationStats;
  structuredOutput?: StructuredOutputStats;
}

// Main run structure
interface BenchmarkRun {
  id: string;
  timestamp: string;
  models: string[];
  documents: string[];
  categories: BenchmarkCategory[];
  results: BenchmarkRunResults;
  stats: BenchmarkRunStats;
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BENCHMARK RUN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Parse CLI Options                                                       │
│     --category flags ──────────────────► BenchmarkCategory[]               │
│                                                                             │
│  2. Load Documents                                                          │
│     docs/*.md ──────────────────────────► Array<{name, content}>           │
│                                                                             │
│  3. For each category:                                                      │
│     ┌───────────────────────────────────────────────────────────────────┐  │
│     │  SUMMARIZATION:                                                   │  │
│     │    Input Text ──► gpt-tokenizer ──► inputTokens                  │  │
│     │         ↓                                                         │  │
│     │    generateText(prompt) ──► {text, usage}                        │  │
│     │         ↓                                                         │  │
│     │    SummarizationResult                                           │  │
│     └───────────────────────────────────────────────────────────────────┘  │
│     ┌───────────────────────────────────────────────────────────────────┐  │
│     │  STRUCTURED OUTPUT:                                               │  │
│     │    generateEntityTypes(doc) ──► string[]                         │  │
│     │         ↓                                                         │  │
│     │    extractEntities(doc, types) ──► {extractions, relationships}  │  │
│     │         ↓                                                         │  │
│     │    StructuredOutputResult                                        │  │
│     └───────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  4. Calculate Stats (per category)                                          │
│     results[] ──► calculateStats() ──► CategoryStats                       │
│                                                                             │
│  5. Save Results                                                            │
│     BenchmarkRun ──► results/{id}.json                                     │
│                  ──► results/{id}.md                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Adding New Models

Edit `src/lib/models.ts`:

```typescript
export const models = [
  "openai/gpt-oss-20b",
  "google/gemma-3-12b-it",
  // Add new models here
  "anthropic/claude-3-haiku",
];
```

Model strings follow the format expected by your LLM proxy (e.g., LiteLLM).

### Adding Benchmark Documents

Place markdown files in the `docs/` directory. The runner automatically discovers all `*.md` files.

### Environment Variables

Create `.env` in project root:

```env
LLM_BASE_URL=https://your-llm-proxy.com/v1
LLM_API_KEY=sk-your-api-key
```

---

## Web Dashboard

### Build Process (`src/build-web.ts`)

The web build is a two-step process:

1. **Tailwind CSS Compilation**
   ```bash
   bunx @tailwindcss/cli -i web/styles.css -o dist/styles.css --minify
   ```

2. **React App Bundling**
   ```typescript
   await Bun.build({
     entrypoints: ["web/app.tsx"],
     outdir: "dist",
     naming: "[name].[hash].[ext]",
     minify: true,
     sourcemap: "linked",
     target: "browser",
   });
   ```

3. **HTML Generation**
   - Injects benchmark data as `window.BENCHMARK_DATA`
   - References bundled JS with content hash

### Data Injection Pattern

```html
<script>window.BENCHMARK_DATA = ${JSON.stringify(run)};</script>
```

The React app accesses this via TypeScript augmentation:

```typescript
// web/types.ts
declare global {
  interface Window {
    BENCHMARK_DATA: BenchmarkRun;
  }
}

// web/app.tsx
const data: BenchmarkRun = window.BENCHMARK_DATA;
```

### Component Architecture

```
App
├── Header (sticky, glassmorphism)
├── StatsCards (per-category stats)
│   ├── SummarizationStatsCards
│   └── StructuredOutputStatsCards
├── Category Tab Navigation (if multiple categories)
├── View Tab Navigation (table | charts | details)
├── Content (per active category)
│   ├── Summarization
│   │   ├── SummarizationTable
│   │   ├── Charts (Duration, Tokens/s)
│   │   └── SummariesSection
│   └── Structured Output
│       ├── StructuredOutputTable
│       ├── Charts (Duration, Extractions)
│       └── ExtractionsSection
└── Footer
```

### Styling (`web/styles.css`)

Uses Tailwind CSS v4's `@theme` directive:

```css
@import "tailwindcss";

@theme {
  --font-sans: "Space Grotesk", system-ui, sans-serif;
  --font-mono: "JetBrains Mono", ui-monospace, monospace;
  
  --color-surface-50: #0a0f14;
  --color-surface-100: #0f1419;
  /* ... dark theme palette */
  
  --color-accent-400: #22d3ee;
  --color-success-400: #4ade80;
  --color-warning-400: #facc15;
  --color-error-400: #f87171;
}
```

Custom utility classes:
- `.card` - Rounded container with border
- `.stat-card` - Card with gradient hover effect
- `.chart-container` - Hover scale animation

### Charts Implementation

Uses Recharts with custom theming:

```tsx
<BarChart data={data} layout="vertical">
  <CartesianGrid strokeDasharray="3 3" stroke="#2a3542" />
  <XAxis tick={{ fill: "#9ca3af" }} />
  <YAxis tick={{ fill: "#9ca3af" }} />
  <Tooltip content={<CustomTooltip />} />
  <Bar dataKey="avgSeconds">
    {data.map((entry, i) => (
      <Cell key={entry.model} fill={CHART_COLORS[i % 8]} />
    ))}
  </Bar>
</BarChart>
```

### Table Implementation

Uses TanStack Table (headless) with separate tables per category:

```tsx
// SummarizationTable - columns: Model, Document, Duration, Input, Output, Tok/s, Status
// StructuredOutputTable - columns: Model, Document, Duration, Types, Extractions, Relations, Status

const table = useReactTable({
  data: results,
  columns,
  state: { sorting, columnFilters, globalFilter },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});
```

---

## Build System

### TypeScript Configuration

```json
{
  "compilerOptions": {
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "target": "ESNext",
    "module": "Preserve",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

Key settings:
- `moduleResolution: "bundler"` - For Bun compatibility
- `noUncheckedIndexedAccess: true` - Safer array access
- Path alias `@/*` maps to `src/*`

### Preview Server

```typescript
Bun.serve({
  port: 5151,
  async fetch(req) {
    const url = new URL(req.url);
    let path = url.pathname === "/" ? "/index.html" : url.pathname;
    return new Response(Bun.file(`dist${path}`));
  },
});
```

Uses `Bun.serve()` for static file serving during development.

---

## Code Style

### Biome Configuration

```json
{
  "formatter": {
    "indentStyle": "space",
    "indentWidth": 2
  },
  "linter": {
    "rules": {
      "recommended": true,
      "suspicious": {
        "noConsole": { "level": "warn", "options": { "allow": ["info", "error"] } }
      }
    },
    "domains": {
      "react": "recommended"
    }
  }
}
```

### Conventions

- **File naming**: kebab-case (`results-table.tsx`)
- **Functions**: camelCase (`runBenchmark`)
- **Types/Interfaces**: PascalCase (`BenchmarkResult`)
- **Console output**: Use `console.info` / `console.error` (not `console.log`)
- **Color output**: Use `Bun.color()` for ANSI colors

### Terminal Output Helpers

```typescript
const cyan = Bun.color("cyan", "ansi");
const reset = "\x1b[0m";

console.info(`${cyan}Message${reset}`);
```

Display functions in `src/lib/display.ts`:
- `displayProgress()` - Show [n/total] progress with category label
- `displayResults()` - Formatted results tables (per category)
- `displayError()` - Red error message
- `displaySuccess()` - Green success with checkmark
- `displayInfo()` - Cyan info with icon

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `bun bench` | `bun src/bench.ts run` | Execute full benchmark (all categories) |
| `bun bench:results` | `bun src/bench.ts results` | Show latest results |
| `bun bench:md` | `bun src/bench.ts markdown` | Export to markdown |
| `bun bench:html` | `bun src/build-web.ts` | Build web dashboard |
| `bun preview` | `bun src/build-web.ts preview` | Start preview server |
| `bun lint` | `bun run --bun biome check` | Run linter |
| `bun fmt` | `bun run --bun biome format --write` | Format code |
| `bun tsc` | `tsc --noEmit` | Type check |

---

## Extending the Tool

### Adding a New Benchmark Category

1. **Define types** in `src/lib/types.ts`:
   ```typescript
   // Add to BenchmarkCategory union
   export type BenchmarkCategory = "summarization" | "structured-output" | "translation";

   // Define result type
   export interface TranslationResult extends BaseBenchmarkResult {
     type: "translation";
     sourceLanguage: string;
     targetLanguage: string;
     translatedText: string;
     bleuScore?: number;
   }

   // Define stats type
   export interface TranslationStats extends BaseStats {
     type: "translation";
     averageBleuScore: number;
   }

   // Add to union types
   export type BenchmarkResult = SummarizationResult | StructuredOutputResult | TranslationResult;
   export type BenchmarkStats = SummarizationStats | StructuredOutputStats | TranslationStats;

   // Add to results/stats containers
   export interface BenchmarkRunResults {
     summarization?: SummarizationResult[];
     structuredOutput?: StructuredOutputResult[];
     translation?: TranslationResult[];
   }
   ```

2. **Create benchmark file** `src/lib/benchmarks/translation.ts`:
   ```typescript
   import type { Document, TranslationResult, TranslationStats } from "@/lib/types";
   import type { BenchmarkType } from "./types";

   async function runTranslationBenchmark(
     model: string,
     document: Document
   ): Promise<TranslationResult> {
     // Implementation
   }

   function calculateTranslationStats(
     results: TranslationResult[],
     models: string[]
   ): TranslationStats {
     // Implementation
   }

   export const translationBenchmark: BenchmarkType<TranslationResult, TranslationStats> = {
     id: "translation",
     name: "Translation",
     description: "Tests LLM translation capabilities",
     run: runTranslationBenchmark,
     calculateStats: calculateTranslationStats,
   };
   ```

3. **Register in index** `src/lib/benchmarks/index.ts`:
   ```typescript
   import { translationBenchmark } from "./translation";

   registry.set("translation", translationBenchmark);

   export { translationBenchmark } from "./translation";
   ```

4. **Update runner** `src/lib/runner.ts`:
   ```typescript
   } else if (category === "translation") {
     const categoryResults = await runCategoryBenchmark<TranslationResult>(...);
     results.translation = categoryResults;
     stats.translation = translationBenchmark.calculateStats(categoryResults, modelList);
   }
   ```

5. **Update display, markdown, and web components** to handle the new category.

### Adding a New Output Format

1. Create formatter in `src/lib/`:
   ```typescript
   // src/lib/csv.ts
   export function generateCSV(run: BenchmarkRun): string {
     // Implementation
   }
   ```

2. Add command in `src/bench.ts`:
   ```typescript
   case "csv":
     await csvCommand(args[1]);
     break;
   ```

### Custom Prompts

Add to `src/lib/prompts.ts`:

```typescript
export const PROMPTS = {
  "summarize-document": (doc) => `...`,
  "extract-entities": (doc, types) => `...`,
  "generate-entity-types": (doc) => `...`,
  // Add new prompts here
  "translate": (doc, lang) => `Translate to ${lang}: ${doc}`,
};
```

---

## Troubleshooting

### Common Issues

**"No benchmark results found"**
- Run `bun bench` first to generate results

**Environment validation errors**
- Check `.env` file exists with valid `LLM_BASE_URL` and `LLM_API_KEY`

**Web build fails**
- Ensure `results/` has at least one benchmark JSON file

**LLM API errors**
- Verify model names match your LLM proxy configuration
- Check API key permissions and rate limits

**Structured output failures**
- Model may not support structured output well
- Check Mastra agent configuration

### Debug Mode

For verbose output, run directly:
```bash
bun src/bench.ts run 2>&1 | tee benchmark.log
```

---

## Contributing

1. Fork the repository
2. Create a feature branch
3. Run `bun lint` and `bun tsc` before committing
4. Follow [Conventional Commits](https://www.conventionalcommits.org/) format
5. Submit a pull request

---

## License

See [LICENSE](./LICENSE) for details.
