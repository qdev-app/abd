import * as React from 'react';
import { motion } from 'motion/react';
import type { DetectionResult } from '@qdev-app/abd-core';
import { BrowserDetector } from './registry/browser-detector';
import { InstallDuo } from './registry/install-duo';

// Example: your extension's install links, keyed by browser. Only browsers you
// list here get a button — omit Zen and its Firefox link still shows.
const INSTALL_LINKS = {
  chrome: 'https://chromewebstore.google.com/',
  firefox: 'https://addons.mozilla.org/firefox/',
  edge: 'https://microsoftedge.microsoft.com/addons/',
  safari: 'https://apps.apple.com/',
};

export default function App() {
  const [result, setResult] = React.useState<DetectionResult | null>(null);

  return (
    <main className="mx-auto flex min-h-dvh max-w-3xl flex-col items-center gap-10 px-6 py-16">
      <motion.header
        className="text-center"
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 22 }}
      >
        <span className="inline-block rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-neutral-500 dark:border-white/15">
          open source · MIT
        </span>
        <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-5xl">Advanced Browser Detector</h1>
        <p className="mx-auto mt-3 max-w-xl text-balance text-neutral-500">
          Identifies the real browser behind a spoofed or shared User-Agent — Brave and Arc hiding as Chrome, Firefox
          forks, resist-fingerprinting builds — using live behavioural signals, not just the UA string.
        </p>
      </motion.header>

      <BrowserDetector onResult={setResult} />

      <motion.section
        className="flex w-full flex-col items-center gap-3 text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.25 }}
      >
        <p className="text-xs font-medium uppercase tracking-wider text-neutral-400">Install for your browser</p>
        <InstallDuo
          links={INSTALL_LINKS}
          result={result ?? undefined}
          emptyState={<p className="text-sm text-neutral-400">No install link configured for your browser or its engine.</p>}
        />
      </motion.section>

      <motion.section
        className="grid w-full gap-4 sm:grid-cols-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <InstallCard
          title="Use the CLI"
          subtitle="UA parsing + live capture"
          code={'npx @abd/cli serve --once\n# then open the browser you want to identify'}
        />
        <InstallCard
          title="Add the widget"
          subtitle="shadcn registry component"
          code={'npx shadcn@latest add \\\n  https://<your-host>/r/browser-detector.json'}
        />
      </motion.section>

      {result?.spoofed && (
        <motion.p
          className="text-center text-sm text-red-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          Heads up: your User-Agent claims “{result.claimedByUA.name}”, but your live signals say “{result.browser.name}”.
        </motion.p>
      )}

      <footer className="mt-auto pt-8 text-center text-xs text-neutral-400">
        Built with <code>@qdev-app/abd-core</code> · React · Tailwind · Motion
      </footer>
    </main>
  );
}

function InstallCard({ title, subtitle, code }: { title: string; subtitle: string; code: string }) {
  return (
    <div className="rounded-2xl border border-black/10 bg-white/60 p-5 backdrop-blur-sm dark:border-white/10 dark:bg-white/5">
      <p className="font-semibold">{title}</p>
      <p className="text-xs text-neutral-400">{subtitle}</p>
      <pre className="mt-3 overflow-x-auto rounded-lg bg-neutral-900 p-3 text-xs leading-relaxed text-neutral-100">
        <code>{code}</code>
      </pre>
    </div>
  );
}
