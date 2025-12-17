import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import type { BenchmarkResult } from "../types";

interface ModelComparisonChartProps {
  modelAverages: Record<string, number>;
}

interface TokensPerSecondChartProps {
  results: BenchmarkResult[];
}

function getShortModelName(model: string): string {
  return model.split("/").pop() || model;
}

const CHART_COLORS = [
  "#22d3ee", // cyan-400
  "#4ade80", // green-400
  "#facc15", // yellow-400
  "#fb923c", // orange-400
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
];

function getColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "#22d3ee";
}

interface TooltipPayload {
  name: string;
  value: number;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}

const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
  if (active && payload && payload.length > 0) {
    const item = payload[0];
    if (!item) return null;
    return (
      <div className="bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-gray-200 font-medium text-sm">{label ?? ""}</p>
        <p className="text-accent-400 font-mono text-sm">
          {item.name}: {item.value.toFixed(1)}
          {item.name === "Average Duration" ? "s" : " tok/s"}
        </p>
      </div>
    );
  }
  return null;
};

export function ModelComparisonChart({
  modelAverages,
}: ModelComparisonChartProps) {
  const data = useMemo(() => {
    return Object.entries(modelAverages)
      .map(([model, avgMs]) => ({
        model: getShortModelName(model),
        fullModel: model,
        avgSeconds: avgMs / 1000,
      }))
      .sort((a, b) => a.avgSeconds - b.avgSeconds);
  }, [modelAverages]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#2a3542"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          tickFormatter={(v: number) => `${v}s`}
        />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={95}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(34, 211, 238, 0.1)" }}
        />
        <Bar dataKey="avgSeconds" name="Average Duration" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.model} fill={getColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TokensPerSecondChart({ results }: TokensPerSecondChartProps) {
  const data = useMemo(() => {
    // Group by model and calculate average tokens per second
    const modelStats = new Map<string, { total: number; count: number }>();

    for (const result of results) {
      if (!result.success) continue;
      const model = result.model;
      const existing = modelStats.get(model) || { total: 0, count: 0 };
      modelStats.set(model, {
        total: existing.total + result.tokensPerSecond,
        count: existing.count + 1,
      });
    }

    return Array.from(modelStats.entries())
      .map(([model, stats]) => ({
        model: getShortModelName(model),
        fullModel: model,
        avgTokPerSec: stats.total / stats.count,
      }))
      .sort((a, b) => b.avgTokPerSec - a.avgTokPerSec);
  }, [results]);

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#2a3542"
          horizontal={false}
        />
        <XAxis
          type="number"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          tickFormatter={(v: number) => `${v}`}
        />
        <YAxis
          type="category"
          dataKey="model"
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={95}
        />
        <Tooltip
          content={<CustomTooltip />}
          cursor={{ fill: "rgba(34, 211, 238, 0.1)" }}
        />
        <Bar dataKey="avgTokPerSec" name="Tokens/sec" radius={[0, 4, 4, 0]}>
          {data.map((entry, index) => (
            <Cell key={entry.model} fill={getColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
