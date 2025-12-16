# dex-bench

A CLI tool for benchmarking LLM summarization performance across multiple models and documents.

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

Execute the benchmark against all configured models and documents:

```bash
bun bench
```

This will:
1. Load all markdown documents from `docs/`
2. Run summarization for each model/document combination
3. Measure response time, token counts, and tokens/second
4. Display results in a formatted table
5. Save results to `results/benchmark-{timestamp}.json`
6. Generate a markdown report at `results/benchmark-{timestamp}.md`

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
- Results table with all metrics
- Statistics summary
- Model averages comparison
- Collapsible summaries for each model/document

### Help

```bash
bun src/bench.ts --help
```

## Models

Models are configured in `src/lib/llm.ts`. Current models:

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
  "results": [
    {
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
  "stats": {
    "totalDurationMs": 246100,
    "averageDurationMs": 11700,
    "fastestResult": { "model": "...", "document": "...", "durationMs": 2700 },
    "slowestResult": { "model": "...", "document": "...", "durationMs": 30800 },
    "modelAverages": { "model1": 5600, "model2": 6600 }
  }
}
```

## Tech Stack

- [Bun](https://bun.sh) - Runtime and package manager
- [AI SDK v6](https://sdk.vercel.ai) - LLM integration
- [gpt-tokenizer](https://github.com/niieani/gpt-tokenizer) - Token counting
