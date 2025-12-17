// ============================================================================
// Benchmark Categories
// ============================================================================

export type BenchmarkCategory = "summarization" | "structured-output";

export const BENCHMARK_CATEGORIES: BenchmarkCategory[] = [
  "summarization",
  "structured-output",
];

// ============================================================================
// Base Types
// ============================================================================

export interface BaseBenchmarkResult {
  model: string;
  document: string;
  documentTokens: number;
  durationMs: number;
  success: boolean;
  error?: string;
}

export interface BaseStats {
  totalDurationMs: number;
  averageDurationMs: number;
  fastestResult: {
    model: string;
    document: string;
    durationMs: number;
  };
  slowestResult: {
    model: string;
    document: string;
    durationMs: number;
  };
  modelAverages: Record<string, number>;
}

// ============================================================================
// Summarization Benchmark
// ============================================================================

export interface SummarizationResult extends BaseBenchmarkResult {
  type: "summarization";
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  tokensPerSecond: number;
  summary: string;
}

export interface SummarizationStats extends BaseStats {
  type: "summarization";
  totalInputTokens: number;
  totalOutputTokens: number;
  averageTokensPerSecond: number;
}

// ============================================================================
// Structured Output Benchmark (Entity Extraction)
// ============================================================================

export interface Extraction {
  id: string;
  extractionClass: string;
  extractionText: string;
}

export interface Relationship {
  sourceId: string;
  targetId: string;
  relationshipType: string;
}

export interface StructuredOutputResult extends BaseBenchmarkResult {
  type: "structured-output";
  entityTypesTimeMs: number;
  extractionTimeMs: number;
  entityTypes: string[];
  extractionCount: number;
  relationshipCount: number;
  extractions: Extraction[];
  relationships: Relationship[];
}

export interface StructuredOutputStats extends BaseStats {
  type: "structured-output";
  totalExtractions: number;
  totalRelationships: number;
  averageExtractionsPerDoc: number;
  averageEntityTypesPerDoc: number;
}

// ============================================================================
// Union Types
// ============================================================================

export type BenchmarkResult = SummarizationResult | StructuredOutputResult;
export type BenchmarkStats = SummarizationStats | StructuredOutputStats;

// ============================================================================
// Benchmark Run
// ============================================================================

export type BenchmarkRunStatus = "in-progress" | "complete";

export interface BenchmarkRunResults {
  summarization?: SummarizationResult[];
  structuredOutput?: StructuredOutputResult[];
}

export interface BenchmarkRunStats {
  summarization?: SummarizationStats;
  structuredOutput?: StructuredOutputStats;
}

export interface BenchmarkRun {
  id: string;
  timestamp: string;
  status: BenchmarkRunStatus;
  models: string[];
  documents: string[];
  categories: BenchmarkCategory[];
  results: BenchmarkRunResults;
  stats: BenchmarkRunStats;
}

// ============================================================================
// Document Type
// ============================================================================

export interface Document {
  name: string;
  content: string;
}

// ============================================================================
// Progress Callback
// ============================================================================

export type ProgressCallback = (
  category: BenchmarkCategory,
  model: string,
  document: string,
  index: number,
  total: number,
) => void;
