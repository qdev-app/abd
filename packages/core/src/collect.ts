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
  return {
    // Rough engine-era probes — presence differs across engines/versions.
    'Array.fromAsync': typeof (Array as unknown as { fromAsync?: unknown }).fromAsync === 'function',
    'navigator.getBattery': typeof (navigator as unknown as { getBattery?: unknown }).getBattery === 'function',
    'window.showDirectoryPicker': typeof (window as unknown as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
    'window.chrome.loadTimes': safe(
      () => typeof (window as unknown as { chrome?: { loadTimes?: unknown } }).chrome?.loadTimes === 'function',
      false,
    ),
    OffscreenCanvas: typeof (window as unknown as { OffscreenCanvas?: unknown }).OffscreenCanvas === 'function',
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
  return {
    '-moz-appearance:none': supports('-moz-appearance', 'none'),
    '-webkit-touch-callout:none': supports('-webkit-touch-callout', 'none'),
    '-apple-pay-button-style:plain': supports('-apple-pay-button-style', 'plain'),
    'accent-color:auto': supports('accent-color', 'auto'),
  };
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    const v = fn();
    return v === undefined ? fallback : v;
  } catch {
    return fallback;
  }
}
