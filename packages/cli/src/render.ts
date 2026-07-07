import type { DetectionResult } from '@abd/core';

const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const c = (code: string, s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = (s: string) => c('1', s);
const dim = (s: string) => c('2', s);
const green = (s: string) => c('32', s);
const yellow = (s: string) => c('33', s);
const red = (s: string) => c('31', s);
const cyan = (s: string) => c('36', s);

/** Pretty-print a detection result to a string for the terminal. */
export function renderResult(r: DetectionResult): string {
  const lines: string[] = [];
  const pct = (n: number) => `${Math.round(n * 100)}%`;

  lines.push('');
  lines.push(`  ${dim('Detected browser')}   ${bold(cyan(r.browser.name))}  ${dim(`(${pct(r.browser.confidence)} confidence)`)}`);
  lines.push(`  ${dim('Rendering engine')}   ${bold(r.engine.name)}  ${dim(`(${pct(r.engine.confidence)})`)}`);
  lines.push(
    `  ${dim('UA claims')}          ${r.claimedByUA.name}${r.claimedByUA.version ? ' ' + r.claimedByUA.version : ''}`,
  );

  if (r.spoofed) {
    lines.push(`  ${dim('Verdict')}            ${red('⚠ MISMATCH')} ${dim('— UA claim differs from live signals')}`);
  } else {
    lines.push(`  ${dim('Verdict')}            ${green('✓ consistent')}`);
  }
  lines.push('');

  if (r.browser.evidence.length) {
    lines.push(`  ${dim('Evidence')}`);
    for (const e of r.browser.evidence) {
      lines.push(`    ${green('•')} ${e.signal} ${dim(`(+${e.weight})`)}`);
    }
    lines.push('');
  }

  if (r.candidates.length > 1) {
    lines.push(`  ${dim('Other candidates')}`);
    for (const cand of r.candidates.slice(1, 4)) {
      lines.push(`    ${dim('-')} ${cand.name} ${dim(`(${pct(cand.confidence)})`)}`);
    }
    lines.push('');
  }

  if (r.notes.length) {
    lines.push(`  ${yellow('Notes')}`);
    for (const n of r.notes) {
      lines.push(wrap(n, '    '));
    }
    lines.push('');
  }

  return lines.join('\n');
}

function wrap(text: string, indent: string): string {
  const width = 76 - indent.length;
  const words = text.split(' ');
  const out: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      out.push(indent + line.trim());
      line = w;
    } else {
      line += ' ' + w;
    }
  }
  if (line.trim()) out.push(indent + line.trim());
  return out.join('\n');
}
