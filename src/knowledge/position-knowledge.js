/** Combines book and tablebase lookups behind one call. */
export class PositionKnowledge {
  constructor({ book = null, tablebase = null } = {}) { this.book = book; this.tablebase = tablebase; }

  probeBook(pos, rng, legalNotations, maxPlies = 99) {
    if (!this.book || this.book.variant !== pos.rules.id) return null;
    if (pos.stack.length >= maxPlies) return null;
    return this.book.probe(pos, rng, legalNotations);
  }

  /**
   * Choose a move using tablebase results of the child positions. Returns null unless EVERY
   * child position is covered (we never pretend to know more than the data says).
   */
  tablebaseMove(pos) {
    const tb = this.tablebase;
    if (!tb || tb.maxPieces === 0) return null;
    const moves = pos.moves();
    if (!moves.length) return null;
    const rank = { loss: 3, draw: 2, win: 1 }; // child result for the opponent: their loss is our win
    let best = null;
    for (const m of moves) {
      pos.make(m);
      const r = tb.probe(pos);
      pos.unmake();
      if (!r) return null;
      const dtw = r.dtw ?? 0;
      const key = rank[r.wdl] * 1000 + (r.wdl === 'loss' ? -dtw : r.wdl === 'win' ? dtw : 0);
      if (!best || key > best.key) best = { move: m, key, wdl: r.wdl, dtw: r.dtw };
    }
    const ours = best.wdl === 'loss' ? 'win' : best.wdl === 'win' ? 'loss' : 'draw';
    return { move: best.move, wdl: ours, dtw: best.dtw };
  }
}
