import { loadAllBenchmarkRuns } from "@/lib/storage";
import { displayError, displaySuccess, displayInfo } from "@/lib/display";

const DIST_DIR = "./dist";
const WEB_DIR = "./web";

async function buildWeb(): Promise<void> {
  displayInfo("Building benchmark dashboard...\n");

  // Load all benchmark data
  const runs = await loadAllBenchmarkRuns();

  if (runs.length === 0) {
    displayError(
      "No benchmark results found. Run 'bun src/bench.ts run' first.",
    );
    process.exit(1);
  }

  displayInfo(`Found ${runs.length} benchmark run(s)`);

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
    <script>window.BENCHMARK_DATA = ${JSON.stringify(runs)};</script>
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

// Connected clients for live reload
const clients = new Set<ReadableStreamDefaultController>();

async function watchWeb(): Promise<void> {
  displayInfo("Starting watch mode with live reload...\n");

  // Initial build
  await buildWebQuiet();

  // Start server with SSE for live reload
  const server = Bun.serve({
    port: 5151,
    async fetch(req) {
      const url = new URL(req.url);
      let path = url.pathname;

      // SSE endpoint for live reload
      if (path === "/__live-reload") {
        const stream = new ReadableStream({
          start(controller) {
            clients.add(controller);
            controller.enqueue("data: connected\n\n");
          },
          cancel(controller) {
            clients.delete(controller);
          },
        });

        return new Response(stream, {
          headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      }

      if (path === "/") path = "/index.html";

      const file = Bun.file(`${DIST_DIR}${path}`);
      if (await file.exists()) {
        // Inject live reload script into HTML
        if (path.endsWith(".html")) {
          const html = await file.text();
          const liveReloadScript = `
<script>
  const es = new EventSource('/__live-reload');
  es.onmessage = (e) => {
    if (e.data === 'reload') window.location.reload();
  };
  es.onerror = () => setTimeout(() => window.location.reload(), 1000);
</script>`;
          return new Response(
            html.replace("</body>", `${liveReloadScript}</body>`),
            {
              headers: { "Content-Type": "text/html" },
            },
          );
        }
        return new Response(file);
      }

      // Fallback to index.html for SPA
      const indexFile = Bun.file(`${DIST_DIR}/index.html`);
      const html = await indexFile.text();
      const liveReloadScript = `
<script>
  const es = new EventSource('/__live-reload');
  es.onmessage = (e) => {
    if (e.data === 'reload') window.location.reload();
  };
  es.onerror = () => setTimeout(() => window.location.reload(), 1000);
</script>`;
      return new Response(
        html.replace("</body>", `${liveReloadScript}</body>`),
        {
          headers: { "Content-Type": "text/html" },
        },
      );
    },
  });

  displaySuccess(`Dev server running at http://localhost:${server.port}`);
  displayInfo("Watching for changes in web/ and results/...\n");

  // Watch for file changes
  const watcher = Bun.spawn(
    [
      "find",
      WEB_DIR,
      "./results",
      "-type",
      "f",
      "-newer",
      `${DIST_DIR}/index.html`,
    ],
    { stdout: "pipe" },
  );
  await watcher.exited;

  // Use native file watching
  const { watch } = await import("node:fs");

  let debounceTimer: Timer | null = null;
  const rebuild = async () => {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(async () => {
      displayInfo("\nFile change detected, rebuilding...");
      try {
        await buildWebQuiet();
        displaySuccess("Rebuild complete!");
        // Notify all connected clients to reload
        for (const client of clients) {
          try {
            client.enqueue("data: reload\n\n");
          } catch {
            clients.delete(client);
          }
        }
      } catch (error) {
        displayError(`Rebuild failed: ${error}`);
      }
    }, 100);
  };

  // Watch web directory
  watch(WEB_DIR, { recursive: true }, (_event, filename) => {
    if (filename && !filename.includes("node_modules")) {
      rebuild();
    }
  });

  // Watch results directory for new benchmark data
  watch("./results", { recursive: true }, (_event, filename) => {
    if (filename?.endsWith(".json")) {
      rebuild();
    }
  });

  // Keep process alive
  await new Promise(() => {});
}

async function buildWebQuiet(): Promise<void> {
  // Load all benchmark data
  const runs = await loadAllBenchmarkRuns();

  if (runs.length === 0) {
    throw new Error("No benchmark results found");
  }

  // Create dist directory
  await Bun.$`rm -rf ${DIST_DIR}`.quiet();
  await Bun.$`mkdir -p ${DIST_DIR}`.quiet();

  // Build Tailwind CSS
  const tailwindResult =
    await Bun.$`bunx @tailwindcss/cli -i ${WEB_DIR}/styles.css -o ${DIST_DIR}/styles.css --minify`.quiet();
  if (tailwindResult.exitCode !== 0) {
    throw new Error("Tailwind build failed");
  }

  // Build the web app
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
    throw new Error("Build failed");
  }

  // Get the JS output filename
  const jsOutput = buildResult.outputs.find((o) => o.path.endsWith(".js"));
  const jsFilename = jsOutput ? jsOutput.path.split("/").pop() : "app.js";

  // Generate HTML
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
    <script>window.BENCHMARK_DATA = ${JSON.stringify(runs)};</script>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./${jsFilename}"></script>
  </body>
</html>`;

  await Bun.write(`${DIST_DIR}/index.html`, html);
}

async function main(): Promise<void> {
  const args = Bun.argv.slice(2);
  const command = args[0];

  switch (command) {
    case "preview":
      await previewWeb();
      break;
    case "watch":
      await watchWeb();
      break;
    default:
      await buildWeb();
      break;
  }
}

main().catch((error) => {
  displayError(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
