// Smoke test for live-signal detection using the built dist.
// Run: node packages/core/test/fixtures.mjs
import { detect, resolveInstallTargets, diffProbes } from '../dist/index.js';

const base = {
  vendor: '',
  platform: '',
  language: 'en-US',
  languages: ['en-US', 'en'],
  globals: {},
  features: {},
  css: {},
  source: 'live',
};

const chromeUA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const ffUA = 'Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0';

const fixtures = {
  'Brave (claims Chrome, live signals expose it)': {
    ...base,
    userAgent: chromeUA,
    vendor: 'Google Inc.',
    uaData: { brands: [{ brand: 'Brave', version: '126' }, { brand: 'Chromium', version: '126' }], mobile: false, platform: 'Windows' },
    globals: { chrome: true },
    brave: true,
  },
  'Arc (claims Chrome, CSS var exposes it)': {
    ...base,
    userAgent: chromeUA,
    vendor: 'Google Inc.',
    uaData: { brands: [{ brand: 'Google Chrome', version: '126' }, { brand: 'Chromium', version: '126' }], mobile: false, platform: 'macOS' },
    globals: { chrome: true },
    arcPalette: 'rgb(20, 20, 20)',
  },
  'Stock Firefox (live, no fork markers)': {
    ...base,
    userAgent: ffUA,
    oscpu: 'Linux x86_64',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    timezone: 'America/New_York',
    hardwareConcurrency: 8,
  },
  'LibreWolf-ish Firefox with RFP (claims Firefox)': {
    ...base,
    userAgent: ffUA,
    oscpu: 'Linux x86_64',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    timezone: 'UTC',
    hardwareConcurrency: 2,
    pdfViewerEnabled: false,
    language: 'en-US',
    languages: ['en-US'],
    // Real laptop screen (not letterboxed) — LibreWolf enables RFP but, unlike
    // Tor, does not round the reported window to 200x100 steps.
    screen: { width: 1536, height: 864, pixelRatio: 1.25, colorDepth: 24 },
  },
  'Zen (GPC + Zen-profile sidebar)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    timezone: 'Europe/Berlin',
    hardwareConcurrency: 15,
    globalPrivacyControl: true, // Zen default; stock Firefox is off
    // Real live Zen geometry: left sidebar + a SMALL bottom chrome inset (~8px,
    // variable) that no Firefox variant has.
    chromeLeft: 269,
    chromeRight: 8,
    chromeTop: 72,
    chromeBottom: 8,
    chromeWidth: 277,
    chromeHeight: 80,
  },
  'Zen (windowed, sidebar hidden — floating window still detects)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: true,
    // Sidebar hidden but still WINDOWED: Zen's floating window keeps the right +
    // bottom insets, so it's still detectable even without the sidebar.
    chromeLeft: 0,
    chromeRight: 8,
    chromeTop: 40,
    chromeBottom: 8,
    chromeWidth: 8,
    chromeHeight: 48,
  },
  'Zen (fullscreen compact — detected via no-toolbar)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: true,
    // Fullscreen collapses the floating insets, but Zen compact shows NO toolbar
    // (chromeTop ~0) whereas default Firefox always keeps its toolbar. Detected.
    chromeLeft: 0,
    chromeRight: 0,
    chromeTop: 0,
    chromeBottom: 0,
    chromeWidth: 0,
    chromeHeight: 0,
  },
  'Firefox fullscreen (toolbar shown — must NOT be Zen)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: false,
    // macOS default Firefox keeps its toolbar in fullscreen (chromeTop > 0) and
    // sits flush to the other edges. No Zen tell.
    chromeLeft: 0,
    chromeRight: 0,
    chromeTop: 44,
    chromeBottom: 0,
    chromeWidth: 0,
    chromeHeight: 44,
  },
  'Firefox with vertical tabs + GPC (must NOT be Zen)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: true, // even with GPC on…
    // Real Firefox-VT geometry: left sidebar but THIN chrome (top 40, no bottom bar).
    chromeLeft: 218,
    chromeRight: 0,
    chromeTop: 40,
    chromeBottom: 0,
    chromeWidth: 218,
    chromeHeight: 40,
  },
  'Firefox vertical tabs + bookmarks bar + GPC (must NOT be Zen)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: true,
    // Bookmarks bar inflates TOP chrome (40 → ~72) but bottom stays 0 — must not
    // be mistaken for Zen just because the top chrome got thicker.
    chromeLeft: 218,
    chromeRight: 0,
    chromeTop: 72,
    chromeBottom: 0,
    chromeWidth: 218,
    chromeHeight: 72,
  },
  'Firefox with GPC only (no sidebar)': {
    ...base,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:152.0) Gecko/20100101 Firefox/152.0',
    oscpu: 'Intel Mac OS X 10.15',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    globalPrivacyControl: true,
    chromeLeft: 0,
    chromeRight: 0,
    chromeTop: 84,
    chromeBottom: 0,
    chromeWidth: 0,
    chromeHeight: 84,
  },
  'Tor Browser (letterboxed + full RFP)': {
    ...base,
    userAgent: ffUA,
    oscpu: 'Linux x86_64',
    productSub: '20100101',
    css: { '-moz-appearance:none': true },
    globals: { MozAppearance: true },
    timezone: 'UTC',
    hardwareConcurrency: 2,
    pdfViewerEnabled: false,
    language: 'en-US',
    languages: ['en-US'],
    screen: { width: 1600, height: 900, pixelRatio: 1, colorDepth: 24 },
    timerResolutionMs: 100, // Tor clamps the timer
    canvasBlocked: true,
  },
  'Spoofed UA (claims Chrome 90 but ships modern V8 APIs)': {
    ...base,
    source: 'live',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.0.0 Safari/537.36',
    vendor: 'Google Inc.',
    uaData: { brands: [{ brand: 'Chromium', version: '90' }], mobile: false, platform: 'Windows' },
    globals: { chrome: true },
    intlV8BreakIterator: true,
    errorCaptureStackTrace: true,
    stackFormat: 'v8',
    features: { 'Array.fromAsync': true, 'URL.canParse': true },
    css: { ':has()': true },
  },
};

