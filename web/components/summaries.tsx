import { useState } from "react";
import type { BenchmarkResult } from "../types";

interface SummariesSectionProps {
  results: BenchmarkResult[];
}

function getShortModelName(model: string): string {
  return model.split("/").pop() || model;
}

function getShortDocName(doc: string): string {
  return doc.replace(".md", "");
}

export function SummariesSection({ results }: SummariesSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const successfulResults = results.filter((r) => r.success && r.summary);

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-gray-200">
        Generated Summaries
      </h3>
      <div className="space-y-2">
        {successfulResults.map((result, index) => (
          <div
            key={`${result.model}-${result.document}`}
            className="border border-surface-300 rounded-lg overflow-hidden"
          >
            <button
              type="button"
              onClick={() =>
                setExpandedIndex(expandedIndex === index ? null : index)
              }
              className="w-full px-4 py-3 flex items-center justify-between bg-surface-200 hover:bg-surface-300 transition-colors text-left"
            >
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm text-accent-400">
                  {getShortModelName(result.model)}
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-sm text-gray-300">
                  {getShortDocName(result.document)}
                </span>
              </div>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform ${
                  expandedIndex === index ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>
            {expandedIndex === index && (
              <div className="px-4 py-4 bg-surface-100 border-t border-surface-300">
                <div className="prose prose-invert prose-sm max-w-none">
                  <div className="text-gray-300 leading-relaxed whitespace-pre-wrap">
                    {result.summary}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-surface-300 flex gap-4 text-xs text-gray-500 font-mono">
                  <span>
                    Input: {result.inputTokens.toLocaleString()} tokens
                  </span>
                  <span>
                    Output: {result.outputTokens.toLocaleString()} tokens
                  </span>
                  <span>{result.tokensPerSecond.toFixed(1)} tok/s</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
