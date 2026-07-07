import type { Signature } from '../types.js';
import { uaHas } from './util.js';

/**
 * WebKit-family signatures. On iOS *every* browser is WebKit (App Store policy),
 * so brand-token browsers like Chrome-iOS and Firefox-iOS are really WebKit skins.
 */
export const webkitSignatures: Signature[] = [
  {
    name: 'Chrome (iOS)',
    engine: 'WebKit',
    evaluate: (s) => (uaHas(s, /\bCriOS\//) ? [{ signal: 'UA token CriOS/ (Chrome on iOS = WebKit)', weight: 3 }] : []),
  },
  {
    name: 'Firefox (iOS)',
    engine: 'WebKit',
    evaluate: (s) => (uaHas(s, /\bFxiOS\//) ? [{ signal: 'UA token FxiOS/ (Firefox on iOS = WebKit)', weight: 3 }] : []),
  },
  {
    name: 'Edge (iOS)',
    engine: 'WebKit',
    evaluate: (s) => (uaHas(s, /\bEdgiOS\//) ? [{ signal: 'UA token EdgiOS/ (Edge on iOS = WebKit)', weight: 3 }] : []),
  },
  {
    name: 'GNOME Web (Epiphany)',
    engine: 'WebKit',
    evaluate: (s) => (uaHas(s, /\bEpiphany\//) ? [{ signal: 'UA token Epiphany/', weight: 3 }] : []),
  },
  {
    name: 'Safari',
    engine: 'WebKit',
    evaluate: (s) => {
      const ev = [];
      if (s.vendor === 'Apple Computer, Inc.') ev.push({ signal: 'navigator.vendor "Apple Computer, Inc."', weight: 1.5 });
      if (s.globals.ApplePaySession) ev.push({ signal: 'window.ApplePaySession present', weight: 1 });
      // Real Safari has Version/ + Safari/ but NOT Chrome/CriOS/FxiOS/etc.
      if (uaHas(s, /\bSafari\//) && !uaHas(s, /Chrome\/|CriOS\/|FxiOS\/|EdgiOS\/|OPiOS\/|Android/))
        ev.push({ signal: 'UA Safari/ token with no other browser token', weight: 1 });
      return ev;
    },
  },
];
