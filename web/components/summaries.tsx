import { useState } from "react";
import type { SummarizationResult, StructuredOutputResult } from "../types";

function getShortModelName(model: string): string {
  return model;
}

function getShortDocName(doc: string): string {
  return doc.replace(".md", "");
}

// ============================================================================
// Summarization Summaries
// ============================================================================

interface SummariesSectionProps {
  results: SummarizationResult[];
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

// ============================================================================
// Structured Output Extractions
// ============================================================================

interface ExtractionsSectionProps {
  results: StructuredOutputResult[];
}

export function ExtractionsSection({ results }: ExtractionsSectionProps) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const successfulResults = results.filter(
    (r) => r.success && r.extractions.length > 0,
  );

  return (
    <div className="card">
      <h3 className="text-lg font-semibold mb-4 text-gray-200">
        Extracted Entities
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
                <span className="font-mono text-sm text-violet-400">
                  {getShortModelName(result.model)}
                </span>
                <span className="text-gray-500">→</span>
                <span className="text-sm text-gray-300">
                  {getShortDocName(result.document)}
                </span>
                <span className="text-xs text-gray-500 bg-surface-300 px-2 py-0.5 rounded">
                  {result.extractionCount} entities
                </span>
                {result.relationshipCount > 0 && (
                  <span className="text-xs text-pink-400 bg-pink-400/10 px-2 py-0.5 rounded">
                    {result.relationshipCount} relations
                  </span>
                )}
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
                {/* Entity Types */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Entity Types ({result.entityTypes.length})
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {result.entityTypes.map((type) => (
                      <span
                        key={type}
                        className="text-xs bg-violet-500/20 text-violet-300 px-2 py-1 rounded"
                      >
                        {type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Extractions Table */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">
                    Extractions (showing first 20)
                  </h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-surface-300">
                          <th className="px-2 py-1 text-left text-gray-500">
                            ID
                          </th>
                          <th className="px-2 py-1 text-left text-gray-500">
                            Class
                          </th>
                          <th className="px-2 py-1 text-left text-gray-500">
                            Text
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.extractions.slice(0, 20).map((extraction) => (
                          <tr
                            key={extraction.id}
                            className="border-b border-surface-300/50"
                          >
                            <td className="px-2 py-1 font-mono text-gray-500">
                              {extraction.id}
                            </td>
                            <td className="px-2 py-1">
                              <span className="text-violet-400">
                                {extraction.extractionClass}
                              </span>
                            </td>
                            <td className="px-2 py-1 text-gray-300 max-w-xs truncate">
                              {extraction.extractionText}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {result.extractions.length > 20 && (
                    <p className="text-xs text-gray-500 mt-2">
                      ...and {result.extractions.length - 20} more extractions
                    </p>
                  )}
                </div>

                {/* Relationships */}
                {result.relationships.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-400 mb-2">
                      Relationships ({result.relationshipCount})
                    </h4>
                    <div className="space-y-1">
                      {result.relationships.slice(0, 10).map((rel) => (
                        <div
                          key={`${rel.sourceId}-${rel.relationshipType}-${rel.targetId}`}
                          className="text-xs flex items-center gap-2"
                        >
                          <span className="font-mono text-gray-500">
                            {rel.sourceId}
                          </span>
                          <span className="text-pink-400">
                            —{rel.relationshipType}→
                          </span>
                          <span className="font-mono text-gray-500">
                            {rel.targetId}
                          </span>
                          {rel.description && (
                            <span className="text-gray-600 italic">
                              ({rel.description})
                            </span>
                          )}
                        </div>
                      ))}
                      {result.relationships.length > 10 && (
                        <p className="text-xs text-gray-500">
                          ...and {result.relationships.length - 10} more
                          relationships
                        </p>
                      )}
                    </div>
                  </div>
                )}

                {/* Timing Info */}
                <div className="mt-4 pt-4 border-t border-surface-300 flex gap-4 text-xs text-gray-500 font-mono">
                  <span>
                    Entity Types: {(result.entityTypesTimeMs / 1000).toFixed(1)}
                    s
                  </span>
                  <span>
                    Extraction: {(result.extractionTimeMs / 1000).toFixed(1)}s
                  </span>
                  <span>Total: {(result.durationMs / 1000).toFixed(1)}s</span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
