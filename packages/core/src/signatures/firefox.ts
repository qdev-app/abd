import type { Signature } from '../types.js';
import { isGecko, rfpEvidence, uaHas } from './util.js';

/**
 * Gecko-family signatures.
 *
 * Honest caveat: many Firefox forks (Zen, Floorp, Mullvad) ship the *unmodified*
 * Firefox User-Agent AND leave `navigator` untouched, because they only restyle
 * the browser chrome — which is invisible to web content. When a fork does that,
 * it is genuinely indistinguishable from stock Firefox from a web page. These
 * signatures capture every tell we currently know; the `notes` in the result
 * are where we're transparent about the limits. PRs adding new tells welcome.
 */
export const firefoxSignatures: Signature[] = [
  {
    name: 'Tor Browser',
    engine: 'Gecko',
    evaluate: (s) => {
      const rfp = rfpEvidence(s);
      // Screen letterboxing (rounding the reported window to 200x100 steps) is
      // Tor's distinctive tell — LibreWolf enables RFP but does NOT letterbox by
      // default. Gate on it so we don't mistake hardened Firefox for Tor.
      const hasLetterbox = rfp.some((e) => e.signal.includes('letterboxed'));
      const strong = hasLetterbox && s.timezone === 'UTC' && rfp.length >= 3;
      if (!strong) return [];
      return [...rfp, { signal: 'letterboxing + UTC + generic profile ⇒ Tor Browser', weight: 1.5 }];
    },
  },
  {
    name: 'LibreWolf',
    engine: 'Gecko',
    evaluate: (s) => {
      const ev = [];
      if (uaHas(s, /\bLibreWolf\//)) ev.push({ signal: 'UA token LibreWolf/', weight: 3 });
      // LibreWolf enables RFP by default but (unlike Tor) usually keeps local TZ.
      const rfp = rfpEvidence(s);
      if (rfp.length >= 2) ev.push(...rfp);
      return ev;
    },
  },
  {
    name: 'Waterfox',
    engine: 'Gecko',
    evaluate: (s) => (uaHas(s, /\bWaterfox\//) ? [{ signal: 'UA token Waterfox/', weight: 3 }] : []),
  },
  {
    name: 'Pale Moon',
    engine: 'Gecko',
    evaluate: (s) => {
      const ev = [];
      if (uaHas(s, /\bPaleMoon\//)) ev.push({ signal: 'UA token PaleMoon/', weight: 3 });
      if (uaHas(s, /\bGoanna\//)) ev.push({ signal: 'UA engine token Goanna/ (Pale Moon)', weight: 2 });
      return ev;
    },
  },
  {
    name: 'Floorp',
    engine: 'Gecko',
    evaluate: (s) => (uaHas(s, /\bFloorp\//) ? [{ signal: 'UA token Floorp/', weight: 3 }] : []),
  },
  {
    name: 'Zen Browser',
    engine: 'Gecko',
    evaluate: (s) => {
      // Empirically (see `abd probe`), stock Zen injects NO global and NO CSS
      // variable into web content and freezes buildID like Firefox — so there is
      // no definitive marker. What it *does* change are two defaults, captured
      // here as heuristics. Deliberately kept below the Firefox base score so we
      // never over-claim: Zen shows up as a strong candidate, not a false verdict.
      const ev = [];
      if (uaHas(s, /\bZen\//)) ev.push({ signal: 'UA token Zen/ (custom build)', weight: 5 });
      if (isGecko(s)) {
        const gpc = s.globalPrivacyControl === true;
        // Prefer the decomposed left inset (a LEFT sidebar specifically) over the
        // raw chromeWidth when Gecko exposed mozInnerScreenX.
        const sidebarW = s.chromeLeft ?? s.chromeWidth ?? 0;
        const sidebar = sidebarW >= 120;
        const leftSidebar = (s.chromeLeft ?? 0) >= 120 && (s.chromeRight ?? 99) <= 40;
        const tallChrome = (s.chromeTop ?? s.chromeHeight ?? 0) >= 95;
        if (gpc)
          ev.push({ signal: 'Global Privacy Control on by default (Zen default; stock Firefox is off)', weight: 1 });
        if (sidebar)
          ev.push({
            signal: `~${sidebarW}px ${leftSidebar ? 'left ' : ''}vertical-tab sidebar (stock Firefox is 0)`,
            weight: 1.5,
          });
        if (sidebar && tallChrome)
          ev.push({ signal: `~${s.chromeTop ?? s.chromeHeight}px top chrome consistent with Zen's toolbar`, weight: 0.5 });
        // Constellation bonus: an empirical Zen-vs-Firefox diff showed GPC + a
        // vertical sidebar are stock Firefox's two clearest differences from Zen.
        // Together (not alone) they outweigh the Firefox base score, so Zen wins
        // only when the whole constellation is present.
        if (gpc && sidebar)
          ev.push({ signal: 'GPC + vertical-sidebar constellation (matches Zen defaults, not stock Firefox)', weight: 2 });
      }
      return ev;
    },
  },
  {
    name: 'Mozilla Firefox',
    engine: 'Gecko',
    evaluate: (s) => {
      const ev = [];
      if (s.oscpu != null) ev.push({ signal: 'navigator.oscpu present', weight: 1 });
      if (s.productSub === '20100101') ev.push({ signal: 'navigator.productSub "20100101"', weight: 1 });
      if (s.css['-moz-appearance:none']) ev.push({ signal: 'CSS.supports(-moz-appearance)', weight: 0.75 });
      if (uaHas(s, /\bFirefox\//) && !uaHas(s, /Seamonkey|Waterfox|LibreWolf|PaleMoon|Floorp|Zen/))
        ev.push({ signal: 'UA token Firefox/ with no fork token', weight: 0.5 });
      return ev;
    },
  },
];
