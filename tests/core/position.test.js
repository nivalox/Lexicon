import test from 'node:test';
import assert from 'node:assert/strict';
import { Position } from '../../src/core/position.js';
import { listVariants } from '../../src/rules/variants.js';
import { randomGame } from '../helpers.js';

for (const v of listVariants()) {
  test(`${v}: FEN round-trip and start position is valid`, () => {
    const p = new Position(v);
    assert.deepEqual(p.validate(), []);
    const q = new Position(v, p.fen());
    assert.ok(p.equals(q));
    assert.equal(p.key(), q.key());
    assert.equal(q.fen(), p.fen());
  });

  test(`${v}: random games keep hash, undo and piece counts consistent`, () => {
    for (let seed = 1; seed <= 6; seed++) {
      let prevCount = Infinity;
      randomGame(v, seed, 120, (pos, m) => {
        const re = new Position(v, pos.fen());
        assert.equal(re.key(), pos.key(), 'incremental hash == recomputed hash');
        const c = pos.countPieces();
        const n = c.blackMen + c.blackKings + c.whiteMen + c.whiteKings;
        assert.ok(n <= prevCount, 'piece count never increases');
        prevCount = n;
        // every legal move can be made and unmade without trace
        const fen = pos.fen(), key = pos.key(), half = pos.half;
        for (const mv of pos.moves()) {
          pos.make(mv); pos.unmake();
          assert.equal(pos.fen(), fen); assert.equal(pos.key(), key); assert.equal(pos.half, half);
        }
      });
    }
  });
}

test('validate reports impossible positions', () => {
  const p = new Position('american', 'B:W1,2,3,4,5,6,7,8,9,10,11,12,13:B20');
  assert.ok(p.validate().some((e) => /too many white/.test(e)));
  const q = new Position('american', 'B:W3:B30');
  assert.ok(q.validate().some((e) => /promotion row/.test(e)));
  assert.throws(() => new Position('american', 'X:W1:B2'), /Bad FEN/);
  assert.throws(() => new Position('american', 'B:W1:B1'), /twice/);
  assert.throws(() => new Position('american', 'B:W99:B2'), /Bad square/);
});

test('undo restores the exact previous position including counters', () => {
  const p = new Position('american');
  const before = { fen: p.fen(), key: p.key(), half: p.half, hist: p.hist.length, turn: p.turn };
  p.move('11-15'); p.move('23-19'); p.undo(); p.undo();
  assert.deepEqual({ fen: p.fen(), key: p.key(), half: p.half, hist: p.hist.length, turn: p.turn }, before);
  assert.equal(p.undo(), null);
});

test('clone is independent', () => {
  const p = new Position('american');
  const c = p.clone();
  c.move('11-15');
  assert.notEqual(p.fen(), c.fen());
  assert.equal(c.hist.length, 2);
});

test('flipped() is a colour/rotation mirror and flipping twice is the identity', () => {
  for (const v of listVariants()) {
    const { pos } = randomGame(v, 3, 30);
    assert.ok(pos.flipped().flipped().equals(pos));
  }
});

test('no legal moves means the side to move loses', () => {
  const p = new Position('american', 'W:W:B1');   // white has no pieces and is to move
  assert.deepEqual(p.status(), { over: true, winner: 'black', reason: 'no legal moves' });
});

test('threefold repetition is a draw (kings shuffling)', () => {
  const p = new Position('american', 'B:WK4:BK29');
  for (let i = 0; i < 2; i++) for (const m of ['29-25', '4-8', '25-29', '8-4']) p.move(m);
  assert.equal(p.status().winner, 'draw');
  assert.equal(p.status().reason, 'repetition');
});

test('no-progress rule draws after the configured number of plies', () => {
  const p = new Position('american', 'B:WK4:BK29');
  p.half = 80;
  assert.equal(p.status().reason, 'no-progress rule');
});
