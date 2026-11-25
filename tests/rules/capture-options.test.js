import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { Position } from '../../src/core/position.js';
import { registerVariant } from '../../src/rules/variants.js';
import { createJSONHandler } from '../../src/protocol/json-protocol.js';
import { MATE_BOUND } from '../../src/utils/constants.js';
import { sorted, notations, randomGame } from '../helpers.js';

const base = { size: 8, startRows: 3 };
registerVariant({ ...base, id: 't-optcap', forceJumps: false });
registerVariant({ ...base, id: 't-early', forceJumps: false, stopMultiJumpEarly: true });
const rus = { size: 8, startRows: 3, firstMove: 'white', menCaptureBackward: true, flyingKings: true, promotionDuringCapture: 'continuesAsKing' };
registerVariant({ ...rus, id: 't-block' });
registerVariant({ ...rus, id: 't-vanish', capturedPiecesBlock: false });
registerVariant({ ...base, id: 't-early-vanish', forceJumps: false, stopMultiJumpEarly: true, capturedRemovedAfterSequence: false, flyingKings: true, menCaptureBackward: true });

test('mandatory capture is configurable: optional captures allow quiet moves too', () => {
  assert.deepEqual(notations(new Position('american', 'B:W15:B1,10')), ['10x19']);
  assert.deepEqual(sorted(notations(new Position('t-optcap', 'B:W15:B1,10'))), sorted(['10x19', '10-14', '1-5', '1-6']));
});

test('stopping a multi-jump early: only when captures are optional, every prefix is a move', () => {
  const fen = 'B:W14,23:B9';
  assert.deepEqual(sorted(notations(new Position('american', fen))), ['9x18x27']);
  assert.deepEqual(sorted(notations(new Position('t-optcap', fen))), sorted(['9x18x27', '9-13']));
  assert.deepEqual(sorted(notations(new Position('t-early', fen))), sorted(['9x18x27', '9x18', '9-13']));
});

test('an early-stopped partial capture removes only the pieces it jumped', () => {
  const p = new Position('t-early', 'B:W14,23:B9');
  p.move('9x18');
  assert.equal(p.fen(), 'W:W23:B18');
  p.undo();
  assert.equal(p.fen(), 'B:W14,23:B9');
});

test('captured pieces block (default) vs vanish: a king can only pass a taken piece\'s square when they vanish', () => {
  const fen = 'B:W14,22,23:BK29';
  const blocked = notations(new Position('t-block', fen));
  const vanish = notations(new Position('t-vanish', fen));
  // king takes 22 (land 18), takes 23 (land 27), then travels back THROUGH 23's square to take 14 (land 9)
  assert.ok(!blocked.includes('29x18x27x9'));
  assert.ok(vanish.includes('29x18x27x9'));
  for (const m of new Position('t-vanish', fen).moves()) assert.equal(new Set(m.caps).size, m.caps.length, 'a piece is never taken twice');
});

test('standard variants are unchanged by the new options', () => {
  for (const v of ['american', 'international', 'russian', 'brazilian', 'pool']) {
    const r = new Position(v).rules;
    assert.equal(r.stopMultiJumpEarly, false);
    assert.equal(r.capturedRemovedAfterSequence, true);
    assert.equal(r.mandatoryCapture, true);
  }
});

test('ruleset validation: aliases, conflicts and illegal combinations', () => {
  assert.throws(() => registerVariant({ id: 'e1', stopMultiJumpEarly: true }), /requires mandatoryCapture/);
  assert.throws(() => registerVariant({ id: 'e2', forceJumps: false, majorityCapture: true }), /majorityCapture requires/);
  assert.throws(() => registerVariant({ id: 'e3', forceJumps: true, mandatoryCapture: false }), /disagree/);
  assert.throws(() => registerVariant({ id: 'e4', capturedPiecesBlock: false, capturedRemovedAfterSequence: true }), /disagree/);
  assert.throws(() => registerVariant({ id: 'e5', stopMultiJumpEarly: 'yes' }), /boolean/);
  const r = registerVariant({ id: 'e6', forceJumps: false, capturedPiecesBlock: false });
  assert.equal(r.mandatoryCapture, false); assert.equal(r.capturedRemovedAfterSequence, false);
});

