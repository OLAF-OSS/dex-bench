import { useMemo, useState } from "react";
import type { BenchmarkRun, AggregatedData, BenchmarkCategory } from "../types";
import { aggregateAllRuns } from "../lib/aggregate-data";
import { getDisplayName } from "../lib/parse-model";
import {
  GpuComparisonChart,
  DocumentPerformanceChart,
  SuccessRateChart,
  ExtractionsComparisonChart,
} from "./analysis-charts";
import prettyMs from "pretty-ms";

interface AnalysisPageProps {
  runs: BenchmarkRun[];
}

type AnalysisTab =
  | "leaderboard"
  | "gpu-comparison"
  | "documents"
  | "reliability";

export function AnalysisPage({ runs }: AnalysisPageProps) {
  const data = useMemo(() => aggregateAllRuns(runs), [runs]);
  const [activeTab, setActiveTab] = useState<AnalysisTab>("leaderboard");
  const [activeCategory, setActiveCategory] = useState<BenchmarkCategory>(
    data.hasSummarization ? "summarization" : "structured-output",
  );
  const [gpuFilter, setGpuFilter] = useState<string | null>(null);

  const filteredPerformances = useMemo(() => {
    if (!gpuFilter) return data.modelPerformances;
    return data.modelPerformances.filter((p) => {
      if (gpuFilter === "openrouter") return !p.parsed.isSelfHosted;
      return p.parsed.gpu === gpuFilter;
    });
  }, [data, gpuFilter]);

  return (
    <div>
      {/* Overview Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total Runs"
          value={data.totalRuns.toString()}
          color="cyan"
        />
        <StatCard
          label="Models Tested"
          value={data.modelPerformances.length.toString()}
          color="green"
        />
        <StatCard
          label="GPUs"
          value={data.uniqueGpus.length.toString()}
          color="orange"
        />
        <StatCard
          label="Documents"
          value={data.uniqueDocuments.length.toString()}
          color="violet"
        />
      </div>

      {/* Category Toggle */}
      {data.hasSummarization && data.hasStructuredOutput && (
        <div className="flex gap-2 mb-6">
          <button
            type="button"
            onClick={() => setActiveCategory("summarization")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeCategory === "summarization"
                ? "bg-accent-500 text-surface-50"
                : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
            }`}
          >
            Summarization
          </button>
          <button
            type="button"
            onClick={() => setActiveCategory("structured-output")}
            className={`px-4 py-2 rounded-lg font-medium transition-all ${
              activeCategory === "structured-output"
                ? "bg-violet-500 text-surface-50"
                : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
            }`}
          >
            Structured Output
          </button>
        </div>
      )}

      {/* Analysis Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        <TabButton
          active={activeTab === "leaderboard"}
          onClick={() => setActiveTab("leaderboard")}
          category={activeCategory}
        >
          Leaderboard
        </TabButton>
        <TabButton
          active={activeTab === "gpu-comparison"}
          onClick={() => setActiveTab("gpu-comparison")}
          category={activeCategory}
        >
          GPU Comparison
        </TabButton>
        <TabButton
          active={activeTab === "documents"}
          onClick={() => setActiveTab("documents")}
          category={activeCategory}
        >
          By Document
        </TabButton>
        <TabButton
          active={activeTab === "reliability"}
          onClick={() => setActiveTab("reliability")}
          category={activeCategory}
        >
          Reliability
        </TabButton>
      </div>

      {/* GPU Filter */}
      <div className="flex items-center gap-4 mb-6">
        <span className="text-sm text-gray-400">Filter by GPU:</span>
        <div className="flex gap-2 flex-wrap">
          <FilterChip
            active={gpuFilter === null}
            onClick={() => setGpuFilter(null)}
          >
            All
          </FilterChip>
          {data.uniqueGpus.map((gpu) => (
            <FilterChip
              key={gpu}
              active={gpuFilter === gpu}
              onClick={() => setGpuFilter(gpu)}
            >
              {gpu.toUpperCase()}
            </FilterChip>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {activeTab === "leaderboard" && (
        <LeaderboardView
          data={data}
          performances={filteredPerformances}
          category={activeCategory}
        />
      )}

      {activeTab === "gpu-comparison" && (
        <GpuComparisonView
          data={{ ...data, modelPerformances: filteredPerformances }}
          category={activeCategory}
        />
      )}

      {activeTab === "documents" && <DocumentsView data={data} />}

      {activeTab === "reliability" && (
        <ReliabilityView
          performances={filteredPerformances}
          category={activeCategory}
        />
      )}
    </div>
  );
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "cyan" | "green" | "orange" | "violet";
}) {
  const colorClasses = {
    cyan: "text-cyan-400 border-cyan-500/30",
    green: "text-green-400 border-green-500/30",
    orange: "text-orange-400 border-orange-500/30",
    violet: "text-violet-400 border-violet-500/30",
  };

  return (
    <div className={`card border ${colorClasses[color]} text-center`}>
      <div
        className={`text-3xl font-bold font-mono ${colorClasses[color].split(" ")[0]}`}
      >
        {value}
      </div>
      <div className="text-sm text-gray-500 mt-1">{label}</div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
  category,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  category: BenchmarkCategory;
}) {
  const activeClass =
    category === "summarization"
      ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
      : "bg-violet-500/20 text-violet-400 border border-violet-500/30";

  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-4 py-2 rounded-lg font-medium transition-all ${
        active
          ? activeClass
          : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
        active
          ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
          : "bg-surface-300 text-gray-400 hover:bg-surface-400 hover:text-gray-200"
      }`}
    >
      {children}
    </button>
  );
}

// ============================================================================
// View Components
// ============================================================================

function LeaderboardView({
  data,
  performances,
  category,
}: {
  data: AggregatedData;
  performances: AggregatedData["modelPerformances"];
  category: BenchmarkCategory;
}) {
  const sortedPerformances = useMemo(() => {
    return [...performances]
      .filter((p) =>
        category === "summarization" ? p.summarization : p.structuredOutput,
      )
      .sort((a, b) => {
        if (category === "summarization") {
          return (
            (b.summarization?.avgTokensPerSecond ?? 0) -
            (a.summarization?.avgTokensPerSecond ?? 0)
          );
        }
        return (
          (a.structuredOutput?.avgDurationMs ?? 0) -
          (b.structuredOutput?.avgDurationMs ?? 0)
        );
      });
  }, [performances, category]);

  return (
    <div className="space-y-6">
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          {category === "summarization"
            ? "Tokens/Second Leaderboard"
            : "Speed Leaderboard (Fastest First)"}
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-300">
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Rank
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Model
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  GPU
                </th>
                {category === "summarization" ? (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">
                      Avg Tok/s
                    </th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">
                      Avg Duration
                    </th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">
                      Avg Duration
                    </th>
                    <th className="px-4 py-3 text-left text-gray-400 font-medium">
                      Avg Extractions
                    </th>
                  </>
                )}
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Runs
                </th>
                <th className="px-4 py-3 text-left text-gray-400 font-medium">
                  Success
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPerformances.map((perf, index) => {
                const stats =
                  category === "summarization"
                    ? perf.summarization
                    : perf.structuredOutput;
                if (!stats) return null;

                const rankColor =
                  index === 0
                    ? "text-yellow-400"
                    : index === 1
                      ? "text-gray-300"
                      : index === 2
                        ? "text-orange-400"
                        : "text-gray-500";

                return (
                  <tr
                    key={perf.modelId}
                    className="border-b border-surface-300/50 hover:bg-surface-200/50"
                  >
                    <td className={`px-4 py-3 font-bold ${rankColor}`}>
                      #{index + 1}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono ${
                          category === "summarization"
                            ? "text-accent-400"
                            : "text-violet-400"
                        }`}
                      >
                        {perf.parsed.baseName}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 rounded text-xs font-mono bg-surface-300 text-gray-300">
                        {perf.parsed.gpu?.toUpperCase() ?? "OPENROUTER"}
                      </span>
                    </td>
                    {category === "summarization" && perf.summarization ? (
                      <>
                        <td className="px-4 py-3 font-mono text-green-400">
                          {perf.summarization.avgTokensPerSecond.toFixed(1)}
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-400">
                          {prettyMs(perf.summarization.avgDurationMs, {
                            secondsDecimalDigits: 1,
                          })}
                        </td>
                      </>
                    ) : perf.structuredOutput ? (
                      <>
                        <td className="px-4 py-3 font-mono text-gray-400">
                          {prettyMs(perf.structuredOutput.avgDurationMs, {
                            secondsDecimalDigits: 1,
                          })}
                        </td>
                        <td className="px-4 py-3 font-mono text-violet-400">
                          {perf.structuredOutput.avgExtractions.toFixed(1)}
                        </td>
                      </>
                    ) : null}
                    <td className="px-4 py-3 font-mono text-gray-500">
                      {stats.totalRuns}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-mono ${
                          stats.successRate === 100
                            ? "text-green-400"
                            : stats.successRate >= 80
                              ? "text-yellow-400"
                              : "text-red-400"
                        }`}
                      >
                        {stats.successRate.toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Chart */}
      <div className="card chart-container">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          {category === "summarization"
            ? "Tokens per Second by Model"
            : "Duration by Model"}
        </h3>
        <GpuComparisonChart
          data={{ ...data, modelPerformances: performances }}
          metric={category === "summarization" ? "tokensPerSecond" : "duration"}
          category={
            category === "summarization" ? "summarization" : "structuredOutput"
          }
        />
      </div>
    </div>
  );
}

function GpuComparisonView({
  data,
  category,
}: {
  data: AggregatedData;
  category: BenchmarkCategory;
}) {
  // Group models by base name to show GPU comparisons
  const groupedByBase = useMemo(() => {
    const groups = new Map<string, AggregatedData["modelPerformances"]>();
    for (const perf of data.modelPerformances) {
      const baseName = perf.parsed.baseName;
      if (!groups.has(baseName)) {
        groups.set(baseName, []);
      }
      const group = groups.get(baseName);
      if (group) {
        group.push(perf);
      }
    }
    // Only show models that have multiple GPU variants
    return Array.from(groups.entries())
      .filter(([_, perfs]) => perfs.length > 1)
      .sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  if (groupedByBase.length === 0) {
    return (
      <div className="card text-center text-gray-400 py-12">
        <p>No models with multiple GPU variants found.</p>
        <p className="text-sm mt-2">
          Run the same model on different GPUs to see comparisons.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {groupedByBase.map(([baseName, perfs]) => (
        <div key={baseName} className="card">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">
            {baseName}
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {perfs.map((perf) => {
              const stats =
                category === "summarization"
                  ? perf.summarization
                  : perf.structuredOutput;
              if (!stats) return null;

              return (
                <div
                  key={perf.modelId}
                  className="bg-surface-200 rounded-lg p-4"
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="px-2 py-1 rounded text-xs font-mono bg-surface-300 text-cyan-400">
                      {perf.parsed.gpu?.toUpperCase() ?? "OPENROUTER"}
                    </span>
                    <span
                      className={`text-xs ${
                        stats.successRate === 100
                          ? "text-green-400"
                          : "text-yellow-400"
                      }`}
                    >
                      {stats.successRate.toFixed(0)}% success
                    </span>
                  </div>
                  {category === "summarization" && perf.summarization ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Tok/s</span>
                        <span className="font-mono text-green-400">
                          {perf.summarization.avgTokensPerSecond.toFixed(1)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Duration</span>
                        <span className="font-mono text-gray-300">
                          {prettyMs(perf.summarization.avgDurationMs, {
                            secondsDecimalDigits: 1,
                          })}
                        </span>
                      </div>
                    </div>
                  ) : perf.structuredOutput ? (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">Duration</span>
                        <span className="font-mono text-gray-300">
                          {prettyMs(perf.structuredOutput.avgDurationMs, {
                            secondsDecimalDigits: 1,
                          })}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400 text-sm">
                          Extractions
                        </span>
                        <span className="font-mono text-violet-400">
                          {perf.structuredOutput.avgExtractions.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function DocumentsView({ data }: { data: AggregatedData }) {
  return (
    <div className="space-y-6">
      <div className="card chart-container">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          Average Processing Time by Document
        </h3>
        <DocumentPerformanceChart
          data={data.documentPerformances}
          metric="duration"
        />
      </div>

      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          Document Details
        </h3>
        <div className="space-y-4">
          {data.documentPerformances.map((doc) => (
            <div key={doc.document} className="bg-surface-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-200">
                  {doc.document.replace(".md", "")}
                </h4>
                <span className="text-sm text-gray-500 font-mono">
                  {doc.documentTokens.toLocaleString()} tokens
                </span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {doc.models.slice(0, 8).map((model) => (
                  <div
                    key={model.modelId}
                    className="bg-surface-300 rounded px-3 py-2 text-sm"
                  >
                    <div className="font-mono text-xs text-gray-400 truncate">
                      {getDisplayName(model.parsed)}
                    </div>
                    <div className="font-mono text-gray-200">
                      {prettyMs(model.avgDurationMs, {
                        secondsDecimalDigits: 1,
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ReliabilityView({
  performances,
  category,
}: {
  performances: AggregatedData["modelPerformances"];
  category: BenchmarkCategory;
}) {
  const categoryKey: "summarization" | "structuredOutput" =
    category === "summarization" ? "summarization" : "structuredOutput";

  return (
    <div className="space-y-6">
      <div className="card chart-container">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          Success Rate by Model
        </h3>
        <SuccessRateChart data={performances} category={categoryKey} />
      </div>

      {category === "structured-output" && (
        <div className="card chart-container">
          <h3 className="text-lg font-semibold mb-4 text-gray-200">
            Extractions & Relationships
          </h3>
          <ExtractionsComparisonChart data={performances} />
        </div>
      )}

      {/* Failure Details */}
      <div className="card">
        <h3 className="text-lg font-semibold mb-4 text-gray-200">
          Models with Failures
        </h3>
        <div className="space-y-2">
          {performances
            .filter((p) => {
              const stats =
                category === "summarization"
                  ? p.summarization
                  : p.structuredOutput;
              return stats && stats.successRate < 100;
            })
            .map((perf) => {
              const stats =
                category === "summarization"
                  ? perf.summarization
                  : perf.structuredOutput;
              if (!stats) return null;

              return (
                <div
                  key={perf.modelId}
                  className="flex items-center justify-between bg-surface-200 rounded-lg p-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm text-gray-200">
                      {getDisplayName(perf.parsed)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400">
                      {stats
                        ? stats.totalRuns -
                          Math.round(
                            (stats.successRate / 100) * stats.totalRuns,
                          )
                        : 0}{" "}
                      / {stats?.totalRuns ?? 0} failed
                    </span>
                    <span
                      className={`font-mono ${
                        stats.successRate >= 80
                          ? "text-yellow-400"
                          : "text-red-400"
                      }`}
                    >
                      {stats.successRate.toFixed(0)}%
                    </span>
                  </div>
                </div>
              );
            })}
          {performances.filter((p) => {
            const stats =
              category === "summarization"
                ? p.summarization
                : p.structuredOutput;
            return stats && stats.successRate < 100;
          }).length === 0 && (
            <div className="text-center text-gray-400 py-8">
              All models have 100% success rate!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
