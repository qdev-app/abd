import type { DetectionResult, EngineName } from './types.js';

/** The mainstream browser for each rendering engine — the safe fallback target. */
export function mainstreamBrowser(engine: EngineName): { name: string; key: string } | null {
  switch (engine) {
    case 'Blink':
      return { name: 'Google Chrome', key: 'chrome' };
    case 'Gecko':
      return { name: 'Mozilla Firefox', key: 'firefox' };
    case 'WebKit':
      return { name: 'Safari', key: 'safari' };
    default:
      return null;
  }
}

/**
 * Normalise a browser name into a stable lookup key so callers can supply links
 * keyed loosely, e.g. "Mozilla Firefox", "firefox" and "Firefox" all map to
 * "firefox"; "Chrome (iOS)" and "Google Chrome" map to "chrome".
 */
export function normalizeBrowserKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, '') // drop parenthetical qualifiers like "(iOS)"
    .replace(/\b(?:mozilla|google|microsoft|apple)\b/g, '') // drop vendor prefixes
    .replace(/\bbrowser\b/g, '')
    .replace(/[^a-z0-9]+/g, '');
}

export interface InstallTarget {
  /** Display name of the browser this link installs into. */
  browser: string;
  /** The install URL supplied by the caller. */
  url: string;
  /** Whether this is the detected browser or the mainstream fallback. */
  kind: 'current' | 'mainstream';
}

export interface InstallTargets {
  /** Link for the exact browser we detected (null if none supplied). */
  current: InstallTarget | null;
  /** Link for the engine's mainstream browser (null if none, or same as current). */
  mainstream: InstallTarget | null;
}

/**
 * Given a detection result and a map of browser → install URL, work out which
 * install buttons to show. `links` keys are matched loosely via
 * {@link normalizeBrowserKey}, so `{ firefox: '…', chrome: '…' }` works.
 *
 * - `current` is set only when a link exists for the detected browser.
 * - `mainstream` is set only when a link exists for the engine's mainstream
 *   browser AND it wouldn't duplicate `current`.
 *
 * So Zen (detected as Zen or Firefox) with only a Firefox link yields a single
 * Firefox button; real Chrome with only a Chrome link yields a single button.
 */
export function resolveInstallTargets(result: DetectionResult, links: Record<string, string>): InstallTargets {
  const lookup = new Map<string, string>();
  for (const [k, v] of Object.entries(links)) {
    if (v) lookup.set(normalizeBrowserKey(k), v);
  }

  const currentKey = normalizeBrowserKey(result.browser.name);
  const currentUrl = lookup.get(currentKey);
  const current: InstallTarget | null = currentUrl
    ? { browser: result.browser.name, url: currentUrl, kind: 'current' }
    : null;

  const ms = mainstreamBrowser(result.engine.name);
  const msUrl = ms ? lookup.get(ms.key) : undefined;
  let mainstream: InstallTarget | null = ms && msUrl ? { browser: ms.name, url: msUrl, kind: 'mainstream' } : null;

  // Don't show a duplicate button when the detected browser IS the mainstream
  // one, or when both keys resolved to the same link.
  if (mainstream && current && (ms!.key === currentKey || mainstream.url === current.url)) {
    mainstream = null;
  }

  return { current, mainstream };
}
