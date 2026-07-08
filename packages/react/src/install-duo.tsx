'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { resolveInstallTargets, type DetectionResult, type InstallTarget } from '@qdev.app/abd-core';
import { useBrowserDetection } from './use-browser-detection.js';

export interface InstallDuoProps {
  /** Map of browser → install URL. Only browsers you list here get a button. */
  links: Record<string, string>;
  /** Reuse an existing detection result instead of detecting again. */
  result?: DetectionResult;
  /** Customise button text. Default: "Install for {browser}". */
  labelFor?: (target: InstallTarget) => string;
  /** Rendered when no link matches the visitor's browser or its engine. */
  emptyState?: React.ReactNode;
  className?: string;
  onResult?: (result: DetectionResult) => void;
}

/**
 * Two install buttons driven by live detection: a **primary** for the visitor's
 * browser and a **secondary** for the mainstream browser of its engine (Chrome
 * for Blink, Firefox for Gecko, Safari for WebKit). A button appears only when a
 * link is provided — so a Zen visitor with just a Firefox link sees one Firefox
 * button.
 */
export function InstallDuo({ links, result: resultProp, labelFor, emptyState, className, onResult }: InstallDuoProps) {
  const detected = useBrowserDetection();
  const result = resultProp ?? (detected.status === 'ready' ? detected.result : null);

  React.useEffect(() => {
    if (!resultProp && detected.status === 'ready') onResult?.(detected.result);
  }, [resultProp, detected, onResult]);

  const targets = React.useMemo(() => (result ? resolveInstallTargets(result, links) : null), [result, links]);
  const label = labelFor ?? ((t: InstallTarget) => `Install for ${t.browser}`);
  const hasAny = !!(targets && (targets.current || targets.mainstream));

  return (
    <div className={'flex flex-wrap items-center gap-3 ' + (className ?? '')}>
      <AnimatePresence mode="popLayout">
        {targets?.current && <InstallButton key={'cur-' + targets.current.url} target={targets.current} label={label(targets.current)} variant="primary" delay={0} />}
        {targets?.mainstream && <InstallButton key={'ms-' + targets.mainstream.url} target={targets.mainstream} label={label(targets.mainstream)} variant="secondary" delay={0.06} />}
      </AnimatePresence>
      {result && !hasAny && emptyState}
    </div>
  );
}

function InstallButton({ target, label, variant, delay }: { target: InstallTarget; label: string; variant: 'primary' | 'secondary'; delay: number }) {
  const base = 'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400';
  const styles =
    variant === 'primary'
      ? 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg shadow-indigo-500/20 hover:brightness-110'
      : 'border border-black/10 bg-white/60 text-neutral-700 hover:bg-white dark:border-white/15 dark:bg-white/5 dark:text-neutral-200 dark:hover:bg-white/10';
  return (
    <motion.a
      href={target.url}
      target="_blank"
      rel="noopener noreferrer"
      className={base + ' ' + styles}
      initial={{ opacity: 0, y: 8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.96 }}
      transition={{ type: 'spring', stiffness: 320, damping: 22, delay }}
      whileHover={{ y: -1 }}
      whileTap={{ scale: 0.97 }}
    >
      <DownloadIcon />
      {label}
    </motion.a>
  );
}

function DownloadIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 21h16" />
    </svg>
  );
}

export default InstallDuo;
