// ============================================================================
// Benchmark Categories
// ============================================================================

export type BenchmarkCategory = "summarization" | "structured-output";

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
  description?: string;
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
  models: string[];
  documents: string[];
  categories: BenchmarkCategory[];
  results: BenchmarkRunResults;
  stats: BenchmarkRunStats;
}

// ============================================================================
// Aggregated Analysis Types
// ============================================================================

export interface ParsedModel {
  fullName: string;
  baseName: string;
  provider: string;
  gpu: string | null;
  isSelfHosted: boolean;
}

export interface ModelGpuPerformance {
  modelId: string;
  parsed: ParsedModel;
  summarization: {
    avgDurationMs: number;
    avgTokensPerSecond: number;
    totalRuns: number;
    successRate: number;
  } | null;
  structuredOutput: {
    avgDurationMs: number;
    avgExtractions: number;
    avgRelationships: number;
    totalRuns: number;
    successRate: number;
  } | null;
}

export interface DocumentPerformance {
  document: string;
  documentTokens: number;
  models: {
    modelId: string;
    parsed: ParsedModel;
    avgDurationMs: number;
    successRate: number;
    tokensPerSecond?: number;
    extractions?: number;
  }[];
}

export interface AggregatedData {
  /** All unique model+GPU combinations with their performance */
  modelPerformances: ModelGpuPerformance[];
  /** Performance breakdown by document */
  documentPerformances: DocumentPerformance[];
  /** All unique GPUs found */
  uniqueGpus: string[];
  /** All unique base model names */
  uniqueBaseModels: string[];
  /** All unique providers */
  uniqueProviders: string[];
  /** All unique documents */
  uniqueDocuments: string[];
  /** Total number of benchmark runs */
  totalRuns: number;
  /** Whether summarization data is available */
  hasSummarization: boolean;
  /** Whether structured output data is available */
  hasStructuredOutput: boolean;
}

declare global {
  interface Window {
    BENCHMARK_DATA: BenchmarkRun[];
  }
}
