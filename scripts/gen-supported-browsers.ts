/**
 * Generates the "Supported browsers" table in README.md from the live signature
 * registry, so the browser LIST can never drift from the code. The per-browser
 * annotations (signal + spoof-resistance) live here; if a signature is added
 * without an annotation, this script fails loudly so the docs stay complete.
 *
 * Run: bun run docs:browsers   (or: bun scripts/gen-supported-browsers.ts)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { signatures } from '../packages/core/dist/index.js';

interface Ann {
  signal: string;
  spoof: string;
}

const ANNOTATIONS: Record<string, Ann> = {
  Brave: { signal: '`navigator.brave.isBrave()` + `userAgentData` brand', spoof: '✅ definitive' },
  'Microsoft Edge': { signal: '`userAgentData` brand "Microsoft Edge" + `Edg/`', spoof: '✅' },
  Opera: { signal: 'brand "Opera" + `window.opr` + `OPR/`', spoof: '✅' },
  'Samsung Internet': { signal: 'brand + `SamsungBrowser/`', spoof: '✅' },
  'Yandex Browser': { signal: 'brand + `YaBrowser/`', spoof: '✅' },
  Arc: { signal: 'injected `--arc-palette-title` CSS variable', spoof: '✅ (behind Chrome’s UA)' },
  Vivaldi: { signal: '`Vivaldi/` token (hides from brands)', spoof: '⚠️ UA-token' },
  'Google Chrome': { signal: 'brand "Google Chrome"', spoof: '✅' },
  Chromium: { signal: 'brand "Chromium", no vendor brand', spoof: '✅' },

  'Zen Browser': { signal: 'floating-window edge insets + GPC (windowed)', spoof: '✅ **(behind Firefox’s UA)**' },
  'Tor Browser': { signal: 'RFP profile: UTC + letterboxing + timer clamp + canvas block', spoof: '✅ heuristic' },
  LibreWolf: { signal: '`LibreWolf/` token, or RFP profile', spoof: '✅ heuristic' },
  Waterfox: { signal: '`Waterfox/` token', spoof: '⚠️ UA-token' },
  'Pale Moon': { signal: '`PaleMoon/` / `Goanna/` engine token', spoof: '⚠️ UA-token' },
  Floorp: { signal: '`Floorp/` token', spoof: '⚠️ UA-token' },
  'Mozilla Firefox': { signal: '`oscpu`, `productSub`, `-moz-appearance`, SpiderMonkey `InternalError`', spoof: '✅' },

  Safari: { signal: 'vendor "Apple" + `ApplePaySession` + `Version/`', spoof: '✅' },
  'Chrome (iOS)': { signal: '`CriOS/` (engine confirmed WebKit)', spoof: '⚠️ UA-token' },
  'Firefox (iOS)': { signal: '`FxiOS/`', spoof: '⚠️ UA-token' },
  'Edge (iOS)': { signal: '`EdgiOS/`', spoof: '⚠️ UA-token' },
  'GNOME Web (Epiphany)': { signal: '`Epiphany/`', spoof: '⚠️ UA-token' },
};

const ENGINE_TITLES: Record<string, string> = {
  Blink: 'Blink / Chromium',
  Gecko: 'Gecko / Firefox',
  WebKit: 'WebKit',
};

const missing = signatures.filter((s) => !ANNOTATIONS[s.name]);
if (missing.length) {
  console.error('Missing annotations for: ' + missing.map((s) => s.name).join(', '));
  process.exit(1);
}

const lines: string[] = [];
for (const engine of ['Blink', 'Gecko', 'WebKit'] as const) {
  const rows = signatures.filter((s) => s.engine === engine);
  if (!rows.length) continue;
  lines.push(`### ${ENGINE_TITLES[engine]}`, '');
  lines.push('| Browser | Primary signal | Behind spoofed UA? |', '| --- | --- | --- |');
  for (const s of rows) {
    const a = ANNOTATIONS[s.name]!;
    lines.push(`| **${s.name}** | ${a.signal} | ${a.spoof} |`);
  }
  lines.push('');
}

const block = `<!-- BROWSERS:START (auto-generated — run \`bun run docs:browsers\`) -->\n${lines.join('\n').trimEnd()}\n<!-- BROWSERS:END -->`;

const readmePath = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'README.md');
const readme = readFileSync(readmePath, 'utf8');
const re = /<!-- BROWSERS:START[\s\S]*?<!-- BROWSERS:END -->/;
if (!re.test(readme)) {
  console.error('Could not find <!-- BROWSERS:START --> … <!-- BROWSERS:END --> markers in README.md');
  process.exit(1);
}
writeFileSync(readmePath, readme.replace(re, block));
console.log(`✓ Wrote ${signatures.length} browsers into README.md Supported browsers table`);
