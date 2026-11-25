import { MAX_PLY } from '../utils/constants.js';
import { moveKey } from '../core/move.js';

/**
 * Orders moves: TT move > captures (by pieces taken) > promotions > killers > history > centrality.
 * In checkers captures are mandatory, so among captures we only rank by material taken;
 * a "winning capture" test (SEE) is not meaningful when every legal move is a capture.
 */
export class MoveOrderer {
  constructor(nSquares, { killers = true, history = true } = {}) {
    this.n = nSquares;
    this.useKillers = killers; this.useHistory = history;
    this.killers = new Int32Array(MAX_PLY * 2);
    this.history = new Int32Array(2 * nSquares * nSquares);
  }

  reset() { this.killers.fill(0); this.history.fill(0); }

  order(moves, ply, ttKey, color, geo) {
    const n = this.n, hOff = color > 0 ? 0 : n * n;
    const k0 = this.killers[ply * 2], k1 = this.killers[ply * 2 + 1];
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i], key = moveKey(m);
      let s;
      if (ttKey && key === ttKey) s = 1e7;
      else if (m.caps.length) {
        s = 1e6 + m.caps.length * 1000;
        for (let j = 0; j < m.capPieces.length; j++) if (m.capPieces[j] === 2 || m.capPieces[j] === -2) s += 500;
      } else if (m.promotes) s = 9e5;
      else if (this.useKillers && key === k0) s = 8e5;
      else if (this.useKillers && key === k1) s = 7.9e5;
      else s = (this.useHistory ? this.history[hOff + m.from * n + m.to] : 0) + geo.center[m.to];
      m.score = s;
    }
    moves.sort((a, b) => b.score - a.score);
  }

  recordCutoff(m, ply, depth, color) {
    if (m.caps.length) return;
    const key = moveKey(m);
    if (this.useKillers && this.killers[ply * 2] !== key) { this.killers[ply * 2 + 1] = this.killers[ply * 2]; this.killers[ply * 2] = key; }
    if (this.useHistory) {
      const i = (color > 0 ? 0 : this.n * this.n) + m.from * this.n + m.to;
      this.history[i] += depth * depth;
      if (this.history[i] > 500000) for (let j = 0; j < this.history.length; j++) this.history[j] >>= 1;
    }
  }
}
