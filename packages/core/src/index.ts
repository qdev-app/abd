export { detect } from './detect.js';
export { collectSignals } from './collect.js';
export { mainstreamBrowser, normalizeBrowserKey, resolveInstallTargets } from './install.js';
export type { InstallTarget, InstallTargets } from './install.js';
export { collectProbe, diffProbes } from './discover.js';
export type { Probe, ProbeDiff, DiffEntry } from './discover.js';
export { detectEngine } from './engine.js';
export { parseClaim, signalsFromUA } from './uaparse.js';
export { checkVersionConsistency } from './version.js';
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
  VersionCheck,
  Signature,
} from './types.js';
