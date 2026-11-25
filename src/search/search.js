import { INF, MATE, MATE_BOUND, MAX_PLY } from '../utils/constants.js';
import { moveKey } from '../core/move.js';
import { TT_EXACT, TT_LOWER, TT_UPPER } from './transposition-table.js';
import { MoveOrderer } from './move-ordering.js';
import { TimeManager } from './time-manager.js';

const yieldToEventLoop = () => new Promise((r) => (typeof setImmediate === 'function' ? setImmediate(r) : setTimeout(r, 0)));

/**
 * Negamax alpha-beta with PVS, transposition table, killers/history, a forced-capture
 * quiescence search, aspiration windows and iterative deepening.
 * Scores are centipawns from the side to move's view; |score| > MATE_BOUND means a forced result.
 */
export class Searcher {
  constructor(evaluator, tt, config) {
    this.ev = evaluator; this.tt = tt; this.cfg = config;
    this.orderer = null;
    this.stopRequested = false;
    this.stopFlag = null; // optional Int32Array on a SharedArrayBuffer for cross-thread stop
    this.pvTable = Array.from({ length: MAX_PLY + 2 }, () => new Array(MAX_PLY + 2));
    this.pvLen = new Int32Array(MAX_PLY + 2);
  }

  stop() { this.stopRequested = true; }

  _checkLimits() {
    if (this.stopRequested || (this.stopFlag && Atomics.load(this.stopFlag, 0) !== 0)) this.stopped = true;
    else if (this.timer.hardExpired()) this.stopped = true;
    else if (this.nodeLimit && this.nodes >= this.nodeLimit) this.stopped = true;
  }

  /**
   * @param pos     Position (mutated during search, restored afterwards)
   * @param limits  { depth, movetime, nodes, exactRoot, analysis }
   * @param onInfo  called after each completed iteration
   */
  async search(pos, limits = {}, onInfo = null) {
    const cfg = this.cfg;
    this.pos = pos;
    this.timer = new TimeManager(limits);
    this.nodeLimit = limits.nodes || 0;
    this.nodes = 0; this.selDepth = 0; this.stopped = false; this.stopRequested = false;
    if (!this.orderer || this.orderer.n !== pos.geo.n) this.orderer = new MoveOrderer(pos.geo.n, { killers: cfg.killers, history: cfg.history });
    else { this.orderer.useKillers = cfg.killers; this.orderer.useHistory = cfg.history; }
    this.orderer.reset();
    this.tt.newSearch();

    const maxDepth = Math.max(1, Math.min(limits.depth || cfg.maxDepth, MAX_PLY - 8));
    this.rootDepth = 1;
    const rootMoves = pos.moves();
    if (!rootMoves.length) return this._result(null, -MATE, 0, [], [], 'no legal moves');
    if (rootMoves.length === 1 && !limits.analysis) {
      const s0 = this.ev.evaluate(pos); // static score only: no search was needed
      return this._result(rootMoves[0], s0, 0, [rootMoves[0]], [{ move: rootMoves[0], score: s0 }], 'single legal move');
    }

    this.orderer.order(rootMoves, 0, 0, pos.turn, pos.geo);
    let best = { move: rootMoves[0], score: 0, pv: [rootMoves[0]], candidates: [] };
    let completed = 0, prevScore = 0, lastYield = this.timer.now(), reason = 'depth limit';

    for (let depth = 1; depth <= maxDepth; depth++) {
      if (depth > 1 && !this.timer.mayStartIteration()) { reason = 'time'; break; }
      if (this.timer.now() - lastYield > 25) { await yieldToEventLoop(); lastYield = this.timer.now(); }
      if (this.stopRequested) { this.stopped = true; }
      if (this.stopped) { reason = 'stopped'; break; }
      this.rootDepth = depth;

      let alpha = -INF, beta = INF, delta = cfg.aspirationWindow;
      if (cfg.aspiration && depth >= 5 && !limits.exactRoot && Math.abs(prevScore) < MATE_BOUND) { alpha = prevScore - delta; beta = prevScore + delta; }

      let res;
      for (;;) {
        res = this._root(rootMoves, depth, alpha, beta, !!limits.exactRoot);
        if (this.stopped) break;
        if (res.score <= alpha && alpha > -INF) { alpha = delta > 800 ? -INF : alpha - delta; delta *= 2; }
        else if (res.score >= beta && beta < INF) { beta = delta > 800 ? INF : beta + delta; delta *= 2; }
        else break;
      }
      if (this.stopped) { reason = this.stopRequested ? 'stopped' : this.nodeLimit && this.nodes >= this.nodeLimit ? 'node limit' : 'time'; break; }

      best = res; completed = depth; prevScore = res.score;
      if (limits.exactRoot) rootMoves.sort((a, b) => (res.scoreOf.get(moveKey(b)) ?? -INF) - (res.scoreOf.get(moveKey(a)) ?? -INF));
      else { const i = rootMoves.indexOf(res.move); if (i > 0) { rootMoves.splice(i, 1); rootMoves.unshift(res.move); } }
      this.tt.store(pos.h1, pos.h2, depth, res.score, TT_EXACT, moveKey(res.move));

      if (onInfo) onInfo(this._info(depth, res));
      if (Math.abs(res.score) > MATE_BOUND) { reason = 'forced result found'; break; }
    }
    return this._result(best.move, best.score, completed, best.pv, best.candidates, reason);
  }

