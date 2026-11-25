// Every bug found during development gets a regression test here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { Position } from '../../src/core/position.js';
import { perft } from '../../src/core/perft.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';

test('BUG: default config must not carry explicit strength overrides that defeat the presets', async () => {
  assert.equal(DEFAULT_CONFIG.strength.maxDepth, undefined);
  const e = new LexiconEngine({ config: { strength: { useOpeningBook: false, level: 3 } } });
  const r = await e.analyze({ position: 'startpos', diagnostics: false });
  assert.ok(r.depth <= 4, `level 3 searched to depth ${r.depth}`);
});

test('BUG: -0 must never appear in evaluation breakdowns', () => {
  const e = new LexiconEngine();
  for (const v of Object.values(e.getEvaluation())) assert.ok(!Object.is(v, -0));
});

test('BUG: a forced single move still reports a meaningful score, and explicit depth searches fully', async () => {
  const e = new LexiconEngine({ config: { strength: { useOpeningBook: false } } });
  const r = await e.analyze({ position: 'B:W15:B1,10', depth: 3 });
  assert.equal(r.mate, 1);
});

test('REGRESSION VALUES (engine-reported, not independently verified): russian/brazilian perft', () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => perft(new Position('russian'), d)), [7, 49, 302, 1469, 7482]);
  assert.deepEqual([1, 2, 3, 4, 5].map((d) => perft(new Position('brazilian'), d)), [7, 49, 302, 1469, 7473]);
});
