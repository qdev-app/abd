import type { Signals, UaData } from './types.js';

/**
 * Collect a live browser signature. MUST run inside a real browser (window +
 * navigator present). Used by the web app and by the page the CLI's `serve`
 * command hands to the target browser.
 *
 * Everything is defensively guarded so it never throws in odd environments.
 */
export async function collectSignals(): Promise<Signals> {
  const nav = navigator as unknown as Navigator & Record<string, unknown>;
  const win = window as unknown as Window & Record<string, unknown>;

  const uaData = readUaData(nav);
  const brave = await readBrave(nav);

  return {
    userAgent: safe(() => nav.userAgent, ''),
    uaData,
    vendor: safe(() => nav.vendor, ''),
    platform: safe(() => (nav as Navigator).platform, ''),
    oscpu: safe(() => (nav as unknown as { oscpu?: string }).oscpu, undefined),
    productSub: safe(() => (nav as unknown as { productSub?: string }).productSub, undefined),
    language: safe(() => nav.language, ''),
    languages: safe(() => Array.from(nav.languages ?? []), []),
    hardwareConcurrency: safe(() => nav.hardwareConcurrency, undefined),
    deviceMemory: safe(() => (nav as unknown as { deviceMemory?: number }).deviceMemory, undefined),
    maxTouchPoints: safe(() => nav.maxTouchPoints, undefined),
    pdfViewerEnabled: safe(() => (nav as unknown as { pdfViewerEnabled?: boolean }).pdfViewerEnabled, undefined),
    globalPrivacyControl: safe(
      () => (nav as unknown as { globalPrivacyControl?: boolean }).globalPrivacyControl,
      undefined,
    ),
    chromeWidth: safe(() => window.outerWidth - window.innerWidth, undefined),
    chromeHeight: safe(() => window.outerHeight - window.innerHeight, undefined),
    ...chromeInsets(),
    intlV8BreakIterator: typeof (Intl as unknown as { v8BreakIterator?: unknown }).v8BreakIterator === 'function',
    errorCaptureStackTrace: typeof (Error as unknown as { captureStackTrace?: unknown }).captureStackTrace === 'function',
    spiderMonkeyInternalError: typeof (globalThis as unknown as { InternalError?: unknown }).InternalError === 'function',
    stackFormat: detectStackFormat(),
    timerResolutionMs: measureTimerResolution(),
    canvasBlocked: measureCanvasBlocked(),
    brave,
    globals: collectGlobals(win, nav),
    features: collectFeatures(),
    css: collectCss(),
    timezone: safe(() => Intl.DateTimeFormat().resolvedOptions().timeZone, undefined),
    screen: safe(
      () => ({
        width: window.screen.width,
        height: window.screen.height,
        pixelRatio: window.devicePixelRatio,
        colorDepth: window.screen.colorDepth,
      }),
      undefined,
    ),
    arcPalette: readArcPalette(),
    source: 'live',
  };
}

function readUaData(nav: Navigator & Record<string, unknown>): UaData | null {
  const uaData = (nav as unknown as { userAgentData?: { brands?: unknown; mobile?: boolean; platform?: string } })
    .userAgentData;
  if (!uaData || !Array.isArray(uaData.brands)) return null;
  return {
    brands: uaData.brands
      .filter((b): b is { brand: string; version: string } => !!b && typeof (b as { brand?: unknown }).brand === 'string')
      .map((b) => ({ brand: b.brand, version: b.version })),
    mobile: !!uaData.mobile,
    platform: typeof uaData.platform === 'string' ? uaData.platform : '',
  };
}

async function readBrave(nav: Navigator & Record<string, unknown>): Promise<boolean | undefined> {
  try {
    const brave = (nav as unknown as { brave?: { isBrave?: () => Promise<boolean> } }).brave;
    if (brave && typeof brave.isBrave === 'function') {
      return await brave.isBrave();
    }
  } catch {
    /* ignore */
  }
  return undefined;
}

/** Arc injects a `--arc-palette-title` custom property onto :root. */
function readArcPalette(): string | undefined {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--arc-palette-title').trim();
    return v || undefined;
  } catch {
    return undefined;
  }
}

function collectGlobals(win: Record<string, unknown>, nav: Record<string, unknown>): Record<string, boolean> {
  const inWin = (k: string) => k in win && win[k] != null;
  return {
    chrome: inWin('chrome'),
    'chrome.webstore': safe(() => !!(win.chrome as { webstore?: unknown } | undefined)?.webstore, false),
    opr: inWin('opr'),
    opera: inWin('opera'),
    safari: inWin('safari'),
    ApplePaySession: inWin('ApplePaySession'),
    GestureEvent: inWin('GestureEvent'),
    InstallTrigger: inWin('InstallTrigger'),
    MozAppearance: safe(() => 'MozAppearance' in document.documentElement.style, false),
    webkitConvertPointFromNodeToPage: inWin('webkitConvertPointFromNodeToPage'),
    brave: nav.brave != null,
  };
}

