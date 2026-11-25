/**
 * Move parsing. Accepts "11-15", "22x15x8", "22x8" (when unambiguous) or {from, to} in playable-square numbers.
 */
export function findMove(pos, input, legal = pos.moves()) {
  const geo = pos.geo;
  let nums;
  if (typeof input === 'string') nums = input.trim().split(/[-xX\s]+/).filter(Boolean).map(Number);
  else if (input && typeof input === 'object') nums = Array.isArray(input.path) ? input.path : [input.from, input.to];
  if (!nums || nums.length < 2 || nums.some((x) => !(x >= 1 && x <= geo.squares))) {
    throw new Error(`Unrecognized move: ${JSON.stringify(input)}`);
  }
  const sqs = nums.map((x) => geo.numToSq[x]);
  const exact = legal.filter((m) => m.path.length === sqs.length && m.path.every((s, i) => s === sqs[i]));
  if (exact.length === 1) return exact[0];
  const ends = legal.filter((m) => m.from === sqs[0] && m.to === sqs[sqs.length - 1]);
  if (ends.length === 1) return ends[0];
  if (ends.length > 1) throw new Error(`Ambiguous move "${input}": give the full path`);
  throw new Error(`Illegal move: ${typeof input === 'string' ? input : JSON.stringify(input)}`);
}
