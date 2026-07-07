/**
 * Signature *discovery* — a much wider net than {@link Signals}. The detection
 * engine only reads signals we already know how to interpret; this dumps a broad
 * candidate set so you can diff two browsers and FIND a new tell (the way Arc's
 * `--arc-palette-title` CSS variable was found).
 *
 * Workflow: run `abd probe` in browser A, then in browser B with `--compare`,
 * and {@link diffProbes} shows exactly what changed — injected globals, injected
 * CSS custom properties, channel-gated features, chrome geometry, etc.
 */
export interface Probe {
  meta: Record<string, string | number | boolean | null>;
  geometry: Record<string, number>;
  /** Object.getOwnPropertyNames(window), sorted — reveals injected globals. */
  globals: string[];
  /** All `--*` custom properties resolved on <html> — reveals injected vars. */
  rootCssVars: Record<string, string>;
  /** All `--*` custom properties resolved on <body>. */
  bodyCssVars: Record<string, string>;
  /** JS API presence probes. */
  features: Record<string, boolean>;
  /** CSS.supports() probes, incl. experimental / channel-gated properties. */
  css: Record<string, boolean>;
  /** matchMedia() probes, incl. Gecko-specific media features. */
  media: Record<string, boolean>;
}

export function collectProbe(): Probe {
  const nav = navigator as unknown as Record<string, unknown>;
  const w = window as unknown as Record<string, unknown>;

  const g = (fn: () => unknown): string | number | boolean | null => {
    try {
      const v = fn();
      if (v == null) return null;
      if (typeof v === 'object') return JSON.stringify(v);
      return v as string | number | boolean;
    } catch {
      return null;
    }
  };

  return {
    meta: {
      userAgent: g(() => nav.userAgent) as string,
      buildID: g(() => nav.buildID),
      oscpu: g(() => nav.oscpu),
      productSub: g(() => nav.productSub),
      vendor: g(() => nav.vendor),
      vendorSub: g(() => nav.vendorSub),
      platform: g(() => nav.platform),
      hardwareConcurrency: g(() => nav.hardwareConcurrency),
      deviceMemory: g(() => nav.deviceMemory),
      language: g(() => nav.language),
      languages: g(() => (nav.languages as string[])?.join(',')),
      timezone: g(() => Intl.DateTimeFormat().resolvedOptions().timeZone),
      globalPrivacyControl: g(() => nav.globalPrivacyControl),
      doNotTrack: g(() => nav.doNotTrack),
      pdfViewerEnabled: g(() => nav.pdfViewerEnabled),
      maxTouchPoints: g(() => nav.maxTouchPoints),
      cookieEnabled: g(() => nav.cookieEnabled),
    },
    geometry: geometry(),
    globals: safeGlobals(w),
    rootCssVars: cssVars(() => document.documentElement),
    bodyCssVars: cssVars(() => document.body),
    features: features(w, nav),
    css: cssProbes(),
    media: mediaProbes(),
  };
}

function geometry(): Record<string, number> {
  const num = (fn: () => number): number => {
    try {
      const v = fn();
      return Number.isFinite(v) ? v : -1;
    } catch {
      return -1;
    }
  };
  return {
    innerWidth: num(() => window.innerWidth),
    innerHeight: num(() => window.innerHeight),
    outerWidth: num(() => window.outerWidth),
    outerHeight: num(() => window.outerHeight),
    // chrome thickness — Zen's vertical tabs / compact mode change these vs Firefox.
    chromeWidth: num(() => window.outerWidth - window.innerWidth),
    chromeHeight: num(() => window.outerHeight - window.innerHeight),
    screenWidth: num(() => screen.width),
    screenHeight: num(() => screen.height),
    availWidth: num(() => screen.availWidth),
    availHeight: num(() => screen.availHeight),
    devicePixelRatio: num(() => window.devicePixelRatio),
    colorDepth: num(() => screen.colorDepth),
  };
}

function safeGlobals(w: Record<string, unknown>): string[] {
  try {
    return Object.getOwnPropertyNames(w).sort();
  } catch {
    return [];
  }
}

function cssVars(getEl: () => Element | null): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const el = getEl();
    if (!el) return out;
    const cs = getComputedStyle(el);
    for (let i = 0; i < cs.length; i++) {
      const p = cs[i];
      if (p && p.startsWith('--')) out[p] = cs.getPropertyValue(p).trim();
    }
  } catch {
    /* ignore */
  }
  return out;
}

