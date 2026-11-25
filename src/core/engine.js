import { ENGINE_NAME, VERSION, MATE, MATE_BOUND } from '../utils/constants.js';
import { createRng } from '../utils/rng.js';
import { DEFAULT_CONFIG } from '../config/defaults.js';
import { deepMerge, validateConfig } from '../utils/validation.js';
import { getRuleset, registerVariant } from '../rules/variants.js';
import { Position } from './position.js';
import { perft, divide } from './perft.js';
import { Evaluator } from '../evaluation/evaluate.js';
import { Searcher } from '../search/search.js';
import { TranspositionTable } from '../search/transposition-table.js';
import { StrengthManager } from '../strength/strength-manager.js';
import { PositionKnowledge } from '../knowledge/position-knowledge.js';
import { NullTablebase } from '../knowledge/tablebases.js';
import { describePosition } from '../analysis/diagnostics.js';
import { explainLine } from '../analysis/explain.js';

const OPTION_PATHS = {
  variant: 'variant', seed: 'seed', hash: 'search.hashMB', algorithm: 'search.algorithm',
  aspiration: 'search.aspiration', lmr: 'search.lmr', killers: 'search.killers', history: 'search.history',
  strengthlevel: 'strength.level', level: 'strength.level', maxdepth: 'strength.maxDepth',
  movetime: 'strength.timeLimit', timelimit: 'strength.timeLimit', nodelimit: 'strength.nodeLimit',
  randomness: 'strength.randomness', usebook: 'strength.useOpeningBook', useopeningbook: 'strength.useOpeningBook',
  usetablebase: 'strength.useTablebases', usetablebases: 'strength.useTablebases',
};

function coerce(v) {
  if (typeof v !== 'string') return v;
  const t = v.trim();
  if (t === 'true') return true;
  if (t === 'false') return false;
  if (t === 'null') return null;
  if (t !== '' && !Number.isNaN(Number(t))) return Number(t);
  return t;
}

/**
 * Public engine facade. Independent of any DOM, website or transport.
 *
 *   const engine = new LexiconEngine({ variant: 'american' });
 *   await engine.initialize();
 *   const r = await engine.analyze({ position: 'startpos', depth: 12 });
 */
export class LexiconEngine {
  constructor(options = {}) {
    this.config = deepMerge(DEFAULT_CONFIG, options.config || {});
    // `variant` may be an id or a ruleset definition; definitions are registered under their id.
    if (options.variant) this.config.variant = typeof options.variant === 'object' ? registerVariant(options.variant).id : options.variant;
    const errs = validateConfig(this.config);
    if (errs.length) throw new Error(`Invalid configuration: ${errs.join('; ')}`);
    this.knowledge = new PositionKnowledge({ book: options.book ?? null, tablebase: options.tablebase ?? new NullTablebase() });
    this.tt = new TranspositionTable(this.config.search.hashMB);
    this.strength = new StrengthManager(this.config.strength);
    this.rng = createRng(this.config.seed);
    this.last = null;
    this.busy = false;
    this._lastNoise = 0;
    this._setVariant(this.config.variant);
  }

  async initialize() { return this; }

  _setVariant(id) {
    this.rules = getRuleset(id);
    this.config.variant = this.rules.id;
    this.position = new Position(this.rules);
    this.evaluator = new Evaluator(this.rules, this.config.evaluation);
    this.searcher = new Searcher(this.evaluator, this.tt, this.config.search);
    this.tt.clear();
    this.last = null;
  }

  // ── position & moves ──

  /** @param spec 'startpos' | FEN string | {fen}  @param moves move strings to play afterwards */
  setPosition(spec = 'startpos', moves = []) {
    const fen = typeof spec === 'string' ? spec : spec && spec.fen ? spec.fen : 'startpos';
    const p = new Position(this.rules, fen);
    const errs = p.validate();
    if (errs.length) throw new Error(`Invalid position: ${errs.join('; ')}`);
    for (const m of moves) p.move(m);
    this.position = p;
    return this.getState();
  }

  getState() {
    return { fen: this.position.fen(), variant: this.rules.id, sideToMove: this.position.turn > 0 ? 'black' : 'white', status: this.position.status() };
  }

  getLegalMoves() { return this.position.moves().map((m) => m.toJSON()); }

  makeMove(move) { const m = this.position.move(move); return { move: m.toJSON(), ...this.getState() }; }

  undoMove() { const m = this.position.unmake(); return m ? { move: m.toJSON(), ...this.getState() } : null; }

  newGame() { this.position = new Position(this.rules); this.tt.clear(); this.last = null; this.rng = createRng(this.config.seed); return this.getState(); }

  // ── options ──

  /** Accepts friendly names ("Hash", "StrengthLevel", "Variant") or dotted config paths ("search.lmr"). */
  setOption(name, value) {
    const key = String(name).replace(/\s+/g, '').toLowerCase();
    const path = name.includes('.') ? name : OPTION_PATHS[key];
    if (!path) throw new Error(`Unknown option "${name}"`);
    const next = deepMerge(this.config, {});
    const parts = path.split('.');
    let o = next;
    for (let i = 0; i < parts.length - 1; i++) { o[parts[i]] = { ...o[parts[i]] }; o = o[parts[i]]; }
    o[parts[parts.length - 1]] = coerce(value);
    const errs = validateConfig(next);
    if (errs.length) throw new Error(`Invalid option: ${errs.join('; ')}`);
    const oldVariant = this.config.variant;
    this.config = next;
    this.searcher.cfg = next.search;
    this.strength.config = next.strength;
    this.evaluator.configure(next.evaluation);
    if (path === 'search.hashMB') this.tt.resize(next.search.hashMB);
    if (path === 'seed') this.rng = createRng(next.seed);
    if (path === 'variant' && getRuleset(next.variant).id !== oldVariant) this._setVariant(next.variant);
    return { name, value: coerce(value) };
  }

