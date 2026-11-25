import { BLACK, WHITE } from '../utils/constants.js';
import { getGeometry } from './board.js';
import { getZobrist, pieceIndex } from './hashing.js';
import { generateMoves } from './move-generator.js';
import { findMove } from './notation.js';
import { getRuleset } from '../rules/variants.js';

/**
 * Position = board + side to move + counters + reversible history.
 * FEN-like format (PDN style):  "B:W21,22,K23:B1,2,K3"  → side to move : White pieces : Black pieces
 */
export class Position {
  constructor(rules = 'american', fen = 'startpos') {
    this.rules = getRuleset(rules);
    this.geo = getGeometry(this.rules.size);
    this.board = new Int8Array(this.geo.n);
    this.turn = this.rules.firstTurn;
    this.half = 0;      // plies since the last capture or man move
    this.h1 = 0; this.h2 = 0;
    this.hist = [];     // position keys, for repetition
    this.stack = [];    // undo records
    this.setFen(fen);
  }

  // ── serialization ──

  startFen() {
    const g = this.geo, r = this.rules, k = r.startRows * g.half;
    const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i).join(',');
    return `${r.firstMove === 'black' ? 'B' : 'W'}:W${range(g.squares - k + 1, g.squares)}:B${range(1, k)}`;
  }

  setFen(fen) {
    if (!fen || fen.trim().toLowerCase() === 'startpos') fen = this.startFen();
    const g = this.geo;
    const parts = fen.trim().replace(/\.$/, '').split(':');
    const side = (parts[0] || '').trim().toUpperCase();
    if (side !== 'B' && side !== 'W') throw new Error(`Bad FEN (side to move): ${fen}`);
    this.board.fill(0);
    for (const part of parts.slice(1)) {
      const t = part.trim();
      if (!t) continue;
      const c = t[0].toUpperCase();
      if (c !== 'B' && c !== 'W') throw new Error(`Bad FEN section: ${part}`);
      const color = c === 'B' ? BLACK : WHITE;
      for (const raw of t.slice(1).split(',')) {
        const item = raw.trim();
        if (!item) continue;
        const king = item[0].toUpperCase() === 'K';
        const n = parseInt(king ? item.slice(1) : item, 10);
        if (!(n >= 1 && n <= g.squares)) throw new Error(`Bad square "${item}" in FEN`);
        const sq = g.numToSq[n];
        if (this.board[sq] !== 0) throw new Error(`Square ${n} occupied twice in FEN`);
        this.board[sq] = color * (king ? 2 : 1);
      }
    }
    this.turn = side === 'B' ? BLACK : WHITE;
    this.half = 0;
    this.stack = [];
    this.rehash();
    this.hist = [this.key()];
    return this;
  }

  fen() {
    const g = this.geo;
    const list = (color) => {
      const out = [];
      for (let n = 1; n <= g.squares; n++) {
        const p = this.board[g.numToSq[n]];
        if (p * color > 0) out.push((Math.abs(p) === 2 ? 'K' : '') + n);
      }
      return out.join(',');
    };
    return `${this.turn === BLACK ? 'B' : 'W'}:W${list(WHITE)}:B${list(BLACK)}`;
  }

  /** Returns a list of problems; empty means the position is structurally valid. */
  validate() {
    const g = this.geo, errs = [];
    const max = this.rules.startRows * g.half;
    const cnt = { b: 0, w: 0 };
    for (let sq = 0; sq < g.n; sq++) {
      const p = this.board[sq];
      if (!p) continue;
      if (p > 0) cnt.b++; else cnt.w++;
      if (p === 1 && g.rowOf[sq] === g.size - 1) errs.push(`black man on its promotion row (${g.sqToNum[sq]})`);
      if (p === -1 && g.rowOf[sq] === 0) errs.push(`white man on its promotion row (${g.sqToNum[sq]})`);
    }
    if (cnt.b > max) errs.push(`too many black pieces (${cnt.b} > ${max})`);
    if (cnt.w > max) errs.push(`too many white pieces (${cnt.w} > ${max})`);
    return errs;
  }

  clone() {
    const p = new Position(this.rules, 'startpos');
    p.board.set(this.board);
    p.turn = this.turn; p.half = this.half; p.h1 = this.h1; p.h2 = this.h2;
    p.hist = this.hist.slice();
    return p;
  }

  /** Mirror image: colours swapped, board rotated 180°, side to move swapped. Evaluation must be invariant. */
  flipped() {
    const p = new Position(this.rules, 'startpos');
    const n = this.geo.n;
    for (let sq = 0; sq < n; sq++) p.board[n - 1 - sq] = -this.board[sq];
    p.turn = -this.turn; p.half = this.half;
    p.rehash(); p.hist = [p.key()];
    return p;
  }

  equals(o) {
    if (this.rules.id !== o.rules.id || this.turn !== o.turn) return false;
    for (let i = 0; i < this.board.length; i++) if (this.board[i] !== o.board[i]) return false;
    return true;
  }

  // ── hashing ──

  rehash() {
    const { Z1, Z2, T1, T2 } = getZobrist(this.geo.size);
    const n = this.geo.n;
    let h1 = 0, h2 = 0;
    for (let sq = 0; sq < n; sq++) {
      const p = this.board[sq];
      if (p) { const i = pieceIndex(p) * n + sq; h1 ^= Z1[i]; h2 ^= Z2[i]; }
    }
    if (this.turn === WHITE) { h1 ^= T1; h2 ^= T2; }
    this.h1 = h1; this.h2 = h2;
  }

  key() { return (this.h1 >>> 0) + (this.h2 & 0x1fffff) * 4294967296; }

  // ── moves ──

  moves() { return generateMoves(this); }

  make(m) {
    const b = this.board, n = this.geo.n;
    const { Z1, Z2, T1, T2 } = getZobrist(this.geo.size);
    const p = b[m.from];
    this.stack.push({ m, p, half: this.half, h1: this.h1, h2: this.h2 });
    let i = pieceIndex(p) * n + m.from;
    this.h1 ^= Z1[i]; this.h2 ^= Z2[i];
    b[m.from] = 0;
    for (let k = 0; k < m.caps.length; k++) {
      const sq = m.caps[k];
      i = pieceIndex(m.capPieces[k]) * n + sq;
      this.h1 ^= Z1[i]; this.h2 ^= Z2[i];
      b[sq] = 0;
    }
    const np = m.promotes ? p * 2 : p;
    i = pieceIndex(np) * n + m.to;
    this.h1 ^= Z1[i]; this.h2 ^= Z2[i];
    b[m.to] = np;
    this.h1 ^= T1; this.h2 ^= T2;
    this.half = m.caps.length || p === 1 || p === -1 ? 0 : this.half + 1;
    this.turn = -this.turn;
    this.hist.push(this.key());
  }

  unmake() {
    const u = this.stack.pop();
    if (!u) return null;
    const m = u.m, b = this.board;
    b[m.to] = 0;
    b[m.from] = u.p;
    for (let k = 0; k < m.caps.length; k++) b[m.caps[k]] = m.capPieces[k];
    this.turn = -this.turn;
    this.half = u.half;
    this.h1 = u.h1; this.h2 = u.h2;
    this.hist.pop();
    return m;
  }

  /** Validate and play a move (string, {from,to}, or Move). Returns the Move played. */
  move(input) {
    const legal = this.moves();
    const m = input && input.path && input.caps ? legal.find((x) => x.from === input.from && x.to === input.to && x.caps.length === input.caps.length && x.path.every((s, i) => s === input.path[i])) : findMove(this, input, legal);
    if (!m) throw new Error(`Illegal move: ${String(input)}`);
    this.make(m);
    return m;
  }

  undo() { return this.unmake(); }

  // ── status / draws ──

  _onlyKings() {
    const b = this.board;
    for (let i = 0; i < b.length; i++) if (b[i] === 1 || b[i] === -1) return false;
    return true;
  }

  /** Cheap draw test for search: no-progress rules plus 2-fold repetition inside the reversible window. */
  isDrawnForSearch() {
    const r = this.rules;
    if (r.noProgressPlies && this.half >= r.noProgressPlies) return true;
    if (r.kingsOnlyPlies && this.half >= r.kingsOnlyPlies && this._onlyKings()) return true;
    if (r.repetitionCount) {
      const h = this.hist, cur = h[h.length - 1];
      const stop = Math.max(0, h.length - 1 - this.half);
      for (let i = h.length - 3; i >= stop; i -= 2) if (h[i] === cur) return true;
    }
    return false;
  }

  repetitions() {
    const h = this.hist, cur = h[h.length - 1];
    let c = 0;
    for (let i = h.length - 1; i >= 0; i -= 2) if (h[i] === cur) c++;
    return c;
  }

  /** Game result from the rules' point of view. */
  status() {
    const r = this.rules;
    if (this.moves().length === 0) {
      return { over: true, winner: this.turn === BLACK ? 'white' : 'black', reason: 'no legal moves' };
    }
    if (r.noProgressPlies && this.half >= r.noProgressPlies) return { over: true, winner: 'draw', reason: 'no-progress rule' };
    if (r.kingsOnlyPlies && this.half >= r.kingsOnlyPlies && this._onlyKings()) return { over: true, winner: 'draw', reason: 'kings-only no-progress rule' };
    if (r.repetitionCount && this.repetitions() >= r.repetitionCount) return { over: true, winner: 'draw', reason: 'repetition' };
    return { over: false, winner: null, reason: null };
  }

  countPieces() {
    const c = { blackMen: 0, blackKings: 0, whiteMen: 0, whiteKings: 0 };
    for (let i = 0; i < this.board.length; i++) {
      const p = this.board[i];
      if (p === 1) c.blackMen++; else if (p === 2) c.blackKings++;
      else if (p === -1) c.whiteMen++; else if (p === -2) c.whiteKings++;
    }
    return c;
  }

  ascii({ numbers = false } = {}) {
    const g = this.geo, ch = { 1: 'b', 2: 'B', '-1': 'w', '-2': 'W' };
    const cell = numbers ? 4 : 2;
    const lines = [];
    for (let r = 0; r < g.size; r++) {
      let line = '';
      for (let c = 0; c < g.size; c++) {
        const sq = r * g.size + c;
        if (!g.dark[sq]) { line += ' '.repeat(cell); continue; }
        const p = this.board[sq];
        const s = p ? ch[p] : numbers ? String(g.sqToNum[sq]) : '.';
        line += s.padEnd(cell);
      }
      lines.push(line.replace(/\s+$/, ''));
    }
    return lines.join('\n');
  }
}
