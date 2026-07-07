import type { EngineName, Evidence, Signals, VersionCheck } from './types.js';

/**
 * UA-version vs feature-availability cross-check.
 *
 * Each engine ships web features at a known version. If the live signals include
 * a feature that only exists in a NEWER engine than the User-Agent claims, the UA
 * is under-reporting — it's frozen, spoofed, or a bot. This is one of the most
 * reliable ways to catch a lying UA, and it needs no external data.
 *
 * We deliberately only flag the "real engine is newer than claimed" direction:
 * it can't produce false positives from an incomplete table (a missing gate just
 * means we detect less), whereas the reverse would.
 *
 * Gate versions are conservative and may need occasional maintenance as engines
 * ship features; each is the major version (Chrome/Firefox) or float (Safari)
 * in which the feature became available by default.
 */
interface Gate {
  /** Key into Signals.features or Signals.css. */
  key: string;
  where: 'features' | 'css';
  /** Minimum engine version that ships this feature. */
  min: number;
  label: string;
}

const BLINK_GATES: Gate[] = [
  { key: ':has()', where: 'css', min: 105, label: 'CSS :has()' },
  { key: 'text-wrap:balance', where: 'css', min: 114, label: 'CSS text-wrap:balance' },
  { key: 'Promise.withResolvers', where: 'features', min: 119, label: 'Promise.withResolvers' },
  { key: 'URL.canParse', where: 'features', min: 120, label: 'URL.canParse' },
  { key: 'Array.fromAsync', where: 'features', min: 121, label: 'Array.fromAsync' },
  { key: 'field-sizing:content', where: 'css', min: 123, label: 'CSS field-sizing' },
];

const GECKO_GATES: Gate[] = [
  { key: 'URL.canParse', where: 'features', min: 115, label: 'URL.canParse' },
  { key: 'color:light-dark', where: 'css', min: 120, label: 'CSS light-dark()' },
  { key: ':has()', where: 'css', min: 121, label: 'CSS :has()' },
  { key: 'Array.fromAsync', where: 'features', min: 121, label: 'Array.fromAsync' },
  { key: 'Promise.withResolvers', where: 'features', min: 121, label: 'Promise.withResolvers' },
];

const WEBKIT_GATES: Gate[] = [
  { key: ':has()', where: 'css', min: 15.4, label: 'CSS :has()' },
  { key: 'URL.canParse', where: 'features', min: 17, label: 'URL.canParse' },
  { key: 'Array.fromAsync', where: 'features', min: 17.4, label: 'Array.fromAsync' },
];

function gatesFor(engine: EngineName): Gate[] {
  switch (engine) {
    case 'Blink':
      return BLINK_GATES;
    case 'Gecko':
      return GECKO_GATES;
    case 'WebKit':
      return WEBKIT_GATES;
    default:
      return [];
  }
}

export function checkVersionConsistency(s: Signals, engine: EngineName, claimedVersion?: string): VersionCheck {
  const claimedMajor = parseMajor(claimedVersion);
  const gates = gatesFor(engine);

  let impliedMin: number | null = null;
  const present: Gate[] = [];
  for (const g of gates) {
    const map = g.where === 'features' ? s.features : s.css;
    if (map[g.key] === true) {
      present.push(g);
      if (impliedMin == null || g.min > impliedMin) impliedMin = g.min;
    }
  }

  const evidence: Evidence[] = [];
  let consistent = true;

  if (claimedMajor != null && impliedMin != null && impliedMin > claimedMajor) {
    consistent = false;
    const driver = present.reduce((a, b) => (b.min > a.min ? b : a));
    evidence.push({
      signal: `${driver.label} requires ${engine} ${driver.min}+, but UA claims ${claimedMajor} — UA under-reports its version`,
      weight: 3,
    });
  }

  return { engine, claimedMajor, impliedMinMajor: impliedMin, consistent, evidence };
}

function parseMajor(v?: string): number | null {
  if (!v) return null;
  const m = /^(\d+)(?:\.(\d+))?/.exec(v);
  if (!m) return null;
  // Safari uses major.minor (17.4); Chrome/Firefox effectively use the major.
  return m[2] ? Number(`${m[1]}.${m[2]}`) : Number(m[1]);
}
