import test from 'node:test';
import assert from 'node:assert/strict';
import { Position } from '../../src/core/position.js';
import { perft } from '../../src/core/perft.js';

test('american perft matches published counts', () => {
  const p = new Position('american');
  const expected = [7, 49, 302, 1469, 7361, 36768, 179740];
  expected.forEach((n, i) => assert.equal(perft(p, i + 1), n, `depth ${i + 1}`));
});

test('international perft depth 1-5 matches published counts', () => {
  const p = new Position('international');
  [9, 81, 658, 4265, 27117].forEach((n, i) => assert.equal(perft(p, i + 1), n, `depth ${i + 1}`));
});
