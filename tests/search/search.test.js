import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { Position } from '../../src/core/position.js';
import { Evaluator } from '../../src/evaluation/evaluate.js';
import { Searcher } from '../../src/search/search.js';
import { TranspositionTable } from '../../src/search/transposition-table.js';
import { MoveOrderer } from '../../src/search/move-ordering.js';
import { moveKey } from '../../src/core/move.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { MATE_BOUND } from '../../src/utils/constants.js';
import { randomGame } from '../helpers.js';

const quiet = { config: { strength: { useOpeningBook: false, useTablebases: false } } };

test('finds a forced win in one and reports it as a mate score', async () => {
  const e = new LexiconEngine(quiet);
  const r = await e.analyze({ position: 'B:W15:B1,10', depth: 4 });
  assert.equal(r.bestMove, '10x19');
  assert.ok(r.score > MATE_BOUND);
  assert.equal(r.mate, 1);
});

test('search always returns a legal move and restores the position', async () => {
  for (const v of ['american', 'russian', 'brazilian']) {
    const e = new LexiconEngine({ variant: v, ...quiet });
    const { pos } = randomGame(v, 11, 20);
    e.setPosition(pos.fen());
    const before = e.position.fen(), key = e.position.key();
    const r = await e.analyze({ depth: 5 });
    assert.ok(e.position.moves().some((m) => m.notation === r.bestMove));
    assert.equal(e.position.fen(), before); assert.equal(e.position.key(), key);
  }
});

test('pvs and plain alpha-beta agree on the minimax value', async () => {
  for (let seed = 1; seed <= 5; seed++) {
    const { pos } = randomGame('american', seed, 14 + seed);
    if (pos.status().over) continue;
    const scores = [];
    for (const algorithm of ['pvs', 'alphabeta']) {
      const e = new LexiconEngine({ config: { search: { algorithm, aspiration: false }, strength: { useOpeningBook: false } } });
      scores.push((await e.analyze({ position: pos.fen(), depth: 6, diagnostics: false })).score);
    }
    assert.equal(scores[0], scores[1], `seed ${seed}`);
  }
});

test('search is colour-symmetric: a position and its mirror get the same score', async () => {
  for (let seed = 1; seed <= 4; seed++) {
    const { pos } = randomGame('american', seed, 16);
    if (pos.status().over) continue;
    const a = new LexiconEngine(quiet), b = new LexiconEngine(quiet);
    const ra = await a.analyze({ position: pos.fen(), depth: 6, diagnostics: false });
    const rb = await b.analyze({ position: pos.flipped().fen(), depth: 6, diagnostics: false });
    assert.equal(ra.score, rb.score, `seed ${seed}`);
  }
});

test('time limit is respected and the last completed iteration is returned', async () => {
  const e = new LexiconEngine(quiet);
  const t0 = Date.now();
  const r = await e.analyze({ position: 'startpos', movetime: 150, diagnostics: false });
  assert.ok(Date.now() - t0 < 600);
  assert.ok(r.depth >= 1 && r.bestMove);
});

test('node limit stops the search', async () => {
  const e = new LexiconEngine(quiet);
  const r = await e.analyze({ position: 'startpos', nodes: 5000, diagnostics: false });
  assert.ok(r.nodes < 5000 + 2048);
  assert.ok(r.bestMove);
});

test('stop() cancels an infinite analysis and still returns a move', async () => {
  const e = new LexiconEngine(quiet);
  const p = e.analyze({ position: 'startpos', infinite: true, diagnostics: false });
  setTimeout(() => e.stop(), 80);
  const r = await p;
  assert.equal(r.stopReason, 'stopped');
  assert.ok(r.bestMove);
  assert.equal(e.busy, false);
});

test('a position with a single legal move is answered immediately', async () => {
  const e = new LexiconEngine(quiet);
  const r = await e.analyze({ position: 'B:W15:B1,10' }); // no explicit depth/time: play, don't analyse
  assert.equal(r.depth, 0);
  assert.equal(r.bestMove, '10x19');
});

test('terminal positions report no move', async () => {
  const e = new LexiconEngine(quiet);
  const r = await e.analyze({ position: 'W:W:B1' });
  assert.equal(r.bestMove, null);
  assert.equal(r.source, 'terminal');
});

test('transposition table store/probe round-trip', () => {
  const tt = new TranspositionTable(1);
  assert.equal(tt.probe(123, 456), -1);
  tt.store(123, 456, 5, -77, 1, 999);
  const i = tt.probe(123, 456);
  assert.ok(i >= 0);
  assert.equal(tt.score[i], -77); assert.equal(tt.depth[i], 5); assert.equal(tt.move[i], 999);
  assert.equal(tt.probe(123, 457), -1, 'second key half must match');
  tt.clear();
  assert.equal(tt.probe(123, 456), -1);
});

test('move ordering: TT move first, then captures, then killers', () => {
  const pos = new Position('american', 'B:W15,22:B10,9');
  const o = new MoveOrderer(pos.geo.n);
  const moves = pos.moves();
  o.order(moves, 0, 0, pos.turn, pos.geo);
  assert.ok(moves[0].isCapture);
  const quiet = new Position('american');
  const qm = quiet.moves();
  const target = qm[qm.length - 1];
  o.order(qm, 0, moveKey(target), 1, quiet.geo);
  assert.equal(qm[0], target);
  o.recordCutoff(qm[3], 2, 4, 1);
  const again = quiet.moves();
  o.order(again, 2, 0, 1, quiet.geo);
  assert.equal(moveKey(again[0]), moveKey(qm[3]), 'killer move sorted first among quiet moves');
});

test('lmr can be enabled without breaking search', async () => {
  const e = new LexiconEngine({ config: { search: { lmr: true }, strength: { useOpeningBook: false } } });
  const r = await e.analyze({ position: 'startpos', depth: 7, diagnostics: false });
  assert.ok(r.bestMove);
});
