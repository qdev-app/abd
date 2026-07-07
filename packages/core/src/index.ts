export { detect } from './detect.js';
export { collectSignals } from './collect.js';
export { mainstreamBrowser, normalizeBrowserKey, resolveInstallTargets } from './install.js';
export type { InstallTarget, InstallTargets } from './install.js';
export { detectEngine } from './engine.js';
export { parseClaim, signalsFromUA } from './uaparse.js';
export { signatures, chromiumSignatures, firefoxSignatures, webkitSignatures } from './signatures/index.js';
export type {
  Signals,
  SignalSource,
  UaData,
  ScreenInfo,
  EngineName,
  Evidence,
  Candidate,
  EngineResult,
  ClaimedByUA,
  DetectionResult,
  Signature,
} from './types.js';
