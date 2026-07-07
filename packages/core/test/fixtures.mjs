// Smoke test for live-signal detection using the built dist.
// Run: node packages/core/test/fixtures.mjs
import { detect } from '../dist/index.js';

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

console.log(fail === 0 ? '\nALL ASSERTIONS PASSED ✓' : `\n${fail} ASSERTION(S) FAILED ✗`);
process.exit(fail === 0 ? 0 : 1);
