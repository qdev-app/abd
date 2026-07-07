# abd — Advanced Browser Detector

Identify the **real** browser behind a spoofed or shared User-Agent.

A User-Agent string is trivially faked, and whole families of browsers deliberately reuse another browser's UA: **Brave** and **Arc** ship Chrome's UA, **Zen / Floorp / Mullvad** ship Firefox's UA, and privacy builds (**LibreWolf**, **Tor Browser**) blend in on purpose. `abd` compares the UA's *claim* against **live behavioural signals** that a page can't easily fake — `userAgentData.brands`, `navigator.brave.isBrave()`, Gecko-only `navigator.oscpu`, Arc's injected CSS variable, resist-fingerprinting tells — and flags the mismatches.

- 🧠 **`@abd/core`** — a pure-TS detection engine (signals → ranked candidates + engine + spoof verdict)
- 🖥️ **`@abd/cli`** — `abd serve` captures a live signature from any browser you point at it; `abd "<ua>"` parses a UA offline
- 🌐 **web app** — React + Tailwind + Motion page that detects *your* browser
- 📦 **shadcn registry** — drop the detector into any React app: `npx shadcn add …/r/browser-detector.json`

> **Honest by design.** A fork that only restyles the browser *chrome* (e.g. stock **Zen**) leaves `navigator` untouched and is genuinely **indistinguishable from Firefox** to web content. `abd` never pretends otherwise — it reports what the signals actually support, with confidence and caveats, and the signature registry is built to grow as new tells are found.

## Quick start

Uses **[bun](https://bun.sh)** as both the package manager and the launcher.

```bash
bun install
bun run build     # build @abd/core and @abd/cli
bun run test      # run the detection fixtures
```

### CLI

```bash
# Offline: parse a User-Agent string (cannot see through Firefox forks)
bun run abd "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0"

# Live: serve a page, open it in the browser you want to identify (Zen, Arc, Brave…)
bun run serve --once
#   → open http://localhost:4747 in that browser; the verdict prints in your terminal
```

`abd serve` starts a local server, hands the target browser a signal-collector page, and prints the detection (add `--json` for machine output, `--once` to exit after the first result). This is the path that can actually unmask a Firefox fork, because it reads live feature signals the UA string can't carry.

### Web app

```bash
bun run dev:web   # http://localhost:5173
```

### shadcn components

The web app hosts a [shadcn registry](https://ui.shadcn.com/docs/registry) with two items. After deploying it, add them to any React app:

```bash
npx shadcn@latest add https://<your-deployed-host>/r/browser-detector.json
npx shadcn@latest add https://<your-deployed-host>/r/install-duo.json
```

**`browser-detector`** — full detection card:

```tsx
import { BrowserDetector } from '@/components/browser-detector';

<BrowserDetector onResult={(r) => console.log(r.browser.name, r.spoofed)} />;
```

**`install-duo`** — two live-detected install buttons: a **primary** for the visitor's browser and a **secondary** for the mainstream browser of its engine (Chrome for Blink, Firefox for Gecko, Safari for WebKit). A button appears **only when you supply a link for it**, so a Zen visitor with just a Firefox link sees a single Firefox button:

```tsx
import { InstallDuo } from '@/components/install-duo';

<InstallDuo
  links={{
    chrome: 'https://chromewebstore.google.com/…',
    firefox: 'https://addons.mozilla.org/…',
    // no Zen link needed — Gecko visitors fall back to the Firefox button
  }}
/>;
```

Regenerate the registry JSON after editing a component: `bun run registry`.

## How detection works

`detect(signals)` runs three things and reconciles them:

1. **Engine detection** (`Blink` / `Gecko` / `WebKit`) — the hardest thing to fake. A Chromium build can't grow Gecko-only `navigator.oscpu`; iOS is WebKit by App-Store policy regardless of brand.
2. **Signature registry** — each browser contributes weighted *evidence*; candidates are ranked by score. See [`packages/core/src/signatures/`](packages/core/src/signatures).
3. **UA claim** — parsed naively and trusted, then compared to the winner. Disagreement ⇒ `spoofed: true`.

The strongest signals per family:

| Browser | Tell |
| --- | --- |
| Brave | `navigator.brave.isBrave()` (unfakeable from page script) |
| Edge / Opera / Vivaldi / Samsung / Yandex | `navigator.userAgentData.brands` + UA token |
| Arc | injected `--arc-palette-title` CSS custom property |
| Firefox | `navigator.oscpu`, `productSub === "20100101"`, `-moz-appearance` |
| LibreWolf | UA token, or resistFingerprinting profile |
| Tor Browser | RFP profile **+ screen letterboxing** (its distinctive tell) |

### Adding a signature

Signatures are small `evaluate(signals) → Evidence[]` functions in `packages/core/src/signatures/`. Return the evidence that fired (with weights); an empty array means no match. Add fixtures to `packages/core/test/fixtures.mjs` and run `bun run test`. **PRs adding new tells — especially for Zen and other chrome-only forks — are very welcome.**

## Layout

```
packages/core   detection engine + browser signal collector (framework-free)
packages/cli    `abd` command — serve mode + UA parsing
apps/web        React/Tailwind/Motion site + shadcn registry (public/r/*.json)
```

## License

MIT — see [LICENSE](LICENSE).
