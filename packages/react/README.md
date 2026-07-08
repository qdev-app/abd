# @qdev.app/abd-react

React components + hook for the [Advanced Browser Detector](https://github.com/qdev-app/abd) — show the **real** browser behind a spoofed or shared User-Agent (Brave/Arc as Chrome, Zen as Firefox).

```bash
npm i @qdev.app/abd-react @qdev.app/abd-core motion react
```

## Hook

```tsx
import { useBrowserDetection } from '@qdev.app/abd-react';

function Banner() {
  const { status, result } = useBrowserDetection();
  if (status !== 'ready') return null;
  return <p>You're using {result.browser.name}{result.spoofed && ' (UA spoofed!)'}</p>;
}
```

## Components

```tsx
import { BrowserDetector, InstallDuo } from '@qdev.app/abd-react';

// Full animated detection card
<BrowserDetector onResult={(r) => console.log(r.browser.name, r.spoofed)} />

// Two install buttons: visitor's browser + its engine's mainstream browser.
// A button shows only if you provide a link — a Zen visitor with just a Firefox
// link sees one Firefox button.
<InstallDuo links={{ chrome: '…', firefox: '…' }} />
```

Styling uses Tailwind utility classes; bring your own Tailwind (or restyle). Animations use [Motion](https://motion.dev). MIT.
