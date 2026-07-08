# @qdev.app/abd-core

Framework-free engine for the [Advanced Browser Detector](https://github.com/qdev-app/abd) — identify the **real** browser behind a spoofed or shared User-Agent (Brave/Arc as Chrome, Zen as Firefox, RFP builds), plus rendering engine and a UA-spoof verdict.

```bash
npm i @qdev.app/abd-core
```

## Usage

**In the browser** — collect live signals and detect:

```ts
import { collectSignals, detect } from '@qdev.app/abd-core';

const result = detect(await collectSignals());
// { browser, engine, spoofed, candidates, notes, ... }
console.log(result.browser.name, result.spoofed);
```

**Anywhere** — from a User-Agent string (can't see behind shared/spoofed UAs, but cheap):

```ts
import { detect, signalsFromUA } from '@qdev.app/abd-core';

detect(signalsFromUA(navigator.userAgent));
```

## API

- `collectSignals(): Promise<Signals>` — gather live browser signals (browser only)
- `detect(signals: Signals): DetectionResult` — rank candidates, detect engine, flag spoofing
- `signalsFromUA(ua: string): Signals` — minimal signals from a UA string
- `detectEngine`, `parseClaim`, `checkVersionConsistency`, `resolveInstallTargets`, `collectProbe`, `diffProbes` — lower-level helpers

Full docs, CLI, and the signature registry: **[github.com/qdev-app/abd](https://github.com/qdev-app/abd)**.

MIT
