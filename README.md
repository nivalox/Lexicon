# Lexicon

A modular checkers / draughts engine in plain JavaScript (ES2020+, no runtime dependencies).
The core has no DOM or site dependencies and runs in Node, Web Workers, userscripts and extensions.

> **Status: v0.1, an engine foundation, not "Stockfish for checkers" yet.** See [What is and isn't done](#what-is-and-isnt-done).

## Install & run

```bash
node --version            # >= 18
npm test                  # node:test suite, no dependencies
npm start                 # UCI-inspired text protocol on stdin/stdout (also accepts one-line JSON)
npm run perft             # move-generation speed / correctness for every variant
npm run bench             # fixed-depth search benchmark
npm run selfplay -- --games 20 --depth 6 --seed 1
npm run export-json       # regenerate rules/*.json, config/*.json, books/*.json from the JS defaults
npm install && npm run build   # optional: standalone browser bundles in dist/ (needs esbuild)
```

## Quick start

```js
import { LexiconEngine } from './src/index.js';

const engine = new LexiconEngine({ variant: 'american' });
await engine.initialize();

const result = await engine.analyze({ position: 'startpos', depth: 18, movetime: 3000, explain: true });
console.log(result.bestMove, result.score, result.principalVariation, result.explanation.reasons);
```

API: `setPosition()`, `getLegalMoves()`, `makeMove()`, `undoMove()`, `analyze()`, `stop()`, `newGame()`,
`setOption()`, `getEvaluation()`, `getPrincipalVariation()`, `perft()`.

**Scores** are centipawns (100 ≈ one man) from the side to move's view. `|score| > 99,488` means a forced result;
`result.mate` gives the distance in moves. **Positions** use a PDN-style FEN: `B:W21,22,K23:B1,2,K3`
(side to move : White pieces : Black pieces; `K` = king). **Squares** are numbered left to right, top to bottom
(American: Black on 1–12 at the top, White on 21–32). Moves: `11-15` (step), `22x15x8` (captures).

## Variants

`american` (default), `international` (10x10), `russian`, `brazilian`, `pool`, or your own:

```js
import { registerVariant } from './src/index.js';
registerVariant({ id: 'mini6', size: 6, startRows: 2, flyingKings: false });   // everything else defaults
const e = new LexiconEngine({ variant: 'mini6' });
```

Ruleset fields (see `src/rules/ruleset.js` and `rules/*.json`): `size`, `startRows`, `firstMove`, `menCaptureBackward`,
`flyingKings`, `mandatoryCapture`, `majorityCapture`, `promotionDuringCapture` (`ends` | `continuesAsKing` | `continuesAsMan`),
`noProgressPlies`, `kingsOnlyPlies`, `repetitionCount`. Boards up to 10x10 are supported. Only rules where captured pieces
are removed *after* the sequence (all five profiles) are implemented; the Turkish strike is rejected by validation.

## Strength

`setOption('StrengthLevel', 1..9)` or `config.strength.level`. Levels 1–8 are presets (depth, time, node budget, deterministic
evaluation noise, and sampling among near-best root moves); level 9 disables all artificial weakness. They are **presets, not Elo
ratings**. Explicit fields (`maxDepth`, `timeLimit`, `nodeLimit`, `randomness` 0–1) override a preset; `level: 'custom'` additionally
accepts `evalNoise`, `candidates`, `margin`, `temperature`. Weak play never throws away a forced win.

## Protocols

Text (`bin/lexicon.js`): `uci`, `isready`, `ucinewgame`, `position startpos|fen <FEN> [moves ...]`,
`go [depth N] [movetime MS] [nodes N] [multipv N] [explain] [infinite]`, `stop`, `setoption name <N> value <V>`, `d`, `eval`,
`perft N`, `bench`, `help`, `quit`. Output: `info depth 12 seldepth 14 score cp 145 nodes 450000 nps 380000 time 1200 hashfull 12 pv 9-13 22-18` and `bestmove 9-13`.

JSON (one object per line, or `engine`-level via `createJSONHandler`):

```json
{"type":"analyze","position":"startpos","depth":20,"timeLimit":3000}
```
Other types: `ping`, `setPosition`, `legalMoves`, `makeMove`, `undoMove`, `newGame`, `setOption`, `evaluate`, `pv`, `perft`, `stop`.

## Browser, userscripts, extensions

- `src/adapters/browser/`: `worker.js` (Web Worker entry) and `BrowserEngine`, the same API as `LexiconEngine` but every call is a Promise.
  `createEngine()` from `api.js` wires them up; see `examples/browser.html` (serve over HTTP).
- `src/adapters/userscript/adapter.js`: site-agnostic `matrixToFen()`, `moveToCells()` and `UserscriptBridge`. You write the
  page-reading function; the engine never touches the DOM. Template: `examples/userscript.js`.
- `src/adapters/extension/adapter.js`: `registerEngineHost()` / `ExtensionClient` over `runtime.sendMessage`.
- `npm run build` bundles `dist/lexicon.browser.js`, `dist/lexicon.worker.js`, `dist/lexicon.userscript-adapter.js`.

Searching is cooperative: the search yields to the event loop between iterations, so `stop()` is honoured between iterations
(and the time/node limits are enforced inside them). Pass a `SharedArrayBuffer`-backed `searcher.stopFlag` for instant cross-thread stop.

## Configuration

Defaults live in `src/config/defaults.js` (mirrored in `config/*.json`). `setOption('search.lmr', true)`-style dotted paths and
friendly names (`Hash`, `StrengthLevel`, `Variant`, …) are validated (`validateConfig`) before being applied; a rejected option changes nothing.

## Architecture

```
src/core        board geometry, Position (make/unmake, hash, FEN), Move, move generator, perft, engine facade
src/rules       ruleset schema + variant profiles          src/search      PVS/alpha-beta, TT, ordering, time manager
src/evaluation  modular features + breakdown               src/strength    presets, candidate selection
src/knowledge   opening book, tablebase interface          src/analysis    diagnostics, explanations
src/protocol    text + JSON protocols                       src/adapters    node, browser, userscript, extension
```

Board: a mailbox `Int8Array` of size² cells with precomputed neighbour tables, generic for any size ≤ 10 (a packed 32-square
bitboard would be faster for 8x8 only and was deliberately not used so every variant shares one code path).

## Testing & benchmarking

`npm test` covers movement/capture rules per variant, perft (American 1–7 and International 1–5 match published counts),
FEN/hash/undo round trips over random games for every variant, search correctness (PVS ≡ alpha-beta, mirror symmetry,
mate finding, stop/time/node limits), evaluation symmetry, strength, book/tablebase, both protocols and the adapters.
Self-play (`benchmarks/selfplay.js`) plays colour-swapped pairs from seeded openings and reports a 95% interval; do not claim
an improvement unless that interval excludes 0.5.

## What is and isn't done

Done and tested: everything above. Measured on the dev machine (single thread, Node): ~0.6M perft nodes/s (American), ~250–350k search nodes/s.

Not done / caveats:
- **Strength is unmeasured.** Evaluation weights are hand-picked, not tuned; no Elo claims are made. Level ordering was only sanity-checked.
- **Only American rules are verified** (perft matches published numbers; International perft depth 1–5 also matches). Russian, Brazilian and
  Pool profiles are best-effort: check first mover, draw rules and promotion-mid-capture against an official rulebook (`verified: false`). Russian/Brazilian perft values in the tests are engine-reported regression values, not independently verified.
- Russian/Brazilian use numeric squares, not `a1`–`h8`.
- **No opening data and no endgame data are shipped.** The book/tablebase code paths are tested with synthetic data only; no endgame database generator exists yet.
- Single-threaded only (`search.threads` must be 1). Late Move Reductions are implemented but unvalidated and off by default.
- The browser worker, the extension adapter against a real browser, and `npm run build` have not been exercised in a real browser/with esbuild here; the adapters are covered by Node tests with fakes.
- Not implemented: Turkish strike, incremental evaluation, king-vs-king theory, book/eval auto-tuning, a GUI.
