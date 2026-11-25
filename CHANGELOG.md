# Changelog

## 0.1.0
- Rule-driven move generation for American, International, Russian, Brazilian and Pool profiles, plus custom rulesets.
- Position with incremental Zobrist hashing, FEN-like serialization, make/unmake, draw rules.
- Search: iterative deepening, negamax/PVS (or plain alpha-beta), typed-array transposition table, killers, history,
  aspiration windows, forced-capture quiescence, single-reply extension, optional LMR (off, unvalidated).
- Modular evaluation with explainable breakdown and phase-dependent weights.
- Strength manager (levels 1-9 + custom), opening-book and tablebase interfaces (no data shipped).
- UCI-inspired text protocol and JSON protocol; Node, Web Worker, userscript and extension adapters.
- node:test suite, perft/search benchmarks, seeded self-play match runner.
