import type { EngineResult, Evidence, Signals } from './types.js';

/**
 * Determine the rendering engine from live signals where possible, falling back
 * to UA tokens. Engine is far harder to spoof than brand: a Chromium build
 * cannot easily grow Gecko-only `navigator.oscpu`, and vice versa.
 *
 * Note: on iOS every browser is WebKit by platform rule, regardless of brand.
 */
export function detectEngine(s: Signals): EngineResult {
  const blink: Evidence[] = [];
  const gecko: Evidence[] = [];
  const webkit: Evidence[] = [];

  // --- Blink / Chromium ---
  if (s.uaData) blink.push({ signal: 'navigator.userAgentData present (Chromium-only)', weight: 3 });
  if (s.globals.chrome) blink.push({ signal: 'window.chrome present', weight: 1.5 });
  if (s.vendor === 'Google Inc.') blink.push({ signal: 'navigator.vendor === "Google Inc."', weight: 1 });
  if (s.deviceMemory != null) blink.push({ signal: 'navigator.deviceMemory present (Chromium-only)', weight: 1 });

  // --- Gecko / Firefox ---
  if (s.oscpu != null) gecko.push({ signal: 'navigator.oscpu present (Gecko-only)', weight: 3 });
  if (s.productSub === '20100101') gecko.push({ signal: 'navigator.productSub === "20100101" (Gecko)', weight: 2 });
  if (s.globals.MozAppearance) gecko.push({ signal: '"MozAppearance" in element.style (Gecko)', weight: 1.5 });
  if (s.css['-moz-appearance:none']) gecko.push({ signal: 'CSS.supports(-moz-appearance) (Gecko)', weight: 1 });
  if (s.globals.InstallTrigger) gecko.push({ signal: 'window.InstallTrigger present (older Gecko)', weight: 1 });

  // --- WebKit / Safari ---
  if (s.vendor === 'Apple Computer, Inc.') webkit.push({ signal: 'navigator.vendor === "Apple Computer, Inc."', weight: 2 });
  if (s.globals.ApplePaySession) webkit.push({ signal: 'window.ApplePaySession present (WebKit/Apple)', weight: 1.5 });
  if (s.globals.GestureEvent && !s.globals.chrome) webkit.push({ signal: 'window.GestureEvent present without window.chrome', weight: 1 });
  if (s.css['-apple-pay-button-style:plain']) webkit.push({ signal: 'CSS.supports(-apple-pay-button-style) (WebKit)', weight: 1 });

  // --- UA fallback when we have no live signals ---
  if (blink.length + gecko.length + webkit.length === 0) {
    const ua = s.userAgent;
    if (/\bGecko\/\d|\bFirefox\//.test(ua) && !/like Gecko/.test(ua.replace(/AppleWebKit.*/, '')))
      gecko.push({ signal: 'UA contains Gecko/Firefox token', weight: 1 });
    if (/Chrome\/|CriOS\//.test(ua)) blink.push({ signal: 'UA contains Chrome token', weight: 1 });
    if (/AppleWebKit/.test(ua) && !/Chrome\//.test(ua)) webkit.push({ signal: 'UA contains AppleWebKit without Chrome', weight: 1 });
    // iOS is always WebKit.
    if (/iPhone|iPad|iPod/.test(ua)) webkit.push({ signal: 'iOS platform ⇒ WebKit by policy', weight: 2 });
  }

  const scored = [
    { name: 'Blink' as const, evidence: blink },
    { name: 'Gecko' as const, evidence: gecko },
    { name: 'WebKit' as const, evidence: webkit },
  ].map((e) => ({ ...e, score: sum(e.evidence) }));

  scored.sort((a, b) => b.score - a.score);
  const top = scored[0]!;
  const runnerUp = scored[1]!;

  if (top.score === 0) return { name: 'Unknown', confidence: 0, evidence: [] };

  const confidence = clamp01(top.score / (top.score + runnerUp.score + 1));
  return { name: top.name, confidence, evidence: top.evidence };
}

function sum(ev: Evidence[]): number {
  return ev.reduce((a, b) => a + b.weight, 0);
}
function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}
