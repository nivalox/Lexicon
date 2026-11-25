// Match runner:  node benchmarks/selfplay.js --games 20 --depth 6 --seed 7 [--variant american]
//                  [--a '{"search":{"lmr":false}}'] [--b '{"search":{"lmr":true}}'] [--opening-plies 4]
// Games are played in colour-swapped pairs from the same seeded random opening. Output is JSON.
import { LexiconEngine } from '../src/core/engine.js';
import { createRng } from '../src/utils/rng.js';
import { Position } from '../src/core/position.js';

const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(`--${name}`); return i < 0 ? def : argv[i + 1]; };
const games = Number(opt('games', 10)), depth = Number(opt('depth', 5)), seed = Number(opt('seed', 1));
const variant = opt('variant', 'american'), openingPlies = Number(opt('opening-plies', 4)), maxPlies = Number(opt('max-plies', 200));
const cfgA = JSON.parse(opt('a', '{}')), cfgB = JSON.parse(opt('b', '{}'));
const noBook = { strength: { useOpeningBook: false, useTablebases: false } };
const mk = (c) => new LexiconEngine({ variant, config: { ...noBook, ...c, strength: { ...noBook.strength, ...(c.strength || {}) } } });

const rows = [];
for (let g = 0; g < games; g++) {
  const rng = createRng(seed * 1000 + (g >> 1));
  const aIsBlack = g % 2 === 0;
  const A = mk(cfgA), B = mk(cfgB);
  const pos = new Position(variant), moves = [];
  for (let i = 0; i < openingPlies; i++) { const ms = pos.moves(); if (!ms.length) break; const m = ms[rng.int(ms.length)]; moves.push(m.notation); pos.make(m); }
  let depthSum = 0, searched = 0, status = pos.status();
  while (!status.over && pos.stack.length < maxPlies) {
    const blackToMove = pos.turn > 0, eng = blackToMove === aIsBlack ? A : B;
    // replay from the start so the engine sees the full history (repetition detection)
    const r = await eng.analyze({ position: 'startpos', moves, depth, diagnostics: false });
    pos.move(r.bestMove); moves.push(r.bestMove); depthSum += r.depth; searched++;
    status = pos.status();
  }
  const winner = status.over ? status.winner : 'draw';
  const aScore = winner === 'draw' ? 0.5 : (winner === 'black') === aIsBlack ? 1 : 0;
  rows.push({ game: g, aIsBlack, winner, reason: status.reason ?? 'ply limit', plies: moves.length, aScore, avgDepth: searched ? depthSum / searched : 0, moves });
}
const wins = rows.filter((r) => r.aScore === 1).length, draws = rows.filter((r) => r.aScore === 0.5).length, losses = rows.length - wins - draws;
const mean = rows.reduce((a, r) => a + r.aScore, 0) / rows.length;
const sd = Math.sqrt(rows.reduce((a, r) => a + (r.aScore - mean) ** 2, 0) / Math.max(1, rows.length - 1));
const ci = 1.96 * sd / Math.sqrt(rows.length);
console.log(JSON.stringify({
  engine: 'Lexicon', variant, seed, depth, games, wins, draws, losses,
  scoreA: Number(mean.toFixed(3)), ci95: Number(ci.toFixed(3)),
  averageDepth: Number((rows.reduce((a, r) => a + r.avgDepth, 0) / rows.length).toFixed(2)),
  note: 'wins/draws/losses are for engine A. With few games the confidence interval is wide: do not claim an improvement unless the 95% interval excludes 0.5.',
  results: rows,
}, null, 2));
