import type {
  BenchmarkRunStats,
  SummarizationStats,
  StructuredOutputStats,
} from "../types";

interface StatsCardsProps {
  stats: BenchmarkRunStats;
  models: string[];
  documents: string[];
  categories: string[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(1);
  return `${minutes}m ${seconds}s`;
}

function getShortModelName(model: string): string {
  return model.split("/").pop() || model;
}

// ============================================================================
// Summarization Stats Cards
// ============================================================================

function SummarizationStatsCards({
  stats,
  models,
  documents,
}: {
  stats: SummarizationStats;
  models: string[];
  documents: string[];
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Summarization
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1">Total Duration</div>
          <div className="text-2xl font-bold font-mono text-accent-400">
            {formatDuration(stats.totalDurationMs)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {models.length} models × {documents.length} docs
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1">Avg Tokens/s</div>
          <div className="text-2xl font-bold font-mono text-gray-200">
            {stats.averageTokensPerSecond.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {stats.totalOutputTokens.toLocaleString()} total output tokens
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <span className="text-lg">⚡</span> Fastest
          </div>
          <div className="text-2xl font-bold font-mono text-success-400">
            {formatDuration(stats.fastestResult.durationMs)}
          </div>
          <div
            className="text-xs text-gray-500 mt-2 truncate"
            title={stats.fastestResult.model}
          >
            {getShortModelName(stats.fastestResult.model)}
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <span className="text-lg">🐢</span> Slowest
          </div>
          <div className="text-2xl font-bold font-mono text-warning-400">
            {formatDuration(stats.slowestResult.durationMs)}
          </div>
          <div
            className="text-xs text-gray-500 mt-2 truncate"
            title={stats.slowestResult.model}
          >
            {getShortModelName(stats.slowestResult.model)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Structured Output Stats Cards
// ============================================================================

function StructuredOutputStatsCards({
  stats,
  models,
  documents,
}: {
  stats: StructuredOutputStats;
  models: string[];
  documents: string[];
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider">
        Structured Output
      </h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1">Total Duration</div>
          <div className="text-2xl font-bold font-mono text-violet-400">
            {formatDuration(stats.totalDurationMs)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {models.length} models × {documents.length} docs
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1">Total Extractions</div>
          <div className="text-2xl font-bold font-mono text-gray-200">
            {stats.totalExtractions.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {stats.averageExtractionsPerDoc.toFixed(1)} avg per doc
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1 flex items-center gap-2">
            <span className="text-lg">⚡</span> Fastest
          </div>
          <div className="text-2xl font-bold font-mono text-success-400">
            {formatDuration(stats.fastestResult.durationMs)}
          </div>
          <div
            className="text-xs text-gray-500 mt-2 truncate"
            title={stats.fastestResult.model}
          >
            {getShortModelName(stats.fastestResult.model)}
          </div>
        </div>

        <div className="card stat-card">
          <div className="text-sm text-gray-400 mb-1">Relationships</div>
          <div className="text-2xl font-bold font-mono text-pink-400">
            {stats.totalRelationships.toLocaleString()}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            extracted connections
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StatsCards({ stats, models, documents }: StatsCardsProps) {
  return (
    <div className="space-y-8">
      {stats.summarization && (
        <SummarizationStatsCards
          stats={stats.summarization}
          models={models}
          documents={documents}
        />
      )}
      {stats.structuredOutput && (
        <StructuredOutputStatsCards
          stats={stats.structuredOutput}
          models={models}
          documents={documents}
        />
      )}
    </div>
  );
}
