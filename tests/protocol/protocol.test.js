import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { UciProtocol, createJSONHandler } from '../../src/protocol/protocol.js';

async function session(lines, cfg = { config: { strength: { useOpeningBook: false } } }) {
  const out = [];
  const e = new LexiconEngine(cfg), p = new UciProtocol(e, (s) => out.push(s));
  for (const l of lines) { await p.handleLine(l); await p.idle(); }
  return out;
}

test('uci handshake, isready, options', async () => {
  const out = await session(['uci', 'isready']);
  assert.ok(out.includes('uciok')); assert.ok(out.includes('readyok'));
  assert.ok(out.some((l) => /^id name Lexicon/.test(l)));
  assert.ok(out.some((l) => /option name StrengthLevel/.test(l)));
});

test('position + go prints info lines and a legal bestmove', async () => {
  const out = await session(['position startpos moves 11-15 23-19', 'go depth 5']);
  const best = out.find((l) => l.startsWith('bestmove')).split(' ')[1];
  const e = new LexiconEngine(); e.setPosition('startpos', ['11-15', '23-19']);
  assert.ok(e.getLegalMoves().some((m) => m.notation === best));
  assert.ok(out.some((l) => /^info depth 5 .* pv /.test(l)));
});

test('position fen, d, eval, perft', async () => {
  const out = await session(['position fen B:W15:B1,10', 'd', 'eval', 'perft 1']);
  assert.ok(out.some((l) => l.startsWith('Fen: B:W15:B1,10')));
  assert.ok(out.some((l) => /^\s+total\s+-?\d+/.test(l)));
  assert.ok(out.includes('10x19: 1'));
});

test('setoption changes behaviour; bad options report an error and change nothing', async () => {
  const out = await session(['setoption name StrengthLevel value 2', 'setoption name Nonsense value 1', 'setoption name Hash value 0', 'position startpos', 'go']);
  assert.ok(out.filter((l) => l.startsWith('info string error')).length === 2);
  const m = out.find((l) => l.startsWith('info depth'));
  assert.ok(!m || Number(m.split(' ')[2]) <= 3);
  assert.ok(out.some((l) => l.startsWith('bestmove')));
});

test('illegal move in position is reported, engine stays usable', async () => {
  const out = await session(['position startpos moves 1-5', 'isready']);
  assert.ok(out.some((l) => /error/.test(l))); assert.ok(out.includes('readyok'));
});

test('quit returns false', async () => {
  const p = new UciProtocol(new LexiconEngine(), () => {});
  assert.equal(await p.handleLine('quit'), false);
});

test('JSON protocol: analyze, legal moves, errors', async () => {
  const e = new LexiconEngine({ config: { strength: { useOpeningBook: false } } });
  const h = createJSONHandler(e);
  const r = await h.handle({ type: 'analyze', position: 'startpos', depth: 6 });
  assert.equal(r.type, 'analysis');
  assert.ok(r.bestMove && Array.isArray(r.principalVariation) && r.nodes > 0 && typeof r.score === 'number');
  const l = await h.handle({ type: 'legalMoves' });
  assert.equal(l.moves.length, 7);
  assert.equal((await h.handle({ type: 'makeMove', move: '11-15' })).move.notation, '11-15');
  assert.equal((await h.handle({ type: 'makeMove', move: '1-2' })).type, 'error');
  assert.equal((await h.handle({ type: 'wat' })).type, 'error');
  const infos = [];
  await h.handle({ type: 'analyze', depth: 4 }, (i) => infos.push(i));
  assert.ok(infos.length >= 1 && infos[0].type === 'info');
});

test('JSON protocol: setOption variant switches rules', async () => {
  const e = new LexiconEngine();
  const h = createJSONHandler(e);
  await h.handle({ type: 'setOption', name: 'Variant', value: 'international' });
  assert.equal((await h.handle({ type: 'legalMoves' })).moves.length, 9);
});