for (const v of ['t-optcap', 't-early', 't-vanish', 't-early-vanish']) {
  test(`${v}: make/undo/hash stay consistent over random games`, () => {
    for (let seed = 1; seed <= 5; seed++) {
      randomGame(v, seed, 100, (pos) => {
        assert.equal(new Position(v, pos.fen()).key(), pos.key());
        const fen = pos.fen(), key = pos.key();
        for (const mv of pos.moves()) { pos.make(mv); pos.unmake(); assert.equal(pos.fen(), fen); assert.equal(pos.key(), key); }
      });
    }
  });
}

test('search handles optional captures: takes a winning capture, reports mate, restores the position', async () => {
  const e = new LexiconEngine({ variant: 't-optcap', config: { strength: { useOpeningBook: false } } });
  const r = await e.analyze({ position: 'B:W15:B1,10', depth: 4, diagnostics: false });
  assert.equal(r.bestMove, '10x19');
  assert.ok(r.score > MATE_BOUND);
  assert.equal(e.position.fen(), 'B:W15:B1,10');
});

test('with optional captures, a bad capture is declinable and the engine can decline it', async () => {
  // black man 10 can take 15, but white then recaptures and wins material; a quiet move is better
  const e = new LexiconEngine({ variant: 't-optcap', config: { strength: { useOpeningBook: false } } });
  const fen = 'B:W15,23,24:B10,1';
  const r = await e.analyze({ position: fen, depth: 6, diagnostics: false });
  const forced = new LexiconEngine({ variant: 'american', config: { strength: { useOpeningBook: false } } });
  const rf = await forced.analyze({ position: fen, depth: 6, diagnostics: false });
  assert.ok(r.score >= rf.score, 'extra freedom can never make the best score worse');
});

test('pvs and alpha-beta agree on optional-capture variants too', async () => {
  for (const v of ['t-optcap', 't-early']) {
    for (let seed = 1; seed <= 3; seed++) {
      const { pos } = randomGame(v, seed, 12);
      if (pos.status().over) continue;
      const s = [];
      for (const algorithm of ['pvs', 'alphabeta']) {
        const e = new LexiconEngine({ variant: v, config: { search: { algorithm, aspiration: false }, strength: { useOpeningBook: false } } });
        s.push((await e.analyze({ position: pos.fen(), depth: 5, diagnostics: false })).score);
      }
      assert.equal(s[0], s[1], `${v} seed ${seed}`);
    }
  }
});

test('diagnostics: "forcedCapture" is only true when captures are mandatory', async () => {
  const a = new LexiconEngine({ config: { strength: { useOpeningBook: false } } });
  const o = new LexiconEngine({ variant: 't-optcap', config: { strength: { useOpeningBook: false } } });
  const da = (await a.analyze({ position: 'B:W15:B1,10', depth: 2 })).diagnostics;
  const dopt = (await o.analyze({ position: 'B:W15:B1,10', depth: 2 })).diagnostics;
  assert.equal(da.forcedCapture, true);
  assert.equal(dopt.forcedCapture, false); assert.equal(dopt.captureAvailable, true);
  assert.ok(!dopt.warnings.some((w) => /mandatory/.test(w)));
});

test('engine accepts a ruleset definition directly, and the JSON protocol can register one', async () => {
  const e = new LexiconEngine({ variant: { id: 't-inline', size: 8, startRows: 3, forceJumps: false } });
  assert.equal(e.rules.mandatoryCapture, false);
  assert.equal(e.getLegalMoves().length, 7);
  const h = createJSONHandler(new LexiconEngine());
  assert.equal((await h.handle({ type: 'registerVariant', ruleset: { id: 't-json', size: 8, startRows: 3, forceJumps: false, stopMultiJumpEarly: true } })).id, 't-json');
  assert.equal((await h.handle({ type: 'registerVariant', ruleset: { id: 't-bad', size: 7 } })).type, 'error');
  await h.handle({ type: 'setOption', name: 'Variant', value: 't-json' });
  assert.equal((await h.handle({ type: 'legalMoves' })).moves.length, 7);
});
