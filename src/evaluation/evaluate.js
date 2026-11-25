import { makeContext, scan } from './context.js';
import { material } from './material.js';
import { advancement, center, backRank } from './positional.js';
import { mobility } from './mobility.js';
import { kingActivity, diagonals } from './king-safety.js';
import { formation } from './formations.js';
import { promotionThreat } from './promotion.js';
import { endgame } from './endgame.js';

const FEATURES = { material, advancement, center, backRank, mobility, kingActivity, diagonals, formation, promotionThreat, endgame };
const POSITIONAL = ['advancement', 'center', 'backRank', 'formation'];
// Symmetric rounding keeps evaluation exactly invariant under colour flips.
const rnd = (x) => (x < 0 ? -Math.round(-x) : Math.round(x));

/**
 * Score convention: centipawns (100 = one man) from the point of view of the SIDE TO MOVE.
 * Features can be switched on/off and re-weighted through the evaluation config.
 */
export class Evaluator {
  constructor(rules, config) {
    this.rules = rules;
    this.noise = 0;
    this.noiseSeed = 0;
    this.ctx = null;
    this.configure(config);
  }

  configure(config) {
    this.config = config;
    const flying = this.rules.flyingKings;
    this.params = { kingRatio: config.kingRatio ?? (flying ? 3.0 : 1.6) };
    this.active = Object.entries(config.features)
      .filter(([name, f]) => f.enabled && FEATURES[name])
      .map(([name, f]) => ({ name, fn: FEATURES[name], wo: f.opening, we: f.endgame }));
    this.tempo = config.tempo ?? 0;
    this.startPieces = 2 * this.rules.startRows * (this.rules.size / 2);
  }

  /** Deterministic, position-based evaluation noise (used for weaker strength levels). */
  setNoise(amplitude, seed = 0) { this.noise = amplitude | 0; this.noiseSeed = seed | 0; }

  _prep(pos) {
    if (!this.ctx || this.ctx.bm.length !== pos.geo.n) this.ctx = makeContext(pos.geo.n);
    scan(pos, this.ctx);
    const c = this.ctx, total = c.nbm + c.nbk + c.nwm + c.nwk;
    const phase = Math.min(1, Math.max(0, (total - 4) / Math.max(1, this.startPieces - 4)));
    return { c, phase };
  }

  evaluate(pos) {
    const { c, phase } = this._prep(pos);
    let sum = 0;
    for (let i = 0; i < this.active.length; i++) {
      const f = this.active[i];
      sum += f.fn(c, pos, this.params) * (f.we + (f.wo - f.we) * phase);
    }
    let score = rnd(sum) * pos.turn + this.tempo;
    if (this.noise) score += (((pos.h1 ^ this.noiseSeed) >>> 0) % (2 * this.noise + 1)) - this.noise;
    return score;
  }

  /** Explainable breakdown, all numbers from the side to move's point of view (noise excluded). */
  evaluateDetailed(pos) {
    const { c, phase } = this._prep(pos);
    const out = {};
    let total = 0;
    for (const f of this.active) {
      const v = (rnd(f.fn(c, pos, this.params) * (f.we + (f.wo - f.we) * phase)) * pos.turn) || 0; // || 0 normalises -0
      out[f.name] = v;
      total += v;
    }
    out.position = POSITIONAL.reduce((a, k) => a + (out[k] || 0), 0);
    out.tempo = this.tempo;
    out.total = total + this.tempo;
    out.phase = Math.round(phase * 100) / 100;
    return out;
  }
}
