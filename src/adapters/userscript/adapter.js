/**
 * Website-agnostic helpers for userscripts (Tampermonkey / Violentmonkey).
 * Nothing here knows about any particular site: YOUR script reads the page into a matrix and
 * decides how to display or click the result.
 *
 * matrix: array of rows, top row first (Black's side), each cell '' | 'b' | 'B' | 'w' | 'W'
 *         (b/w = men, B/W = kings). Use { flip: true } if the site draws White at the top.
 */
import { getGeometry } from '../../core/board.js';
import { getRuleset } from '../../rules/variants.js';

export function matrixToFen(matrix, { turn = 'B', variant = 'american', flip = false } = {}) {
  const rules = getRuleset(variant), g = getGeometry(rules.size);
  if (matrix.length !== g.size) throw new Error(`Expected ${g.size} rows, got ${matrix.length}`);
  const black = [], white = [];
  for (let r = 0; r < g.size; r++) {
    if (matrix[r].length !== g.size) throw new Error(`Row ${r} has ${matrix[r].length} cells, expected ${g.size}`);
    for (let c = 0; c < g.size; c++) {
      const cell = matrix[r][c];
      if (!cell) continue;
      const rr = flip ? g.size - 1 - r : r, cc = flip ? g.size - 1 - c : c;
      const num = g.sqToNum[rr * g.size + cc];
      if (!num) throw new Error(`Piece "${cell}" on a light square (row ${r}, col ${c}); check orientation / flip`);
      const label = (cell === 'B' || cell === 'W' ? 'K' : '') + num;
      if (cell === 'b' || cell === 'B') black.push([num, label]); else if (cell === 'w' || cell === 'W') white.push([num, label]);
      else throw new Error(`Unknown piece "${cell}"`);
    }
  }
  const list = (a) => a.sort((x, y) => x[0] - y[0]).map((x) => x[1]).join(',');
  return `${turn.toUpperCase()}:W${list(white)}:B${list(black)}`;
}

/** Convert a move string into [{row, col}] page coordinates (respecting `flip`) so a script can highlight or click. */
export function moveToCells(notation, { variant = 'american', flip = false } = {}) {
  const g = getGeometry(getRuleset(variant).size);
  return notation.split(/[-x]/).map(Number).map((n) => {
    const sq = g.numToSq[n];
    const row = g.rowOf[sq], col = g.colOf[sq];
    return flip ? { row: g.size - 1 - row, col: g.size - 1 - col } : { row, col };
  });
}

/** Glue: matrix in, recommended move (and cells) out. `engine` is any object with analyze() (BrowserEngine or LexiconEngine). */
export class UserscriptBridge {
  constructor(engine, { variant = 'american', flip = false } = {}) { this.engine = engine; this.variant = variant; this.flip = flip; }
  async suggest(matrix, turn, analysis = { movetime: 1000 }) {
    const fen = matrixToFen(matrix, { turn, variant: this.variant, flip: this.flip });
    const r = await this.engine.analyze({ position: fen, ...analysis });
    return { fen, bestMove: r.bestMove, score: r.score, cells: r.bestMove ? moveToCells(r.bestMove, { variant: this.variant, flip: this.flip }) : [], analysis: r };
  }
}
