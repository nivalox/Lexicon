import { STRENGTH_PRESETS } from './presets.js';
import { selectCandidate } from './move-selection.js';

const FULL = { evalNoise: 0, candidates: 1, margin: 0, temperature: 1, bookMaxPlies: 99 };
const OVERRIDABLE = ['maxDepth', 'timeLimit', 'nodeLimit', 'useOpeningBook', 'useTablebases', 'bookMaxPlies'];
const WEAKNESS = ['evalNoise', 'candidates', 'margin', 'temperature'];

export class StrengthManager {
  constructor(config) { this.config = config; }

  /**
   * Resolve the effective settings.
   * - level 1..8: preset + explicit overrides; `randomness` (0..1) scales the artificial weakness (default 1).
   * - level 9:   strongest configuration; artificial weakness is forced off, whatever else is set.
   * - 'custom':  level-9 baseline with every explicit field applied, including weakness fields.
   */
  resolve(cfg = this.config) {
    const level = cfg.level;
    let eff;
    if (level === 'custom') {
      eff = { ...STRENGTH_PRESETS[9], ...FULL };
      for (const k of [...OVERRIDABLE, ...WEAKNESS]) if (cfg[k] !== undefined) eff[k] = cfg[k];
      eff.name = 'Custom';
    } else {
      eff = { ...STRENGTH_PRESETS[level] };
      for (const k of OVERRIDABLE) if (cfg[k] !== undefined) eff[k] = cfg[k];
      if (level === 9) Object.assign(eff, FULL);
      else if (cfg.randomness !== undefined) {
        const s = cfg.randomness;
        eff.evalNoise = Math.round(eff.evalNoise * s); eff.margin = Math.round(eff.margin * s);
        if (s === 0) { eff.candidates = 1; }
      }
    }
    if (eff.useTablebases === undefined) eff.useTablebases = true;
    eff.level = level;
    eff.artificialWeakness = eff.evalNoise > 0 || (eff.candidates > 1 && eff.margin > 0);
    return eff;
  }

  select(candidates, rng, eff) { return selectCandidate(candidates, rng, eff); }
}
