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
  Legend,
} from "recharts";
import type {
  AggregatedData,
  ModelGpuPerformance,
  DocumentPerformance,
} from "../types";
import { getDisplayName } from "../lib/parse-model";

const CHART_COLORS = [
  "#22d3ee", // cyan-400
  "#4ade80", // green-400
  "#facc15", // yellow-400
  "#fb923c", // orange-400
  "#a78bfa", // violet-400
  "#f472b6", // pink-400
  "#60a5fa", // blue-400
  "#34d399", // emerald-400
  "#f87171", // red-400
  "#818cf8", // indigo-400
];

const GPU_COLORS: Record<string, string> = {
  h200: "#22d3ee",
  h100: "#4ade80",
  a100: "#facc15",
  l40s: "#fb923c",
  l40: "#a78bfa",
  l4: "#f472b6",
  t4: "#60a5fa",
  api: "#818cf8",
  openrouter: "#818cf8",
};

function getColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length] ?? "#22d3ee";
}

function getGpuColor(gpu: string | null): string {
  if (!gpu) {
    return GPU_COLORS.api ?? "#818cf8";
  }
  return GPU_COLORS[gpu.toLowerCase()] ?? getColor(0);
}

interface TooltipPayload {
  name: string;
  value: number;
  payload?: Record<string, unknown>;
  color?: string;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
  suffix?: string;
}