let fail = 0;
for (const [label, signals] of Object.entries(fixtures)) {
  const r = detect(signals);
  console.log(`\n=== ${label} ===`);
  console.log(`  detected : ${r.browser.name} (${Math.round(r.browser.confidence * 100)}%)`);
  console.log(`  engine   : ${r.engine.name}`);
  console.log(`  claimed  : ${r.claimedByUA.name}`);
  console.log(`  spoofed  : ${r.spoofed}`);
  console.log(`  candidates: ${r.candidates.map((c) => c.name).join(', ') || '(none)'}`);
}

// Assertions
const asrt = (cond, msg) => { if (!cond) { console.error('  ✗ FAIL: ' + msg); fail++; } };
asrt(detect(fixtures['Brave (claims Chrome, live signals expose it)']).browser.name === 'Brave', 'Brave not detected');
asrt(detect(fixtures['Brave (claims Chrome, live signals expose it)']).spoofed === true, 'Brave should be flagged as mismatch vs Chrome UA');
asrt(detect(fixtures['Arc (claims Chrome, CSS var exposes it)']).browser.name === 'Arc', 'Arc not detected');
asrt(detect(fixtures['Stock Firefox (live, no fork markers)']).browser.name === 'Mozilla Firefox', 'Firefox not detected');
asrt(detect(fixtures['LibreWolf-ish Firefox with RFP (claims Firefox)']).browser.name === 'LibreWolf', 'LibreWolf not detected');
asrt(detect(fixtures['Tor Browser (letterboxed + full RFP)']).browser.name === 'Tor Browser', 'Tor not detected');
// Zen with sidebar visible → Zen tops, with a caveat note.
const zenR = detect(fixtures['Zen (GPC + Zen-profile sidebar)']);
console.log('  Zen (sidebar shown) → top:', zenR.browser.name);
asrt(zenR.browser.name === 'Zen Browser', 'Zen with sidebar should be the top pick');
asrt(zenR.notes.some((n) => n.includes('heuristic')), 'Zen heuristic caveat note should be present');
// Zen windowed with sidebar HIDDEN → still detected via the floating-window insets.
const zenHidden = detect(fixtures['Zen (windowed, sidebar hidden — floating window still detects)']);
console.log('  Zen (windowed, sidebar hidden) → top:', zenHidden.browser.name);
asrt(zenHidden.browser.name === 'Zen Browser', 'Windowed Zen without sidebar should STILL detect (floating window)');
// Zen FULLSCREEN compact → floating insets collapse, but no-toolbar tells it's Zen.
const zenFs = detect(fixtures['Zen (fullscreen compact — detected via no-toolbar)']);
console.log('  Zen (fullscreen compact) → top:', zenFs.browser.name);
asrt(zenFs.browser.name === 'Zen Browser', 'Fullscreen compact Zen detected via missing toolbar');
// Firefox fullscreen keeps its toolbar → must stay Firefox.
const ffFs = detect(fixtures['Firefox fullscreen (toolbar shown — must NOT be Zen)']);
console.log('  Firefox (fullscreen) → top:', ffFs.browser.name);
asrt(ffFs.browser.name === 'Mozilla Firefox', 'Fullscreen Firefox with toolbar must NOT be Zen');
// Firefox vertical tabs + GPC must NOT read as Zen (no bottom bar).
const ffvt = detect(fixtures['Firefox with vertical tabs + GPC (must NOT be Zen)']);
console.log('  Firefox-VT → top:', ffvt.browser.name);
asrt(ffvt.browser.name === 'Mozilla Firefox', 'Firefox vertical tabs must NOT be classified as Zen');
// Bookmarks bar (thicker TOP chrome) must NOT flip Firefox-VT into Zen.
const ffvtBm = detect(fixtures['Firefox vertical tabs + bookmarks bar + GPC (must NOT be Zen)']);
console.log('  Firefox-VT + bookmarks → top:', ffvtBm.browser.name);
asrt(ffvtBm.browser.name === 'Mozilla Firefox', 'Bookmarks bar must NOT turn Firefox-VT into Zen');
// GPC alone (no bottom bar) is too weak → Firefox stays top.
const gpcOnly = detect(fixtures['Firefox with GPC only (no sidebar)']);
asrt(gpcOnly.browser.name === 'Mozilla Firefox', 'GPC alone should NOT override Firefox');

