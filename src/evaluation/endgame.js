/**
 * Low-material heuristic: when one side is ahead and few pieces remain, its kings should close in.
 * This is a heuristic only. It does NOT know theoretical draws or wins (use a tablebase for that).
 * Returns centipawn-scale units (black minus white).
 */
export function endgame(ctx, pos, params) {
  const total = ctx.nbm + ctx.nbk + ctx.nwm + ctx.nwk;
  if (total > 8 || ctx.nbm + ctx.nbk === 0 || ctx.nwm + ctx.nwk === 0) return 0;
  const mat = (ctx.nbm - ctx.nwm) + (ctx.nbk - ctx.nwk) * params.kingRatio;
  if (mat === 0) return 0;
  const hunter = mat > 0 ? 1 : -1;
  const { rowOf, colOf, size } = pos.geo;
  const mine = hunter > 0 ? ctx.bk : ctx.wk, nMine = hunter > 0 ? ctx.nbk : ctx.nwk;
  let bonus = 0;
  for (let i = 0; i < nMine; i++) {
    let best = 2 * size;
    const scan = (list, n) => {
      for (let j = 0; j < n; j++) {
        const d = Math.abs(rowOf[mine[i]] - rowOf[list[j]]) + Math.abs(colOf[mine[i]] - colOf[list[j]]);
        if (d < best) best = d;
      }
    };
    if (hunter > 0) { scan(ctx.wm, ctx.nwm); scan(ctx.wk, ctx.nwk); } else { scan(ctx.bm, ctx.nbm); scan(ctx.bk, ctx.nbk); }
    bonus += (2 * size - 2 - best) * 2;
  }
  return hunter * bonus;
}
