import { Position } from '../src/core/position.js';
import { createRng } from '../src/utils/rng.js';

export const sorted = (a) => [...a].sort();
export const notations = (pos) => pos.moves().map((m) => m.notation);

/** Plays random legal moves; calls check(pos, move) after each. Returns the number of plies played. */
export function randomGame(variant, seed, maxPlies, check) {
  const rng = createRng(seed);
  const pos = new Position(variant);
  let plies = 0;
  while (plies < maxPlies) {
    const st = pos.status();
    if (st.over) break;
    const ms = pos.moves();
    const m = ms[rng.int(ms.length)];
    pos.make(m); plies++;
    if (check) check(pos, m);
  }
  return { pos, plies };
}
