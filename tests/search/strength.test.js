import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { StrengthManager } from '../../src/strength/strength-manager.js';
import { STRENGTH_PRESETS } from '../../src/strength/presets.js';
import { selectCandidate } from '../../src/strength/move-selection.js';
import { createRng } from '../../src/utils/rng.js';
import { MATE } from '../../src/utils/constants.js';

const noBook = { strength: { useOpeningBook: false, useTablebases: false } };

test('nine presets exist and get progressively stronger', () => {
  for (let l = 1; l <= 9; l++) assert.ok(STRENGTH_PRESETS[l], `level ${l}`);
  for (let l = 2; l <= 9; l++) assert.ok(STRENGTH_PRESETS[l].maxDepth >= STRENGTH_PRESETS[l - 1].maxDepth);
});

test('level 9 disables every artificial weakness, whatever else is configured', () => {
  const eff = new StrengthManager({ level: 9, randomness: 1 }).resolve();
  assert.equal(eff.evalNoise, 0); assert.equal(eff.candidates, 1); assert.equal(eff.margin, 0);
  assert.equal(eff.artificialWeakness, false);
});

test('levels 1-8 are weakened on purpose; randomness scales it; 0 removes it', () => {
  const m = new StrengthManager({ level: 3 });
  assert.equal(m.resolve().artificialWeakness, true);
  const half = m.resolve({ level: 3, randomness: 0.5 });
  assert.equal(half.evalNoise, Math.round(STRENGTH_PRESETS[3].evalNoise * 0.5));
  assert.equal(m.resolve({ level: 3, randomness: 0 }).evalNoise, 0);
});

test("'custom' profile applies explicit weakness fields on a level-9 baseline", () => {
  const eff = new StrengthManager({ level: 'custom', maxDepth: 5, evalNoise: 12, candidates: 3, margin: 40, temperature: 20 }).resolve();
  assert.equal(eff.maxDepth, 5); assert.equal(eff.evalNoise, 12); assert.equal(eff.artificialWeakness, true);
});

test('candidate selection: only near-best moves, deterministic per seed, never gives away a forced win', () => {
  const c = [{ move: 'a', score: 100 }, { move: 'b', score: 90 }, { move: 'c', score: -300 }];
  const opts = { candidates: 3, margin: 30, temperature: 20 };
  const seen = new Set();
  for (let s = 1; s < 60; s++) seen.add(selectCandidate(c, createRng(s), opts).move);
  assert.deepEqual([...seen].sort(), ['a', 'b']);
  assert.equal(selectCandidate(c, createRng(4), opts).move, selectCandidate(c, createRng(4), opts).move);
  const win = [{ move: 'mate', score: MATE - 3 }, { move: 'ok', score: 50 }];
  for (let s = 1; s < 40; s++) assert.equal(selectCandidate(win, createRng(s), { candidates: 2, margin: 99999, temperature: 50 }).move, 'mate');
});

test('level 1 respects its depth budget; level 9 does not', async () => {
  const weak = new LexiconEngine({ config: { ...noBook, strength: { ...noBook.strength, level: 1 } } });
  const rw = await weak.analyze({ position: 'startpos', depth: 20, diagnostics: false });
  assert.ok(rw.depth <= STRENGTH_PRESETS[1].maxDepth);
  const strong = new LexiconEngine({ config: noBook });
  const rs = await strong.analyze({ position: 'startpos', depth: 7, diagnostics: false });
  assert.equal(rs.depth, 7);
});

test('weak play is reproducible for a given seed and varies across seeds', async () => {
  const play = async (seed) => {
    const e = new LexiconEngine({ config: { ...noBook, seed, strength: { ...noBook.strength, level: 1 } } });
    const out = [];
    for (let i = 0; i < 4; i++) { const r = await e.analyze({ diagnostics: false }); out.push(r.bestMove); e.makeMove(r.bestMove); }
    return out.join(' ');
  };
  assert.equal(await play(5), await play(5));
  const variants = new Set();
  for (let s = 1; s <= 6; s++) variants.add(await play(s));
  assert.ok(variants.size > 1);
});

test('weak levels still take a mate in one', async () => {
  const e = new LexiconEngine({ config: { ...noBook, strength: { ...noBook.strength, level: 1 } } });
  const r = await e.analyze({ position: 'B:W15,16:B1,10,11', depth: 3, diagnostics: false });
  assert.ok(r.bestMove);
});
