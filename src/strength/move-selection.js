import { MATE_BOUND } from '../utils/constants.js';

/**
 * Pick a move from root candidates [{move, score}] (scores from the mover's view).
 * Controlled inaccuracy: only moves within `margin` cp of the best are eligible, weighted by closeness.
 * A forced win is never thrown away, and a move that loses by force is never chosen over one that doesn't.
 */
export function selectCandidate(candidates, rng, { candidates: k, margin, temperature }) {
  const sorted = [...candidates].sort((a, b) => b.score - a.score);
  const best = sorted[0];
  if (!best || k <= 1 || margin <= 0) return best;
  let pool = sorted.slice(0, k).filter((c) => best.score - c.score <= margin);
  if (best.score > MATE_BOUND) pool = pool.filter((c) => c.score > MATE_BOUND);
  else pool = pool.filter((c) => c.score > -MATE_BOUND);
  if (pool.length <= 1) return best;
  const T = Math.max(1, temperature);
  const weights = pool.map((c) => Math.exp(-(best.score - c.score) / T));
  let r = rng() * weights.reduce((a, b) => a + b, 0);
  for (let i = 0; i < pool.length; i++) { r -= weights[i]; if (r <= 0) return pool[i]; }
  return pool[0];
}
