'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import type { DetectionResult } from '@qdev.app/abd-core';
import { useBrowserDetection } from './use-browser-detection.js';

export interface BrowserDetectorProps {
  /** Called once detection completes. */
  onResult?: (result: DetectionResult) => void;
  /** Extra classes for the outer card. */
  className?: string;
}

/**
 * Drop-in widget that identifies the *real* browser it is running in — including
 * ones that spoof or share a User-Agent (Brave/Arc as Chrome, Firefox forks) —
 * by reading live behavioural signals, not just the UA string.
 */
export function BrowserDetector({ onResult, className }: BrowserDetectorProps) {
  const state = useBrowserDetection();

  React.useEffect(() => {
    if (state.status === 'ready') onResult?.(state.result);
  }, [state, onResult]);

  return (
    <div
      className={
        'relative w-full max-w-xl overflow-hidden rounded-2xl border border-black/10 bg-white/70 p-6 shadow-xl backdrop-blur-md dark:border-white/10 dark:bg-white/5 ' +
        (className ?? '')
      }
    >
      <AnimatePresence mode="wait">
        {state.status === 'loading' && (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-6 text-sm text-neutral-500">
            <Spinner /> Reading live browser signals…
          </motion.div>
        )}
        {state.status === 'error' && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="py-6 text-sm text-red-500">
            Detection failed: {state.error}
          </motion.div>
        )}
        {state.status === 'ready' && <Result key="ready" result={state.result} />}
      </AnimatePresence>
    </div>
  );
}

function Result({ result }: { result: DetectionResult }) {
  const confidence = Math.round(result.browser.confidence * 100);
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ type: 'spring', stiffness: 260, damping: 24 }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">You are using</p>
          <motion.h2
            className="mt-1 bg-gradient-to-br from-neutral-900 to-neutral-500 bg-clip-text text-4xl font-bold text-transparent dark:from-white dark:to-neutral-400"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 300, damping: 18, delay: 0.05 }}
          >
            {result.browser.name}
          </motion.h2>
          <p className="mt-1 text-sm text-neutral-500">
            {result.engine.name} engine{result.source === 'live' ? ' · live signature' : ' · UA only'}
          </p>
        </div>
        <SpoofBadge spoofed={result.spoofed} />
      </div>

      <div className="mt-5">
        <div className="mb-1 flex justify-between text-xs text-neutral-400">
          <span>Confidence</span>
          <span>{confidence}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-white/10">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500"
            initial={{ width: 0 }}
            animate={{ width: `${confidence}%` }}
            transition={{ type: 'spring', stiffness: 120, damping: 20, delay: 0.15 }}
          />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
        <Field label="UA claims" value={`${result.claimedByUA.name}${result.claimedByUA.version ? ' ' + result.claimedByUA.version : ''}`} />
        <Field label="Engine" value={result.engine.name} />
      </dl>

      {result.browser.evidence.length > 0 && (
        <motion.ul className="mt-5 space-y-1.5" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.05, delayChildren: 0.2 } } }}>
          <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Evidence</p>
          {result.browser.evidence.map((e, i) => (
            <motion.li key={i} variants={{ hidden: { opacity: 0, x: -8 }, show: { opacity: 1, x: 0 } }} className="flex items-center gap-2 text-sm text-neutral-600 dark:text-neutral-300">
              <span className="text-emerald-500">✓</span>
              <span>{e.signal}</span>
            </motion.li>
          ))}
        </motion.ul>
      )}

      {result.notes.length > 0 && (
        <div className="mt-5 space-y-2 rounded-xl bg-amber-500/10 p-3 text-xs leading-relaxed text-amber-700 dark:text-amber-300">
          {result.notes.map((n, i) => (
            <p key={i}>{n}</p>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function SpoofBadge({ spoofed }: { spoofed: boolean }) {
  return (
    <motion.span
      initial={{ scale: 0.6, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.1 }}
      className={'shrink-0 rounded-full px-3 py-1 text-xs font-semibold ' + (spoofed ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400')}
    >
      {spoofed ? '⚠ UA mismatch' : '✓ consistent'}
    </motion.span>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-black/[0.03] p-3 dark:bg-white/[0.04]">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="mt-0.5 font-medium text-neutral-800 dark:text-neutral-100">{value}</dd>
    </div>
  );
}

function Spinner() {
  return <motion.span className="inline-block h-4 w-4 rounded-full border-2 border-neutral-300 border-t-indigo-500" animate={{ rotate: 360 }} transition={{ repeat: Infinity, ease: 'linear', duration: 0.8 }} />;
}

export default BrowserDetector;
