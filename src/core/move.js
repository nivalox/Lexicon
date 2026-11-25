export class Move {
  /**
   * @param geo        board geometry (for notation)
   * @param from,to    internal square indices
   * @param path       every square visited, including from and to
   * @param caps       internal indices of captured pieces
   * @param capPieces  piece codes of the captured pieces (parallel to caps)
   * @param promotes   true if the moving man is crowned by this move
   */
  constructor(geo, from, to, path, caps, capPieces, promotes) {
    this.geo = geo;
    this.from = from;
    this.to = to;
    this.path = path;
    this.caps = caps;
    this.capPieces = capPieces;
    this.promotes = promotes;
    this.score = 0; // scratch value used by move ordering
  }
  get isCapture() { return this.caps.length > 0; }
  /** Playable-square numbers visited by the move. */
  get squares() { return this.path.map((s) => this.geo.sqToNum[s]); }
  /** "11-15" for a step, "22x15x8" for captures (squares where the piece lands). */
  get notation() { return this.squares.join(this.caps.length ? 'x' : '-'); }
  toJSON() {
    const g = this.geo;
    return {
      from: g.sqToNum[this.from],
      to: g.sqToNum[this.to],
      captures: this.caps.map((s) => g.sqToNum[s]),
      promotes: this.promotes,
      notation: this.notation,
    };
  }
  toString() { return this.notation; }
}

/** Compact integer identity used by the transposition table and move ordering. */
export const moveKey = (m) => m.from | (m.to << 7) | ((m.caps.length ? m.caps[0] : 0) << 14) | ((m.caps.length & 15) << 21);
