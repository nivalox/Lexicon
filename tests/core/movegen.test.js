import test from 'node:test';
import assert from 'node:assert/strict';
import { Position } from '../../src/core/position.js';
import { registerVariant } from '../../src/rules/variants.js';
import { sorted, notations } from '../helpers.js';

test('captures are mandatory: quiet moves are excluded', () => {
  const p = new Position('american', 'B:W15:B1,10');
  assert.deepEqual(notations(p), ['10x19']);
});

test('multi-jump is generated as one move', () => {
  const p = new Position('american', 'B:W14,23:B9');
  assert.deepEqual(notations(p), ['9x18x27']);
  assert.equal(p.moves()[0].caps.length, 2);
});

test('american: promotion ends a capture sequence', () => {
  const p = new Position('american', 'B:W26,27:B22');
  const ms = p.moves();
  assert.deepEqual(ms.map((m) => m.notation), ['22x31']);
  assert.equal(ms[0].promotes, true);
});

test('russian: a man crowned mid-capture continues as a king', () => {
  const p = new Position('russian', 'B:W26,27:B22');
  const ms = p.moves();
  // the new (flying) king may land on 24 or 20 after taking 27
  assert.deepEqual(sorted(ms.map((m) => m.notation)), sorted(['22x31x24', '22x31x20']));
  assert.ok(ms.every((m) => m.promotes));
});

test('flying king may land on any empty square beyond the captured piece', () => {
  const p = new Position('russian', 'B:W22:BK29');
  assert.deepEqual(sorted(notations(p)), sorted(['29x18', '29x15', '29x11', '29x8', '29x4']));
});

test('flying king must land where it can continue capturing', () => {
  const p = new Position('russian', 'B:W14,22:BK29');
  assert.deepEqual(sorted(notations(p)), sorted(['29x18x9', '29x18x5']));
});

test('majority rule: brazilian forces the longer sequence, russian allows either', () => {
  const fen = 'B:W14,16,22:B9,12';
  assert.deepEqual(sorted(notations(new Position('russian', fen))), sorted(['9x18x25', '12x19']));
  assert.deepEqual(notations(new Position('brazilian', fen)), ['9x18x25']);
});

test('international: man passing through the king row without ending there is not crowned', () => {
  const p = new Position('international', 'W:W11:B7,8');
  const ms = p.moves();
  assert.deepEqual(ms.map((m) => m.notation), ['11x2x13']);
  assert.equal(ms[0].promotes, false);
});

test('a captured piece cannot be jumped twice and blocks until the sequence ends', () => {
  // black king can loop around four white men and take all of them once
  const p = new Position('american', 'B:W14,15,22,23:BK18');
  for (const m of p.moves()) assert.equal(new Set(m.caps).size, m.caps.length);
});

test('men never move backward without capturing (american)', () => {
  const p = new Position('american', 'B:W32:B18');
  assert.deepEqual(sorted(notations(p)), sorted(['18-22', '18-23']));
});

test('illegal and malformed moves are rejected', () => {
  const p = new Position('american');
  assert.throws(() => p.move('1-5'), /Illegal/);
  assert.throws(() => p.move('banana'), /Unrecognized/);
  assert.throws(() => p.move('40-41'), /Unrecognized/);
  assert.equal(p.move('11-15').notation, '11-15');
});

test('registerVariant adds a custom variant without touching the engine', () => {
  const r = registerVariant({ id: 'mini6', name: 'Mini 6x6', size: 6, startRows: 2, firstMove: 'black' });
  const p = new Position(r);
  assert.equal(p.geo.squares, 18);
  assert.ok(p.moves().length > 0);
  assert.throws(() => registerVariant({ id: 'bad', size: 7 }), /Invalid ruleset/);
});
