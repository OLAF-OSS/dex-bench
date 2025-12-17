import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  createColumnHelper,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import type { BenchmarkResult } from "../types";

interface ResultsTableProps {
  results: BenchmarkResult[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function getShortModelName(model: string): string {
  return model.split("/").pop() || model;
}

function getShortDocName(doc: string): string {
  const name = doc.replace(".md", "");
  return name.length > 30 ? `${name.substring(0, 30)}...` : name;
}

const columnHelper = createColumnHelper<BenchmarkResult>();

export function ResultsTable({ results }: ResultsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [globalFilter, setGlobalFilter] = useState("");

  const columns = useMemo(
    () => [
      columnHelper.accessor("model", {
        header: "Model",
        cell: (info) => (
          <span className="font-mono text-accent-400" title={info.getValue()}>
            {getShortModelName(info.getValue())}
          </span>
        ),
        filterFn: "includesString",
      }),
      columnHelper.accessor("document", {
        header: "Document",
        cell: (info) => (
          <span className="text-gray-300" title={info.getValue()}>
            {getShortDocName(info.getValue())}
          </span>
        ),
        filterFn: "includesString",
      }),
      columnHelper.accessor("durationMs", {
        header: "Duration",
        cell: (info) => (
          <span className="font-mono">{formatDuration(info.getValue())}</span>
        ),
      }),
      columnHelper.accessor("inputTokens", {
        header: "Input",
        cell: (info) => (
          <span className="font-mono text-gray-400">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("outputTokens", {
        header: "Output",
        cell: (info) => (
          <span className="font-mono text-gray-400">
            {info.getValue().toLocaleString()}
          </span>
        ),
      }),
      columnHelper.accessor("tokensPerSecond", {
        header: "Tok/s",
        cell: (info) => {
          const value = info.getValue();
          const colorClass =
            value > 100
              ? "text-success-400"
              : value > 50
                ? "text-accent-400"
                : value > 25
                  ? "text-warning-400"
                  : "text-gray-400";
          return (
            <span className={`font-mono font-medium ${colorClass}`}>
              {value.toFixed(1)}
            </span>
          );
        },
      }),
      columnHelper.accessor("success", {
        header: "Status",
        cell: (info) =>
          info.getValue() ? (
            <span className="text-success-400">✓</span>
          ) : (
            <span className="text-error-400">✗</span>
          ),
      }),
    ],
    [],
  );

  const table = useReactTable({
    data: results,
    columns,
    state: {
      sorting,
      columnFilters,
      globalFilter,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  const uniqueModels = useMemo(() => {
    const models = new Set(results.map((r) => getShortModelName(r.model)));
    return Array.from(models);
  }, [results]);

  const uniqueDocs = useMemo(() => {
    const docs = new Set(results.map((r) => r.document));
    return Array.from(docs);
  }, [results]);

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex-1 min-w-[200px]">
          <input
            type="text"
            placeholder="Search all columns..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full px-3 py-2 bg-surface-200 border border-surface-400 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-accent-500 transition-colors"
          />
        </div>
        <select
          value={(table.getColumn("model")?.getFilterValue() as string) ?? ""}
          onChange={(e) =>
            table
              .getColumn("model")
              ?.setFilterValue(e.target.value || undefined)
          }
          className="px-3 py-2 bg-surface-200 border border-surface-400 rounded-lg text-gray-200 focus:outline-none focus:border-accent-500 transition-colors"
        >
          <option value="">All Models</option>
          {uniqueModels.map((model) => (
            <option key={model} value={model}>
              {model}
            </option>
          ))}
        </select>
        <select
          value={
            (table.getColumn("document")?.getFilterValue() as string) ?? ""
          }
          onChange={(e) =>
            table
              .getColumn("document")
              ?.setFilterValue(e.target.value || undefined)
          }
          className="px-3 py-2 bg-surface-200 border border-surface-400 rounded-lg text-gray-200 focus:outline-none focus:border-accent-500 transition-colors"
        >
          <option value="">All Documents</option>
          {uniqueDocs.map((doc) => (
            <option key={doc} value={doc}>
              {getShortDocName(doc)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b border-surface-300">
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-gray-400 font-medium cursor-pointer select-none hover:text-gray-200 transition-colors"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      <span className="sort-indicator text-accent-400">
                        {{
                          asc: "↑",
                          desc: "↓",
                        }[header.column.getIsSorted() as string] ?? (
                          <span className="text-gray-600">↕</span>
                        )}
                      </span>
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row, i) => (
              <tr
                key={row.id}
                className={`border-b border-surface-300/50 hover:bg-surface-200/50 transition-colors ${
                  i % 2 === 0 ? "bg-surface-100" : "bg-surface-100/50"
                }`}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Table Info */}
      <div className="mt-4 text-sm text-gray-500">
        Showing {table.getFilteredRowModel().rows.length} of {results.length}{" "}
        results
      </div>
    </div>
  );
}
