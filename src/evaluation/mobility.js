import { DIRS_ALL, DIRS_DOWN, DIRS_UP } from '../core/board.js';

function side(pos, list, n, dirs, flying) {
  const { NEXT } = pos.geo, b = pos.board;
  let s = 0;
  for (let i = 0; i < n; i++) {
    const sq = list[i];
    for (let k = 0; k < dirs.length; k++) {
      let t = NEXT[sq * 4 + dirs[k]], len = 0;
      while (t >= 0 && b[t] === 0) { len++; if (!flying || len >= 3) break; t = NEXT[t * 4 + dirs[k]]; }
      s += len;
    }
  }
  return s;
}

/** Empty squares reachable by simple moves (long-range kings are capped at 3 squares per ray). */
export function mobility(ctx, pos) {
  const f = pos.rules.flyingKings;
  return side(pos, ctx.bm, ctx.nbm, DIRS_DOWN, false) + side(pos, ctx.bk, ctx.nbk, DIRS_ALL, f)
       - side(pos, ctx.wm, ctx.nwm, DIRS_UP, false) - side(pos, ctx.wk, ctx.nwk, DIRS_ALL, f);
}
