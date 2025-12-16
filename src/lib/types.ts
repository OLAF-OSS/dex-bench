export interface BenchmarkResult {
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

export interface BenchmarkRun {
  id: string;
  timestamp: string;
  models: string[];
  documents: string[];
  results: BenchmarkResult[];
  stats: BenchmarkStats;
}

export interface BenchmarkStats {
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
