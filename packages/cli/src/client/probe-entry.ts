/// <reference lib="dom" />
import { collectProbe } from '@abd/core';

/** Collects an expanded discovery probe and ships it to the CLI. */
async function main() {
  const status = document.getElementById('status')!;
  try {
    status.textContent = 'Collecting expanded probe…';
    const probe = collectProbe();
    // Behavioural probe: does sendBeacon work? (beacon.enabled off ⇒ returns false / never arrives)
    try {
      probe.beaconReturned = navigator.sendBeacon('/beacon-probe', 'abd');
    } catch {
      probe.beaconReturned = false;
    }
    await new Promise((r) => setTimeout(r, 300)); // let the beacon reach the server first
    await fetch('/probe', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(probe),
    });
    status.textContent = 'Probe captured — see your terminal. You can close this tab.';
    document.getElementById('out')!.textContent =
      `${probe.globals.length} globals · ${Object.keys(probe.rootCssVars).length} :root vars · ${Object.keys(probe.bodyCssVars).length} :body vars captured.`;
  } catch (err) {
    status.textContent = 'Error: ' + (err instanceof Error ? err.message : String(err));
  }
}

main();
