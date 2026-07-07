import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { diffProbes, type Probe, type DiffEntry } from '@qdev-app/abd-core';
import * as esbuild from 'esbuild';

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface ProbeOptions {
  port: number;
  /** Label for this run; probe is saved to abd-probe-<label>.json. */
  label: string;
  /** Compare against a previously-saved probe with this label. */
  compare?: string;
}

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const cc = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => cc('1', s);
const dim = (s: string) => cc('2', s);
const green = (s: string) => cc('32', s);
const cyan = (s: string) => cc('36', s);

/**
 * Signature-discovery server. Opens a page that captures an expanded probe from
 * the target browser, saves it, and (with --compare) diffs it against a baseline
 * browser's probe — surfacing injected globals, CSS variables, channel-gated
 * features, and chrome geometry that could become a new signature.
 */
export async function probe(opts: ProbeOptions): Promise<void> {
  const clientJs = await buildProbeClient();
  const outFile = resolve(process.cwd(), `abd-probe-${opts.label}.json`);

  // Captured server-side from the navigation request (zero JS, hard to spoof).
  let navHeaders: Record<string, string> = {};
  let headerOrder: string[] = [];
  let beaconSeen = false;

  const server = createServer((req, res) => {
    if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
      // Record the real request headers in wire order. Sensitive headers are
      // redacted — they carry secrets (cookies, tokens) and add nothing to a
      // fingerprint; we keep only presence + length.
      const REDACT = new Set(['cookie', 'authorization', 'proxy-authorization', 'set-cookie']);
      headerOrder = [];
      navHeaders = {};
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        const name = req.rawHeaders[i]!.toLowerCase();
        const value = req.rawHeaders[i + 1] ?? '';
        headerOrder.push(name);
        navHeaders[name] = REDACT.has(name) ? `[redacted, ${value.length} bytes]` : value;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(pageHtml(opts.label));
      return;
    }
    if (req.method === 'GET' && req.url === '/client.js') {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end(clientJs);
      return;
    }
    if (req.url === '/beacon-probe') {
      beaconSeen = true;
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method === 'POST' && req.url === '/probe') {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        try {
          const p = JSON.parse(body) as Probe;
          p.requestHeaders = navHeaders;
          p.headerOrder = headerOrder;
          p.beaconSeen = beaconSeen;
          writeFileSync(outFile, JSON.stringify(p, null, 2) + '\n');
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end('{"ok":true}');
          report(p, outFile, opts);
          server.close();
          setTimeout(() => process.exit(0), 100);
        } catch (err) {
          res.writeHead(400);
          res.end(String(err));
        }
      });
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });

  await new Promise<void>((r) => server.listen(opts.port, r));
  const url = `http://localhost:${opts.port}/`;
  process.stderr.write(
    `\n  abd probe [${opts.label}] listening at ${url}\n` +
      `  → Open that URL in the browser you want to profile.\n` +
      (opts.compare ? `  → Will diff against abd-probe-${opts.compare}.json when captured.\n\n` : `\n`),
  );
}

