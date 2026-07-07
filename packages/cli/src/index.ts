#!/usr/bin/env node
import { detect, signalsFromUA } from '@abd/core';
import { renderResult } from './render.js';
import { serve } from './serve.js';

const HELP = `
abd — Advanced Browser Detector

Identify the real browser behind a spoofed or shared User-Agent.

USAGE
  abd "<user-agent string>"     Detect from a UA string (offline, UA-only)
  abd serve [options]           Serve a page; open it in a browser to get a live signature
  abd --help                    Show this help

SERVE OPTIONS
  --port <n>     Port to listen on (default: 4747)
  --once         Print the first result, then exit
  --json         Output raw JSON instead of the formatted view

NOTES
  UA-only mode cannot distinguish Firefox forks (Zen, Floorp, Mullvad) that reuse
  the Firefox UA string. Use "abd serve" and open the target browser for that —
  live feature signals are what give a fork away.

EXAMPLES
  abd "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"
  abd serve --once
  cat ua.txt | abd -
`;

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    process.stdout.write(HELP);
    return;
  }

  if (args[0] === 'serve') {
    const port = numFlag(args, '--port', 4747);
    await serve({ port, json: args.includes('--json'), once: args.includes('--once') });
    return;
  }

  // UA-only detection path.
  const json = args.includes('--json');
  let ua = args.find((a) => !a.startsWith('-'));

  if (args[0] === '-' || ua === '-') {
    ua = (await readStdin()).trim();
  }

  if (!ua) {
    process.stderr.write('error: no user-agent string provided.\n\n' + HELP);
    process.exit(1);
  }

  const result = detect(signalsFromUA(ua));
  if (json) {
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  } else {
    process.stdout.write(renderResult(result));
  }
}

function numFlag(args: string[], name: string, fallback: number): number {
  const i = args.indexOf(name);
  if (i >= 0 && args[i + 1]) {
    const n = Number(args[i + 1]);
    if (!Number.isNaN(n)) return n;
  }
  return fallback;
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

main(process.argv).catch((err) => {
  process.stderr.write('fatal: ' + (err instanceof Error ? err.stack : String(err)) + '\n');
  process.exit(1);
});
