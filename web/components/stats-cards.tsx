import type { BenchmarkStats } from "../types";

interface StatsCardsProps {
  stats: BenchmarkStats;
  models: string[];
  documents: string[];
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

export function StatsCards({ stats, models, documents }: StatsCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {/* Total Duration */}
      <div className="card stat-card">
        <div className="text-sm text-gray-400 mb-1">Total Duration</div>
        <div className="text-2xl font-bold font-mono text-accent-400">
          {formatDuration(stats.totalDurationMs)}
        </div>
        <div className="text-xs text-gray-500 mt-2">
          {models.length} models × {documents.length} docs
        </div>
      </div>

      {/* Average Duration */}
      <div className="card stat-card">
        <div className="text-sm text-gray-400 mb-1">Average Duration</div>
        <div className="text-2xl font-bold font-mono text-gray-200">
          {formatDuration(stats.averageDurationMs)}
        </div>
        <div className="text-xs text-gray-500 mt-2">per benchmark run</div>
      </div>

      {/* Fastest */}
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

      {/* Slowest */}
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
  );
}
