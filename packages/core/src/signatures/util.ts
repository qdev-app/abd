import type { Evidence, ScreenInfo, Signals } from '../types.js';

export function uaHas(s: Signals, re: RegExp): boolean {
  return re.test(s.userAgent || '');
}

/** True when live signals (or the UA) indicate the Gecko engine. */
export function isGecko(s: Signals): boolean {
  return (
    s.oscpu != null ||
    s.productSub === '20100101' ||
    s.css['-moz-appearance:none'] === true ||
    s.globals['MozAppearance'] === true ||
    /\bGecko\/\d|\bFirefox\//.test(s.userAgent || '')
  );
}

export function brandHas(s: Signals, name: string): boolean {
  return !!s.uaData?.brands.some((b) => b.brand.toLowerCase().includes(name.toLowerCase()));
}

export function brandVersion(s: Signals, name: string): string | undefined {
  return s.uaData?.brands.find((b) => b.brand.toLowerCase().includes(name.toLowerCase()))?.version;
}

/**
 * Heuristic score that Firefox's resistFingerprinting (RFP) is active — the
 * shared tell behind Tor Browser, LibreWolf's defaults, and privacy-hardened
 * Firefox. Returns matched evidence entries.
 */
export function rfpEvidence(s: Signals): Evidence[] {
  const ev: Evidence[] = [];
  if (s.timezone === 'UTC') ev.push({ signal: 'Intl timezone forced to UTC (RFP)', weight: 1.5 });
  if (s.hardwareConcurrency === 2) ev.push({ signal: 'hardwareConcurrency spoofed to 2 (RFP)', weight: 1 });
  if (s.languages.length <= 1 && s.language === 'en-US') ev.push({ signal: 'languages collapsed to ["en-US"] (RFP)', weight: 0.75 });
  if (s.pdfViewerEnabled === false) ev.push({ signal: 'pdfViewerEnabled false (RFP)', weight: 0.5 });
  if (s.screen && isLetterboxed(s.screen)) ev.push({ signal: 'screen dimensions rounded/letterboxed (RFP)', weight: 1 });
  return ev;
}

/** RFP rounds the reported window to multiples of 200x100 and dpr to 1. */
function isLetterboxed(screen: ScreenInfo): boolean {
  return screen.width % 200 === 0 && screen.height % 100 === 0 && screen.pixelRatio === 1;
}