  // ── analysis ──

  stop() { this.searcher.stop(); }

  /**
   * @param {object} opts { position, moves, depth, movetime|timeLimit, nodes, infinite, multiPV, explain, diagnostics, onInfo }
   */
  async analyze(opts = {}) {
    if (this.busy) throw new Error('An analysis is already running; call stop() first');
    if (opts.position !== undefined) this.setPosition(opts.position, opts.moves || []);
    else if (opts.moves) for (const m of opts.moves) this.position.move(m);
    this.busy = true;
    try { return await this._analyze(opts); } finally { this.busy = false; }
  }

  async _analyze(opts) {
    const pos = this.position;
    const eff = this.strength.resolve(this.config.strength);
    const t0 = Date.now();
    const status = pos.status();
    const diag = opts.diagnostics === false ? null : describePosition(pos, this.evaluator);
    const base = { type: 'analysis', variant: this.rules.id, fen: pos.fen(), strength: { level: eff.level, name: eff.name }, diagnostics: diag, evaluation: this.evaluator.evaluateDetailed(pos) };

    if (status.over) {
      const score = status.winner === 'draw' ? 0 : -MATE;
      return this._store({ ...base, bestMove: null, move: null, score, depth: 0, nodes: 0, nps: 0, time: 0, principalVariation: [], candidates: [], source: 'terminal', status });
    }

    const legal = pos.moves();
    const legalNotations = legal.map((m) => m.notation);

    // 1. opening book
    if (eff.useOpeningBook && opts.useBook !== false) {
      const bm = this.knowledge.probeBook(pos, this.rng, legalNotations, eff.bookMaxPlies);
      if (bm) {
        const mv = legal.find((m) => m.notation === bm.move);
        return this._store({ ...base, bestMove: bm.move, move: mv.toJSON(), score: 0, depth: 0, nodes: 0, nps: 0, time: Date.now() - t0, principalVariation: [bm.move], candidates: [], source: 'book' });
      }
    }
    // 2. tablebase (only if every child position is covered)
    if (eff.useTablebases && opts.useTablebases !== false) {
      const tb = this.knowledge.tablebaseMove(pos);
      if (tb) {
        const score = tb.wdl === 'win' ? MATE - (tb.dtw ?? 0) : tb.wdl === 'loss' ? -MATE + (tb.dtw ?? 0) : 0;
        return this._store({ ...base, bestMove: tb.move.notation, move: tb.move.toJSON(), score, depth: 0, nodes: 0, nps: 0, time: Date.now() - t0, principalVariation: [tb.move.notation], candidates: [], source: 'tablebase', tablebase: { wdl: tb.wdl, dtw: tb.dtw } });
      }
    }

    // 3. search
    const explicit = opts.depth != null || opts.nodes != null || opts.infinite;
    let depth = opts.depth ?? eff.maxDepth;
    let movetime = opts.movetime ?? opts.timeLimit ?? (explicit ? 0 : eff.timeLimit);
    let nodes = opts.nodes ?? (explicit ? 0 : eff.nodeLimit);
    if (eff.artificialWeakness) {
      depth = Math.min(depth, eff.maxDepth);
      if (eff.timeLimit) movetime = movetime ? Math.min(movetime, eff.timeLimit) : eff.timeLimit;
      if (eff.nodeLimit) nodes = nodes ? Math.min(nodes, eff.nodeLimit) : eff.nodeLimit;
    }
    const weak = eff.artificialWeakness && eff.candidates > 1 && eff.margin > 0;
    const exactRoot = weak || opts.multiPV > 1;

    this.evaluator.setNoise(eff.evalNoise, this.config.seed);
    if (eff.evalNoise > 0 || this._lastNoise > 0) this.tt.clear();
    this._lastNoise = eff.evalNoise;

    const res = await this.searcher.search(pos.clone(), { depth, movetime, nodes, exactRoot, analysis: !!(opts.analysis || opts.multiPV > 1 || explicit) }, opts.onInfo);
    this.evaluator.setNoise(0);

    let chosen = res.move, pv = res.pv, score = res.score;
    const cands = [...res.candidates].sort((a, b) => b.score - a.score);
    if (weak && cands.length > 1) {
      const pick = this.strength.select(cands, this.rng, eff);
      if (pick && pick.move !== res.move) { chosen = pick.move; pv = [pick.move]; score = pick.score; }
    }
    const out = {
      ...base, bestMove: chosen ? chosen.notation : null, move: chosen ? chosen.toJSON() : null, score,
      mate: Math.abs(score) > MATE_BOUND ? Math.sign(score) * Math.ceil((MATE - Math.abs(score)) / 2) : null,
      depth: res.depth, selDepth: res.selDepth, nodes: res.nodes, nps: res.nps, time: res.time,
      principalVariation: pv.map((m) => m.notation),
      candidates: cands.map((c) => ({ move: c.move.notation, score: c.score })),
      stopReason: res.stopReason, source: 'search',
    };
    if (opts.explain && chosen) out.explanation = explainLine(pos, pv, this.evaluator);
    return this._store(out);
  }

  _store(r) { this.last = r; return r; }

  getEvaluation() { return this.evaluator.evaluateDetailed(this.position); }
  getPrincipalVariation() { return this.last ? this.last.principalVariation : []; }

  // ── utilities ──

  perft(depth) { return perft(this.position.clone(), depth); }
  divide(depth) { return divide(this.position.clone(), depth); }
  info() { return { name: ENGINE_NAME, version: VERSION, variant: this.rules.id }; }
}
