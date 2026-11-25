import { BrowserEngine } from './browser-engine.js';
import { LexiconEngine as CoreEngine } from '../../core/engine.js';

/** Worker-backed engine (recommended in pages and extensions). */
export const LexiconEngine = BrowserEngine;

/**
 * createEngine({ inline: true }) runs the engine on the main thread (no Worker); useful for tests or
 * environments where module workers are unavailable. Search yields between iterations but can still
 * cause jank for long analyses.
 */
export async function createEngine({ inline = false, ...cfg } = {}) {
  const e = inline ? new CoreEngine(cfg.options || {}) : new BrowserEngine(cfg);
  await e.initialize();
  return e;
}
