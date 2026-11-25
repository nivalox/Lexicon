import { DIRS_DOWN, DIRS_UP } from '../core/board.js';

/** Men one step from promotion with at least one empty promotion square ahead. */
export function promotionThreat(ctx, pos) {
  const { NEXT, rowOf, size } = pos.geo, b = pos.board;
  let s = 0;
  for (let i = 0; i < ctx.nbm; i++) {
    const sq = ctx.bm[i];
    if (rowOf[sq] !== size - 2) continue;
    for (let k = 0; k < 2; k++) { const t = NEXT[sq * 4 + DIRS_DOWN[k]]; if (t >= 0 && b[t] === 0) { s++; break; } }
  }
  for (let i = 0; i < ctx.nwm; i++) {
    const sq = ctx.wm[i];
    if (rowOf[sq] !== 1) continue;
    for (let k = 0; k < 2; k++) { const t = NEXT[sq * 4 + DIRS_UP[k]]; if (t >= 0 && b[t] === 0) { s--; break; } }
  }
  return s;
}
