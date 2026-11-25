import { DIRS_DOWN, DIRS_UP } from '../core/board.js';

/** Men with friendly pieces diagonally behind them (supported men are harder to capture). */
export function formation(ctx, pos) {
  const { NEXT } = pos.geo, b = pos.board;
  let s = 0;
  for (let i = 0; i < ctx.nbm; i++) for (let k = 0; k < 2; k++) { const t = NEXT[ctx.bm[i] * 4 + DIRS_UP[k]]; if (t >= 0 && b[t] > 0) s++; }
  for (let i = 0; i < ctx.nwm; i++) for (let k = 0; k < 2; k++) { const t = NEXT[ctx.wm[i] * 4 + DIRS_DOWN[k]]; if (t >= 0 && b[t] < 0) s--; }
  return s;
}
