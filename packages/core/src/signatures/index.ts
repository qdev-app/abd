import type { Signature } from '../types.js';
import { chromiumSignatures } from './chromium.js';
import { firefoxSignatures } from './firefox.js';
import { webkitSignatures } from './webkit.js';

/** The full signature registry, ordered most-specific-first within each family. */
export const signatures: Signature[] = [...chromiumSignatures, ...firefoxSignatures, ...webkitSignatures];

export { chromiumSignatures, firefoxSignatures, webkitSignatures };
