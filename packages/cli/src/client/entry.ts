/// <reference lib="dom" />
import { collectSignals } from '@abd/core';
import type { DetectionResult } from '@abd/core';

/**
 * Runs inside the *target* browser that the user opens against `abd serve`.
 * Collects a live signature, sends it to the CLI, and renders the verdict the
 * CLI computes. esbuild bundles this file at serve time.
 */
async function main() {
  const status = document.getElementById('status')!;
  const out = document.getElementById('out')!;
  try {
    status.textContent = 'Collecting live browser signals…';
    const signals = await collectSignals();
    status.textContent = 'Analysing…';
    const res = await fetch('/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(signals),
    });
    const result = (await res.json()) as DetectionResult;
    status.textContent = 'Done — result also printed in your terminal.';
    render(result, out);
  } catch (err) {
    status.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
  }
}

function render(r: DetectionResult, root: HTMLElement) {
  const pct = (n: number) => Math.round(n * 100) + '%';
  const rows: string[] = [];
  rows.push(row('Detected browser', `<b>${esc(r.browser.name)}</b> <span class="dim">(${pct(r.browser.confidence)})</span>`));
  rows.push(row('Engine', `${esc(r.engine.name)} <span class="dim">(${pct(r.engine.confidence)})</span>`));
  rows.push(row('UA claims', esc(r.claimedByUA.name + (r.claimedByUA.version ? ' ' + r.claimedByUA.version : ''))));
  rows.push(row('Verdict', r.spoofed ? '<span class="bad">⚠ mismatch</span>' : '<span class="ok">✓ consistent</span>'));

  const evidence = r.browser.evidence.map((e) => `<li>${esc(e.signal)} <span class="dim">(+${e.weight})</span></li>`).join('');
  const notes = r.notes.map((n) => `<li>${esc(n)}</li>`).join('');

  root.innerHTML = `
    <table>${rows.join('')}</table>
    ${evidence ? `<h3>Evidence</h3><ul>${evidence}</ul>` : ''}
    ${notes ? `<h3>Notes</h3><ul class="notes">${notes}</ul>` : ''}
  `;
}

const row = (k: string, v: string) => `<tr><td class="k">${k}</td><td>${v}</td></tr>`;
const esc = (s: string) => s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);

main();
