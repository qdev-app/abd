import { detectEngine } from './engine.js';
import { signatures } from './signatures/index.js';
import type { Candidate, DetectionResult, Signals } from './types.js';
import { parseClaim } from './uaparse.js';
import { checkVersionConsistency } from './version.js';

/**
 * Core detection. Runs every signature against the signals, ranks the candidates,
 * determines the engine independently, and compares the winner against what the
 * User-Agent string claims — surfacing spoofing when they disagree.
 */
export function detect(signals: Signals): DetectionResult {
  const engine = detectEngine(signals);
  const claimedByUA = parseClaim(signals.userAgent);

  const scored: Candidate[] = signatures
    .map((sig) => {
      const evidence = sig.evaluate(signals);
      const score = evidence.reduce((a, e) => a + e.weight, 0);
      return { name: sig.name, engine: sig.engine, score, confidence: 0, evidence };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score);

  // Normalise confidence relative to the field.
  const total = scored.reduce((a, c) => a + c.score, 0) || 1;
  for (const c of scored) c.confidence = round2(c.score / total);

  const notes: string[] = [];
  let browser: Candidate;

  if (scored.length > 0) {
    browser = scored[0]!;
  } else {
    // No signature fired — fall back to the UA claim so we always say *something*.
    browser = {
      name: claimedByUA.name,
      engine: claimedByUA.engine,
      score: 0,
      confidence: 0,
      evidence: [{ signal: 'no behavioural signature matched — using UA claim', weight: 0 }],
    };
    notes.push('No behavioural signature matched; result is based on the User-Agent string alone.');
  }

  let spoofed = isSpoofed(browser.name, claimedByUA.name, engine.name, browser.engine);

  // UA↔feature version consistency (live signals only).
  let versionCheck: DetectionResult['versionCheck'];
  if (signals.source === 'live') {
    versionCheck = checkVersionConsistency(signals, engine.name, claimedByUA.version);
    if (!versionCheck.consistent) {
      spoofed = true;
      for (const e of versionCheck.evidence) notes.push(e.signal + '.');
    }
  }

  addContextNotes(notes, signals, browser, claimedByUA.name, engine, spoofed);

  // Zen has no unique web-content marker, so its result is always heuristic —
  // annotate it whether Zen won or is a strong runner-up.
  const zen = scored.find((c) => c.name === 'Zen Browser');
  if (browser.name === 'Zen Browser') {
    notes.push(
      'Zen match is heuristic (from default prefs + window chrome), not a unique marker — a stock Firefox with Global Privacy Control and vertical tabs enabled could look the same.',
    );
  } else if (zen) {
    notes.push(
      `Possible Zen Browser: ${zen.evidence.map((e) => e.signal).join('; ')}. These are Zen defaults, not a unique marker, so it still reports as ${browser.name}.`,
    );
  }

  return {
    browser,
    engine,
    claimedByUA,
    spoofed,
    versionCheck,
    candidates: scored,
    notes,
    source: signals.source,
  };
}

function isSpoofed(detected: string, claimed: string, detectedEngine: string, browserEngine: string): boolean {
  if (claimed === 'Unknown') return false;
  // Engine mismatch is the clearest spoof signal (very hard to fake).
  if (detectedEngine !== 'Unknown' && browserEngine !== 'Unknown' && detectedEngine !== browserEngine) return true;
  // Brand mismatch where both are known and not simple aliases.
  const norm = (n: string) => n.toLowerCase().replace(/\s*\(.*\)\s*/g, '').replace(/mozilla |google |microsoft /g, '').trim();
  const d = norm(detected);
  const c = norm(claimed);
  if (d === c) return false;
  // A UA claiming Firefox while we detect a Firefox fork isn't "spoofing" per se —
  // but it IS a hidden identity, which is exactly what we want to flag.
  return d !== c;
}

function addContextNotes(
  notes: string[],
  s: Signals,
  browser: Candidate,
  claimed: string,
  engine: { name: string; confidence: number },
  spoofed: boolean,
): void {
  if (s.source === 'ua-only') {
    notes.push(
      'UA-only mode: no live feature signals were available. Firefox forks (Zen, Floorp, Mullvad) that reuse the Firefox UA cannot be distinguished from stock Firefox this way — run `abd serve` and open the target browser for a live signature.',
    );
  }

  if (spoofed) {
    notes.push(`User-Agent claims "${claimed}", but live signals indicate "${browser.name}".`);
  }

  if (browser.name === 'Mozilla Firefox' && s.source === 'live') {
    notes.push(
      'Detected stock Firefox signals. Note: a chrome-only Firefox fork (e.g. Zen) that leaves navigator untouched is indistinguishable from Firefox to web content — absence of fork markers is not proof of stock Firefox.',
    );
  }

  if (browser.name.includes('LibreWolf') || browser.name.includes('Tor')) {
    notes.push('resistFingerprinting appears active, so many signals are deliberately generic; confidence reflects a heuristic profile, not a unique marker.');
  }

  if (engine.name !== 'Unknown' && browser.engine !== 'Unknown' && engine.name !== browser.engine) {
    notes.push(`Engine detector says ${engine.name} but the top brand is a ${browser.engine} browser — treat the brand guess with caution.`);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
