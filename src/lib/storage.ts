import type { BenchmarkRun } from "@/lib/types";

const RESULTS_DIR = "./results";

export function getResultsDir(): string {
  return RESULTS_DIR;
}

export async function saveBenchmarkRun(run: BenchmarkRun): Promise<string> {
  const fileName = `${run.id}.json`;
  const filePath = `${RESULTS_DIR}/${fileName}`;

  // Ensure results directory exists
  await Bun.write(`${RESULTS_DIR}/.gitkeep`, "");

  await Bun.write(filePath, JSON.stringify(run, null, 2));
  return filePath;
}

export async function loadIncompleteRun(): Promise<BenchmarkRun | null> {
  const glob = new Bun.Glob("benchmark-*.json");
  const files: string[] = [];

  try {
    for await (const path of glob.scan(RESULTS_DIR)) {
      files.push(path);
    }
  } catch {
    // Directory doesn't exist yet
    return null;
  }

  if (files.length === 0) {
    return null;
  }

  // Sort by filename (newest first) and find the first incomplete run
  files.sort().reverse();

  for (const file of files) {
    const filePath = `${RESULTS_DIR}/${file}`;
    try {
      const content = await Bun.file(filePath).text();
      const run = JSON.parse(content) as BenchmarkRun;
      if (run.status === "in-progress") {
        return run;
      }
    } catch {
      // Skip corrupted files
      continue;
    }
  }

  return null;
}

export async function loadLatestBenchmarkRun(): Promise<BenchmarkRun | null> {
  const glob = new Bun.Glob("benchmark-*.json");
  const files: string[] = [];

  try {
    for await (const path of glob.scan(RESULTS_DIR)) {
      files.push(path);
    }
  } catch {
    // Directory doesn't exist yet
    return null;
  }

  if (files.length === 0) {
    return null;
  }

  // Sort by filename (which includes timestamp) to get the latest
  files.sort().reverse();
  const latestFile = `${RESULTS_DIR}/${files[0]}`;

  const content = await Bun.file(latestFile).text();
  return JSON.parse(content) as BenchmarkRun;
}

export async function loadBenchmarkRun(
  filePath: string,
): Promise<BenchmarkRun> {
  const content = await Bun.file(filePath).text();
  return JSON.parse(content) as BenchmarkRun;
}

export async function loadAllBenchmarkRuns(): Promise<BenchmarkRun[]> {
  const glob = new Bun.Glob("benchmark-*.json");
  const files: string[] = [];

  try {
    for await (const path of glob.scan(RESULTS_DIR)) {
      files.push(path);
    }
  } catch {
    // Directory doesn't exist yet
    return [];
  }

  if (files.length === 0) {
    return [];
  }

  // Sort by filename (which includes timestamp) to get newest first
  files.sort().reverse();

  const runs: BenchmarkRun[] = [];
  for (const file of files) {
    const filePath = `${RESULTS_DIR}/${file}`;
    try {
      const content = await Bun.file(filePath).text();
      const run = JSON.parse(content) as BenchmarkRun;
      // Only include completed runs
      if (run.status === "complete") {
        runs.push(run);
      }
    } catch {
      // Skip corrupted files
      continue;
    }
  }

  return runs;
}
