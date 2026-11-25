import { DIRS_DOWN, DIRS_UP } from '../core/board.js';

function promotionThreats(pos) {
  const { NEXT, rowOf, size, sqToNum } = pos.geo, b = pos.board;
  const out = { black: [], white: [] };
  for (let sq = 0; sq < b.length; sq++) {
    const p = b[sq];
    if (p === 1 && rowOf[sq] === size - 2) { for (const d of DIRS_DOWN) { const t = NEXT[sq * 4 + d]; if (t >= 0 && b[t] === 0) { out.black.push(sqToNum[sq]); break; } } }
    if (p === -1 && rowOf[sq] === 1) { for (const d of DIRS_UP) { const t = NEXT[sq * 4 + d]; if (t >= 0 && b[t] === 0) { out.white.push(sqToNum[sq]); break; } } }
  }
  return out;
}

/** Facts about a position, all computed from the board and the rules (no search). */
export function describePosition(pos, evaluator) {
  const moves = pos.moves();
  const captures = moves.filter((m) => m.isCapture);
  const status = pos.status();
  const threats = promotionThreats(pos);
  const warnings = [];
  if (captures.length && pos.rules.mandatoryCapture) warnings.push(`Capture is mandatory (${captures.length} option${captures.length > 1 ? 's' : ''})`);
  const opp = pos.turn > 0 ? 'white' : 'black';
  if (threats[opp].length) warnings.push(`${opp} threatens to promote from square(s) ${threats[opp].join(', ')}`);
  if (pos.rules.noProgressPlies && pos.half >= pos.rules.noProgressPlies - 10) warnings.push(`${pos.rules.noProgressPlies - pos.half} plies until the no-progress draw rule`);
  return {
    fen: pos.fen(),
    variant: pos.rules.id,
    sideToMove: pos.turn > 0 ? 'black' : 'white',
    legalMoves: moves.length,
    forcedCapture: pos.rules.mandatoryCapture && captures.length > 0,
    captureAvailable: captures.length > 0,
    captureMoves: captures.map((m) => m.notation),
    pieces: pos.countPieces(),
    promotionThreats: threats,
    status,
    evaluation: evaluator ? evaluator.evaluateDetailed(pos) : null,
    warnings,
  };
}
