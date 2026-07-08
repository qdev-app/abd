import * as React from 'react';
import { collectSignals, detect, type DetectionResult } from '@qdev.app/abd-core';

export type BrowserDetectionState =
  | { status: 'loading'; result: null; error: null }
  | { status: 'ready'; result: DetectionResult; error: null }
  | { status: 'error'; result: null; error: string };

/**
 * Detect the real browser this component is running in — including ones that
 * spoof or share a User-Agent (Brave/Arc as Chrome, Zen as Firefox) — by reading
 * live behavioural signals. Runs once on mount.
 *
 * ```tsx
 * const { status, result } = useBrowserDetection();
 * if (status === 'ready') console.log(result.browser.name, result.spoofed);
 * ```
 */
export function useBrowserDetection(): BrowserDetectionState {
  const [state, setState] = React.useState<BrowserDetectionState>({ status: 'loading', result: null, error: null });

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = detect(await collectSignals());
        if (!cancelled) setState({ status: 'ready', result, error: null });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', result: null, error: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
