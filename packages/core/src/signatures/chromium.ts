import type { Signature } from '../types.js';
import { brandHas, uaHas } from './util.js';

/**
 * Chromium-family signatures. `navigator.userAgentData.brands` is the strongest
 * signal here — every mainstream Chromium browser advertises its true brand in
 * `brands`, even when the legacy UA string is frozen/spoofed.
 */
export const chromiumSignatures: Signature[] = [
  {
    name: 'Brave',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      // Brave exposes an API that is impossible to fake from page script.
      if (s.brave === true) ev.push({ signal: 'navigator.brave.isBrave() === true', weight: 3 });
      if (brandHas(s, 'Brave')) ev.push({ signal: 'userAgentData brand "Brave"', weight: 2 });
      if (uaHas(s, /\bBrave\//)) ev.push({ signal: 'UA token Brave/', weight: 1 });
      return ev;
    },
  },
  {
    name: 'Microsoft Edge',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      if (brandHas(s, 'Microsoft Edge')) ev.push({ signal: 'userAgentData brand "Microsoft Edge"', weight: 3 });
      if (uaHas(s, /\bEdg(?:A|iOS)?\//)) ev.push({ signal: 'UA token Edg/', weight: 1.5 });
      return ev;
    },
  },
  {
    name: 'Opera',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      if (brandHas(s, 'Opera')) ev.push({ signal: 'userAgentData brand "Opera"', weight: 3 });
      if (s.globals.opr) ev.push({ signal: 'window.opr present', weight: 2 });
      if (uaHas(s, /\bOPR\//)) ev.push({ signal: 'UA token OPR/', weight: 1.5 });
      return ev;
    },
  },
  {
    name: 'Vivaldi',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      // Vivaldi often hides from userAgentData, so the UA token is the main tell.
      if (uaHas(s, /\bVivaldi\//)) ev.push({ signal: 'UA token Vivaldi/', weight: 3 });
      if (brandHas(s, 'Vivaldi')) ev.push({ signal: 'userAgentData brand "Vivaldi"', weight: 3 });
      return ev;
    },
  },
  {
    name: 'Samsung Internet',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      if (brandHas(s, 'Samsung')) ev.push({ signal: 'userAgentData brand "Samsung Internet"', weight: 3 });
      if (uaHas(s, /\bSamsungBrowser\//)) ev.push({ signal: 'UA token SamsungBrowser/', weight: 2 });
      return ev;
    },
  },
  {
    name: 'Yandex Browser',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      if (brandHas(s, 'Yandex')) ev.push({ signal: 'userAgentData brand "Yandex"', weight: 3 });
      if (uaHas(s, /\bYaBrowser\//)) ev.push({ signal: 'UA token YaBrowser/', weight: 2 });
      return ev;
    },
  },
  {
    name: 'Arc',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      // Arc reuses Chrome's UA verbatim AND advertises the "Google Chrome" brand,
      // so this marker must outweigh the plain-Chrome signature to win. The
      // injected CSS variable is the only web-visible tell we currently know of.
      if (s.arcPalette) ev.push({ signal: '--arc-palette-title CSS custom property is set', weight: 4 });
      return ev;
    },
  },
  {
    name: 'Google Chrome',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      if (brandHas(s, 'Google Chrome')) ev.push({ signal: 'userAgentData brand "Google Chrome"', weight: 3 });
      // Only credit the UA token when nothing more specific is around.
      if (uaHas(s, /\bChrome\//) && !uaHas(s, /Edg\/|OPR\/|Vivaldi|YaBrowser|SamsungBrowser|Brave/))
        ev.push({ signal: 'UA token Chrome/ with no derivative token', weight: 0.75 });
      return ev;
    },
  },
  {
    name: 'Chromium',
    engine: 'Blink',
    evaluate: (s) => {
      const ev = [];
      // Bare Chromium advertises only "Chromium" + "Not?A_Brand" in brands.
      if (s.uaData && brandHas(s, 'Chromium') && !brandHas(s, 'Google Chrome') && !brandHas(s, 'Microsoft Edge'))
        ev.push({ signal: 'userAgentData brand "Chromium" with no vendor brand', weight: 1 });
      return ev;
    },
  },
];
