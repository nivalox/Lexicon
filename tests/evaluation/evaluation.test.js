import test from 'node:test';
import assert from 'node:assert/strict';
import { Position } from '../../src/core/position.js';
import { Evaluator } from '../../src/evaluation/evaluate.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { deepMerge } from '../../src/utils/validation.js';
import { listVariants } from '../../src/rules/variants.js';
import { randomGame } from '../helpers.js';

const mk = (pos, cfg = {}) => new Evaluator(pos.rules, deepMerge(DEFAULT_CONFIG.evaluation, cfg));

test('start position is balanced (only the tempo bonus remains)', () => {
  for (const v of listVariants()) {
    const p = new Position(v), ev = mk(p);
    const d = ev.evaluateDetailed(p);
    assert.equal(d.total, DEFAULT_CONFIG.evaluation.tempo, v);
    assert.equal(d.material, 0);
  }
});

test('evaluation is invariant under colour flip (all variants, random positions)', () => {
  for (const v of listVariants()) {
    for (let seed = 1; seed <= 8; seed++) {
      const { pos } = randomGame(v, seed, 10 + seed * 6);
      const ev = mk(pos);
      const f = pos.flipped();
      assert.deepEqual(ev.evaluateDetailed(pos), ev.evaluateDetailed(f), `${v} seed ${seed}`);
      assert.equal(ev.evaluate(pos), ev.evaluate(f));
    }
  }
});

test('an extra man is worth about a man; an extra king more', () => {
  const ev = mk(new Position('american'));
  const base = new Position('american', 'B:W21,22:B1,2');
  const up = new Position('american', 'B:W21,22:B1,2,3');
  const king = new Position('american', 'B:W21,22:B1,2,K3');
  assert.ok(ev.evaluate(up) - ev.evaluate(base) > 80);
  assert.ok(ev.evaluate(king) > ev.evaluate(up));
});

test('breakdown is explainable: parts sum to the total', () => {
  const { pos } = randomGame('american', 5, 24);
  const d = mk(pos).evaluateDetailed(pos);
  const parts = ['material', 'advancement', 'center', 'backRank', 'mobility', 'kingActivity', 'diagonals', 'formation', 'promotionThreat', 'endgame', 'tempo'];
  assert.equal(parts.reduce((a, k) => a + d[k], 0), d.total);
});

test('features can be disabled independently', () => {
  const { pos } = randomGame('american', 5, 24);
  const full = mk(pos).evaluateDetailed(pos);
  const off = mk(pos, { features: { mobility: { enabled: false } } }).evaluateDetailed(pos);
  assert.equal(off.mobility, undefined);
  assert.equal(off.total, full.total - full.mobility);
});

test('noise is deterministic per position and bounded', () => {
  const p = new Position('american'), ev = mk(p);
  ev.setNoise(20, 5);
  const a = ev.evaluate(p), b = ev.evaluate(p);
  assert.equal(a, b);
  assert.ok(Math.abs(a - 4) <= 20);
  ev.setNoise(0);
  assert.equal(ev.evaluate(p), 4);
});

test('promotion threat and mobility respond to the board', () => {
  const ev = mk(new Position('american'));
  const threat = new Position('american', 'B:W1:B26'); // black man one step from crowning
  assert.ok(ev.evaluateDetailed(threat).promotionThreat > 0);
});
