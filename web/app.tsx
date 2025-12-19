import { useState } from "react";
import { createRoot } from "react-dom/client";
import type { BenchmarkRun, BenchmarkCategory } from "./types";
import {
  SummarizationTable,
  StructuredOutputTable,
} from "./components/results-table";
import {
  ModelComparisonChart,
  TokensPerSecondChart,
  ExtractionsChart,
} from "./components/charts";
import { StatsCards } from "./components/stats-cards";
import { SummariesSection, ExtractionsSection } from "./components/summaries";
import { AnalysisPage } from "./components/analysis-page";

type TabView = "table" | "charts" | "details";
type ViewMode = "analysis" | "run";

const formatShortDate = (timestamp: string) => {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

function App() {
  const allRuns: BenchmarkRun[] = window.BENCHMARK_DATA;
  const [viewMode, setViewMode] = useState<ViewMode>("analysis");
  const [selectedRunIndex, setSelectedRunIndex] = useState(0);
  const [activeCategory, setActiveCategory] =
    useState<BenchmarkCategory>("summarization");
  const [activeTab, setActiveTab] = useState<TabView>("table");

  // Get current data with safe fallback
  const data = allRuns[selectedRunIndex];

  // Update category when data changes
  const hasSummarization = data?.results.summarization ? true : false;
  const hasStructuredOutput = data?.results.structuredOutput ? true : false;

  const handleRunSelect = (index: number) => {
    setSelectedRunIndex(index);
    setViewMode("run");
    const newData = allRuns[index];
    if (newData) {
      setActiveCategory(newData.categories[0] ?? "summarization");
    }
    setActiveTab("table");
  };

  // If no data available, show only analysis view
  if (!data && viewMode === "run") {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-gray-400">
          <p>No benchmark run selected.</p>
          <button
            type="button"
            onClick={() => setViewMode("analysis")}
            className="mt-4 px-4 py-2 bg-accent-500 text-white rounded-lg"
          >
            View Analysis
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-surface-300 bg-surface-100/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setViewMode("analysis")}
                className="text-2xl font-bold bg-linear-to-r from-accent-400 to-cyan-300 bg-clip-text text-transparent hover:opacity-80 transition-opacity"
              >
                DEX Bench
              </button>
              <span className="px-2 py-1 text-xs font-mono bg-surface-300 rounded-md text-gray-400">
                LLM Benchmark
              </span>
            </div>
            <a
              href="https://github.com/OLAF-OSS/dex-bench"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-400 hover:text-gray-200 transition-colors mr-auto"
            >
              <span className="sr-only">View on GitHub</span>
              <svg
                className="w-6 h-6"
                viewBox="0 0 98 96"
                xmlns="http://www.w3.org/2000/svg"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.324-3.015.324-3.015 4.934.326 7.523 5.052 7.523 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.699-5.378 3.074-6.6-10.839-1.141-22.243-5.378-22.243-24.283 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 18.905-11.404 23.06-22.324 24.283 1.78 1.548 3.316 4.481 3.316 9.126 0 6.6-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
                />
              </svg>
            </a>
            <div className="flex items-center gap-3 text-sm">
              {/* Analysis Button */}
              <button
                type="button"
                onClick={() => setViewMode("analysis")}
                className={`px-3 py-2 rounded-lg font-medium transition-all ${
                  viewMode === "analysis"
                    ? "bg-accent-500 text-surface-50"
                    : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                }`}
              >
                All Runs Analysis
              </button>

              {/* Run Selector Dropdown */}
              <div className="relative">
                <select
                  value={viewMode === "run" ? selectedRunIndex : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val !== "") {
                      handleRunSelect(Number(val));
                    }
                  }}
                  className="appearance-none bg-surface-200 border border-surface-300 rounded-lg px-4 py-2 pr-10 text-gray-200 font-mono text-sm cursor-pointer hover:bg-surface-300 focus:outline-none focus:ring-2 focus:ring-accent-500/50 transition-all"
                >
                  <option value="" disabled>
                    Select a run...
                  </option>
                  {allRuns.map((run, index) => (
                    <option key={run.id} value={index}>
                      {formatShortDate(run.timestamp)} • {run.models.length}{" "}
                      models • {run.categories.join(", ")}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <svg
                    className="h-4 w-4 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <title>Select run</title>
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Analysis View (Landing Page) */}
        {viewMode === "analysis" && <AnalysisPage runs={allRuns} />}

        {/* Individual Run View */}
        {viewMode === "run" && data && (
          <>
            {/* Breadcrumb */}
            <div className="mb-6">
              <button
                type="button"
                onClick={() => setViewMode("analysis")}
                className="text-sm text-gray-400 hover:text-accent-400 transition-colors flex items-center gap-2"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <title>Back arrow</title>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                Back to All Runs Analysis
              </button>
            </div>

            {/* Run Header */}
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-200">
                Benchmark Run: {formatShortDate(data.timestamp)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                {data.models.length} models • {data.documents.length} documents
                • {data.categories.join(", ")}
              </p>
            </div>

            {/* Stats Overview */}
            <StatsCards
              stats={data.stats}
              models={data.models}
              documents={data.documents}
              categories={data.categories}
            />

            {/* Category Tabs */}
            {data.categories.length > 1 && (
              <div className="flex gap-2 mb-6 mt-8">
                {hasSummarization && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory("summarization");
                      setActiveTab("table");
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      activeCategory === "summarization"
                        ? "bg-accent-500 text-surface-50"
                        : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                    }`}
                  >
                    Summarization
                  </button>
                )}
                {hasStructuredOutput && (
                  <button
                    type="button"
                    onClick={() => {
                      setActiveCategory("structured-output");
                      setActiveTab("table");
                    }}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      activeCategory === "structured-output"
                        ? "bg-violet-500 text-surface-50"
                        : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                    }`}
                  >
                    Structured Output
                  </button>
                )}
              </div>
            )}

            {/* View Tabs */}
            <div className="flex gap-2 mb-6 mt-4">
              <button
                type="button"
                onClick={() => setActiveTab("table")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "table"
                    ? activeCategory === "summarization"
                      ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
                      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                }`}
              >
                Results Table
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("charts")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "charts"
                    ? activeCategory === "summarization"
                      ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
                      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                }`}
              >
                Charts
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("details")}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  activeTab === "details"
                    ? activeCategory === "summarization"
                      ? "bg-accent-500/20 text-accent-400 border border-accent-500/30"
                      : "bg-violet-500/20 text-violet-400 border border-violet-500/30"
                    : "bg-surface-200 text-gray-400 hover:bg-surface-300 hover:text-gray-200"
                }`}
              >
                {activeCategory === "summarization"
                  ? "Summaries"
                  : "Extractions"}
              </button>
            </div>

            {/* Summarization Content */}
            {activeCategory === "summarization" &&
              data.results.summarization && (
                <>
                  {activeTab === "table" && (
                    <div className="card">
                      <SummarizationTable
                        results={data.results.summarization}
                      />
                    </div>
                  )}
                  {activeTab === "charts" && data.stats.summarization && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="card chart-container">
                        <h3 className="text-lg font-semibold mb-4 text-gray-200">
                          Average Duration by Model
                        </h3>
                        <ModelComparisonChart
                          modelAverages={data.stats.summarization.modelAverages}
                        />
                      </div>
                      <div className="card chart-container">
                        <h3 className="text-lg font-semibold mb-4 text-gray-200">
                          Tokens per Second
                        </h3>
                        <TokensPerSecondChart
                          results={data.results.summarization}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "details" && (
                    <SummariesSection results={data.results.summarization} />
                  )}
                </>
              )}

            {/* Structured Output Content */}
            {activeCategory === "structured-output" &&
              data.results.structuredOutput && (
                <>
                  {activeTab === "table" && (
                    <div className="card">
                      <StructuredOutputTable
                        results={data.results.structuredOutput}
                      />
                    </div>
                  )}
                  {activeTab === "charts" && data.stats.structuredOutput && (
                    <div className="grid gap-6 lg:grid-cols-2">
                      <div className="card chart-container">
                        <h3 className="text-lg font-semibold mb-4 text-gray-200">
                          Average Duration by Model
                        </h3>
                        <ModelComparisonChart
                          modelAverages={
                            data.stats.structuredOutput.modelAverages
                          }
                          label="Avg Duration"
                        />
                      </div>
                      <div className="card chart-container">
                        <h3 className="text-lg font-semibold mb-4 text-gray-200">
                          Average Extractions per Model
                        </h3>
                        <ExtractionsChart
                          results={data.results.structuredOutput}
                        />
                      </div>
                    </div>
                  )}
                  {activeTab === "details" && (
                    <ExtractionsSection
                      results={data.results.structuredOutput}
                    />
                  )}
                </>
              )}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-surface-300 mt-16 py-6">
        <div className="max-w-7xl mx-auto px-6 text-center text-sm text-gray-500">
          {viewMode === "analysis" ? (
            <>
              Generated by DEX Bench • {allRuns.length} runs •{" "}
              {new Set(allRuns.flatMap((r) => r.models)).size} unique models
            </>
          ) : data ? (
            <>
              Generated by DEX Bench • {data.models.length} models •{" "}
              {data.documents.length} documents • {data.categories.length}{" "}
              categories
            </>
          ) : null}
        </div>
      </footer>
    </div>
  );
}

const rootElement = document.getElementById("root");
if (rootElement) {
  const root = createRoot(rootElement);
  root.render(<App />);
}
