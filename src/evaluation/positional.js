/** Rows each man has advanced from its own back row. */
export function advancement(ctx, pos) {
  const { rowOf, size } = pos.geo;
  let s = 0;
  for (let i = 0; i < ctx.nbm; i++) s += rowOf[ctx.bm[i]];
  for (let i = 0; i < ctx.nwm; i++) s -= size - 1 - rowOf[ctx.wm[i]];
  return s;
}

/** Centrality of men. */
export function center(ctx, pos) {
  const c = pos.geo.center;
  let s = 0;
  for (let i = 0; i < ctx.nbm; i++) s += c[ctx.bm[i]];
  for (let i = 0; i < ctx.nwm; i++) s -= c[ctx.wm[i]];
  return s;
}

/** Men still on their own back row (they guard against promotion). */
export function backRank(ctx, pos) {
  const { rowOf, size } = pos.geo;
  let s = 0;
  for (let i = 0; i < ctx.nbm; i++) if (rowOf[ctx.bm[i]] === 0) s++;
  for (let i = 0; i < ctx.nwm; i++) if (rowOf[ctx.wm[i]] === size - 1) s--;
  return s;
}