const CustomTooltip = ({
  active,
  payload,
  label,
  suffix = "",
}: CustomTooltipProps) => {
  if (active && payload && payload.length > 0) {
    return (
      <div className="bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 shadow-lg">
        <p className="text-gray-200 font-medium text-sm mb-1">{label ?? ""}</p>
        {payload.map((item, i) => (
          <p
            key={i}
            className="text-sm font-mono"
            style={{ color: item.color }}
          >
            {item.name}:{" "}
            {typeof item.value === "number"
              ? item.value.toFixed(1)
              : item.value}
            {suffix}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// ============================================================================
// GPU Performance Comparison Chart
// ============================================================================

interface GpuComparisonChartProps {
  data: AggregatedData;
  metric: "tokensPerSecond" | "duration";
  category: "summarization" | "structuredOutput";
}

export function GpuComparisonChart({
  data,
  metric,
  category,
}: GpuComparisonChartProps) {
  const chartData = useMemo(() => {
    const performances = data.modelPerformances.filter((p) =>
      category === "summarization" ? p.summarization : p.structuredOutput,
    );

    return performances
      .map((perf) => {
        const stats =
          category === "summarization"
            ? perf.summarization
            : perf.structuredOutput;
        const value =
          metric === "tokensPerSecond" && category === "summarization"
            ? (stats as NonNullable<typeof perf.summarization>)
                .avgTokensPerSecond
            : stats!.avgDurationMs / 1000;

        return {
          name: getDisplayName(perf.parsed),
          value,
          gpu: perf.parsed.gpu ?? "openrouter",
          fullName: perf.modelId,
        };
      })
      .sort((a, b) =>
        metric === "tokensPerSecond" ? b.value - a.value : a.value - b.value,
      );
  }, [data, metric, category]);

  const suffix = metric === "tokensPerSecond" ? " tok/s" : "s";
  const label = metric === "tokensPerSecond" ? "Tokens/sec" : "Duration";

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(300, chartData.length * 40)}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
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
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={145}
        />
        <Tooltip content={<CustomTooltip suffix={suffix} />} />
        <Bar dataKey="value" name={label} radius={[0, 4, 4, 0]}>
          {chartData.map((entry, index) => (
            <Cell key={entry.fullName} fill={getGpuColor(entry.gpu)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Document Performance Chart
// ============================================================================

interface DocumentPerformanceChartProps {
  data: DocumentPerformance[];
  metric: "duration" | "tokensPerSecond";
}

export function DocumentPerformanceChart({
  data,
  metric,
}: DocumentPerformanceChartProps) {
  const chartData = useMemo(() => {
    return data.map((doc) => {
      const avgDuration =
        doc.models.reduce((sum, m) => sum + m.avgDurationMs, 0) /
        doc.models.length;
      const avgTokPerSec =
        doc.models
          .filter((m) => m.tokensPerSecond)
          .reduce((sum, m) => sum + (m.tokensPerSecond ?? 0), 0) /
          doc.models.filter((m) => m.tokensPerSecond).length || 0;

      return {
        name: doc.document.replace(".md", "").slice(0, 25),
        fullName: doc.document,
        tokens: doc.documentTokens,
        duration: avgDuration / 1000,
        tokensPerSecond: avgTokPerSec,
      };
    });
  }, [data]);

  const dataKey = metric === "duration" ? "duration" : "tokensPerSecond";
  const suffix = metric === "duration" ? "s" : " tok/s";

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
        layout="vertical"
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
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={95}
        />
        <Tooltip content={<CustomTooltip suffix={suffix} />} />
        <Bar
          dataKey={dataKey}
          name={metric === "duration" ? "Avg Duration" : "Avg Tok/s"}
          radius={[0, 4, 4, 0]}
        >
          {chartData.map((entry, index) => (
            <Cell key={entry.fullName} fill={getColor(index)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Model Comparison by GPU Chart (Grouped)
// ============================================================================

interface ModelByGpuChartProps {
  data: AggregatedData;
  selectedBaseModel: string | null;
}

export function ModelByGpuChart({
  data,
  selectedBaseModel,
}: ModelByGpuChartProps) {
  const chartData = useMemo(() => {
    // Group by base model, then show different GPUs
    const baseModelMap = new Map<string, ModelGpuPerformance[]>();

    for (const perf of data.modelPerformances) {
      const baseName = perf.parsed.baseName;
      if (!baseModelMap.has(baseName)) {
        baseModelMap.set(baseName, []);
      }
      baseModelMap.get(baseName)!.push(perf);
    }

    // Filter to selected model or show all
    const modelsToShow = selectedBaseModel
      ? [[selectedBaseModel, baseModelMap.get(selectedBaseModel) ?? []]]
      : Array.from(baseModelMap.entries());

    return modelsToShow
      .filter(([_, perfs]) => (perfs as ModelGpuPerformance[]).length > 0)
      .map(([baseName, perfs]) => {
        const entry: Record<string, unknown> = { name: baseName as string };
        for (const perf of perfs as ModelGpuPerformance[]) {
          const gpu = perf.parsed.gpu ?? "openrouter";
          if (perf.summarization) {
            entry[gpu] = perf.summarization.avgTokensPerSecond;
          } else if (perf.structuredOutput) {
            entry[gpu] = perf.structuredOutput.avgDurationMs / 1000;
          }
        }
        return entry;
      });
  }, [data, selectedBaseModel]);

  const allGpus = data.uniqueGpus;

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart
        data={chartData}
        margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#2a3542" />
        <XAxis
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
        />
        <YAxis
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: "#9ca3af" }} />
        {allGpus.map((gpu, index) => (
          <Bar
            key={gpu}
            dataKey={gpu}
            name={gpu.toUpperCase()}
            fill={getGpuColor(gpu)}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Success Rate Chart
// ============================================================================

interface SuccessRateChartProps {
  data: ModelGpuPerformance[];
  category: "summarization" | "structuredOutput";
}

export function SuccessRateChart({ data, category }: SuccessRateChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((perf) =>
        category === "summarization"
          ? perf.summarization
          : perf.structuredOutput,
      )
      .map((perf) => {
        const stats =
          category === "summarization"
            ? perf.summarization
            : perf.structuredOutput;
        return {
          name: getDisplayName(perf.parsed),
          successRate: stats!.successRate,
          gpu: perf.parsed.gpu ?? "openrouter",
          fullName: perf.modelId,
        };
      })
      .sort((a, b) => b.successRate - a.successRate);
  }, [data, category]);

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(200, chartData.length * 35)}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
      >
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#2a3542"
          horizontal={false}
        />
        <XAxis
          type="number"
          domain={[0, 100]}
          tick={{ fill: "#9ca3af", fontSize: 12 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          tickFormatter={(v) => `${v}%`}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={145}
        />
        <Tooltip content={<CustomTooltip suffix="%" />} />
        <Bar dataKey="successRate" name="Success Rate" radius={[0, 4, 4, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.fullName}
              fill={
                entry.successRate === 100
                  ? "#4ade80"
                  : entry.successRate >= 80
                    ? "#facc15"
                    : "#f87171"
              }
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

// ============================================================================
// Extractions Comparison Chart
// ============================================================================

interface ExtractionsChartProps {
  data: ModelGpuPerformance[];
}

export function ExtractionsComparisonChart({ data }: ExtractionsChartProps) {
  const chartData = useMemo(() => {
    return data
      .filter((perf) => perf.structuredOutput)
      .map((perf) => ({
        name: getDisplayName(perf.parsed),
        extractions: perf.structuredOutput!.avgExtractions,
        relationships: perf.structuredOutput!.avgRelationships,
        gpu: perf.parsed.gpu ?? "openrouter",
        fullName: perf.modelId,
      }))
      .sort((a, b) => b.extractions - a.extractions);
  }, [data]);

  return (
    <ResponsiveContainer
      width="100%"
      height={Math.max(250, chartData.length * 40)}
    >
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 150, bottom: 5 }}
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
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: "#9ca3af", fontSize: 11 }}
          axisLine={{ stroke: "#3a4756" }}
          tickLine={{ stroke: "#3a4756" }}
          width={145}
        />
        <Tooltip content={<CustomTooltip />} />
        <Legend wrapperStyle={{ color: "#9ca3af" }} />
        <Bar
          dataKey="extractions"
          name="Avg Extractions"
          fill="#a78bfa"
          radius={[0, 4, 4, 0]}
        />
        <Bar
          dataKey="relationships"
          name="Avg Relationships"
          fill="#f472b6"
          radius={[0, 4, 4, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
