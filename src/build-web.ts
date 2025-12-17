import { loadLatestBenchmarkRun, loadBenchmarkRun } from "@/lib/storage";
import { displayError, displaySuccess, displayInfo } from "@/lib/display";

const DIST_DIR = "./dist";
const WEB_DIR = "./web";

async function buildWeb(inputFile?: string): Promise<void> {
  displayInfo("Building benchmark dashboard...\n");

  // Load benchmark data
  let run: Awaited<ReturnType<typeof loadLatestBenchmarkRun>>;

  if (inputFile) {
    try {
      run = await loadBenchmarkRun(inputFile);
      displayInfo(`Using benchmark file: ${inputFile}`);
    } catch {
      displayError(`Could not load results from ${inputFile}`);
      process.exit(1);
    }
  } else {
    run = await loadLatestBenchmarkRun();
    if (!run) {
      displayError(
        "No benchmark results found. Run 'bun src/bench.ts run' first.",
      );
      process.exit(1);
    }
    displayInfo(`Using latest benchmark: ${run.id}`);
  }

  // Create dist directory
  await Bun.$`rm -rf ${DIST_DIR}`.quiet();
  await Bun.$`mkdir -p ${DIST_DIR}`.quiet();

  // Build Tailwind CSS first
  displayInfo("Building Tailwind CSS...");
  const tailwindResult =
    await Bun.$`bunx @tailwindcss/cli -i ${WEB_DIR}/styles.css -o ${DIST_DIR}/styles.css --minify`.quiet();
  if (tailwindResult.exitCode !== 0) {
    displayError("Tailwind build failed");
    console.error(tailwindResult.stderr.toString());
    process.exit(1);
  }
  displaySuccess("Tailwind CSS built");

  // Build the web app with Bun (without CSS)
  displayInfo("Bundling React app...");

  const buildResult = await Bun.build({
    entrypoints: [`${WEB_DIR}/app.tsx`],
    outdir: DIST_DIR,
    naming: "[name].[hash].[ext]",
    minify: true,
    sourcemap: "linked",
    target: "browser",
    define: {
      "process.env.NODE_ENV": '"production"',
    },
  });

  if (!buildResult.success) {
    displayError("Build failed:");
    for (const log of buildResult.logs) {
      console.error(log);
    }
    process.exit(1);
  }

  displaySuccess(`Bundled ${buildResult.outputs.length} files`);

  // Get the JS output filename
  const jsOutput = buildResult.outputs.find((o) => o.path.endsWith(".js"));
  const jsFilename = jsOutput ? jsOutput.path.split("/").pop() : "app.js";

  // Generate HTML with proper references
  displayInfo("Generating HTML...");

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DEX Bench - LLM Benchmark Results</title>
    <link rel="stylesheet" href="./styles.css" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Space+Grotesk:wght@400;500;600;700&display=swap"
      rel="stylesheet"
    />
    <script>window.BENCHMARK_DATA = ${JSON.stringify(run)};</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./${jsFilename}"></script>
  </body>
</html>`;

  await Bun.write(`${DIST_DIR}/index.html`, html);

  // Calculate output size
  const files = await Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: DIST_DIR }),
  );
  let totalSize = 0;
  for (const file of files) {
    const stat = await Bun.file(`${DIST_DIR}/${file}`).size;
    totalSize += stat;
  }

  displaySuccess(`\nBuild complete!`);
  displayInfo(`Output: ${DIST_DIR}/`);
  displayInfo(`Files: ${files.length}`);
  displayInfo(`Total size: ${(totalSize / 1024).toFixed(1)} KB`);
  displayInfo(`\nTo preview: bun run preview`);
  displayInfo(`To deploy: git push (GitHub Pages workflow)`);
}

async function previewWeb(): Promise<void> {
  displayInfo("Starting preview server...\n");

  const server = Bun.serve({
    port: 5151,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;

      if (path === "/") path = "/index.html";

      const file = Bun.file(`${DIST_DIR}${path}`);
      if (await file.exists()) {
        return new Response(file);
      }

      // Fallback to index.html for SPA
      return new Response(Bun.file(`${DIST_DIR}/index.html`));
    },
  });

  displaySuccess(`Preview server running at http://localhost:${server.port}`);
  displayInfo("Press Ctrl+C to stop");
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "preview":
      await previewWeb();
      break;
    default:
      // Build with optional input file
      await buildWeb(command);
      break;
  }
}

main().catch((error) => {
  displayError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
