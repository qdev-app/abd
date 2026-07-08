/** Browser name → dashboard-icons slug (served from jsDelivr). */
const SLUGS: Record<string, string> = {
  chrome: 'google-chrome',
  'google chrome': 'google-chrome',
  chromium: 'chromium',
  firefox: 'firefox',
  'mozilla firefox': 'firefox',
  brave: 'brave',
  edge: 'microsoft-edge',
  'microsoft edge': 'microsoft-edge',
  safari: 'safari',
  opera: 'opera',
  vivaldi: 'vivaldi',
  zen: 'zen-browser',
  'zen browser': 'zen-browser',
  arc: 'arc',
  'samsung internet': 'samsung-internet',
  yandex: 'yandex-browser',
  'yandex browser': 'yandex-browser',
  tor: 'tor-browser',
  'tor browser': 'tor-browser',
  librewolf: 'librewolf',
  waterfox: 'waterfox',
  floorp: 'floorp',
};

/** Icon URL for a browser name, or null if we don't have one. */
export function browserIconUrl(name: string): string | null {
  const key = name.toLowerCase().replace(/\(.*?\)/g, '').trim();
  const slug = SLUGS[key] ?? SLUGS[key.replace(/\s*browser$/, '').trim()];
  return slug ? `https://cdn.jsdelivr.net/gh/homarr-labs/dashboard-icons/svg/${slug}.svg` : null;
}
