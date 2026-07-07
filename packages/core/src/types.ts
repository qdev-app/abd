/**
 * A "signature" is the bundle of observable signals we can read from a browser.
 *
 * Some signals come straight from the User-Agent string (easily spoofed), others
 * are behavioural / feature-detection signals that a browser cannot easily fake
 * from web content. The whole point of `abd` is to compare the two and surface
 * disagreements — e.g. a UA that claims plain Firefox but whose live signals match
 * a Firefox fork with resist-fingerprinting on.
 */
export interface Signals {
  /** navigator.userAgent — trivially spoofable. */
  userAgent: string;

  /**
   * navigator.userAgentData (Chromium only). `brands` is the single strongest
   * brand signal on Chromium — Edge/Brave/Opera/Vivaldi/Chrome all advertise here.
   * Absent (null) on Gecko and WebKit.
   */
  uaData: UaData | null;

  /** navigator.vendor. "Google Inc." (Blink), "Apple Computer, Inc." (WebKit), "" (Gecko). */
  vendor: string;

  /** navigator.platform (deprecated but still informative). */
  platform: string;

  /** navigator.oscpu — Gecko-only property, undefined elsewhere. */
  oscpu?: string;

  /** navigator.productSub — "20030107" on Blink/WebKit, "20100101" on Gecko. */
  productSub?: string;

  /** navigator.language + navigator.languages. RFP browsers collapse this to ["en-US"]. */
  language: string;
  languages: string[];

  /** navigator.hardwareConcurrency. RFP (LibreWolf/Tor) spoofs to 2. */
  hardwareConcurrency?: number;

  /** navigator.deviceMemory — Chromium only. */
  deviceMemory?: number;

  /** navigator.maxTouchPoints. */
  maxTouchPoints?: number;

  /** navigator.pdfViewerEnabled — false under many RFP configs. */
  pdfViewerEnabled?: boolean;

  /** Resolved result of navigator.brave?.isBrave() — definitive for Brave. */
  brave?: boolean;

  /** Presence of notable global objects, e.g. { chrome: true, opr: false, ApplePaySession: true }. */
  globals: Record<string, boolean>;

  /** JS feature-detection probes, e.g. { 'Array.fromAsync': true }. */
  features: Record<string, boolean>;

  /** CSS.supports() probes, e.g. { '-moz-appearance:none': true }. */
  css: Record<string, boolean>;

  // --- Engine cross-confirmation: JS quirks that are very hard to spoof ---
  /** typeof Intl.v8BreakIterator === 'function' — V8 (Blink) only. */
  intlV8BreakIterator?: boolean;
  /** typeof Error.captureStackTrace === 'function' — V8 (Blink) only. */
  errorCaptureStackTrace?: boolean;
  /** SpiderMonkey exposes the InternalError type — Gecko only. */
  spiderMonkeyInternalError?: boolean;
  /** Error stack line style: 'v8' = "    at fn"; 'moz-webkit' = "fn@url". */
  stackFormat?: 'v8' | 'moz-webkit' | 'unknown';

  // --- Fingerprinting-hardening measurements (RFP/FPP detectors) ---
  /** Measured performance.now() granularity in ms. RFP clamps this (Tor ≈ 100). */
  timerResolutionMs?: number;
  /** True when a canvas readback does not return the colour we drew (RFP block). */
  canvasBlocked?: boolean;

  /** navigator.globalPrivacyControl — Zen enables this by default; stock Firefox is off. */
  globalPrivacyControl?: boolean;

  /** window.outerWidth - innerWidth. A large value ⇒ a vertical sidebar (Zen's layout). */
  chromeWidth?: number;

  /** window.outerHeight - innerHeight. */
  chromeHeight?: number;

  /**
   * Chrome insets decomposed via Gecko's window.mozInnerScreenX/Y (Gecko only).
   * Reveals which SIDE the sidebar is on and its exact width — the key to
   * telling Zen's left sidebar apart from Firefox's native vertical tabs.
   */
  chromeLeft?: number;
  chromeTop?: number;
  chromeRight?: number;
  chromeBottom?: number;

  /** Intl timezone — RFP forces "UTC". */
  timezone?: string;

  /** Screen geometry — RFP rounds width/height to round numbers and dpr to 1. */
  screen?: ScreenInfo;

  /** Non-empty computed value of the Arc-injected CSS custom property. */
  arcPalette?: string;

  /** Where the signals came from, so consumers know how much to trust them. */
  source: SignalSource;
}

export type SignalSource = 'live' | 'ua-only';

export interface UaData {
  brands: { brand: string; version: string }[];
  mobile: boolean;
  platform: string;
}

export interface ScreenInfo {
  width: number;
  height: number;
  pixelRatio: number;
  colorDepth: number;
}

export type EngineName = 'Blink' | 'Gecko' | 'WebKit' | 'Unknown';

export interface Evidence {
  /** The signal that fired, e.g. "navigator.brave.isBrave() === true". */
  signal: string;
  /** How much this evidence moves the needle (roughly -1..+3). */
  weight: number;
}

export interface Candidate {
  name: string;
  /** Rendering engine this browser is built on. */
  engine: EngineName;
  /** Sum of evidence weights. */
  score: number;
  /** 0..1 normalised confidence for display. */
  confidence: number;
  evidence: Evidence[];
}

export interface EngineResult {
  name: EngineName;
  confidence: number;
  evidence: Evidence[];
}

export interface ClaimedByUA {
  name: string;
  version?: string;
  engine: EngineName;
}

export interface DetectionResult {
  /** Best-guess real browser. */
  browser: Candidate;
  /** Detected rendering engine. */
  engine: EngineResult;
  /** What the User-Agent string alone claims to be. */
  claimedByUA: ClaimedByUA;
  /** True when the live-detected browser disagrees with the UA claim. */
  spoofed: boolean;
  /** UA-version vs feature-availability cross-check (undefined in UA-only mode). */
  versionCheck?: VersionCheck;
  /** All scored candidates, best first. */
  candidates: Candidate[];
  /** Human-readable caveats and explanations. */
  notes: string[];
  /** Echoes Signals.source so callers can gauge reliability. */
  source: SignalSource;
}

export interface VersionCheck {
  engine: EngineName;
  /** Major version the UA claims (null if unparseable / UA-only). */
  claimedMajor: number | null;
  /** Highest version implied by the features actually present. */
  impliedMinMajor: number | null;
  /** False when present features require a newer engine than the UA claims. */
  consistent: boolean;
  evidence: Evidence[];
}

/** A signature contributes evidence toward one browser given a set of signals. */
export interface Signature {
  name: string;
  engine: EngineName;
  /** Return evidence entries that fired (empty array = no match). */
  evaluate(s: Signals): Evidence[];
}
