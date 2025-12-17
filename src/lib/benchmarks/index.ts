import type { BenchmarkCategory } from "@/lib/types";
import type { BenchmarkRegistry, BenchmarkType } from "./types";
import { summarizationBenchmark } from "./summarization";
import { structuredOutputBenchmark } from "./structured-output";

// ============================================================================
// Benchmark Registry
// ============================================================================

const registry: BenchmarkRegistry = new Map();

// Register built-in benchmarks
registry.set("summarization", summarizationBenchmark);
registry.set("structured-output", structuredOutputBenchmark);

// ============================================================================
// Registry Functions
// ============================================================================

export function registerBenchmark(benchmark: BenchmarkType): void {
  registry.set(benchmark.id, benchmark);
}

export function getBenchmark(
  category: BenchmarkCategory,
): BenchmarkType | undefined {
  return registry.get(category);
}

export function getAllBenchmarks(): BenchmarkType[] {
  return Array.from(registry.values());
}

export function getRegisteredCategories(): BenchmarkCategory[] {
  return Array.from(registry.keys());
}

// ============================================================================
// Re-exports
// ============================================================================

export { summarizationBenchmark } from "./summarization";
export { structuredOutputBenchmark } from "./structured-output";
export type { BenchmarkType, BenchmarkRegistry } from "./types";