function collectFeatures(): Record<string, boolean> {
  const fn = (v: unknown) => typeof v === 'function';
  return {
    // Version-gated JS features (keys referenced by version.ts).
    'Array.fromAsync': fn((Array as unknown as { fromAsync?: unknown }).fromAsync),
    'Promise.withResolvers': fn((Promise as unknown as { withResolvers?: unknown }).withResolvers),
    'URL.canParse': fn((URL as unknown as { canParse?: unknown }).canParse),
    structuredClone: fn((globalThis as unknown as { structuredClone?: unknown }).structuredClone),
    'navigator.userAgentData': (navigator as unknown as { userAgentData?: unknown }).userAgentData != null,
    // Misc engine-era probes.
    'navigator.getBattery': fn((navigator as unknown as { getBattery?: unknown }).getBattery),
    'window.showDirectoryPicker': fn((window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker),
    'window.chrome.loadTimes': safe(
      () => fn((window as unknown as { chrome?: { loadTimes?: unknown } }).chrome?.loadTimes),
      false,
    ),
    OffscreenCanvas: fn((window as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas),
  };
}

function collectCss(): Record<string, boolean> {
  const supports = (p: string, v: string): boolean => {
    try {
      return typeof CSS !== 'undefined' && CSS.supports(p, v);
    } catch {
      return false;
    }
  };
  const selector = (sel: string): boolean => {
    try {
      return typeof CSS !== 'undefined' && CSS.supports(`selector(${sel})`);
    } catch {
      return false;
    }
  };
  return {
    '-moz-appearance:none': supports('-moz-appearance', 'none'),
    '-webkit-touch-callout:none': supports('-webkit-touch-callout', 'none'),
    '-apple-pay-button-style:plain': supports('-apple-pay-button-style', 'plain'),
    'accent-color:auto': supports('accent-color', 'auto'),
    // Version-gated CSS features (keys referenced by version.ts).
    ':has()': selector(':has(*)'),
    'text-wrap:balance': supports('text-wrap', 'balance'),
    'color:light-dark': supports('color', 'light-dark(#000,#fff)'),
    'field-sizing:content': supports('field-sizing', 'content'),
  };
}

/** V8 stacks read "    at fn (url)"; SpiderMonkey & JSC read "fn@url". */
function detectStackFormat(): 'v8' | 'moz-webkit' | 'unknown' {
  try {
    const stack = new Error('x').stack ?? '';
    if (/\n\s*at\s/.test(stack) || stack.startsWith('Error')) {
      if (/@/.test(stack) && !/\n\s*at\s/.test(stack)) return 'moz-webkit';
      return 'v8';
    }
    if (/@/.test(stack)) return 'moz-webkit';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

/** Busy-loop to find the smallest non-zero performance.now() delta. */
function measureTimerResolution(): number | undefined {
  try {
    if (typeof performance === 'undefined') return undefined;
    let min = Infinity;
    let last = performance.now();
    for (let i = 0; i < 50000 && min > 0.0005; i++) {
      const n = performance.now();
      const d = n - last;
      if (d > 0 && d < min) min = d;
      last = n;
    }
    return Number.isFinite(min) ? min : undefined;
  } catch {
    return undefined;
  }
}

/** Draw a known colour and read it back — RFP returns white/blank instead. */
function measureCanvasBlocked(): boolean | undefined {
  try {
    const c = document.createElement('canvas');
    c.width = 10;
    c.height = 10;
    const ctx = c.getContext('2d');
    if (!ctx) return undefined;
    ctx.fillStyle = 'rgb(255,102,0)';
    ctx.fillRect(0, 0, 10, 10);
    const px = ctx.getImageData(2, 2, 1, 1).data;
    // Expect ~[255,102,0]. Anything far off ⇒ blocked/randomised.
    const ok = px[0]! > 220 && px[1]! > 60 && px[1]! < 150 && px[2]! < 60;
    return !ok;
  } catch {
    return undefined;
  }
}

/**
 * Decompose the window chrome into left/top/right/bottom insets using Gecko's
 * mozInnerScreenX/Y (the screen position of the content area's top-left, in CSS
 * px). Returns {} on non-Gecko browsers where mozInnerScreenX is unavailable.
 */
function chromeInsets(): {
  chromeLeft?: number;
  chromeTop?: number;
  chromeRight?: number;
  chromeBottom?: number;
} {
  try {
    const w = window as unknown as { mozInnerScreenX?: number; mozInnerScreenY?: number };
    if (typeof w.mozInnerScreenX !== 'number' || typeof w.mozInnerScreenY !== 'number') return {};
    const left = Math.round(w.mozInnerScreenX - window.screenX);
    const top = Math.round(w.mozInnerScreenY - window.screenY);
    const right = Math.round(window.screenX + window.outerWidth - (w.mozInnerScreenX + window.innerWidth));
    const bottom = Math.round(window.screenY + window.outerHeight - (w.mozInnerScreenY + window.innerHeight));
    return { chromeLeft: left, chromeTop: top, chromeRight: right, chromeBottom: bottom };
  } catch {
    return {};
  }
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}