function report(p: Probe, outFile: string, opts: ProbeOptions): void {
  process.stdout.write(
    `\n  ${green('✓')} probe captured → ${dim(outFile)}\n` +
      `    ${p.globals.length} globals · ${Object.keys(p.rootCssVars).length} :root vars · ` +
      `${Object.keys(p.bodyCssVars).length} :body vars\n`,
  );

  // Always surface injected CSS variables — the Arc-style tell.
  const vars = { ...p.rootCssVars, ...p.bodyCssVars };
  const varKeys = Object.keys(vars);
  if (varKeys.length) {
    process.stdout.write(`\n  ${bold('Injected CSS custom properties (candidate markers):')}\n`);
    for (const k of varKeys.slice(0, 40)) process.stdout.write(`    ${cyan(k)} = ${vars[k]}\n`);
  }

  // Notable request headers + behaviour (pref-constellation tells).
  const h = p.requestHeaders ?? {};
  const notable = ['sec-gpc', 'dnt', 'accept', 'accept-language', 'accept-encoding', 'priority', 'upgrade-insecure-requests'];
  process.stdout.write(`\n  ${bold('Request headers / behaviour:')}\n`);
  for (const k of notable) if (h[k] != null) process.stdout.write(`    ${cyan(k)}: ${h[k]}\n`);
  process.stdout.write(`    ${cyan('header order')}: ${(p.headerOrder ?? []).join(' ')}\n`);
  process.stdout.write(`    ${cyan('sendBeacon')}: returned=${p.beaconReturned} arrived=${p.beaconSeen}\n`);

  if (!opts.compare) {
    process.stdout.write(
      `\n  ${dim(`Tip: capture a stock Firefox baseline, then run:`)}\n` +
        `  ${dim(`abd probe --label ${opts.label} --compare firefox`)}\n\n`,
    );
    return;
  }

  const baseFile = resolve(process.cwd(), `abd-probe-${opts.compare}.json`);
  if (!existsSync(baseFile)) {
    process.stdout.write(`\n  ⚠ baseline ${dim(baseFile)} not found — capture it first with --label ${opts.compare}.\n\n`);
    return;
  }
  const baseline = JSON.parse(readFileSync(baseFile, 'utf8')) as Probe;
  const d = diffProbes(baseline, p);

  process.stdout.write(`\n  ${bold(`DIFF: ${opts.compare} (baseline) → ${opts.label} (current)`)}\n`);
  printList('Globals only in current', d.globalsOnlyInCurrent.map((k) => ({ key: k, baseline: '∅', current: 'present' })));
  printList('Globals only in baseline', d.globalsOnlyInBaseline.map((k) => ({ key: k, baseline: 'present', current: '∅' })));
  printList(':root CSS vars changed', d.rootVarsChanged);
  printList(':body CSS vars changed', d.bodyVarsChanged);
  printList('navigator/meta changed', d.metaChanged);
  printList('JS features changed', d.featureChanged);
  printList('CSS support changed', d.cssChanged);
  printList('media queries changed', d.mediaChanged);
  printList('request headers changed', d.headersChanged);
  printList('behaviour changed (beacon/header order)', d.behaviorChanged);
  printList('chrome geometry changed', d.geometryChanged);

  const total =
    d.globalsOnlyInCurrent.length +
    d.globalsOnlyInBaseline.length +
    d.rootVarsChanged.length +
    d.bodyVarsChanged.length +
    d.featureChanged.length +
    d.cssChanged.length +
    d.mediaChanged.length +
    d.headersChanged.length +
    d.behaviorChanged.length;
  process.stdout.write(
    `\n  ${total === 0 ? dim('No structural differences found — no web-content signature in this probe set.') : green(`${total} candidate difference(s) — any stable one can become a signature.`)}\n\n`,
  );
}

function printList(title: string, entries: DiffEntry[]): void {
  if (!entries.length) return;
  process.stdout.write(`\n  ${bold(title)} ${dim(`(${entries.length})`)}\n`);
  for (const e of entries.slice(0, 30)) {
    process.stdout.write(`    ${cyan(e.key)}: ${dim(e.baseline)} → ${e.current}\n`);
  }
  if (entries.length > 30) process.stdout.write(`    ${dim(`… ${entries.length - 30} more`)}\n`);
}

async function buildProbeClient(): Promise<string> {
  const entry = resolve(__dirname, 'client/probe-entry.js');
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

function pageHtml(label: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>abd probe — ${label}</title>
<style>body{font:15px/1.5 ui-sans-serif,system-ui,sans-serif;max-width:640px;margin:8vh auto;padding:0 20px}#status{opacity:.8}#out{opacity:.6;margin-top:1rem;font-size:.9rem}</style>
</head><body>
<h1>abd probe · <code>${label}</code></h1>
<p id="status">Loading…</p>
<div id="out"></div>
<script src="/client.js"></script>
</body></html>`;
}
