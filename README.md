# abd — Advanced Browser Detector

Identify the **real** browser behind a spoofed or shared User-Agent.

A User-Agent string is trivially faked, and whole families of browsers deliberately reuse another browser's UA: **Brave** and **Arc** ship Chrome's UA, **Zen / Floorp / Mullvad** ship Firefox's UA, and privacy builds (**LibreWolf**, **Tor Browser**) blend in on purpose. `abd` compares the UA's *claim* against **live behavioural signals** that a page can't easily fake — `userAgentData.brands`, `navigator.brave.isBrave()`, Gecko-only `navigator.oscpu`, Arc's injected CSS variable, resist-fingerprinting tells — and flags the mismatches.

- 🧠 **`@qdev.app/abd-core`** — a pure-TS detection engine (signals → ranked candidates + engine + spoof verdict)
- ⚛️ **`@qdev.app/abd-react`** — React components + `useBrowserDetection()` hook
- 🖥️ **`@abd/cli`** — `abd serve` captures a live signature from any browser you point at it; `abd "<ua>"` parses a UA offline
- 🌐 **hosted UI + API** — live demo and a metered detection API at **[abd.qdev.app](https://abd.qdev.app)**

> **Honest by design.** A fork that only restyles the browser *chrome* (e.g. stock **Zen**) leaves `navigator` untouched and is genuinely **indistinguishable from Firefox** to web content. `abd` never pretends otherwise — it reports what the signals actually support, with confidence and caveats, and the signature registry is built to grow as new tells are found.

## Quick start

Uses **[bun](https://bun.sh)** as both the package manager and the launcher.

```bash
bun install
bun run build     # build @qdev.app/abd-core and @abd/cli
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

### Discovering new signatures (`abd probe`)

Some forks (notably **Zen**) ship the Firefox UA and don't obviously alter `navigator`, so detection needs a *tell*. `abd probe` hunts for one empirically: it captures a wide net of candidate signals — every `window` global, every `--*` CSS custom property on `<html>`/`<body>`, channel-gated JS/CSS features, and chrome geometry (Zen's vertical tabs change `outerWidth − innerWidth`) — then diffs two browsers.

```bash
bun run abd probe --label firefox                 # capture in stock Firefox
bun run abd probe --label zen --compare firefox   # capture in Zen, diff vs Firefox
```

Anything that shows up as a **stable** difference (an injected global, a `--zen-*` variable, a feature only its build enables) becomes a new entry in `packages/core/src/signatures/firefox.ts`. This is exactly how Arc's `--arc-palette-title` marker was turned into a signature.

> Note: Zen's [own issue #9439 "Zen has a unique fingerprint"](https://github.com/zen-browser/desktop/issues/9439) confirms it is *not* trying to hide — it ships an unusual Firefox version, which is itself distinguishing. `abd probe` is how you find the concrete signal on your build.

### TLS / JA4 network fingerprint (`abd tls`)

The TLS ClientHello is chosen by the browser's network stack, not by page JS, so it **can't be spoofed from the web** the way a User-Agent can — ideal for catching headless bots and UA liars.

```bash
bun run tls            # builds, then runs the HTTPS server on :4443 under Node
# open https://localhost:4443 (accept the self-signed cert) or: curl -k https://localhost:4443/
```

It peeks the raw ClientHello, computes **JA4** (and JA3), then terminates TLS normally so the page still loads. Look the JA4 up in a database like [ja4db.com](https://ja4db.com) to map it to a client. (Runs under Node, not bun — bun's server-side TLS wrapping is incomplete; the `bun run tls` script handles that for you. Needs `openssl` on PATH for a throwaway dev cert.) Note: it won't separate same-engine forks — Zen and Firefox share Gecko's TLS stack.

### React components — `@qdev.app/abd-react`

```bash
npm i @qdev.app/abd-react @qdev.app/abd-core motion react
```

**Hook** — own your own UI:

```tsx
import { useBrowserDetection } from '@qdev.app/abd-react';

const { status, result } = useBrowserDetection();
// status === 'ready' ⇒ result.browser.name, result.spoofed, …
```

**`<BrowserDetector />`** — full animated detection card. **`<InstallDuo />`** — two live-detected install buttons (visitor's browser + its engine's mainstream browser); a button appears **only when you supply a link for it**, so a Zen visitor with just a Firefox link sees one Firefox button:

```tsx
import { BrowserDetector, InstallDuo } from '@qdev.app/abd-react';

<BrowserDetector onResult={(r) => console.log(r.browser.name, r.spoofed)} />
<InstallDuo links={{ chrome: '…', firefox: '…' }} />
```

The hosted demo of these lives at **[abd.qdev.app](https://abd.qdev.app)**.

## Supported browsers

The **Behind spoofed UA?** column is the point of the project: ✅ means a behavioural/structural signal identifies the browser even if its User-Agent is shared or spoofed; ⚠️ UA-token means detection relies on a distinctive UA string (fine in practice, since these don't masquerade as another browser).

<!-- BROWSERS:START (auto-generated — run `bun run docs:browsers`) -->
### Blink / Chromium

| Browser | Primary signal | Behind spoofed UA? |
| --- | --- | --- |
| **Brave** | `navigator.brave.isBrave()` + `userAgentData` brand | ✅ definitive |
| **Microsoft Edge** | `userAgentData` brand "Microsoft Edge" + `Edg/` | ✅ |
| **Opera** | brand "Opera" + `window.opr` + `OPR/` | ✅ |
| **Vivaldi** | `Vivaldi/` token (hides from brands) | ⚠️ UA-token |
| **Samsung Internet** | brand + `SamsungBrowser/` | ✅ |
| **Yandex Browser** | brand + `YaBrowser/` | ✅ |
| **Arc** | injected `--arc-palette-title` CSS variable | ✅ (behind Chrome’s UA) |
| **Google Chrome** | brand "Google Chrome" | ✅ |
| **Chromium** | brand "Chromium", no vendor brand | ✅ |

### Gecko / Firefox

| Browser | Primary signal | Behind spoofed UA? |
| --- | --- | --- |
| **Tor Browser** | RFP profile: UTC + letterboxing + timer clamp + canvas block | ✅ heuristic |
| **LibreWolf** | `LibreWolf/` token, or RFP profile | ✅ heuristic |
| **Waterfox** | `Waterfox/` token | ⚠️ UA-token |
| **Pale Moon** | `PaleMoon/` / `Goanna/` engine token | ⚠️ UA-token |
| **Floorp** | `Floorp/` token | ⚠️ UA-token |
| **Zen Browser** | floating-window edge insets + GPC (windowed) | ✅ **(behind Firefox’s UA)** |
| **Mozilla Firefox** | `oscpu`, `productSub`, `-moz-appearance`, SpiderMonkey `InternalError` | ✅ |

### WebKit

| Browser | Primary signal | Behind spoofed UA? |
| --- | --- | --- |
| **Chrome (iOS)** | `CriOS/` (engine confirmed WebKit) | ⚠️ UA-token |
| **Firefox (iOS)** | `FxiOS/` | ⚠️ UA-token |
| **Edge (iOS)** | `EdgiOS/` | ⚠️ UA-token |
| **GNOME Web (Epiphany)** | `Epiphany/` | ⚠️ UA-token |
| **Safari** | vendor "Apple" + `ApplePaySession` + `Version/` | ✅ |
<!-- BROWSERS:END -->

Beyond the browser name, detection also reports the **engine** (Blink/Gecko/WebKit, near-unspoofable), a **UA-spoof flag** (feature↔version consistency), and a **TLS/JA4** network fingerprint (`abd tls`).

## How detection works

`detect(signals)` runs three things and reconciles them:

1. **Engine detection** (`Blink` / `Gecko` / `WebKit`) — the hardest thing to fake. A Chromium build can't grow Gecko-only `navigator.oscpu`; iOS is WebKit by App-Store policy regardless of brand.
2. **Signature registry** — each browser contributes weighted *evidence*; candidates are ranked by score. See [`packages/core/src/signatures/`](packages/core/src/signatures).
3. **UA claim** — parsed naively and trusted, then compared to the winner. Disagreement ⇒ `spoofed: true`.

On top of the per-browser signatures, several cross-cutting techniques harden detection and catch spoofers:

- **Engine cross-confirmation** — V8-only `Intl.v8BreakIterator` / `Error.captureStackTrace`, SpiderMonkey's `InternalError`, and V8-vs-`fn@url` stack format make the Blink/Gecko/WebKit call near-unspoofable.
- **UA↔version consistency** ([`version.ts`](packages/core/src/version.ts)) — maps web features to the engine version they shipped in and flags a UA that under-reports its version (e.g. a UA claiming Chrome 90 while `Array.fromAsync` — Chrome 121+ — is present). Catches frozen/spoofed UAs and bots.
- **RFP / hardening measurement** — measured `performance.now()` timer resolution (Tor clamps to ~100 ms) and a canvas-readback block turn the Tor/LibreWolf heuristic into a measurement.
- **TLS / JA4** (`abd tls`) — a JS-proof network-stack fingerprint.

The strongest per-family signals:

| Browser | Tell |
| --- | --- |
| Brave | `navigator.brave.isBrave()` (unfakeable from page script) |
| Edge / Opera / Vivaldi / Samsung / Yandex | `navigator.userAgentData.brands` + UA token |
| Arc | injected `--arc-palette-title` CSS custom property |
| Firefox | `navigator.oscpu`, `productSub === "20100101"`, `-moz-appearance` |
| LibreWolf | UA token, or resistFingerprinting profile |
| Tor Browser | RFP profile **+ screen letterboxing** (its distinctive tell) |

### Adding a signature

Signatures are small `evaluate(signals) → Evidence[]` functions in `packages/core/src/signatures/`. Return the evidence that fired (with weights); an empty array means no match. Add fixtures to `packages/core/test/fixtures.mjs` and run `bun run test`. When you add a browser, also add its annotation in `scripts/gen-supported-browsers.ts` and run `bun run docs:browsers` to refresh the table above (the script fails if a signature has no annotation, so the docs can't drift). **PRs adding new tells — especially for Zen and other chrome-only forks — are very welcome.**

## Layout

```
packages/core   @qdev.app/abd-core  — detection engine + signal collector (framework-free)
packages/react  @qdev.app/abd-react — React components + useBrowserDetection() hook
packages/cli    @abd/cli            — `abd` command: serve / probe / tls / UA parsing
```

The hosted web UI and metered API live in the separate private `abd-cloud` repo (deployed to abd.qdev.app).

## License

MIT — see [LICENSE](LICENSE).
