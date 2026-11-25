/** Men + kings * kingRatio, black minus white (in man units). */
export function material(ctx, pos, params) {
  return (ctx.nbm - ctx.nwm) + (ctx.nbk - ctx.nwk) * params.kingRatio;
}
