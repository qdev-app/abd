import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { detect } from '@qdev.app/abd-core';
import type { Signals } from '@qdev.app/abd-core';
import * as esbuild from 'esbuild';
import { renderResult } from './render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ServeOptions {
  port: number;
  json: boolean;
  once: boolean;
}

/**
 * Start a local server that hands a signal-collector page to whichever browser
 * you open it in, then prints the detection to the terminal. This is the path
 * that can actually unmask Firefox forks (Zen, etc.): it reads live signals the
 * UA string can't carry.
 */
export async function serve(opts: ServeOptions): Promise<void> {
  const clientJs = await buildClient();

  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pageHtml());
      return;
    }
    if (req.method === 'GET' && req.url === '/client.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(clientJs);
      return;
    }
    if (req.method === 'POST' && req.url === '/report') {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const signals = JSON.parse(body) as Signals;
          const result = detect(signals);
          if (process.env.ABD_DEBUG) {
            const g = signals as unknown as Record<string, unknown>;
            process.stderr.write(
              `[debug] L=${g.chromeLeft} R=${g.chromeRight} T=${g.chromeTop} B=${g.chromeBottom} gpc=${g.globalPrivacyControl} → ${result.browser.name}\n`,
            );
          }
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(result));

          // Print to terminal.
          if (opts.json) {
            process.stdout.write(JSON.stringify(result, null, 2) + '\n');
          } else {
            process.stdout.write(renderResult(result));
          }
          if (opts.once) {
            server.close();
            setTimeout(() => process.exit(0), 100);
          }
        } catch (err) {
          res.writeHead(400, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise<void>((res) => server.listen(opts.port, res));
  const url = `http://localhost:${opts.port}/`;
  process.stderr.write(
    `\n  abd is listening at ${url}\n` +
      `  → Open that URL in the browser you want to identify (Zen, Arc, Brave, …).\n` +
      (opts.once ? `  → Will print the first result and exit.\n\n` : `  → Leave running to test multiple browsers. Ctrl-C to stop.\n\n`),
  );
}

/** Bundle the browser collector entry (imports @qdev.app/abd-core) into a single file. */
async function buildClient(): Promise<string> {
  const entry = resolve(__dirname, 'client/entry.js');
  const result = await esbuild.build({
    entryPoints: [entry],
    bundle: true,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    write: false,
    minify: true,
  });
  return result.outputFiles[0]!.text;
}

function pageHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>abd — browser detection</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 ui-sans-serif, system-ui, sans-serif; max-width: 640px; margin: 6vh auto; padding: 0 20px; }
  h1 { font-size: 1.4rem; } h3 { margin: 1.4rem 0 .4rem; font-size: .85rem; text-transform: uppercase; letter-spacing: .05em; opacity: .6; }
  table { border-collapse: collapse; width: 100%; } td { padding: 6px 8px; border-bottom: 1px solid color-mix(in srgb, currentColor 12%, transparent); }
  td.k { opacity: .6; width: 11rem; } .dim { opacity: .5; } .ok { color: #16a34a; } .bad { color: #dc2626; font-weight: 600; }
  ul { margin: 0; padding-left: 1.2rem; } .notes li { opacity: .75; margin-bottom: .4rem; }
  #status { opacity: .7; }
</style>
</head>
<body>
  <h1>Advanced Browser Detector</h1>
  <p id="status">Loading…</p>
  <div id="out"></div>
  <script src="/client.js"></script>
</body>
</html>`;
}