  _info(depth, res) {
    const time = this.timer.elapsed();
    return {
      depth, selDepth: this.selDepth, score: res.score, nodes: this.nodes, time: Math.round(time),
      nps: time > 0 ? Math.round((this.nodes / time) * 1000) : 0, hashfull: this.tt.hashfull(),
      pv: res.pv.map((m) => m.notation),
    };
  }

  _result(move, score, depth, pv, candidates, reason) {
    const time = this.timer.elapsed();
    return {
      move, score, depth, selDepth: this.selDepth, nodes: this.nodes, time: Math.round(time),
      nps: time > 0 ? Math.round((this.nodes / time) * 1000) : 0, pv, candidates, stopReason: reason,
    };
  }

  _root(moves, depth, alpha, beta, exact) {
    const pos = this.pos, usePVS = this.cfg.algorithm === 'pvs';
    let bestScore = -INF, bestMove = moves[0];
    const candidates = [], scoreOf = new Map();
    this.pvLen[0] = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      let score;
      if (exact) score = -this._negamax(depth - 1, -INF, INF, 1, true);
      else if (i === 0 || !usePVS) score = -this._negamax(depth - 1, -beta, -alpha, 1, true);
      else {
        score = -this._negamax(depth - 1, -alpha - 1, -alpha, 1, false);
        if (score > alpha && score < beta) score = -this._negamax(depth - 1, -beta, -alpha, 1, true);
      }
      pos.unmake();
      if (this.stopped) break;
      candidates.push({ move: m, score });
      scoreOf.set(moveKey(m), score);
      if (score > bestScore) {
        bestScore = score; bestMove = m;
        if (score > alpha) { alpha = score; this._setPV(0, m); }
      }
    }
    const pv = [];
    for (let i = 0; i < this.pvLen[0]; i++) pv.push(this.pvTable[0][i]);
    if (!pv.length) pv.push(bestMove);
    return { move: bestMove, score: bestScore, pv, candidates, scoreOf };
  }

  _setPV(ply, m) {
    const row = this.pvTable[ply], next = this.pvTable[ply + 1];
    row[ply] = m;
    const end = this.pvLen[ply + 1];
    for (let i = ply + 1; i < end; i++) row[i] = next[i];
    this.pvLen[ply] = Math.max(end, ply + 1);
  }

  _negamax(depth, alpha, beta, ply, isPV) {
    const pos = this.pos;
    this.pvLen[ply] = ply;
    if ((++this.nodes & 1023) === 0) this._checkLimits();
    if (this.stopped) return 0;
    if (ply > this.selDepth) this.selDepth = ply;
    if (ply >= MAX_PLY - 2) return this.ev.evaluate(pos);
    if (pos.isDrawnForSearch()) return 0;

    // mate-distance pruning
    if (alpha < -MATE + ply) alpha = -MATE + ply;
    if (beta > MATE - ply - 1) beta = MATE - ply - 1;
    if (alpha >= beta) return alpha;

    const moves = pos.moves();
    if (moves.length === 0) return -MATE + ply;

    if (depth <= 0) {
      if (moves[0].caps.length === 0) return this.ev.evaluate(pos);
      return this._quiesce(moves, alpha, beta, ply, 0);
    }
    if (moves.length === 1 && this.cfg.extensions && this.cfg.extensions.singleReply && ply < this.rootDepth * 2) depth++;

    const h1 = pos.h1, h2 = pos.h2, tt = this.tt;
    let ttMove = 0;
    const ti = tt.probe(h1, h2);
    if (ti >= 0) {
      ttMove = tt.move[ti];
      if (!isPV && tt.depth[ti] >= depth) {
        let s = tt.score[ti];
        if (s > MATE_BOUND) s -= ply; else if (s < -MATE_BOUND) s += ply;
        const f = tt.flag[ti];
        if (f === TT_EXACT) return s;
        if (f === TT_LOWER && s >= beta) return s;
        if (f === TT_UPPER && s <= alpha) return s;
      }
    }

    this.orderer.order(moves, ply, ttMove, pos.turn, pos.geo);
    const alpha0 = alpha, color = pos.turn, usePVS = this.cfg.algorithm === 'pvs';
    const lmr = this.cfg.lmr;
    let best = -INF, bestKey = 0;
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      let score, reduced = false;
      if (i === 0 || !usePVS) score = -this._negamax(depth - 1, -beta, -alpha, ply + 1, isPV);
      else {
        let d = depth - 1;
        if (lmr && depth >= this.cfg.lmrMinDepth && i >= this.cfg.lmrMoveThreshold && !m.caps.length && !m.promotes) { d--; reduced = true; }
        score = -this._negamax(d, -alpha - 1, -alpha, ply + 1, false);
        if (reduced && score > alpha) score = -this._negamax(depth - 1, -alpha - 1, -alpha, ply + 1, false);
        if (isPV && score > alpha && score < beta) score = -this._negamax(depth - 1, -beta, -alpha, ply + 1, true);
      }
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) {
        best = score; bestKey = moveKey(m);
        if (score > alpha) {
          alpha = score;
          this._setPV(ply, m);
          if (alpha >= beta) { this.orderer.recordCutoff(m, ply, depth, color); break; }
        }
      }
    }

    let s = best;
    if (s > MATE_BOUND) s += ply; else if (s < -MATE_BOUND) s -= ply;
    tt.store(h1, h2, depth, s, best <= alpha0 ? TT_UPPER : best >= beta ? TT_LOWER : TT_EXACT, bestKey);
    return best;
  }

  /**
   * Checkers quiescence. With mandatory capture there is no "stand pat": we keep searching until the
   * side to move has no capture. With optional capture (forceJumps=false) the static score is a floor.
   */
  _quiesce(moves, alpha, beta, ply, qd) {
    const pos = this.pos;
    this.pvLen[ply] = ply;
    if ((++this.nodes & 1023) === 0) this._checkLimits();
    if (this.stopped) return 0;
    if (ply > this.selDepth) this.selDepth = ply;
    if (qd >= this.cfg.maxQuiescenceDepth || ply >= MAX_PLY - 2) return this.ev.evaluate(pos);

    let best = -INF;
    if (!pos.rules.mandatoryCapture) {
      // Captures are optional, so standing pat is legal: search captures only, with the static score as a floor.
      const stand = this.ev.evaluate(pos);
      if (stand >= beta) return stand;
      if (stand > alpha) alpha = stand;
      best = stand;
      moves = moves.filter((m) => m.caps.length);
    }
    moves.sort((a, b) => b.caps.length - a.caps.length);
    for (let i = 0; i < moves.length; i++) {
      const m = moves[i];
      pos.make(m);
      const next = pos.moves();
      let score;
      if (next.length === 0) score = MATE - ply - 1;
      else if (next[0].caps.length) score = -this._quiesce(next, -beta, -alpha, ply + 1, qd + 1);
      else score = -this.ev.evaluate(pos);
      pos.unmake();
      if (this.stopped) return 0;
      if (score > best) { best = score; if (score > alpha) { alpha = score; if (alpha >= beta) break; } }
    }
    return best;
  }
}
