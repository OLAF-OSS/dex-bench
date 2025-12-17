# dex-bench

A CLI tool for benchmarking LLM performance across multiple models, documents, and benchmark categories.

## Installation

```bash
bun install
```

## Configuration

Create a `.env` file with your LLM API credentials:

```env
LLM_BASE_URL=https://your-llm-api-endpoint.com
LLM_API_KEY=your-api-key
```

## Usage

### Run Benchmark

Execute the benchmark against all configured models, documents, and categories:

```bash
bun bench
```

This will:
1. Load all markdown documents from `docs/`
2. Run all benchmark categories for each model/document combination
3. Measure response time, token counts, extraction quality, and more
4. Display results in a formatted table
5. Save results to `results/benchmark-{timestamp}.json`
6. Generate a markdown report at `results/benchmark-{timestamp}.md`

### Run with Concurrency and Retries

Run benchmarks in parallel for faster execution:

```bash
# Run 4 benchmarks in parallel
bun bench --concurrency 4

# Run with custom retry count (default: 3)
bun bench --concurrency 4 --retries 5

# Disable retries
bun bench --retries 0
```

### Run Specific Categories

Run only specific benchmark types:

```bash
# Run only summarization benchmark
bun bench --category summarization

# Run only structured output benchmark
bun bench --category structured-output

# Run multiple categories
bun bench --category summarization --category structured-output
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--category <name>` | Run specific category (can be used multiple times) | all |
| `--concurrency <n>` | Run up to n benchmarks in parallel | 1 |
| `--retries <n>` | Retry failed benchmarks up to n times | 3 |
| `--fresh` | Start fresh, ignoring incomplete runs | false |

### Available Categories

| Category | Description |
|----------|-------------|
| `summarization` | Tests LLM summarization capabilities with document analysis |
| `structured-output` | Tests JSON structured output with entity extraction |

### View Results

Display the latest benchmark results:

```bash
bun bench:results
```

View results from a specific file:

```bash
bun src/bench.ts results ./results/benchmark-2024-01-01T12-00-00-000Z.json
```

### Export to Markdown

Generate a GitHub-friendly markdown report from the latest results:

```bash
bun bench:md
```

Export from a specific JSON file:

```bash
bun src/bench.ts markdown ./results/benchmark-2024-01-01T12-00-00-000Z.json
```

The markdown report includes:
- Results tables for each benchmark category
- Category-specific statistics
- Model averages comparison
- Collapsible summaries and entity extractions

### Web Dashboard

Build a static HTML dashboard with interactive charts:

```bash
bun bench:html
```

Preview the dashboard locally:

```bash
bun preview
```

The dashboard features:
- Category tabs for switching between benchmark types
- Interactive results tables with sorting and filtering
- Charts for model comparison
- Detailed view of summaries and entity extractions

The dashboard is automatically deployed to GitHub Pages on push to `main`.

### Help

```bash
bun src/bench.ts --help
```

## Benchmark Categories

### Summarization

Tests LLM ability to generate concise, accurate summaries of documents.

**Metrics:**
- Input/Output tokens
- Tokens per second
- Duration
- Summary quality

### Structured Output

Tests LLM ability to produce valid JSON structured output using entity extraction.

**Process:**
1. First, generates a list of entity types present in the document
2. Then, extracts entities and relationships based on those types

**Metrics:**
- Entity types identified
- Total extractions
- Relationships found
- Duration breakdown (entity types + extraction)

## Self-Hosted Models with Modal

Deploy your own vLLM servers on [Modal.com](https://modal.com) with on-demand GPU scaling:

```bash
cd modal
uv sync
uv run modal token new

# Deploy a model
uv run python deploy.py --model gemma-3-12b-l40s

# Test it
uv run python deploy.py --test gemma-3-12b-l40s
```

After deployment, update your `.env`:

```env
LLM_BASE_URL=https://your-workspace--vllm-gemma-3-12b-l40s-serve.modal.run/v1
LLM_API_KEY=not-required
```

See [modal/README.md](./modal/README.md) for full documentation on available models, GPU options, and configuration.

## Models

Models are configured in `src/lib/models.ts`. Current models:

- `openai/gpt-oss-20b`
- `google/gemma-3-12b-it`
- `google/gemma-3-27b-it`
- `mistralai/mistral-large-2411`
- `qwen/qwen3-vl-30b-a3b-instruct`
- `mistralai/devstral-medium`
- `meta-llama/llama-3.3-70b-instruct`

## Documents

Place markdown files in `docs/` to include them in the benchmark.

## Output

Results are saved as JSON with the following structure:

```json
{
  "id": "benchmark-2025-12-16T17-56-25-799Z",
  "timestamp": "2025-12-16T17:56:25.799Z",
  "models": ["model1", "model2"],
  "documents": ["doc1.md", "doc2.md"],
  "categories": ["summarization", "structured-output"],
  "results": {
    "summarization": [
      {
        "type": "summarization",
        "model": "openai/gpt-oss-20b",
        "document": "bitcoin-paper.md",
        "inputTokens": 5000,
        "outputTokens": 350,
        "totalTokens": 5350,
        "durationMs": 2700,
        "tokensPerSecond": 228.4,
        "summary": "...",
        "success": true
      }
    ],
    "structuredOutput": [
      {
        "type": "structured-output",
        "model": "openai/gpt-oss-20b",
        "document": "bitcoin-paper.md",
        "durationMs": 15000,
        "entityTypesTimeMs": 3000,
        "extractionTimeMs": 12000,
        "entityTypes": ["PERSON", "ORGANIZATION", "TECHNOLOGY"],
        "extractionCount": 45,
        "relationshipCount": 12,
        "extractions": [...],
        "relationships": [...],
        "success": true
      }
    ]
  },
  "stats": {
    "summarization": {
      "type": "summarization",
      "totalDurationMs": 246100,
      "averageDurationMs": 11700,
      "totalInputTokens": 150000,
      "totalOutputTokens": 8500,
      "averageTokensPerSecond": 75.2,
      "fastestResult": { "model": "...", "document": "...", "durationMs": 2700 },
      "slowestResult": { "model": "...", "document": "...", "durationMs": 30800 },
      "modelAverages": { "model1": 5600, "model2": 6600 }
    },
    "structuredOutput": {
      "type": "structured-output",
      "totalDurationMs": 315000,
      "averageDurationMs": 15000,
      "totalExtractions": 945,
      "totalRelationships": 252,
      "averageExtractionsPerDoc": 45,
      "averageEntityTypesPerDoc": 12,
      "fastestResult": { "model": "...", "document": "...", "durationMs": 8000 },
      "slowestResult": { "model": "...", "document": "...", "durationMs": 25000 },
      "modelAverages": { "model1": 12000, "model2": 18000 }
    }
  }
}
```

## Tech Stack

- [Bun](https://bun.sh) - Runtime and package manager
- [AI SDK v6](https://sdk.vercel.ai) - LLM integration
- [Mastra](https://mastra.ai) - Agent framework for structured output
- [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) - Token counting
- [React 19](https://react.dev) - Web dashboard UI
- [Recharts](https://recharts.org) - Chart visualizations
- [TanStack Table](https://tanstack.com/table) - Data table with sorting/filtering
- [Tailwind CSS v4](https://tailwindcss.com) - Styling
- [Biome](https://biomejs.dev) - Linting and formatting

## Development

For technical implementation details, architecture decisions, and contribution guidelines, see [DEVELOPMENT.md](./DEVELOPMENT.md).