// --- Version-consistency spoof detection + engine cross-confirmation ---
console.log('\n=== version consistency ===');
const spoofR = detect(fixtures['Spoofed UA (claims Chrome 90 but ships modern V8 APIs)']);
console.log('  claimed:', spoofR.claimedByUA.version, '| impliedMin:', spoofR.versionCheck?.impliedMinMajor, '| consistent:', spoofR.versionCheck?.consistent, '| spoofed:', spoofR.spoofed);
asrt(spoofR.versionCheck && spoofR.versionCheck.consistent === false, 'modern APIs under Chrome 90 UA should be inconsistent');
asrt(spoofR.spoofed === true, 'version mismatch should mark spoofed');
asrt(spoofR.engine.name === 'Blink', 'V8 quirks should confirm Blink engine');
// Tor now also fires the measured-hardening evidence.
const torR = detect(fixtures['Tor Browser (letterboxed + full RFP)']);
asrt(torR.browser.evidence.some((e) => /timer resolution clamped/.test(e.signal)), 'Tor should show clamped-timer evidence');

// --- Install target resolution ---
console.log('\n=== resolveInstallTargets ===');
const links = { firefox: 'https://addons.mozilla.org/x', chrome: 'https://chrome.google.com/x', edge: 'https://edge/x' };

// Zen-style: detected Firefox, only a Firefox link → single Firefox button.
const zen = resolveInstallTargets(detect(fixtures['Stock Firefox (live, no fork markers)']), links);
console.log('  firefox/zen  → current:', zen.current?.browser ?? null, '| mainstream:', zen.mainstream?.browser ?? null);
asrt(zen.current?.browser === 'Mozilla Firefox', 'Firefox current link should resolve');
asrt(zen.mainstream === null, 'no duplicate mainstream button when current IS mainstream');

// Brave: no Brave link, but Blink engine → mainstream Chrome button, no current.
const brave = resolveInstallTargets(detect(fixtures['Brave (claims Chrome, live signals expose it)']), links);
console.log('  brave        → current:', brave.current?.browser ?? null, '| mainstream:', brave.mainstream?.browser ?? null);
asrt(brave.current === null, 'no Brave-specific link ⇒ no current button');
asrt(brave.mainstream?.browser === 'Google Chrome', 'Brave should fall back to Chrome mainstream link');

// Brave WITH a Brave link → current Brave + mainstream Chrome (distinct URLs).
const braveBoth = resolveInstallTargets(detect(fixtures['Brave (claims Chrome, live signals expose it)']), {
  ...links,
  brave: 'https://brave/x',
});
asrt(braveBoth.current?.browser === 'Brave', 'Brave-specific link ⇒ current button');
asrt(braveBoth.mainstream?.browser === 'Google Chrome', 'Brave + Chrome links ⇒ both buttons');

// --- Probe diffing (signature discovery) ---
console.log('\n=== diffProbes ===');
const mkProbe = (over = {}) => ({
  meta: { userAgent: 'ff', buildID: '20181001000000' },
  geometry: { chromeHeight: 80, innerWidth: 1200 },
  globals: ['CSS', 'document', 'navigator', 'window'],
  rootCssVars: {},
  bodyCssVars: {},
  features: { 'navigator.oscpu': true },
  css: { '-moz-appearance:none': true },
  media: { 'prefers-color-scheme:dark': false },
  ...over,
});
const ffProbe = mkProbe();
const zenProbe = mkProbe({
  globals: ['CSS', 'document', 'navigator', 'window', '__zenBrowser'],
  rootCssVars: { '--zen-primary-color': '#f0f' },
  geometry: { chromeHeight: 40, innerWidth: 1120 },
});
const d = diffProbes(ffProbe, zenProbe);
console.log('  globals only in current :', d.globalsOnlyInCurrent);
console.log('  root vars changed       :', d.rootVarsChanged.map((e) => e.key));
console.log('  geometry changed        :', d.geometryChanged.map((e) => e.key));
asrt(d.globalsOnlyInCurrent.includes('__zenBrowser'), 'diff should catch an injected global');
asrt(d.rootVarsChanged.some((e) => e.key === '--zen-primary-color'), 'diff should catch an injected CSS var');
asrt(d.geometryChanged.some((e) => e.key === 'chromeHeight'), 'diff should catch chrome geometry change');

console.log(fail === 0 ? '\nALL ASSERTIONS PASSED ✓' : `\n${fail} ASSERTION(S) FAILED ✗`);
process.exit(fail === 0 ? 0 : 1);
