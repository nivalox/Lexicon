import { LexiconEngine } from '../src/core/engine.js';
import { listVariants } from '../src/rules/variants.js';

const depth = Number(process.argv[2] ?? 8);
const results = [];
for (const v of listVariants()) {
  const e = new LexiconEngine({ variant: v, config: { strength: { useOpeningBook: false, useTablebases: false } } });
  const d = e.rules.size === 10 ? Math.min(depth, 6) : depth;
  const t0 = performance.now();
  const r = await e.analyze({ position: 'startpos', depth: d, diagnostics: false });
  const ms = performance.now() - t0;
  results.push({ variant: v, depth: r.depth, bestMove: r.bestMove, score: r.score, nodes: r.nodes, ms: Math.round(ms), nps: r.nps, hashfull: e.tt.hashfull() });
}
console.log(JSON.stringify({ benchmark: 'search', results, memoryMB: Math.round(process.memoryUsage().rss / 1048576) }, null, 2));
