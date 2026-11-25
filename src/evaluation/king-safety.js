/** Centralised kings are active; kings pinned to the rim are not. */
export function kingActivity(ctx, pos) {
  const c = pos.geo.center;
  let s = 0;
  for (let i = 0; i < ctx.nbk; i++) s += c[ctx.bk[i]];
  for (let i = 0; i < ctx.nwk; i++) s -= c[ctx.wk[i]];
  return s;
}

/** Kings on the long diagonal. */
export function diagonals(ctx, pos) {
  const d = pos.geo.mainDiag;
  let s = 0;
  for (let i = 0; i < ctx.nbk; i++) s += d[ctx.bk[i]];
  for (let i = 0; i < ctx.nwk; i++) s -= d[ctx.wk[i]];
  return s;
}
