/** Central defaults. These are JSON-compatible; `npm run export-json` writes them to config/*.json. */
export const DEFAULT_CONFIG = {
  variant: 'american',
  seed: 1,
  search: {
    hashMB: 16,               // transposition table memory
    maxDepth: 64,
    algorithm: 'pvs',         // 'pvs' | 'alphabeta'
    aspiration: true,
    aspirationWindow: 40,     // centipawns
    killers: true,
    history: true,
    lmr: false,               // Late Move Reductions: implemented but NOT validated for checkers, so off by default
    lmrMinDepth: 3,
    lmrMoveThreshold: 4,
    maxQuiescenceDepth: 24,   // forced-capture extension limit at the search horizon
    extensions: { singleReply: true },
    threads: 1,               // only 1 is supported
  },
  evaluation: {
    tempo: 4,
    kingRatio: null,          // king value in men; null = 1.6 (short kings) or 3.0 (flying kings)
    // Weights are hand-picked, NOT tuned. Each feature is (black - white) in feature units,
    // multiplied by a weight that is interpolated between `opening` and `endgame` by game phase.
    features: {
      material:        { enabled: true, opening: 100, endgame: 100 },
      advancement:     { enabled: true, opening: 3,   endgame: 5 },
      center:          { enabled: true, opening: 2,   endgame: 1 },
      backRank:        { enabled: true, opening: 8,   endgame: 0 },
      mobility:        { enabled: true, opening: 2,   endgame: 4 },
      kingActivity:    { enabled: true, opening: 3,   endgame: 6 },
      diagonals:       { enabled: true, opening: 0,   endgame: 8 },
      formation:       { enabled: true, opening: 3,   endgame: 1 },
      promotionThreat: { enabled: true, opening: 10,  endgame: 25 },
      endgame:         { enabled: true, opening: 1,   endgame: 1 },
    },
  },
  strength: {
    level: 9,                 // 1..9, or 'custom'. Presets live in src/strength/presets.js
    useOpeningBook: true,
    useTablebases: true,
    // Optional explicit overrides (they win over the preset): maxDepth, timeLimit (ms), nodeLimit,
    // bookMaxPlies, randomness (0..1, scales the artificial weakness of levels 1-8).
    // With level 'custom' you may also set evalNoise, candidates, margin, temperature.
  },
  browser: { useWorker: true, workerUrl: null },
};
