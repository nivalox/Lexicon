import test from 'node:test';
import assert from 'node:assert/strict';
import { LexiconEngine } from '../../src/core/engine.js';
import { Position } from '../../src/core/position.js';
import { OpeningBook } from '../../src/knowledge/opening-book.js';
import { MapTablebase, NullTablebase, canonicalKey } from '../../src/knowledge/tablebases.js';
import { createRng } from '../../src/utils/rng.js';
import { MATE_BOUND } from '../../src/utils/constants.js';

test('an engine with no book and no tablebase works normally', async () => {
  const e = new LexiconEngine();
  const r = await e.analyze({ position: 'startpos', depth: 4, diagnostics: false });
  assert.equal(r.source, 'search');
});

test('book: JSON round-trip, weighted probe, only legal moves are returned', () => {
  const p = new Position('american');
  const b = new OpeningBook('american');
  b.add(p.fen(), '11-15', 100);
  b.add(p.fen(), '99-99', 500); // not legal: must never be returned
  const copy = OpeningBook.fromJSON(JSON.parse(JSON.stringify(b.toJSON())));
  assert.equal(copy.size, 1);
  const m = copy.probe(p, createRng(1), p.moves().map((x) => x.notation));
  assert.equal(m.move, '11-15');
  assert.equal(new OpeningBook('american').probe(p, createRng(1), ['11-15']), null);
  assert.throws(() => OpeningBook.fromJSON({ format: 'nope' }));
});

test('book: learning from a game records results from the mover\'s point of view', () => {
  const b = new OpeningBook('american');
  b.learnGame(new Position('american'), ['11-15', '23-19'], 'black');
  const e1 = b.entries.get(new Position('american').fen()).moves[0];
  assert.deepEqual([e1.wins, e1.draws, e1.losses], [1, 0, 0]);
  const p = new Position('american'); p.move('11-15');
  const e2 = b.entries.get(p.fen()).moves[0];
  assert.deepEqual([e2.wins, e2.draws, e2.losses], [0, 0, 1]);
  assert.match(b.source, /experimental/);
});

test('engine plays a book move when the position is in the book', async () => {
  const p = new Position('american');
  const b = new OpeningBook('american');
  b.add(p.fen(), '9-13', 100);
  const e = new LexiconEngine({ book: b });
  const r = await e.analyze({ position: 'startpos', depth: 4 });
  assert.equal(r.bestMove, '9-13'); assert.equal(r.source, 'book');
  e.setOption('UseBook', 'false');
  assert.equal((await e.analyze({ depth: 3, diagnostics: false })).source, 'search');
});

test('a book for another variant is ignored', async () => {
  const b = new OpeningBook('russian');
  b.add(new Position('russian').fen(), '22-18', 100);
  const e = new LexiconEngine({ variant: 'american', book: b });
  assert.equal((await e.analyze({ position: 'startpos', depth: 2, diagnostics: false })).source, 'search');
});

test('canonical keys are shared by a position and its colour-flipped mirror', () => {
  const p = new Position('american', 'B:WK4,12:BK29,21');
  assert.equal(canonicalKey(p), canonicalKey(p.flipped()));
});

test('tablebase: unknown positions are never reported as solved', async () => {
  assert.equal(new NullTablebase().probe(new Position('american')), null);
  const tb = new MapTablebase('american', {}, 2);
  assert.equal(tb.probe(new Position('american', 'B:WK4:BK30')), null);
  const e = new LexiconEngine({ tablebase: tb });
  const r = await e.analyze({ position: 'B:WK4:BK30', depth: 3, diagnostics: false });
  assert.equal(r.source, 'search');
});

test('tablebase: used only when every child position is covered', async () => {
  const start = new Position('american', 'B:WK4:BK30');
  const entries = {};
  const moves = start.moves();
  moves.forEach((m, i) => {
    start.make(m);
    entries[canonicalKey(start)] = { wdl: i === 0 ? 'loss' : 'draw', dtw: 7 }; // white to move loses after moves[0]
    start.unmake();
  });
  const tb = MapTablebase.fromJSON({ format: 'lexicon-tb-1', variant: 'american', maxPieces: 2, entries });
  const e = new LexiconEngine({ tablebase: tb });
  const r = await e.analyze({ position: 'B:WK4:BK30', depth: 3, diagnostics: false });
  assert.equal(r.source, 'tablebase');
  assert.equal(r.bestMove, moves[0].notation);
  assert.equal(r.tablebase.wdl, 'win');
  assert.ok(r.score > MATE_BOUND);
  // drop one child entry -> falls back to search
  delete entries[Object.keys(entries)[1]];
  const e2 = new LexiconEngine({ tablebase: MapTablebase.fromJSON({ format: 'lexicon-tb-1', variant: 'american', maxPieces: 2, entries }) });
  assert.equal((await e2.analyze({ position: 'B:WK4:BK30', depth: 3, diagnostics: false })).source, 'search');
});
