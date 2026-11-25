export const TT_EXACT = 1, TT_LOWER = 2, TT_UPPER = 3;

/** Fixed-size, typed-array transposition table (always-replace with depth/age protection). */
export class TranspositionTable {
  constructor(mb = 16) { this.resize(mb); }

  resize(mb) {
    const perEntry = 4 + 4 + 4 + 4 + 1 + 1 + 1; // k1,k2,score,move,depth,flag,age
    let n = 1024;
    while (n * 2 * perEntry <= mb * 1024 * 1024) n *= 2;
    this.size = n; this.mask = n - 1;
    this.k1 = new Int32Array(n); this.k2 = new Int32Array(n);
    this.score = new Int32Array(n); this.move = new Int32Array(n);
    this.depth = new Int8Array(n); this.flag = new Uint8Array(n); this.ageArr = new Uint8Array(n);
    this.age = 0; this.used = 0;
  }

  clear() {
    this.k1.fill(0); this.k2.fill(0); this.score.fill(0); this.move.fill(0);
    this.depth.fill(0); this.flag.fill(0); this.ageArr.fill(0);
    this.age = 0; this.used = 0;
  }

  newSearch() { this.age = (this.age + 1) & 255; }

  /** Returns the slot index of a matching entry, or -1. */
  probe(h1, h2) {
    const i = h1 & this.mask;
    return this.flag[i] !== 0 && this.k1[i] === h1 && this.k2[i] === h2 ? i : -1;
  }

  store(h1, h2, depth, score, flag, move) {
    const i = h1 & this.mask;
    const occupied = this.flag[i] !== 0;
    if (occupied && (this.k1[i] !== h1 || this.k2[i] !== h2) && this.ageArr[i] === this.age && this.depth[i] > depth + 3) return;
    if (!occupied) this.used++;
    this.k1[i] = h1; this.k2[i] = h2; this.score[i] = score; this.move[i] = move;
    this.depth[i] = depth; this.flag[i] = flag; this.ageArr[i] = this.age;
  }

  /** Permille of the table in use (sampled), as reported by UCI-style "hashfull". */
  hashfull() { return Math.min(1000, Math.round((this.used / this.size) * 1000)); }
}
