/**
 * Endgame database interface. Lexicon ships NO endgame data: positions are only reported as solved
 * when a loaded dataset says so. Results are from the SIDE TO MOVE's point of view.
 *
 * probe(pos) -> null | { wdl: 'win' | 'draw' | 'loss', dtw: number | null }
 */
export class Tablebase {
  get name() { return 'none'; }
  get maxPieces() { return 0; }
  probe(/* pos */) { return null; }
}

export class NullTablebase extends Tablebase {}

/** Canonical key: the smaller of the position's FEN and its colour-flipped mirror (a true symmetry of checkers). */
export function canonicalKey(pos) {
  const a = pos.fen(), b = pos.flipped().fen();
  return a <= b ? a : b;
}

/**
 * In-memory tablebase loaded from JSON:
 *   { format: 'lexicon-tb-1', variant, maxPieces, entries: { "<canonical fen>": { wdl: 'win'|'draw'|'loss', dtw?: n } } }
 * where wdl is for the side to move in the canonical orientation (identical for the mirror, since the mirror also swaps the mover).
 */
export class MapTablebase extends Tablebase {
  constructor(variant, entries = {}, maxPieces = 0) {
    super();
    this.variant = variant; this.entries = new Map(Object.entries(entries)); this._max = maxPieces;
  }
  static fromJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (d.format !== 'lexicon-tb-1') throw new Error('Unsupported tablebase format');
    return new MapTablebase(d.variant, d.entries, d.maxPieces ?? 0);
  }
  get name() { return `map(${this.variant}, ${this.entries.size} entries)`; }
  get maxPieces() { return this._max; }
  probe(pos) {
    if (pos.rules.id !== this.variant) return null;
    const e = this.entries.get(canonicalKey(pos));
    return e ? { wdl: e.wdl, dtw: e.dtw ?? null } : null;
  }
}