function features(w: Record<string, unknown>, nav: Record<string, unknown>): Record<string, boolean> {
  const has = (fn: () => unknown) => {
    try {
      return fn() != null;
    } catch {
      return false;
    }
  };
  return {
    'navigator.oscpu': has(() => nav.oscpu),
    'navigator.buildID': has(() => nav.buildID),
    'navigator.globalPrivacyControl': has(() => nav.globalPrivacyControl),
    'navigator.getBattery': has(() => nav.getBattery),
    'navigator.userAgentData': has(() => nav.userAgentData),
    'window.InstallTrigger': has(() => w.InstallTrigger),
    'window.mozInnerScreenX': has(() => w.mozInnerScreenX),
    'window.chrome': has(() => w.chrome),
    'CSS.highlights': has(() => (w.CSS as { highlights?: unknown })?.highlights),
    'Array.fromAsync': typeof (Array as unknown as { fromAsync?: unknown }).fromAsync === 'function',
    'Promise.withResolvers': typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers === 'function',
    OffscreenCanvas: typeof (w.OffscreenCanvas as unknown) === 'function',
    'window.PdfJS': has(() => w.PdfJS),
  };
}

function cssProbes(): Record<string, boolean> {
  const s = (p: string, v: string) => {
    try {
      return CSS.supports(p, v);
    } catch {
      return false;
    }
  };
  return {
    '-moz-appearance:none': s('-moz-appearance', 'none'),
    '-moz-user-select:none': s('-moz-user-select', 'none'),
    '-moz-orient:inline': s('-moz-orient', 'inline'),
    'field-sizing:content': s('field-sizing', 'content'),
    'anchor-name:--x': s('anchor-name', '--x'),
    'scrollbar-width:thin': s('scrollbar-width', 'thin'),
    'text-wrap:balance': s('text-wrap', 'balance'),
    'color:light-dark(#000,#fff)': s('color', 'light-dark(#000,#fff)'),
  };
}

function mediaProbes(): Record<string, boolean> {
  const m = (q: string) => {
    try {
      return matchMedia(q).matches;
    } catch {
      return false;
    }
  };
  return {
    'prefers-color-scheme:dark': m('(prefers-color-scheme: dark)'),
    'prefers-reduced-motion': m('(prefers-reduced-motion: reduce)'),
    'forced-colors:active': m('(forced-colors: active)'),
    '-moz-gtk-csd-available': m('(-moz-gtk-csd-available)'),
    '-moz-platform:linux': m('(-moz-platform: linux)'),
    '-moz-platform:macos': m('(-moz-platform: macos)'),
    '-moz-platform:windows': m('(-moz-platform: windows)'),
    'prefers-contrast:more': m('(prefers-contrast: more)'),
  };
}

// ------------------------------------------------------------------ diffing

export interface ProbeDiff {
  globalsOnlyInBaseline: string[];
  globalsOnlyInCurrent: string[];
  rootVarsChanged: DiffEntry[];
  bodyVarsChanged: DiffEntry[];
  metaChanged: DiffEntry[];
  featureChanged: DiffEntry[];
  cssChanged: DiffEntry[];
  mediaChanged: DiffEntry[];
  geometryChanged: DiffEntry[];
}

export interface DiffEntry {
  key: string;
  baseline: string;
  current: string;
}

/** Pure diff of two probes. `baseline` is the reference (e.g. stock Firefox). */
export function diffProbes(baseline: Probe, current: Probe): ProbeDiff {
  const bSet = new Set(baseline.globals);
  const cSet = new Set(current.globals);
  return {
    globalsOnlyInBaseline: baseline.globals.filter((k) => !cSet.has(k)),
    globalsOnlyInCurrent: current.globals.filter((k) => !bSet.has(k)),
    rootVarsChanged: diffRecord(baseline.rootCssVars, current.rootCssVars),
    bodyVarsChanged: diffRecord(baseline.bodyCssVars, current.bodyCssVars),
    metaChanged: diffRecord(baseline.meta, current.meta),
    featureChanged: diffRecord(baseline.features, current.features),
    cssChanged: diffRecord(baseline.css, current.css),
    mediaChanged: diffRecord(baseline.media, current.media),
    geometryChanged: diffRecord(baseline.geometry, current.geometry),
  };
}

function diffRecord(a: Record<string, unknown>, b: Record<string, unknown>): DiffEntry[] {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  const out: DiffEntry[] = [];
  for (const key of keys) {
    const av = a[key] === undefined ? '∅' : String(a[key]);
    const bv = b[key] === undefined ? '∅' : String(b[key]);
    if (av !== bv) out.push({ key, baseline: av, current: bv });
  }
  return out.sort((x, y) => x.key.localeCompare(y.key));
}
