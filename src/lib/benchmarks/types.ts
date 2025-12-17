import type {
  BenchmarkCategory,
  Document,
  BaseBenchmarkResult,
  BaseStats,
} from "@/lib/types";

// ============================================================================
// Benchmark Type Interface
// ============================================================================

export interface BenchmarkType<
  TResult extends BaseBenchmarkResult = BaseBenchmarkResult,
  TStats extends BaseStats = BaseStats,
> {
  id: BenchmarkCategory;
  name: string;
  description: string;
  run: (model: string, document: Document) => Promise<TResult>;
  calculateStats: (results: TResult[], models: string[]) => TStats;
}

// ============================================================================
// Registry Type (uses any for flexibility with different result types)
// ============================================================================

// biome-ignore lint/suspicious/noExplicitAny: Registry holds benchmarks with different result/stats types
export type BenchmarkRegistry = Map<BenchmarkCategory, BenchmarkType<any, any>>;
