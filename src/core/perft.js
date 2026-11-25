export function perft(pos, depth) {
  if (depth === 0) return 1;
  const moves = pos.moves();
  if (depth === 1) return moves.length;
  let n = 0;
  for (const m of moves) { pos.make(m); n += perft(pos, depth - 1); pos.unmake(); }
  return n;
}

export function divide(pos, depth) {
  return pos.moves().map((m) => {
    pos.make(m);
    const nodes = perft(pos, depth - 1);
    pos.unmake();
    return { move: m.notation, nodes };
  });
}
