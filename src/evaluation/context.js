/** One pass over the board builds piece lists that every feature shares. */
export function makeContext(n) {
  return {
    bm: new Int16Array(n), bk: new Int16Array(n), wm: new Int16Array(n), wk: new Int16Array(n),
    nbm: 0, nbk: 0, nwm: 0, nwk: 0,
  };
}

export function scan(pos, ctx) {
  const b = pos.board;
  ctx.nbm = ctx.nbk = ctx.nwm = ctx.nwk = 0;
  for (let sq = 0; sq < b.length; sq++) {
    const p = b[sq];
    if (p === 0) continue;
    if (p === 1) ctx.bm[ctx.nbm++] = sq;
    else if (p === 2) ctx.bk[ctx.nbk++] = sq;
    else if (p === -1) ctx.wm[ctx.nwm++] = sq;
    else ctx.wk[ctx.nwk++] = sq;
  }
}
