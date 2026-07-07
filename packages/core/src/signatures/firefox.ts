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
        const haveInsets = s.chromeLeft != null;
        const sidebarW = s.chromeLeft ?? s.chromeWidth ?? 0;
        const leftSidebar = (s.chromeLeft ?? 0) >= 120;
        // Zen's floating window insets content from the RIGHT and BOTTOM edges
        // (its rounded-window design) — edges where a browser normally has zero
        // chrome. Every Firefox variant sits flush there (chromeRight/Bottom = 0).
        // This is independent of the sidebar, toolbar, and bookmarks bar; it only
        // goes away when Zen is truly fullscreen. That's the cleanest tell.
        const rightInset = (s.chromeRight ?? 0) >= 4;
        const bottomInset = (s.chromeBottom ?? 0) >= 4;
        const floatingWindow = rightInset && bottomInset;
        // Default Firefox ALWAYS shows a toolbar (~40px+), windowed or fullscreen
        // — it only vanishes with the non-default "Hide Toolbars" setting. Zen's
        // compact mode shows none. So a near-zero top inset is a Zen tell, and
        // crucially it works in fullscreen where the floating insets collapse.
        const noTopToolbar = s.chromeTop != null && s.chromeTop < 20;

        let structural = false;

        if (gpc)
          ev.push({ signal: 'Global Privacy Control on by default (Zen default; stock Firefox is off)', weight: 1 });

        if (floatingWindow) {
          ev.push({
            signal: `${s.chromeRight}px right + ${s.chromeBottom}px bottom chrome insets — Zen's floating window (Firefox content is flush to those edges)`,
            weight: 3,
          });
          if (leftSidebar) ev.push({ signal: `~${sidebarW}px left sidebar also consistent with Zen`, weight: 0.5 });
          structural = true;
        }

        if (noTopToolbar) {
          ev.push({
            signal: `no top toolbar (chromeTop ${s.chromeTop}px) — Zen compact mode; default Firefox always shows a toolbar`,
            weight: 2.5,
          });
          structural = true;
        }

        if (gpc && structural)
          ev.push({ signal: 'GPC + Zen chrome constellation (excludes all default-config Firefox variants)', weight: 1 });

        if (!floatingWindow && !noTopToolbar && !haveInsets && sidebarW >= 120) {
          // No decomposed insets ⇒ can't separate Zen from Firefox vertical tabs.
          ev.push({
            signal: `~${sidebarW}px vertical sidebar (can't separate Zen from Firefox vertical tabs without chrome insets)`,
            weight: 0.75,
          });
        }
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
