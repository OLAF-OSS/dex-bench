# Development Guide

This document provides comprehensive technical details for developers and LLMs working with dex-bench.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Data Flow](#data-flow)
- [Configuration](#configuration)
- [Web Dashboard](#web-dashboard)
- [Build System](#build-system)
- [Code Style](#code-style)
- [Scripts Reference](#scripts-reference)

---

## Architecture Overview

dex-bench is a CLI benchmarking tool that measures LLM summarization performance. It consists of two main parts:

1. **CLI Benchmark Runner** (`src/`) - Executes benchmarks against LLM APIs and generates results
2. **Web Dashboard** (`web/`) - React-based visualization of benchmark results

### Technology Choices

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Runtime | Bun | Fast startup, built-in TypeScript, native file APIs |
| LLM Integration | AI SDK v6 | Unified API for multiple LLM providers |
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
│       ├── display.ts     # Terminal output formatting
│       ├── env.ts         # Environment validation (Zod)
│       ├── llm.ts         # LLM provider configuration
│       ├── markdown.ts    # Markdown report generation
│       ├── models.ts      # Model definitions
│       ├── prompts.ts     # Prompt templates
│       ├── runner.ts      # Benchmark execution logic
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
│       ├── results-table.tsx  # TanStack Table
│       ├── stats-cards.tsx    # Summary stat cards
│       └── summaries.tsx      # Collapsible summaries
│
├── docs/                   # Benchmark input documents
├── results/                # Benchmark output (JSON/MD)
├── dist/                   # Built web dashboard
├── biome.json             # Linting configuration
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

---

## Core Components

### 1. CLI Entry Point (`src/bench.ts`)

The CLI uses a simple command pattern:

```typescript
// Command routing
switch (command) {
  case "run":      // Execute benchmark
  case "results":  // Display latest/specific results
  case "markdown": // Export to markdown
  case "help":     // Show usage
}
```

**Commands:**
- `run` - Executes benchmark against all models × documents
- `results [file]` - Displays results table in terminal
- `markdown [file]` - Exports results to GitHub-flavored markdown
- `help` - Shows usage information

### 2. Benchmark Runner (`src/lib/runner.ts`)

The runner orchestrates benchmark execution:

```typescript
export async function runBenchmark(
  onProgress?: (model, document, index, total) => void
): Promise<BenchmarkRun>
```

**Execution Flow:**
1. Load documents from `docs/` using `Bun.Glob`
2. For each model × document combination:
   - Count input tokens using `gpt-tokenizer`
   - Call LLM with `generateText()` from AI SDK
   - Measure duration with `performance.now()`
   - Calculate tokens/second
3. Compute aggregate statistics
4. Return `BenchmarkRun` object

**Single Benchmark Function:**

```typescript
async function runSingleBenchmark(
  model: string,
  document: { name: string; content: string }
): Promise<BenchmarkResult>
```

Returns metrics including:
- `inputTokens` - Pre-counted with gpt-tokenizer
- `outputTokens` - From API response or fallback counting
- `durationMs` - Wall clock time
- `tokensPerSecond` - Output tokens / duration
- `summary` - Generated text
- `success` / `error` - Status

### 3. LLM Configuration (`src/lib/llm.ts`)

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

### 4. Environment Validation (`src/lib/env.ts`)

Uses `@t3-oss/env-nextjs` with Zod for type-safe environment variables:

```typescript
export const env = createEnv({
  server: {
    LLM_BASE_URL: z.url(),
    LLM_API_KEY: z.string().min(1),
  },
  runtimeEnv: {
    LLM_BASE_URL: process.env.LLM_BASE_URL,
    LLM_API_KEY: process.env.LLM_API_KEY,
  },
});
```

Bun automatically loads `.env` files - no dotenv required.

### 5. Prompt Templates (`src/lib/prompts.ts`)

Centralized prompt definitions:

```typescript
export const PROMPTS = {
  "analyze-document": (document: string) => `Generate a comprehensive...`,
};
```

The summarization prompt instructs models to:
- Capture main purpose, arguments, conclusions
- Preserve tone and intent
- Include critical details
- Scale length based on document size

### 6. Type Definitions (`src/lib/types.ts`)

Core interfaces:

```typescript
interface BenchmarkResult {
  model: string;
  document: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  durationMs: number;
  tokensPerSecond: number;
  summary: string;
  success: boolean;
  error?: string;
}

interface BenchmarkRun {
  id: string;              // "benchmark-{ISO timestamp}"
  timestamp: string;       // ISO 8601
  models: string[];
  documents: string[];
  results: BenchmarkResult[];
  stats: BenchmarkStats;
}

interface BenchmarkStats {
  totalDurationMs: number;
  averageDurationMs: number;
  fastestResult: { model, document, durationMs };
  slowestResult: { model, document, durationMs };
  modelAverages: Record<string, number>;
}
```

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BENCHMARK RUN                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Load Documents                                                          │
│     docs/*.md ──────────────────────► Array<{name, content}>               │
│                                                                             │
│  2. For each model × document:                                              │
│     ┌───────────────────────────────────────────────────────────────────┐  │
│     │  Input Text  ──► gpt-tokenizer ──► inputTokens                    │  │
│     │       ↓                                                            │  │
│     │  PROMPTS["analyze-document"](content)                             │  │
│     │       ↓                                                            │  │
│     │  llmModel(model) ──► generateText() ──► {text, usage}             │  │
│     │       ↓                                                            │  │
│     │  Calculate metrics: duration, tokensPerSecond                      │  │
│     │       ↓                                                            │  │
│     │  BenchmarkResult                                                   │  │
│     └───────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  3. Calculate Stats                                                         │
│     results[] ──► calculateStats() ──► BenchmarkStats                      │
│                                                                             │
│  4. Save Results                                                            │
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
├── StatsCards (4 metric cards)
├── Tab Navigation (table | charts)
├── Content
│   ├── ResultsTable (TanStack Table)
│   └── Charts Grid
│       ├── ModelComparisonChart (horizontal bar)
│       └── TokensPerSecondChart (horizontal bar)
├── SummariesSection (collapsible accordions)
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

Uses TanStack Table (headless):

```tsx
const table = useReactTable({
  data: results,
  columns,
  state: { sorting, columnFilters, globalFilter },
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
});
```

Features:
- Click column headers to sort
- Global search across all columns
- Dropdown filters for model/document

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
- `displayProgress()` - Show [n/total] progress
- `displayResults()` - Formatted results table
- `displayError()` - Red error message
- `displaySuccess()` - Green success with checkmark
- `displayInfo()` - Cyan info with icon

---

## Scripts Reference

| Script | Command | Description |
|--------|---------|-------------|
| `bun bench` | `bun src/bench.ts run` | Execute full benchmark |
| `bun bench:results` | `bun src/bench.ts results` | Show latest results |
| `bun bench:md` | `bun src/bench.ts markdown` | Export to markdown |
| `bun bench:html` | `bun src/build-web.ts` | Build web dashboard |
| `bun preview` | `bun src/build-web.ts preview` | Start preview server |
| `bun lint` | `bun run --bun biome check` | Run linter |
| `bun fmt` | `bun run --bun biome format --write` | Format code |
| `bun tsc` | `tsc --noEmit` | Type check |

---

## Extending the Tool

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

### Adding New Metrics

1. Extend `BenchmarkResult` interface in `src/lib/types.ts`
2. Calculate in `runSingleBenchmark()` in `src/lib/runner.ts`
3. Display in `displayResults()` in `src/lib/display.ts`
4. Add column in `web/components/results-table.tsx`

### Custom Prompts

Add to `src/lib/prompts.ts`:

```typescript
export const PROMPTS = {
  "analyze-document": (doc) => `...`,
  "extract-entities": (doc) => `Extract named entities from: ${doc}`,
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

