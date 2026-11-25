import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { Position } from '../../src/core/position.js';
import { DEFAULT_CONFIG } from '../../src/config/defaults.js';
import { validateConfig, deepMerge } from '../../src/utils/validation.js';
import { matrixToFen, moveToCells, UserscriptBridge } from '../../src/adapters/userscript/adapter.js';
import { registerEngineHost, ExtensionClient } from '../../src/adapters/extension/adapter.js';
import { listVariants } from '../../src/rules/variants.js';

test('default configuration is valid; bad configurations are rejected with reasons', () => {
  assert.deepEqual(validateConfig(DEFAULT_CONFIG), []);
  assert.ok(validateConfig(deepMerge(DEFAULT_CONFIG, { search: { threads: 4 } })).length);
  assert.ok(validateConfig(deepMerge(DEFAULT_CONFIG, { strength: { level: 12 } })).length);
  assert.ok(validateConfig(deepMerge(DEFAULT_CONFIG, { strength: { randomness: 3 } })).length);
  assert.throws(() => new LexiconEngine({ config: { search: { hashMB: 0 } } }), /Invalid configuration/);
});

test('runtime options are validated and a rejected option leaves the config untouched', () => {
  const e = new LexiconEngine();
  const before = JSON.stringify(e.config);
  assert.throws(() => e.setOption('Hash', '0'));
  assert.throws(() => e.setOption('search.threads', '3'));
  assert.equal(JSON.stringify(e.config), before);
  e.setOption('search.lmr', 'true');
  assert.equal(e.config.search.lmr, true);
  e.setOption('Hash', '4');
  assert.equal(e.tt.size > 0, true);
});

test('engine API: setPosition / getLegalMoves / makeMove / undoMove / newGame / getEvaluation', async () => {
  const e = new LexiconEngine();
  await e.initialize();
  e.setPosition('startpos', ['11-15']);
  assert.equal(e.getState().sideToMove, 'white');
  assert.ok(e.getLegalMoves().length > 0);
  assert.equal(e.makeMove('23-19').move.notation, '23-19');
  assert.equal(e.undoMove().move.notation, '23-19');
  assert.equal(typeof e.getEvaluation().total, 'number');
  e.newGame();
  assert.equal(e.position.fen(), new Position('american').fen());
  assert.throws(() => e.setPosition('B:W1,2,3,4,5,6,7,8,9,10,11,12,13:B20'), /Invalid position/);
  const r = await e.analyze({ position: 'startpos', depth: 4, explain: true });
  assert.deepEqual(e.getPrincipalVariation(), r.principalVariation);
  assert.ok(r.explanation.reasons.length > 0);
  assert.ok(r.diagnostics.legalMoves === 7);
});

test('every variant can be analysed through the facade', async () => {
  for (const v of listVariants()) {
    const e = new LexiconEngine({ variant: v, config: { strength: { useOpeningBook: false } } });
    const r = await e.analyze({ position: 'startpos', depth: v === 'international' ? 4 : 5, diagnostics: false });
    assert.ok(r.bestMove, v);
  }
});

test('userscript adapter: board matrix -> FEN -> move cells, with and without flip', () => {
  const p = new Position('american');
  const matrix = Array.from({ length: 8 }, () => Array(8).fill(''));
  for (let sq = 0; sq < 64; sq++) if (p.board[sq]) matrix[p.geo.rowOf[sq]][p.geo.colOf[sq]] = p.board[sq] > 0 ? 'b' : 'w';
  assert.equal(matrixToFen(matrix, { turn: 'B' }), p.fen());
  const flipped = matrix.map((r) => [...r].reverse()).reverse();
  assert.equal(matrixToFen(flipped, { turn: 'B', flip: true }), p.fen());
  assert.deepEqual(moveToCells('11-15'), [{ row: 2, col: 5 }, { row: 3, col: 4 }]);
  assert.deepEqual(moveToCells('11-15', { flip: true }), [{ row: 5, col: 2 }, { row: 4, col: 3 }]);
  const bad = Array.from({ length: 8 }, () => Array(8).fill('')); bad[0][0] = 'b';
  assert.throws(() => matrixToFen(bad), /light square/);
});

test('userscript bridge returns a legal move for a page board', async () => {
  const e = new LexiconEngine({ config: { strength: { useOpeningBook: false } } });
  const p = new Position('american');
  const matrix = Array.from({ length: 8 }, () => Array(8).fill(''));
  for (let sq = 0; sq < 64; sq++) if (p.board[sq]) matrix[p.geo.rowOf[sq]][p.geo.colOf[sq]] = p.board[sq] > 0 ? 'b' : 'w';
  const s = await new UserscriptBridge(e).suggest(matrix, 'B', { depth: 4 });
  assert.ok(p.moves().some((m) => m.notation === s.bestMove));
  assert.equal(s.cells.length, 2);
});

test('extension host/client round trip over a fake runtime', async () => {
  let listener;
  const runtime = { onMessage: { addListener: (f) => { listener = f; } }, sendMessage: (msg) => new Promise((res) => listener(msg, {}, res)) };
  registerEngineHost(runtime, new LexiconEngine({ config: { strength: { useOpeningBook: false } } }));
  const c = new ExtensionClient(runtime);
  assert.equal((await c.request({ type: 'ping' })).type, 'pong');
  assert.ok((await c.request({ type: 'analyze', position: 'startpos', depth: 3 })).bestMove);
});
