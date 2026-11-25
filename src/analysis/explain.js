const MESSAGES = {
  material:        ['Wins material', 'Loses material'],
  advancement:     ['Advances men toward promotion', 'Gives up advancement'],
  center:          ['Improves central control', 'Loosens central control'],
  backRank:        ['Keeps the back rank guarded', 'Weakens the back rank'],
  mobility:        ['Increases mobility', 'Reduces mobility'],
  kingActivity:    ['Makes the kings more active', 'Makes the kings less active'],
  diagonals:       ['Gains the long diagonal', 'Gives up the long diagonal'],
  formation:       ['Strengthens the formation (more supported men)', 'Loosens the formation'],
  promotionThreat: ['Creates a promotion threat', 'Allows a promotion threat'],
  endgame:         ['Improves the endgame setup', 'Worsens the endgame setup'],
};

/**
 * Explain a line by comparing the evaluation breakdown at the root with the one at the end of the
 * principal variation, both from the root mover's point of view. Every reason is a measured feature
 * change (>= threshold cp); nothing here is narrative.
 */
export function explainLine(pos, pv, evaluator, threshold = 6) {
  const root = evaluator.evaluateDetailed(pos);
  const sign0 = pos.turn;
  const p = pos.clone();
  let captures = 0, promotions = 0;
  for (const m of pv) {
    const mv = p.moves().find((x) => x.from === m.from && x.to === m.to && x.caps.length === m.caps.length);
    if (!mv) break;
    if (mv.isCapture) captures += mv.caps.length;
    if (mv.promotes) promotions++;
    p.make(mv);
  }
  const leaf = evaluator.evaluateDetailed(p);
  const f = p.turn === sign0 ? 1 : -1;
  const reasons = [], deltas = {};
  for (const k of Object.keys(MESSAGES)) {
    if (root[k] === undefined) continue;
    const d = leaf[k] * f - root[k];
    deltas[k] = d;
    if (Math.abs(d) >= threshold) reasons.push(`${MESSAGES[k][d > 0 ? 0 : 1]} (${d > 0 ? '+' : ''}${d} cp)`);
  }
  if (captures) reasons.unshift(`Line includes ${captures} capture${captures > 1 ? 's' : ''}`);
  if (promotions) reasons.push(`Line includes ${promotions} promotion${promotions > 1 ? 's' : ''}`);
  if (!reasons.length) reasons.push('No evaluation feature changes by more than the threshold along the line');
  return { reasons, deltas, basis: `static evaluation at the end of the ${pv.length}-move principal variation vs the current position` };
}
