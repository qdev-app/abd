import type { ClaimedByUA, EngineName, Signals } from './types.js';

/**
 * Parse what the User-Agent string *claims* to be. This is intentionally naive —
 * it trusts the UA completely. The detection engine then checks these claims
 * against behavioural signals to spot spoofing.
 */
export function parseClaim(ua: string): ClaimedByUA {
  const u = ua || '';

  // Order matters: more specific tokens first (forks reuse base tokens).
  const rules: { name: string; test: RegExp; version?: RegExp; engine: EngineName }[] = [
    { name: 'Edge', test: /\bEdg(A|iOS)?\//, version: /\bEdg(?:A|iOS)?\/([\d.]+)/, engine: 'Blink' },
    { name: 'Opera', test: /\bOPR\/|\bOpera\//, version: /\b(?:OPR|Opera)\/([\d.]+)/, engine: 'Blink' },
    { name: 'Vivaldi', test: /\bVivaldi\//, version: /\bVivaldi\/([\d.]+)/, engine: 'Blink' },
    { name: 'Yandex', test: /\bYaBrowser\//, version: /\bYaBrowser\/([\d.]+)/, engine: 'Blink' },
    { name: 'Samsung Internet', test: /\bSamsungBrowser\//, version: /\bSamsungBrowser\/([\d.]+)/, engine: 'Blink' },
    { name: 'Brave', test: /\bBrave\//, version: /\bBrave\/([\d.]+)/, engine: 'Blink' },
    { name: 'Chrome (iOS)', test: /\bCriOS\//, version: /\bCriOS\/([\d.]+)/, engine: 'WebKit' },
    { name: 'Firefox (iOS)', test: /\bFxiOS\//, version: /\bFxiOS\/([\d.]+)/, engine: 'WebKit' },
    { name: 'Edge (iOS)', test: /\bEdgiOS\//, version: /\bEdgiOS\/([\d.]+)/, engine: 'WebKit' },
    { name: 'Firefox', test: /\bFirefox\//, version: /\bFirefox\/([\d.]+)/, engine: 'Gecko' },
    { name: 'Chrome', test: /\bChrome\/|\bCriOS\//, version: /\bChrome\/([\d.]+)/, engine: 'Blink' },
    { name: 'Safari', test: /\bSafari\//, version: /\bVersion\/([\d.]+)/, engine: 'WebKit' },
  ];

  for (const r of rules) {
    if (r.test.test(u)) {
      const version = r.version?.exec(u)?.[1];
      return { name: r.name, version, engine: r.engine };
    }
  }
  return { name: 'Unknown', engine: 'Unknown' };
}

/** Convenience for the UA-only path: turn a bare UA string into minimal Signals. */
export function signalsFromUA(ua: string): Signals {
  return {
    userAgent: ua,
    uaData: null,
    vendor: '',
    platform: '',
    language: '',
    languages: [],
    globals: {},
    features: {},
    css: {},
    source: 'ua-only',
  };
}
