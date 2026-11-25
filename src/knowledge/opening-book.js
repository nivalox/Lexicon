/**
 * JSON opening book. Entries are keyed by the position's FEN, so a book is variant-specific.
 * No opening statistics are shipped: books/*.json start empty and only contain what you add or learn.
 *
 * Format: { format, variant, source, entries: [{ position, moves: [{ move, weight, wins, draws, losses, source? }] }] }
 */
export class OpeningBook {
  constructor(variant = 'american') {
    this.variant = variant;
    this.source = 'empty';
    this.entries = new Map();
  }

  static fromJSON(json) {
    const data = typeof json === 'string' ? JSON.parse(json) : json;
    if (data.format !== 'lexicon-book-1') throw new Error('Unsupported opening book format');
    const b = new OpeningBook(data.variant);
    b.source = data.source ?? 'unknown';
    for (const e of data.entries) b.entries.set(e.position, { position: e.position, moves: e.moves.map((m) => ({ wins: 0, draws: 0, losses: 0, ...m })) });
    return b;
  }

  toJSON() {
    return { format: 'lexicon-book-1', variant: this.variant, source: this.source, entries: [...this.entries.values()] };
  }

  get size() { return this.entries.size; }

  add(position, move, weight = 100) {
    let e = this.entries.get(position);
    if (!e) { e = { position, moves: [] }; this.entries.set(position, e); }
    const m = e.moves.find((x) => x.move === move);
    if (m) m.weight = weight; else e.moves.push({ move, weight, wins: 0, draws: 0, losses: 0 });
  }

  /** Weighted random book move among those that are legal here, or null. */
  probe(pos, rng, legalNotations) {
    const e = this.entries.get(pos.fen());
    if (!e) return null;
    const legal = new Set(legalNotations);
    const cands = e.moves.filter((m) => m.weight > 0 && legal.has(m.move));
    if (!cands.length) return null;
    let r = rng() * cands.reduce((a, m) => a + m.weight, 0);
    for (const m of cands) { r -= m.weight; if (r <= 0) return m; }
    return cands[0];
  }

  /**
   * Learn from a finished game: update win/draw/loss counts for the first `maxPlies` moves.
   * Weights are then re-derived from the counts (EXPERIMENTAL heuristic, marked source:'learned').
   * @param pos     a Position at the start of the game (it is cloned)
   * @param moves   move strings
   * @param result  'black' | 'white' | 'draw'
   */
  learnGame(pos, moves, result, maxPlies = 12) {
    const p = pos.clone();
    for (let i = 0; i < Math.min(moves.length, maxPlies); i++) {
      const key = p.fen(), mover = p.turn > 0 ? 'black' : 'white';
      const m = p.move(moves[i]);
      let e = this.entries.get(key);
      if (!e) { e = { position: key, moves: [] }; this.entries.set(key, e); }
      let rec = e.moves.find((x) => x.move === m.notation);
      if (!rec) { rec = { move: m.notation, weight: 1, wins: 0, draws: 0, losses: 0, source: 'learned' }; e.moves.push(rec); }
      if (result === 'draw') rec.draws++; else if (result === mover) rec.wins++; else rec.losses++;
      if (rec.source === 'learned') {
        const n = rec.wins + rec.draws + rec.losses;
        rec.weight = Math.max(1, Math.round((100 * (rec.wins + 0.5 * rec.draws + 1)) / (n + 2)));
      }
    }
    if (this.source === 'empty') this.source = 'learned (experimental)';
  }
}
