import { Position } from '../src/core/position.js';
import { perft } from '../src/core/perft.js';
import { listVariants } from '../src/rules/variants.js';

const arg = process.argv[2];
const variants = arg && arg !== 'all' ? [arg] : listVariants();
const maxDepth = Number(process.argv[3] ?? 6);
for (const v of variants) {
  const pos = new Position(v);
  const d = Math.min(maxDepth, pos.rules.size === 10 ? 5 : maxDepth);
  const t0 = performance.now();
  const n = perft(pos, d);
  const ms = performance.now() - t0;
  console.log(JSON.stringify({ variant: v, depth: d, nodes: n, ms: Math.round(ms), nps: Math.round((n / ms) * 1000) }));
}
