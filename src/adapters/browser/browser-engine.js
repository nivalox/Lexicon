/**
 * Main-thread client for the Lexicon worker. Same API as LexiconEngine, but every call returns a Promise
 * and analysis never blocks the page.
 */
export class BrowserEngine {
  /** @param {{workerUrl?: string|URL, options?: object}} [cfg] options are passed to LexiconEngine inside the worker */
  constructor({ workerUrl, options } = {}) {
    this.workerUrl = workerUrl || new URL('./worker.js', import.meta.url);
    this.options = options || {};
    this.worker = null; this.nextId = 1; this.pending = new Map(); this.lastPV = [];
  }

  async initialize() {
    if (this.worker) return this;
    this.worker = new Worker(this.workerUrl, { type: 'module' });
    this.worker.onmessage = (e) => {
      const { id, type, result, info, error } = e.data;
      const p = this.pending.get(id);
      if (!p) return;
      if (type === 'info') { if (p.onInfo) p.onInfo(info); return; }
      this.pending.delete(id);
      if (type === 'error') p.reject(new Error(error)); else p.resolve(result);
    };
    this.worker.onerror = (e) => { for (const p of this.pending.values()) p.reject(new Error(e.message)); this.pending.clear(); };
    await this._call({ type: 'configure', options: this.options });
    return this;
  }

  _call(req, onInfo) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject, onInfo });
      this.worker.postMessage({ ...req, id });
    });
  }

  async analyze(opts = {}) {
    const { onInfo, ...req } = opts;
    const r = await this._call({ type: 'analyze', ...req }, onInfo);
    this.lastPV = r.principalVariation || [];
    return r;
  }
  stop() { return this._call({ type: 'stop' }); }
  setPosition(position = 'startpos', moves = []) { return this._call({ type: 'setPosition', position, moves }); }
  async getLegalMoves() { return (await this._call({ type: 'legalMoves' })).moves; }
  makeMove(move) { return this._call({ type: 'makeMove', move }); }
  undoMove() { return this._call({ type: 'undoMove' }); }
  newGame() { return this._call({ type: 'newGame' }); }
  setOption(name, value) { return this._call({ type: 'setOption', name, value }); }
  async getEvaluation() { return (await this._call({ type: 'evaluate' })).evaluation; }
  async getPrincipalVariation() { return (await this._call({ type: 'pv' })).principalVariation; }
  perft(depth) { return this._call({ type: 'perft', depth }); }
  terminate() { if (this.worker) this.worker.terminate(); this.worker = null; this.pending.clear(); }
}
