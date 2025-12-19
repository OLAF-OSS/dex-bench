// Known GPU identifiers for self-hosted models
const GPU_PATTERNS = ["l40s", "h100", "a100", "h200", "b200"];

/**
 * Create a normalized model key for aggregation.
 * This ensures that "a100/gemma-3-12b" and "gemma-3-12b/a100" produce the same key.
 *
 * Format: "{baseName}/{gpu}" for self-hosted, "{provider}/{baseName}" for API
 */
export function getNormalizedModelKey(modelId: string): string {
  const parsed = parseModel(modelId);
  if (parsed.isSelfHosted && parsed.gpu) {
    return `${parsed.baseName}/${parsed.gpu}`;
  }
  return `${parsed.provider}/${parsed.baseName}`;
}

export interface ParsedModel {
  /** Original model identifier (e.g., "gemma-3-12b/l40s" or "google/gemma-3-27b-it") */
  fullName: string;
  /** Base model name without GPU/provider (e.g., "gemma-3-12b") */
  baseName: string;
  /** Provider: "self-hosted" for GPU models, or API provider name (e.g., "google", "openrouter") */
  provider: string;
  /** GPU identifier if self-hosted (e.g., "l40s", "h200"), null for API models */
  gpu: string | null;
  /** Whether this is a self-hosted model running on a GPU */
  isSelfHosted: boolean;
}

/**
 * Find a GPU pattern in the model string.
 * Returns the GPU pattern if found, null otherwise.
 */
function findGpuInString(str: string): string | null {
  const lowerStr = str.toLowerCase();
  for (const gpu of GPU_PATTERNS) {
    if (lowerStr === gpu) {
      return gpu;
    }
  }
  return null;
}

/**
 * Parse a model identifier to extract base name, GPU, and provider information.
 *
 * Model formats:
 * - Self-hosted (GPU at front): "a100/gemma-3-12b" -> baseName: "gemma-3-12b", gpu: "a100"
 * - Self-hosted (GPU at end): "gemma-3-12b/l40s" -> baseName: "gemma-3-12b", gpu: "l40s"
 * - OpenRouter/API: "google/gemma-3-27b-it" -> baseName: "gemma-3-27b-it", provider: "google"
 */
export function parseModel(modelId: string): ParsedModel {
  const parts = modelId.split("/");

  if (parts.length === 2) {
    const [first, second] = parts as [string, string];

    // Check if first part is a GPU identifier (GPU at front: a100/gemma-3-12b)
    const gpuInFirst = findGpuInString(first);
    if (gpuInFirst) {
      return {
        fullName: modelId,
        baseName: second,
        provider: "self-hosted",
        gpu: gpuInFirst,
        isSelfHosted: true,
      };
    }

    // Check if second part is a GPU identifier (GPU at end: gemma-3-12b/l40s)
    const gpuInSecond = findGpuInString(second);
    if (gpuInSecond) {
      return {
        fullName: modelId,
        baseName: first,
        provider: "self-hosted",
        gpu: gpuInSecond,
        isSelfHosted: true,
      };
    }

    // No GPU found - it's an API provider/model format (e.g., "google/gemma-3-27b-it")
    return {
      fullName: modelId,
      baseName: second,
      provider: first,
      gpu: null,
      isSelfHosted: false,
    };
  }

  // Single part - treat as standalone model name
  return {
    fullName: modelId,
    baseName: modelId,
    provider: "unknown",
    gpu: null,
    isSelfHosted: false,
  };
}

/**
 * Get a display-friendly name for the model
 */
export function getDisplayName(parsed: ParsedModel): string {
  if (parsed.isSelfHosted && parsed.gpu) {
    return `${parsed.baseName} (${parsed.gpu.toUpperCase()})`;
  }
  if (parsed.provider !== "unknown" && parsed.provider !== "self-hosted") {
    return `${parsed.baseName} (${parsed.provider})`;
  }
  return parsed.baseName;
}

/**
 * Get a short display name for charts (just base name)
 */
export function getShortName(parsed: ParsedModel): string {
  return parsed.baseName;
}

/**
 * Get unique GPUs from a list of model identifiers
 */
export function getUniqueGpus(modelIds: string[]): string[] {
  const gpus = new Set<string>();
  for (const modelId of modelIds) {
    const parsed = parseModel(modelId);
    if (parsed.gpu) {
      gpus.add(parsed.gpu);
    } else if (!parsed.isSelfHosted) {
      gpus.add("openrouter"); // Group all API models under "openrouter"
    }
  }
  return Array.from(gpus).sort();
}

/**
 * Get unique base model names from a list of model identifiers
 */
export function getUniqueBaseModels(modelIds: string[]): string[] {
  const baseNames = new Set<string>();
  for (const modelId of modelIds) {
    const parsed = parseModel(modelId);
    baseNames.add(parsed.baseName);
  }
  return Array.from(baseNames).sort();
}

/**
 * Get unique providers from a list of model identifiers
 */
export function getUniqueProviders(modelIds: string[]): string[] {
  const providers = new Set<string>();
  for (const modelId of modelIds) {
    const parsed = parseModel(modelId);
    providers.add(parsed.provider);
  }
  return Array.from(providers).sort();
}
